import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // Visible on every response so a deploy can be verified without credentials.
  'X-Webhook-Build': 'silent-2026-11-06',
};

// KVP Marketing sends WhatsApp through journeys and templates only. This webhook is the QuickApp
// field-sales retailer bot (greeting + Place Order template, retailer assistant, "not registered"
// replies), which must NOT answer messages sent to the KVP number. Keep false; the old code below
// stays in place, unreachable, so it can be switched back on deliberately.
const KVP_AUTO_REPLIES_ENABLED = false;

const MEMORY_TTL = 30 * 60 * 1000; // 30 minutes
const CONTEXT_TTL = 30 * 60 * 1000; // 30 minutes for conversation context
const MAX_HISTORY = 10; // 5 exchanges

function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

// Exact-match confirm/cancel words so phrases like "I know the rate" never act on a pending order.
const CONFIRM_WORDS = new Set(['yes', 'y', 'confirm', 'ok', 'okay', 'haan', 'han', 'ha', 'proceed', 'yes confirm', 'confirm order']);
const CANCEL_WORDS = new Set(['no', 'n', 'cancel', 'nahi', 'nah', 'discard', 'cancel order']);

function normalizeReply(message: string): string {
  return message.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

// ── Session Management ──────────────────────────────────────────────
interface Session {
  id: string;
  phone_number: string;
  state: string;
  retailer_id: string | null;
  retailer_name: string | null;
  owner_id: string | null;
  beat_id: string | null;
  territory_id: string | null;
  pending_items: any[];
  conversation_history: any[];
  last_active_at: string;
}

async function loadOrCreateSession(supabase: any, phone: string): Promise<Session> {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phone)
    .maybeSingle();

  if (error) console.error('Session load error:', error);

  if (data) {
    // Check TTL — reset if inactive too long
    const lastActive = new Date(data.last_active_at).getTime();
    if (Date.now() - lastActive > MEMORY_TTL) {
      console.log(`⏰ Session expired for ${phone}, resetting`);
      return await resetSession(supabase, phone, data.id);
    }
    return data as Session;
  }

  // Create new session
  const { data: newSession, error: insertErr } = await supabase
    .from('whatsapp_sessions')
    .insert({ phone_number: phone })
    .select()
    .single();

  if (insertErr) console.error('Session create error:', insertErr);
  return newSession as Session;
}

async function resetSession(supabase: any, phone: string, id: string): Promise<Session> {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .update({
      state: 'IDLE',
      retailer_id: null,
      retailer_name: null,
      owner_id: null,
      beat_id: null,
      territory_id: null,
      pending_items: [],
      conversation_history: [],
      last_active_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) console.error('Session reset error:', error);
  return data as Session;
}

async function saveSession(supabase: any, session: Session) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .update({
      state: session.state,
      retailer_id: session.retailer_id,
      retailer_name: session.retailer_name,
      owner_id: session.owner_id,
      beat_id: session.beat_id,
      territory_id: session.territory_id,
      pending_items: session.pending_items,
      conversation_history: session.conversation_history,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  if (error) console.error('Session save error:', error);
}

// ── Gemini Tools ────────────────────────────────────────────────────
const allTools = [
  {
    functionDeclarations: [
      {
        name: "get_orders",
        description: "Fetches the current user's own orders for a given date range.",
        parameters: {
          type: "OBJECT",
          properties: {
            startDate: { type: "STRING", description: "Start date YYYY-MM-DD" },
            endDate: { type: "STRING", description: "End date YYYY-MM-DD" },
            status: { type: "STRING", description: "Order status filter" },
          },
          required: ["startDate", "endDate"],
        },
      },
      {
        name: "get_revenue_summary",
        description: "Gets the current user's own total revenue and order count for a date range.",
        parameters: {
          type: "OBJECT",
          properties: {
            startDate: { type: "STRING", description: "Start date YYYY-MM-DD" },
            endDate: { type: "STRING", description: "End date YYYY-MM-DD" },
          },
          required: ["startDate", "endDate"],
        },
      },
      {
        name: "get_products",
        description: "Returns the number of products and the first 5 only. Use when the user asks about products; never list more than the 5 returned.",
        parameters: {
          type: "OBJECT",
          properties: {
            category: { type: "STRING", description: "Filter by category name." },
          },
          required: [],
        },
      },
      {
        name: "get_retailer_info",
        description: "Fetches the current user's own store details including address, total orders, total revenue. Only the user's own store is available; retailerName is ignored.",
        parameters: {
          type: "OBJECT",
          properties: {
            retailerName: { type: "STRING", description: "The retailer/store name to look up" },
          },
          required: ["retailerName"],
        },
      },
      {
        name: "place_order",
        description: "Parses product names and quantities from user input for order placement. Use when the user wants to place an order and provides product names with quantities. Keep any pack size the user said (for example 100g, 1kg, 500ml) inside productName exactly as spoken; never guess a size.",
        parameters: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              description: "Array of items to order",
              items: {
                type: "OBJECT",
                properties: {
                  productName: { type: "STRING", description: "Product name including pack size if the user gave one, e.g. 'haldi 100g'" },
                  quantity: { type: "NUMBER", description: "Number of packs/units to order. Leave this out if the user did not say how many. Never guess or reuse the pack size as the quantity." },
                },
                required: ["productName"],
              },
            },
          },
          required: ["items"],
        },
      },
    ],
  },
];

// ── Function Execution ──────────────────────────────────────────────
async function executeFunction(name: string, args: Record<string, any>, session: Session, userMessage = ''): Promise<any> {
  const supabase = getSupabaseClient();

  // Retailer-scoped tools only ever read the chatting retailer's own data.
  const SCOPED_TOOLS = ['get_orders', 'get_revenue_summary', 'get_top_retailers', 'get_retailer_info'];
  let ownRetailer: any = null;
  if (SCOPED_TOOLS.includes(name)) {
    ownRetailer = await findRetailerByPhone(supabase, session.phone_number);
    if (!ownRetailer) {
      return { error: "No retailer is linked to this phone number, so personal order data is not available." };
    }
  }

  switch (name) {
    case "get_orders": {
      let query = supabase
        .from('orders')
        .select('id, retailer_name, total_amount, subtotal, discount_amount, status, order_date, payment_status, delivery_status')
        .eq('retailer_id', ownRetailer.id)
        .gte('order_date', args.startDate)
        .lte('order_date', args.endDate)
        .order('order_date', { ascending: false })
        .limit(50);
      if (args.status) query = query.eq('status', args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return {
        total_orders: data?.length || 0,
        total_revenue: data?.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0) || 0,
        orders: data?.map((o: any) => ({
          id: o.id?.slice(0, 8), retailer: o.retailer_name, amount: o.total_amount,
          status: o.status, date: o.order_date, payment: o.payment_status, delivery: o.delivery_status,
        })) || [],
      };
    }

    case "get_revenue_summary": {
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount, status, order_date')
        .eq('retailer_id', ownRetailer.id)
        .gte('order_date', args.startDate)
        .lte('order_date', args.endDate);
      if (error) return { error: error.message };
      const confirmed = data?.filter((o: any) => o.status === 'confirmed') || [];
      const cancelled = data?.filter((o: any) => o.status === 'cancelled') || [];
      return {
        period: `${args.startDate} to ${args.endDate}`,
        total_orders: data?.length || 0,
        confirmed_orders: confirmed.length,
        cancelled_orders: cancelled.length,
        total_revenue: data?.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0) || 0,
        confirmed_revenue: confirmed.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
      };
    }

    case "get_top_retailers": {
      // Company-wide ranking would expose other shops' data to a retailer.
      return { error: "This information is not available." };
    }

    case "get_products": {
      // Retailers only ever see active products, whatever the AI asks for.
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, rate, unit, closing_stock, is_active, category:product_categories(name)')
        .eq('is_active', true)
        .or('is_discontinued.is.null,is_discontinued.eq.false')
        .order('name', { ascending: true })
        .limit(1000);
      if (error) return { error: error.message };
      let products = (data || []).map((p: any) => ({
        id: p.id, name: p.name, sku: p.sku, rate: p.rate, unit: p.unit,
        category: p.category?.name || 'Uncategorized', stock: p.closing_stock,
      }));
      if (args.category) {
        const cl = args.category.toLowerCase();
        products = products.filter((p: any) => p.category.toLowerCase().includes(cl));
      }
      // Never hand the whole catalogue to the AI: 5 products, the total, and where to see the rest.
      return {
        total_products: products.length,
        products: products.slice(0, PRODUCT_PAGE_SIZE),
        note: `Only the first ${PRODUCT_PAGE_SIZE} of ${products.length} products are shown here. Tell the user to send *pdf* to get the full product list as a PDF, or *products* to browse 5 at a time.`,
      };
    }

    case "get_retailer_info": {
      const { data: r, error: rErr } = await supabase
        .from('retailers')
        .select('id, name, address, phone, owner_name, state')
        .eq('id', ownRetailer.id)
        .maybeSingle();
      if (rErr) return { error: rErr.message };
      if (!r) return { message: "No store details found for this phone number." };

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, order_date')
        .eq('retailer_id', r.id);
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0) || 0;
      const lastOrder = orders?.sort((a: any, b: any) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())?.[0];
      return {
        retailers: [{
          name: r.name, address: r.address, phone: r.phone, owner: r.owner_name,
          state: r.state,
          total_orders: totalOrders, total_revenue: totalRevenue,
          last_order_date: lastOrder?.order_date || 'No orders yet',
        }],
      };
    }

    case "place_order": {
      // This tool is used by Gemini to parse items — we handle the actual order logic separately
      return await handlePlaceOrderTool(supabase, args.items, session, userMessage);
    }

    default:
      return { error: `Unknown function: ${name}` };
  }
}

// ── Order Placement Logic ───────────────────────────────────────────
// ── Product matching (exact product + pack size, ask when unsure) ───
interface SellableUnit {
  product_id: string;
  variant_id: string | null;
  label: string;
  rate: number;
  unit: string;
  category: string;
  sizes: { amount: number; kind: 'g' | 'ml' }[];
  stock: number | null;
  reorder: number | null;
}

// "100g", "1 kg", "500 ml", "2 ltr" → comparable amount in g or ml.
const SIZE_RE = /(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|grams?|gms?|g|ml|ltrs?|litres?|liters?|l)\b/gi;

function extractSizes(text: string): { amount: number; kind: 'g' | 'ml' }[] {
  const out: { amount: number; kind: 'g' | 'ml' }[] = [];
  for (const m of text.matchAll(SIZE_RE)) {
    const n = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    if (/^(kg|kgs|kilogram|kilograms)$/.test(u)) out.push({ amount: n * 1000, kind: 'g' });
    else if (/^(g|gm|gms|gram|grams)$/.test(u)) out.push({ amount: n, kind: 'g' });
    else if (u === 'ml') out.push({ amount: n, kind: 'ml' });
    else out.push({ amount: n * 1000, kind: 'ml' });
  }
  return out;
}

function sameSize(a: { amount: number; kind: string }, b: { amount: number; kind: string }): boolean {
  return a.kind === b.kind && Math.abs(a.amount - b.amount) <= Math.max(0.5, a.amount * 0.005);
}

function nameWords(text: string): string[] {
  return text.toLowerCase().replace(SIZE_RE, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter(w => w.length >= 2);
}

// ── Hindi / Hinglish names and spelling mistakes ────────────────────
// Words retailers use for the same thing. This is only a starting list: add the real
// words your sales team hears, one group per line.
const SYNONYM_GROUPS: string[][] = [
  ['adrak', 'ginger'], ['haldi', 'turmeric'], ['chai', 'tea'], ['cheeni', 'chini', 'sugar'],
  ['namak', 'salt'], ['jeera', 'zeera', 'cumin'], ['mirch', 'mirchi', 'chilli', 'chili'],
  ['dhaniya', 'coriander'], ['elaichi', 'cardamom'], ['dal', 'daal', 'dhal'], ['atta', 'flour'],
  ['chawal', 'rice'], ['tel', 'oil'], ['sabun', 'soap'], ['doodh', 'milk'], ['pyaz', 'onion'],
  ['lehsun', 'garlic'], ['powder', 'powdr', 'pwdr', 'pdr', 'pwd'],
];

function wordVariants(word: string): string[] {
  const group = SYNONYM_GROUPS.find(g => g.includes(word));
  return group ? group.filter(w => w !== word) : [];
}

// Number of single-letter changes (insert, delete, swap, replace) between two words.
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// One mistake allowed in words of 4+ letters, two in words of 8+ letters; first letter must be right.
function closeEnough(a: string, b: string): boolean {
  if (a.length < 4) return false;
  const allowed = a.length >= 8 ? 2 : 1;
  return a[0] === b[0] && Math.abs(a.length - b.length) <= allowed && editDistance(a, b) <= allowed;
}

// 'exact' = the word (or a known synonym) is in the name; 'fuzzy' = only a near-spelling is.
function wordMatch(word: string, labelLower: string, labelWords: string[]): 'exact' | 'fuzzy' | null {
  if (labelLower.includes(word)) return 'exact';
  const synonyms = wordVariants(word);
  if (synonyms.some(v => labelWords.includes(v) || (v.length >= 4 && labelLower.includes(v)))) return 'exact';
  if ([word, ...synonyms].some(v => labelWords.some(lw => closeEnough(v, lw)))) return 'fuzzy';
  return null;
}

function labelMatch(words: string[], label: string): 'exact' | 'fuzzy' | null {
  const lower = label.toLowerCase();
  const labelWords = lower.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  let fuzzy = false;
  for (const w of words) {
    const m = wordMatch(w, lower, labelWords);
    if (!m) return null;
    if (m === 'fuzzy') fuzzy = true;
  }
  return fuzzy ? 'fuzzy' : 'exact';
}

// "adrak20" / "vay250": letters glued to a number are read as a size in grams ("adrak 20g"),
// the way your SKUs are written (Ada40, Adu100).
function normalizeGluedSize(text: string): string {
  return text.replace(/(?<![\p{L}\p{N}])(\p{L}{3,})(\d{1,4})(?![\p{L}\p{N}])/gu, '$1 $2g');
}

// Free-sample items ("SAMPLE ADRAK (FS)") are given away through schemes, so they are never offered for sale.
function isFreeSampleName(name: string): boolean {
  return /\(\s*FS\s*\)/i.test(name);
}

// The matched items first, then the other items of the same product (its other sizes),
// each as its own line. Used when someone searches a product by name.
function withSiblings(base: SellableUnit[], all: SellableUnit[]): SellableUnit[] {
  const productIds = new Set(base.map(u => u.product_id));
  const seen = new Set(base);
  return [...base, ...all.filter(u => productIds.has(u.product_id) && !seen.has(u))];
}

// Shared by price, availability and product-name answers.
//   shown      the items to list
//   closest    true when only a near-spelling matched
//   sizeMissing true when the requested size does not exist (shown = the sizes that do)
//   hasExact   at least one item matched the typed words exactly
function searchUnits(units: SellableUnit[], text: string): { shown: SellableUnit[]; closest: boolean; sizeMissing: boolean; hasExact: boolean } | null {
  const q = normalizeGluedSize(text);
  const words = nameWords(q);
  if (words.length === 0) return null;
  const wanted = extractSizes(q);

  const graded = units
    .map(u => ({ u, q: labelMatch(words, u.label) }))
    .filter((x): x is { u: SellableUnit; q: 'exact' | 'fuzzy' } => x.q !== null)
    .sort((a, b) => (a.q === b.q ? 0 : a.q === 'exact' ? -1 : 1));
  if (graded.length === 0) return null;

  const exact = graded.filter(x => x.q === 'exact').map(x => x.u);
  const hasExact = exact.length > 0;
  if (wanted.length === 0) {
    return hasExact
      ? { shown: withSiblings(exact, units), closest: false, sizeMissing: false, hasExact }
      : { shown: graded.map(x => x.u), closest: true, sizeMissing: false, hasExact };
  }

  const hasSize = (u: SellableUnit) => wanted.every(ws => u.sizes.some(us => sameSize(ws, us)));
  const familySized = withSiblings(exact, units).filter(hasSize);
  if (familySized.length > 0) return { shown: familySized, closest: false, sizeMissing: false, hasExact };
  const fuzzySized = graded.filter(x => x.q === 'fuzzy').map(x => x.u).filter(hasSize);
  if (fuzzySized.length > 0) return { shown: fuzzySized, closest: true, sizeMissing: false, hasExact };
  return { shown: withSiblings(graded.map(x => x.u), units), closest: false, sizeMissing: true, hasExact }; // the sizes that do exist
}

async function loadSellableUnits(supabase: any, words: string[]): Promise<SellableUnit[]> {
  if (words.length === 0) return [];
  const key = [...words].sort((x, y) => y.length - x.length)[0];
  // Look for the word, its known synonyms, and its first 3 letters (catches spelling mistakes).
  // The exact check happens afterwards in labelMatch.
  const terms = new Set<string>([key, ...wordVariants(key)]);
  if (key.length >= 5) terms.add(key.slice(0, 3));
  const nameFilter = [...terms].map(t => `name.ilike.%${t}%`).join(',');
  const variantFilter = [...terms].map(t => `variant_name.ilike.%${t}%`).join(',');
  const productSelect = 'id, name, rate, unit, net_weight_g, net_volume_ml, closing_stock, reorder_level, is_active, is_discontinued, category:product_categories(name)';

  const [{ data: byName }, { data: byVariant }] = await Promise.all([
    supabase.from('products').select(productSelect).or(nameFilter).eq('is_active', true).order('name').limit(300),
    supabase.from('product_variants').select('product_id').or(variantFilter).eq('is_active', true).limit(300),
  ]);

  const productMap = new Map<string, any>();
  for (const p of byName || []) productMap.set(p.id, p);
  const missing = [...new Set((byVariant || []).map((v: any) => v.product_id))].filter(id => !productMap.has(id as string));
  if (missing.length > 0) {
    const { data: extra } = await supabase.from('products').select(productSelect).in('id', missing).eq('is_active', true);
    for (const p of extra || []) productMap.set(p.id, p);
  }
  const productIds = [...productMap.keys()];
  if (productIds.length === 0) return [];

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, product_id, variant_name, price, variant_weight_g, net_weight_g, net_volume_ml, stock_quantity, reorder_level, is_active, is_discontinued')
    .in('product_id', productIds)
    .eq('is_active', true);

  const variantsByProduct = new Map<string, any[]>();
  for (const v of variants || []) {
    if (v.is_discontinued) continue;
    if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
    variantsByProduct.get(v.product_id)!.push(v);
  }

  // The main product and each of its variants are separate items, each with its own name,
  // price and size. The main product's name is NOT added to a variant's name.
  const units: SellableUnit[] = [];
  for (const p of productMap.values()) {
    if (p.is_discontinued || isFreeSampleName(p.name)) continue;
    const category = p.category?.name || 'Uncategorized';

    const sizes = extractSizes(p.name);
    if (p.net_weight_g) sizes.push({ amount: Number(p.net_weight_g), kind: 'g' });
    if (p.net_volume_ml) sizes.push({ amount: Number(p.net_volume_ml), kind: 'ml' });
    units.push({
      product_id: p.id, variant_id: null, label: p.name, rate: Number(p.rate), unit: p.unit, category, sizes,
      stock: p.closing_stock ?? null, reorder: p.reorder_level ?? null,
    });

    for (const v of variantsByProduct.get(p.id) || []) {
      if (isFreeSampleName(v.variant_name)) continue;
      const vSizes = extractSizes(v.variant_name);
      const w = Number(v.variant_weight_g ?? v.net_weight_g ?? 0);
      if (w) vSizes.push({ amount: w, kind: 'g' });
      if (v.net_volume_ml) vSizes.push({ amount: Number(v.net_volume_ml), kind: 'ml' });
      const price = Number(v.price);
      units.push({
        product_id: p.id, variant_id: v.id, label: v.variant_name,
        rate: price > 0 ? price : Number(p.rate), unit: p.unit, category, sizes: vSizes,
        stock: v.stock_quantity ?? null, reorder: v.reorder_level ?? null,
      });
    }
  }
  return units;
}

type MatchResult =
  | { status: 'matched'; unit: SellableUnit }
  | { status: 'ambiguous'; options: SellableUnit[] }
  | { status: 'wrong_size'; options: SellableUnit[] }
  | { status: 'suggest'; options: SellableUnit[] } // only a near-spelling matched: ask, never guess
  | { status: 'none' };

function matchSellableUnit(units: SellableUnit[], requestedText: string): MatchResult {
  const text = normalizeGluedSize(requestedText);
  const words = nameWords(text);
  if (words.length === 0) return { status: 'none' };
  const wantedSizes = extractSizes(text);

  // Every typed word (or a known synonym) must appear in the item's name.
  const graded = units
    .map(u => ({ u, q: labelMatch(words, u.label) }))
    .filter((x): x is { u: SellableUnit; q: 'exact' | 'fuzzy' } => x.q !== null)
    .sort((a, b) => (a.q === b.q ? 0 : a.q === 'exact' ? -1 : 1));
  const byName = graded.filter(x => x.q === 'exact').map(x => x.u);
  // A spelling that is only close is never picked for the retailer; we ask "did you mean".
  if (byName.length === 0) {
    if (graded.length > 0) return { status: 'suggest', options: graded.map(x => x.u) };
    if (words.length > 1) {
      // Maybe two names run together ("dakshin gold"): offer items that match any one of the words.
      // Near-spellings count too ("dakxhin" ~ "dakshin"); items matching a word exactly come first.
      const rank = (u: SellableUnit) => words.filter(w => labelMatch([w], u.label) === 'exact').length * 2
        + words.filter(w => labelMatch([w], u.label) === 'fuzzy').length;
      const partial = units.filter(u => rank(u) > 0).sort((a, b) => rank(b) - rank(a));
      if (partial.length > 0) return { status: 'suggest', options: partial };
    }
    return { status: 'none' };
  }

  let candidates = byName;
  if (wantedSizes.length > 0) {
    const hasSize = (u: SellableUnit) => wantedSizes.every(ws => u.sizes.some(us => sameSize(ws, us)));
    // A named size can also be another item of the same product (ADRAK 40G → its 250G variant).
    candidates = withSiblings(byName, units).filter(hasSize);
    if (candidates.length === 0) {
      // The size may belong to an item whose name is only spelled slightly differently: ask, never guess.
      const fuzzySized = graded.filter(x => x.q === 'fuzzy').map(x => x.u).filter(hasSize);
      if (fuzzySized.length > 0) return { status: 'suggest', options: fuzzySized };
      return { status: 'wrong_size', options: withSiblings(graded.map(x => x.u), units) };
    }
  }
  if (candidates.length === 1) return { status: 'matched', unit: candidates[0] };

  // Several fit: accept only when exactly one has the very same words as the request.
  const exact = candidates.filter(u => {
    const lw = nameWords(u.label);
    return lw.length === words.length && words.every(w => lw.includes(w) || wordVariants(w).some(v => lw.includes(v)));
  });
  if (exact.length === 1) return { status: 'matched', unit: exact[0] };
  return { status: 'ambiguous', options: candidates };
}

// The AI sometimes drops the pack size or turns it into the quantity. Re-read the
// retailer's own message: a size written AFTER the product name ("adrak 20g") is a pack size.
function recoverSizeFromMessage(message: string, productName: string): { sizeText: string; hasOtherNumber: boolean } | null {
  const words = nameWords(productName);
  if (words.length === 0 || !message) return null;
  const segments = message.split(/[,;\n+]|\s(?:and|aur|&)\s/i);
  const lowerSegs = segments.map(seg => seg.toLowerCase());
  const hits = lowerSegs.map((seg, i) => (words.every(w => seg.includes(w)) ? i : -1)).filter(i => i >= 0);
  if (hits.length !== 1) return null;

  const seg = segments[hits[0]];
  const lower = lowerSegs[hits[0]];
  const nameEnd = Math.max(...words.map(w => lower.indexOf(w) + w.length));
  const sizeMatch = [...seg.matchAll(SIZE_RE)].find(m => (m.index ?? 0) >= nameEnd);
  if (!sizeMatch) return null;

  const hasOtherNumber = /\d/.test(seg.replace(SIZE_RE, ' '));
  return { sizeText: sizeMatch[0], hasOtherNumber };
}

// A pack (size) price is for the pack; a plain product's price is per its unit.
// "5kg", "250g", "1.5l" from an amount in g or ml.
function formatSize(s: { amount: number; kind: 'g' | 'ml' }): string {
  const big = s.amount >= 1000;
  const n = big ? s.amount / 1000 : s.amount;
  const num = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  return s.kind === 'g' ? `${num}${big ? 'kg' : 'g'}` : `${num}${big ? 'l' : 'ml'}`;
}

// The size saved on the product (weight / volume) when the name does not already say it:
// "DAKSHIN GOLD (HORECA)" with 5000 g saved → "DAKSHIN GOLD (HORECA) (5kg)". Used in lists only.
function labelWithSize(label: string, sizes: { amount: number; kind: 'g' | 'ml' }[]): string {
  if (extractSizes(label).length > 0 || sizes.length === 0) return label;
  return `${label} (${formatSize(sizes[0])})`;
}

function priceText(u: SellableUnit): string {
  return u.variant_id ? `₹${u.rate.toFixed(2)}` : `₹${u.rate.toFixed(2)}/${u.unit || 'unit'}`;
}

// ── Distributor stock ───────────────────────────────────────────────
// Stock comes from the inventory of the distributor that serves the retailer
// (retailers.distributor_id → distributor_inventory), never from the product master.
//   available = quantity − reserved − damaged − expired, added up over the distributor's warehouses.
// An item with no inventory row is "not tracked": it shows no status (it is NOT "out of stock").
// Stock on a van (on_van_quantity) is neither added nor subtracted.
type StockMap = Map<string, { available: number; reorder: number | null }>;

const stockKey = (productId: string, variantId: string | null) => `${productId}__${variantId ?? 'none'}`;

async function loadDistributorStock(supabase: any, distributorId: string | null | undefined, units: SellableUnit[]): Promise<StockMap> {
  const result: StockMap = new Map();
  if (!distributorId || units.length === 0) return result;

  const productIds = [...new Set(units.map(u => u.product_id))];
  const { data, error } = await supabase
    .from('distributor_inventory')
    .select('product_id, variant_id, quantity, reserved_quantity, damaged_quantity, expired_quantity, reorder_level')
    .eq('distributor_id', distributorId)
    .in('product_id', productIds);
  if (error) {
    console.error('Distributor stock lookup error:', error.message);
    return result; // no stock shown rather than a wrong one
  }

  for (const row of data || []) {
    const key = stockKey(row.product_id, row.variant_id ?? null);
    const free = Number(row.quantity || 0) - Number(row.reserved_quantity || 0)
      - Number(row.damaged_quantity || 0) - Number(row.expired_quantity || 0);
    const cur = result.get(key) || { available: 0, reorder: null };
    cur.available += free;
    if (row.reorder_level !== null && row.reorder_level !== undefined) {
      cur.reorder = (cur.reorder ?? 0) + Number(row.reorder_level);
    }
    result.set(key, cur);
  }
  return result;
}

function stockBadge(unit: SellableUnit, stock: StockMap | undefined): string | null {
  const s = stock?.get(stockKey(unit.product_id, unit.variant_id));
  if (!s) return null;
  if (s.available <= 0) return '❌ Out of stock';
  if (s.reorder !== null && s.available <= s.reorder) return '⚠️ Low stock';
  return '✅ Available';
}

// One item per line with its price (and its distributor stock when known), for example:
//   🔎 *Marinero 130g* — 3 items found
//   • Marinero Classic 130g — ₹45.00 · ✅ Available
// Pass `stock` (even an empty map) to show stock; items without data get one explanatory note.
function formatProductLines(title: string, units: SellableUnit[], note?: string, stock?: StockMap): string {
  const MAX_LISTED = 8;
  const shown = units.slice(0, MAX_LISTED);
  const lines = shown.map(u => {
    const badge = stockBadge(u, stock);
    return `• ${labelWithSize(u.label, u.sizes)} — ${priceText(u)}${badge ? ` · ${badge}` : ''}`;
  });
  if (units.length > MAX_LISTED) {
    lines.push(`…and ${units.length - MAX_LISTED} more. Send the exact name and size to see one.`);
  }
  const count = `${units.length} item${units.length === 1 ? '' : 's'} found`;
  let reply = `🔎 *${title}* — ${count}\n\n${lines.join('\n')}`;
  if (note) reply += `\n\n${note}`;
  if (stock && shown.some(u => !stockBadge(u, stock))) {
    reply += '\n\nStock is shown only for items your distributor tracks. For the others, please confirm availability with your sales representative before ordering.';
  }
  reply += `\n\nSend the name and quantity to order,\nfor example: *${units[0].label} 5*`;
  return reply;
}

function listOptions(options: SellableUnit[]): string {
  const shown = options.slice(0, 5).map(o => `• ${labelWithSize(o.label, o.sizes)} – ₹${o.rate}`);
  if (options.length > 5) shown.push(`…and ${options.length - 5} more`);
  return shown.join('\n');
}

// ── Order lines typed by the retailer, read without the AI ──────────
// "Adrak 40G 24kg, Aduku 20g 5kg", "5 kg haldi", "add adrak", "tea x 3" → items and quantities.
// Returns null when the message does not look like a list of items (the AI then reads it).
const QTY_UNITS = '(?:kgs?|kilos?|pcs?|pieces?|pkts?|packets?|packs?|nos|box(?:es)?|units?|cases?|cartons?)';
const ORDER_FILLER = new Set(['please', 'plz', 'add', 'also', 'i', 'want', 'need', 'order', 'mujhe', 'chahiye', 'chahie',
  'bhejo', 'bhej', 'do', 'dena', 'de', 'the', 'of', 'me', 'send', 'kindly', 'my', 'more']);

// Words that show a sentence or a question, not an item name: those go to the AI.
const NOT_AN_ITEM = new Set(['can', 'could', 'you', 'your', 'some', 'any', 'what', 'which', 'how', 'why', 'when', 'where', 'who',
  'is', 'are', 'do', 'does', 'would', 'will', 'have', 'has', 'tell', 'show', 'give', 'thanks', 'thank', 'hello', 'hi', 'hey',
  'ok', 'okay', 'yes', 'no', 'kya', 'kab', 'kaise', 'kitna', 'kitne', 'hai']);

interface ParsedOrderLine { productName: string; quantity?: number; altSize?: string }

function parseOrderLines(message: string): ParsedOrderLine[] | null {
  const segments = message.split(/[,;\n]+|\s+(?:and|aur|&|\+)\s+/i).map(x => x.trim()).filter(Boolean);
  if (segments.length === 0 || segments.length > 15) return null;

  const lines: ParsedOrderLine[] = [];
  for (const raw of segments) {
    const words = raw.split(/\s+/).filter(Boolean);
    const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}]/gu, '');
    while (words.length > 0 && ORDER_FILLER.has(clean(words[0]))) words.shift();
    while (words.length > 0 && ORDER_FILLER.has(clean(words[words.length - 1]))) words.pop();
    let seg = words.join(' ');
    if (!seg || words.length > 6 || !/\p{L}{2,}/u.test(seg)) return null;
    if (words.some(w => NOT_AN_ITEM.has(clean(w)))) return null;

    let quantity: number | undefined;
    let altSize: string | undefined;
    let name = seg;

    // quantity at the end: "adrak 40g 24kg", "haldi 5", "tea x 3", "tea 3 pkt"
    let m = seg.match(new RegExp(`^(.*?\\p{L}.*?)\\s+(?:x\\s*)?(\\d+(?:\\.\\d+)?)\\s*(${QTY_UNITS})?$`, 'iu'));
    // quantity at the start: "5 adrak", "5 kg adrak", "2 pkt haldi"
    let lead: RegExpMatchArray | null = null;
    if (!m) lead = seg.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${QTY_UNITS})?\\s+(.*\\p{L}.*)$`, 'iu'));

    if (m) {
      name = m[1].trim(); quantity = parseFloat(m[2]);
      // "5kg" can be a quantity or a 5 kg pack: decided later against the catalogue
      if (m[3] && /^(kgs?|kilos?)$/i.test(m[3])) altSize = `${m[2]}kg`;
    } else if (lead) {
      quantity = parseFloat(lead[1]); name = lead[3].trim();
      if (lead[2] && /^(kgs?|kilos?)$/i.test(lead[2])) altSize = `${lead[1]}kg`;
    }
    if (!/\p{L}{2,}/u.test(name)) return null;
    lines.push({ productName: name, quantity, altSize });
  }
  return lines;
}

// A bare number ("5", "5 kg", "3 pkt") answers the last "How many…?" question.
function parseBareQuantity(message: string): number | null {
  const m = message.trim().match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${QTY_UNITS}?$`, 'i'));
  return m ? parseFloat(m[1]) : null;
}

// The order summary, always worded the same way.
function buildDraftReply(items: any[]): string {
  const total = items.reduce((s, i) => s + Number(i.total), 0);
  const lines = items.map(i => `• ${i.product_name} × ${i.quantity} = ₹${Number(i.total).toFixed(2)}`);
  return `🛒 *Your order*\n\n${lines.join('\n')}\n\n💰 *Total: ₹${total.toFixed(2)}*\n\nReply *YES* to place this order or *NO* to cancel.`;
}

async function handlePlaceOrderTool(supabase: any, items: any[], session: Session, userMessage = ''): Promise<any> {
  if (!items || items.length === 0) {
    return { error: "No items parsed from the message" };
  }

  // Items already understood earlier in this order (while we waited for a clarification).
  const keyOf = (i: any) => `${i.product_id}__${i.variant_id ?? 'none'}`;
  const kept = new Map<string, any>();
  if (session.state === 'AWAITING_ORDER_DETAILS' || session.state === 'CONFIRMING_ORDER') {
    for (const i of session.pending_items || []) kept.set(keyOf(i), i);
  }

  const questions: string[] = [];
  const awaitingQuantity: any[] = []; // exact items that only need a quantity

  for (const item of items) {
    // An item that was already identified earlier and only waited for its quantity.
    if (item.resolvedUnit) {
      const u = item.resolvedUnit;
      const q = Number(item.quantity);
      if (Number.isFinite(q) && q > 0) {
        const entry = {
          product_id: u.product_id, variant_id: u.variant_id, product_name: u.label,
          rate: u.rate, unit: u.unit, category: u.category, quantity: q, total: u.rate * q,
        };
        kept.set(keyOf(entry), entry);
      }
      continue;
    }

    let requestedText = String(item.productName || '').trim();
    let quantity = Number(item.quantity);
    if (!requestedText) continue;

    const units = await loadSellableUnits(supabase, nameWords(normalizeGluedSize(requestedText)));

    // A size written after the name ("adrak 20g", "dakshin gold 5kg") may be a pack size or a quantity.
    let sizeHint: string | undefined = item.altSize;
    let hintLeavesQuantity = false; // true when the number in the hint is also a separate quantity
    if (extractSizes(requestedText).length === 0) {
      if (!sizeHint) {
        const recovered = recoverSizeFromMessage(userMessage, requestedText);
        if (recovered) { sizeHint = recovered.sizeText; hintLeavesQuantity = recovered.hasOtherNumber; }
      }
      if (sizeHint) {
        const hint = extractSizes(sizeHint)[0];
        const words = nameWords(normalizeGluedSize(requestedText));
        // Small sizes (g, ml) are pack sizes. Big ones (kg, l) are pack sizes only if the catalogue has that size;
        // otherwise "5kg" is simply how much the retailer wants.
        const catalogueHasIt = hint && units.some(u => labelMatch(words, u.label) === 'exact' && u.sizes.some(us => sameSize(hint, us)));
        const isSmallUnit = hint && hint.amount < 1000;
        if (hint && (isSmallUnit || catalogueHasIt)) {
          requestedText = `${requestedText} ${sizeHint}`;
          if (!hintLeavesQuantity) quantity = NaN; // the only number was the size: the quantity was never stated
        }
      }
    }

    const quantityOk = Number.isFinite(quantity) && quantity > 0;
    const exampleQty = quantityOk ? quantity : 5;
    const match = matchSellableUnit(units, requestedText);

    if (match.status === 'matched') {
      const u = match.unit;
      if (!quantityOk) {
        questions.push(`How many of *${u.label}* do you want? Reply with the number, for example: *5*`);
        awaitingQuantity.push(u);
        continue;
      }
      const entry = {
        product_id: u.product_id, variant_id: u.variant_id, product_name: u.label,
        rate: u.rate, unit: u.unit, category: u.category,
        quantity, total: u.rate * quantity,
      };
      kept.set(keyOf(entry), entry); // same item again replaces the quantity, never doubles it
    } else if (match.status === 'ambiguous') {
      questions.push(`More than one item matches *${requestedText}*:\n${listOptions(match.options)}\nPlease send the exact name and quantity, for example: *${match.options[0].label} ${exampleQty}*`);
    } else if (match.status === 'suggest') {
      questions.push(`I could not find *${requestedText}* exactly. Did you mean:\n${listOptions(match.options)}\nPlease send the exact name and quantity, for example: *${match.options[0].label} ${exampleQty}*`);
    } else if (match.status === 'wrong_size') {
      questions.push(`I could not find *${requestedText}* in that size. Available:\n${listOptions(match.options)}\nPlease send the one you want.`);
    } else {
      questions.push(`I could not find *${requestedText}* in our products. Please check the name and send it again.`);
    }
  }

  // Remember a single "How many…?" question so a bare number can answer it.
  await saveContext(
    supabase, session.phone_number,
    questions.length === 1 && awaitingQuantity.length === 1 ? 'awaiting_quantity' : 'order_step',
    questions.length === 1 && awaitingQuantity.length === 1 ? { unit: awaitingQuantity[0] } : {},
  );

  const matchedItems = [...kept.values()];
  session.pending_items = matchedItems;

  // Anything unclear: do not guess. Ask, keep what is already understood, and stay in this step.
  if (questions.length > 0) {
    session.state = 'AWAITING_ORDER_DETAILS';
    let reply = '';
    if (matchedItems.length > 0) {
      reply += `✅ Noted so far:\n${matchedItems.map(i => `• ${i.product_name} × ${i.quantity}`).join('\n')}\n\n`;
    }
    reply += questions.join('\n\n');
    return { needs_clarification: true, reply_text: reply };
  }

  if (matchedItems.length === 0) {
    return { error: "Could not match any products" };
  }

  const orderTotal = matchedItems.reduce((s, i) => s + i.total, 0);
  session.state = 'CONFIRMING_ORDER';

  return {
    matched_items: matchedItems.map(i => ({
      product: i.product_name, qty: i.quantity, unit: i.unit,
      rate: `₹${i.rate}`, total: `₹${i.total}`,
    })),
    unmatched_items: [],
    order_total: `₹${orderTotal.toFixed(2)}`,
    message: "Please confirm this order by replying 'Yes' or 'Confirm'. Reply 'Cancel' to discard.",
    // Sent exactly as written, so the draft always looks the same.
    reply_text: buildDraftReply(matchedItems),
  };
}

// ── Change the order before it is placed ────────────────────────────
// "remove adrak", "adrak hatao", "change aduku to 8", "remove all", "done" (review the order).
const REVIEW_WORDS = new Set(['done', 'review', 'review order', 'show order', 'summary', 'bas', 'bas itna', 'thats all', 'that s all', 'finish']);
const WHOLE_ORDER_WORDS = new Set(['all', 'everything', 'order', 'it', 'sab', 'sabhi', 'sara', 'all items']);

// Items already in the draft that the retailer's words point to.
function findDraftItems(items: any[], target: string): any[] {
  const q = normalizeGluedSize(target);
  const words = nameWords(q);
  if (words.length === 0) return [];
  const wanted = extractSizes(q);
  let hits = items.filter(i => labelMatch(words, i.product_name) === 'exact');
  if (hits.length === 0) hits = items.filter(i => labelMatch(words, i.product_name) === 'fuzzy');
  if (wanted.length > 0) {
    hits = hits.filter(i => wanted.every(ws => extractSizes(i.product_name).some(us => sameSize(ws, us))));
  }
  return hits;
}

function handleDraftEdit(session: Session, message: string): string | null {
  if (session.state !== 'AWAITING_ORDER_DETAILS' && session.state !== 'CONFIRMING_ORDER') return null;
  const text = message.trim();
  const bare = normalizeReply(text);
  const current = (): any[] => session.pending_items || [];
  const emptyReply = 'Your order is empty. Send the product name and quantity, for example: *product name 5*';

  // What the retailer sees after a change.
  const afterEdit = (head: string): string => {
    const items = current();
    if (items.length === 0) {
      session.state = 'AWAITING_ORDER_DETAILS';
      return `${head}\n\n${emptyReply}`;
    }
    if (session.state === 'CONFIRMING_ORDER') return `${head}\n\n${buildDraftReply(items)}`;
    const noted = items.map(i => `• ${i.product_name} × ${i.quantity}`).join('\n');
    return `${head}\n\n✅ Noted so far:\n${noted}\n\nSend the next item, or send *done* to review your order.`;
  };

  // "done" / "review": show the order and ask for YES
  if (REVIEW_WORDS.has(bare)) {
    if (current().length === 0) return emptyReply;
    session.state = 'CONFIRMING_ORDER';
    return buildDraftReply(current());
  }

  // remove: "remove adrak", "delete adrak 40g", "adrak hatao", "cancel adrak"
  const rm = text.match(/^(?:please\s+)?(?:remove|delete|drop|cancel|hata(?:o|do|dena)?|nikal(?:o|do|dena)?)\s+(.+)$/i)
    || text.match(/^(.+?)\s+(?:remove|delete|hata(?:o|do|dena)?|nikal(?:o|do|dena)?)$/i);
  if (rm) {
    const target = rm[1].trim();
    if (WHOLE_ORDER_WORDS.has(normalizeReply(target))) {
      session.pending_items = [];
      session.state = 'IDLE';
      return 'Okay, your order was cleared. Send *place order* any time to start a new one.';
    }
    const hits = findDraftItems(current(), target);
    if (hits.length === 0) {
      const list = current().map(i => `• ${i.product_name} × ${i.quantity}`).join('\n');
      return `I could not find *${target}* in your order.${list ? `\n\nYour order now:\n${list}` : `\n\n${emptyReply}`}`;
    }
    if (hits.length > 1) {
      const list = hits.map(i => `• ${i.product_name} × ${i.quantity}`).join('\n');
      return `More than one item in your order matches *${target}*:\n${list}\nPlease send the exact name, for example: *remove ${hits[0].product_name}*`;
    }
    session.pending_items = current().filter(i => i !== hits[0]);
    return afterEdit(`🗑️ Removed *${hits[0].product_name}* from your order.`);
  }

  // change the quantity: "change adrak to 5", "make aduku 8", "adrak qty 3"
  const qtyTail = '(\\d+(?:\\.\\d+)?)\\s*(?:kgs?|pcs?|pkts?|packets?|packs?|nos|units?)?$';
  const ch = text.match(new RegExp(`^(?:change|update|make|set|badlo|badal(?:o|na)?)\\s+(.+?)\\s+(?:to|as|qty|quantity|=|ko)?\\s*${qtyTail}`, 'i'))
    || text.match(new RegExp(`^(.+?)\\s+(?:qty|quantity)\\s*(?:to|=)?\\s*${qtyTail}`, 'i'));
  if (ch) {
    const target = ch[1].trim();
    const qty = parseFloat(ch[2]);
    const hits = findDraftItems(current(), target);
    if (hits.length === 0 || !(qty > 0)) return null; // not about an item in the order: read as a normal message
    if (hits.length > 1) {
      const list = hits.map(i => `• ${i.product_name} × ${i.quantity}`).join('\n');
      return `More than one item in your order matches *${target}*:\n${list}\nPlease send the exact name, for example: *change ${hits[0].product_name} to ${qty}*`;
    }
    hits[0].quantity = qty;
    hits[0].total = Number(hits[0].rate) * qty;
    return afterEdit(`✏️ Updated *${hits[0].product_name}* to ${qty}.`);
  }

  return null;
}

interface ConfirmResult {
  ok: boolean;
  message: string;
  // true when nothing was saved, so the draft can safely be offered again
  restoreDraft: boolean;
}

async function confirmOrder(supabase: any, session: Session): Promise<ConfirmResult> {
  if (!session.retailer_id || !session.pending_items || session.pending_items.length === 0) {
    return { ok: false, restoreDraft: false, message: "No pending order to confirm. Please start a new order." };
  }

  // Re-fetch retailer to get the correct auth user ID
  const { data: retailer, error: rErr } = await supabase
    .from('retailers')
    .select('owner_id, user_id, beat_id, territory_id')
    .eq('id', session.retailer_id)
    .single();

  if (rErr) {
    console.error('Retailer fetch error in confirmOrder:', rErr);
  }

  const assignedUserId = retailer?.owner_id || retailer?.user_id || session.owner_id;
  if (!assignedUserId) {
    console.error('No assigned auth user for retailer:', session.retailer_id);
    return { ok: false, restoreDraft: true, message: "⚠️ Your account is not linked to a sales representative yet. Please contact your distributor to assign one, then try again." };
  }

  const items = session.pending_items;
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.total), 0);
  const today = new Date().toISOString().split('T')[0];

  // Create order matching Customer Portal pattern
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      retailer_id: session.retailer_id,
      retailer_name: session.retailer_name,
      subtotal: subtotal,
      total_amount: subtotal,
      status: 'confirmed',
      order_date: today,
      order_source: 'whatsapp',
      user_id: assignedUserId,
      beat_id: retailer?.beat_id || session.beat_id || null,
      territory_id: retailer?.territory_id || session.territory_id || null,
    })
    .select('id, invoice_number')
    .single();

  if (orderErr) {
    console.error('Order creation error:', orderErr);
    return { ok: false, restoreDraft: true, message: "Failed to create order. Please reply YES to try again, or NO to cancel." };
  }

  // Insert order items
  const orderItems = items.map((i: any) => ({
    order_id: order.id,
    product_id: i.product_id,
    variant_id: i.variant_id ?? null,
    product_name: i.product_name,
    category: i.category,
    rate: i.rate,
    unit: i.unit,
    quantity: i.quantity,
    total: i.total,
  }));

  let { error: itemsErr } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsErr) {
    // One retry. The order row already exists, so never create a second order.
    console.error('Order items error, retrying once:', itemsErr);
    ({ error: itemsErr } = await supabase.from('order_items').insert(orderItems));
  }

  if (itemsErr) {
    console.error('Order items error after retry:', itemsErr);
    return { ok: false, restoreDraft: false, message: "Order created but failed to add items. Please contact support." };
  }

  // Generate invoice message
  let invoice = `✅ *Order Confirmed!*\n`;
  invoice += `📋 Order ID: ${order.id.slice(0, 8)}\n`;
  invoice += `📅 Date: ${today}\n`;
  invoice += `🏪 Retailer: ${session.retailer_name}\n\n`;
  invoice += `*Items:*\n`;
  for (const item of items) {
    invoice += `• ${item.product_name} × ${item.quantity} ${item.unit} = ₹${Number(item.total).toFixed(2)}\n`;
  }
  invoice += `\n💰 *Total: ₹${subtotal.toFixed(2)}*\n`;
  invoice += `\nThank you for your order!`;

  // Also trigger the dedicated WhatsApp order confirmation edge function
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const confirmRes = await fetch(`${supabaseUrl}/functions/v1/send-order-confirmation-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ orderId: order.id, retailerId: session.retailer_id }),
    });
    const confirmResult = await confirmRes.json();
    console.log('📨 Order confirmation edge function result:', JSON.stringify(confirmResult));
  } catch (confirmErr) {
    console.error('⚠️ Failed to trigger order confirmation edge function:', confirmErr);
  }

  // Reset session
  session.state = 'IDLE';
  session.pending_items = [];

  return { ok: true, restoreDraft: false, message: invoice };
}

// Any way of writing an Indian mobile number ("+91 98765 43210", "098765-43210", "919876543210")
// is reduced to its last 10 digits. Returns null when there are fewer than 10 digits.
function normalizePhoneDigits(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

async function findRetailerByPhone(supabase: any, phone: string): Promise<any | null> {
  const last10 = normalizePhoneDigits(phone.replace('whatsapp:', ''));
  if (!last10) return null;

  const columns = 'id, name, phone, beat_id, territory_id, owner_id, user_id, distributor_id';

  // Step 1 (fast): the spellings seen in the data, matched exactly.
  const variants = [
    last10, `91${last10}`, `+91${last10}`, `0${last10}`,
    `+91 ${last10}`, `+91-${last10}`, `91 ${last10}`, `91-${last10}`,
  ];
  const { data, error } = await supabase
    .from('retailers')
    .select(columns)
    .in('phone', variants)
    .limit(1);

  if (error) {
    console.error('Retailer phone lookup error:', error);
    return null;
  }
  if (data?.[0]) return data[0];

  // Step 2 (fallback): numbers saved with spaces or dashes inside, e.g. "+91 98765 43210".
  // Look at phones containing the same last 4 digits, then compare digits only.
  const { data: candidates, error: fbError } = await supabase
    .from('retailers')
    .select(columns)
    .ilike('phone', `%${last10.slice(-4)}%`)
    .limit(100);

  if (fbError) {
    console.error('Retailer phone fallback lookup error:', fbError);
    return null;
  }
  return (candidates || []).find((r: any) => normalizePhoneDigits(r.phone || '') === last10) || null;
}

// ── Conversation Context Helpers ─────────────────────────────────────
interface UserContext {
  phone: string;
  last_intent: string | null;
  last_entity: Record<string, any>;
  last_order_id: string | null;
  updated_at: string;
}

async function loadContext(supabase: any, phone: string): Promise<UserContext | null> {
  const { data, error } = await supabase
    .from('user_context')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (error || !data) return null;

  // Check TTL — ignore if older than 30 minutes
  const updatedAt = new Date(data.updated_at).getTime();
  if (Date.now() - updatedAt > CONTEXT_TTL) {
    console.log(`⏰ Context expired for ${phone}`);
    return null;
  }

  return data as UserContext;
}

async function saveContext(
  supabase: any,
  phone: string,
  intent: string,
  entity: Record<string, any> = {},
  orderId: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from('user_context')
    .upsert({
      phone,
      last_intent: intent,
      last_entity: entity,
      last_order_id: orderId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' });

  if (error) console.error('Context save error:', error);
}

// A message that is just a product name ("Marinero 130g"): list the matching items line by line
// instead of leaving it to the AI, which tends to write one sentence ("A, B and C").
async function handleProductSearchQuery(supabase: any, message: string, distributorId?: string | null): Promise<string | null> {
  const lower = message.toLowerCase().trim();
  if (lower.length < 3 || lower.length > 60) return null;
  if (lower.includes('?')) return null;
  if (/\b(how|what|which|when|why|who|where|kab|kya|kaise|kitna|kitne|please|plz|thanks|thank|ok|okay|hi|hello|hey|yes|no|haan|nahi)\b/.test(lower)) return null;

  const q = normalizeGluedSize(message);
  const words = nameWords(q);
  if (words.length === 0 || words.length > 10) return null;

  // "adrak 250g, adrak 40g": each item is searched on its own. Searching the whole text as one item
  // would need a single product with both sizes and wrongly say that a size does not exist.
  const parts = q.split(/[,;\n]+|\s+(?:and|aur|&)\s+/i).map(x => x.trim()).filter(x => nameWords(x).length > 0);
  if (parts.length > 1 && parts.length <= 5) {
    const shownMulti: SellableUnit[] = [];
    let anyClosest = false;
    let missingSize = false;
    for (const part of parts) {
      const partUnits = await loadSellableUnits(supabase, nameWords(part));
      const f = searchUnits(partUnits, part);
      if (!f || !f.hasExact) return null; // one part is not a product name: leave it to the other handlers / the AI
      if (f.closest) anyClosest = true;
      if (f.sizeMissing) missingSize = true;
      for (const u of f.shown) {
        if (!shownMulti.some(x => x.product_id === u.product_id && x.variant_id === u.variant_id)) shownMulti.push(u);
      }
    }
    console.log(`🔎 Product search matched — ${parts.length} items → ${shownMulti.length} item(s)`);
    const stockMulti = await loadDistributorStock(supabase, distributorId, shownMulti.slice(0, 8));
    return formatProductLines(anyClosest ? 'Closest matches' : parts.join(', '), shownMulti,
      missingSize ? 'One of these sizes is not available. These are the sizes we have.' : undefined, stockMulti);
  }

  if (words.length > 5) return null;
  const units = await loadSellableUnits(supabase, words);
  const found = searchUnits(units, q);
  if (!found || !found.hasExact) return null; // not a product name: leave it to the other handlers / the AI
  const { shown } = found;
  const note = found.sizeMissing ? 'We do not have that size. These are the sizes available.' : undefined;

  // Title: what the retailer typed, without a loose quantity ("marinero 130g 5" → "marinero 130g").
  const keptSizes: string[] = [];
  const title = q
    .replace(SIZE_RE, m => { keptSizes.push(m); return `SZPH${keptSizes.length - 1}X`; })
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(/SZPH(\d+)X/g, (_m, i) => keptSizes[Number(i)])
    .replace(/\s+/g, ' ')
    .trim() || q.trim();
  console.log(`🔎 Product search matched — "${message.trim()}" → ${shown.length} item(s)`);
  const stock = await loadDistributorStock(supabase, distributorId, shown.slice(0, 8));
  return formatProductLines(found.closest ? `Closest matches for "${title}"` : title, shown, note, stock);
}

// ── Product list: 5 at a time; the full list is sent as a PDF ───────
const PRODUCT_PAGE_SIZE = 5;

interface ProductListScope {
  categoryIds?: string[];
  productIds?: string[];
  label?: string;
}

// Reads every row, 1000 at a time (the database returns at most 1000 rows per request).
async function fetchAllRows(build: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

interface CatalogueRow { label: string; text: string; plain: string }
const catalogueCache = new Map<string, { rows: CatalogueRow[]; expiresAt: number }>();
const CATALOGUE_CACHE_TTL = 5 * 60 * 1000;

// Main products and variants as separate lines, sorted by name. Kept for 5 minutes per scope,
// so tapping "more" does not read the whole catalogue again.
async function loadCatalogueRows(supabase: any, scope: ProductListScope): Promise<CatalogueRow[]> {
  const key = JSON.stringify([scope.categoryIds || null, scope.productIds || null]);
  const cached = catalogueCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const products = await fetchAllRows((from, to) => {
    let query = supabase
      .from('products')
      .select('id, name, rate, unit, net_weight_g, net_volume_ml')
      .eq('is_active', true)
      .or('is_discontinued.is.null,is_discontinued.eq.false');
    if (scope.categoryIds && scope.categoryIds.length > 0) query = query.in('category_id', scope.categoryIds);
    if (scope.productIds && scope.productIds.length > 0) query = query.in('id', scope.productIds);
    return query.order('name').order('id').range(from, to);
  });
  const variants = await fetchAllRows((from, to) =>
    supabase
      .from('product_variants')
      .select('id, product_id, variant_name, price, variant_weight_g, net_weight_g, net_volume_ml')
      .eq('is_active', true)
      .or('is_discontinued.is.null,is_discontinued.eq.false')
      .order('id')
      .range(from, to));

  const rows: CatalogueRow[] = [];
  const productRate = new Map<string, number>();
  for (const p of products) {
    if (isFreeSampleName(p.name)) continue;
    productRate.set(p.id, Number(p.rate));
    const pSizes: { amount: number; kind: 'g' | 'ml' }[] = [];
    if (p.net_weight_g) pSizes.push({ amount: Number(p.net_weight_g), kind: 'g' });
    if (p.net_volume_ml) pSizes.push({ amount: Number(p.net_volume_ml), kind: 'ml' });
    rows.push({ plain: p.name, label: labelWithSize(p.name, pSizes), text: `₹${Number(p.rate).toFixed(2)}/${p.unit || 'unit'}` });
  }
  for (const v of variants) {
    if (!productRate.has(v.product_id) || isFreeSampleName(v.variant_name)) continue;
    const price = Number(v.price) > 0 ? Number(v.price) : productRate.get(v.product_id)!;
    const vSizes: { amount: number; kind: 'g' | 'ml' }[] = [];
    const vw = Number(v.variant_weight_g ?? v.net_weight_g ?? 0);
    if (vw) vSizes.push({ amount: vw, kind: 'g' });
    if (v.net_volume_ml) vSizes.push({ amount: Number(v.net_volume_ml), kind: 'ml' });
    rows.push({ plain: v.variant_name, label: labelWithSize(v.variant_name, vSizes), text: `₹${price.toFixed(2)}` });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  catalogueCache.set(key, { rows, expiresAt: Date.now() + CATALOGUE_CACHE_TTL });
  return rows;
}

async function buildProductPage(supabase: any, phone: string, scope: ProductListScope, offset: number): Promise<string> {
  let rows: CatalogueRow[];
  try {
    rows = await loadCatalogueRows(supabase, scope);
  } catch (e) {
    console.error('Product list error:', (e as any)?.message || e);
    return "Sorry, I couldn't fetch the product list right now. Please try again later.";
  }

  if (offset >= rows.length) {
    return offset > 0
      ? "That is the end of the list. Send *products* to start again."
      : `I could not find any products${scope.label ? ` for "${scope.label}"` : ''} right now.`;
  }
  const page = rows.slice(offset, offset + PRODUCT_PAGE_SIZE);
  const hasMore = rows.length > offset + PRODUCT_PAGE_SIZE;

  const lines = page.map(r => `• ${r.label} — ${r.text}`);
  const from = offset + 1;
  const to = offset + page.length;
  let reply = `📦 *Products${scope.label ? ` — ${scope.label}` : ''}* (${from}–${to} of ${rows.length})\n\n${lines.join('\n')}`;
  const footer: string[] = [];
  if (hasMore) footer.push(`Reply *more* to see the next ${PRODUCT_PAGE_SIZE}.`);
  footer.push('📄 Send *pdf* to get the full product list as a PDF.');
  reply += `\n\n${footer.join('\n')}`;

  await saveContext(supabase, phone, 'product_list_page', { ...scope, nextOffset: offset + PRODUCT_PAGE_SIZE });
  return reply;
}

// ── Product list as a PDF ───────────────────────────────────────────
// "pdf", "catalogue", "price list", "product list" → the whole list as a file, built by the
// whatsapp-catalogue-pdf function (kept for 6 hours) and sent as a WhatsApp document.
const CATALOGUE_PDF_WORDS = /\b(pdf|catalogue|catalog|price\s*list|rate\s*list|product\s*list|products\s*list|full\s*list)\b/i;
const NOT_A_PDF_REQUEST = /\b(orders|status|deliver|delivery|schemes?|offers?|dues?|loyalty)\b/i;

async function getCataloguePdf(): Promise<{ url: string; count: number | null; generatedAt: string | null } | null> {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-catalogue-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      console.error('Catalogue PDF function error:', res.status);
      return null;
    }
    const data = await res.json();
    return data?.url ? { url: data.url, count: data.count ?? null, generatedAt: data.generatedAt ?? null } : null;
  } catch (e) {
    console.error('Catalogue PDF request failed:', (e as any)?.message || e);
    return null;
  }
}

// Returns true when the message asked for the PDF (and a reply was sent).
async function handleCataloguePdfRequest(supabase: any, phone: string, message: string): Promise<boolean> {
  if (!CATALOGUE_PDF_WORDS.test(message) || NOT_A_PDF_REQUEST.test(message)) return false;

  const pdf = await getCataloguePdf();
  if (!pdf) {
    await sendTwilioFreeForm(phone, `Sorry, I could not prepare the product list right now. Send *products* to see 5 products, or try again in a minute.`);
    return true;
  }
  const date = pdf.generatedAt
    ? new Date(pdf.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : null;
  const caption = `📄 *Product list*${pdf.count ? ` — ${pdf.count.toLocaleString('en-IN')} items` : ''}${date ? `, prices as of ${date}` : ''}.\n\n` +
    `To order, type your items and quantities here, for example:\n*${await orderExample(supabase)}*`;
  await sendTwilioFreeForm(phone, caption, pdf.url);
  return true;
}

// Short welcome after "place order": how to order, a few products, and how to get the PDF.
// An example order line built from real products of the product master (never made-up names).
// Falls back to a plain placeholder when the catalogue cannot be read.
async function orderExample(supabase: any): Promise<string> {
  try {
    const rows = await loadCatalogueRows(supabase, {});
    const names = rows.slice(0, 2).map(r => r.plain);
    if (names.length >= 2) return `${names[0]} 5, ${names[1]} 3`;
    if (names.length === 1) return `${names[0]} 5`;
  } catch (_e) { /* use the placeholder below */ }
  return 'product name 5';
}

async function buildWelcomeReply(supabase: any, retailerName: string): Promise<string> {
  let sample = '';
  try {
    const rows = await loadCatalogueRows(supabase, {});
    sample = rows.slice(0, PRODUCT_PAGE_SIZE).map(r => `• ${r.label} — ${r.text}`).join('\n');
  } catch (e) {
    console.error('Welcome product sample error:', (e as any)?.message || e);
  }
  return `👋 Hello *${retailerName}*! Let's place your order.\n\n` +
    `Type your items and quantities, for example:\n*${await orderExample(supabase)}*\n` +
    (sample ? `\n📦 *A few of our products:*\n${sample}\n` : '') +
    `\n📄 Send *pdf* to get the full product list as a PDF.`;
}

async function handleProductListQuery(supabase: any, phone: string, message: string): Promise<string | null> {
  const lower = message.toLowerCase().trim();
  const bare = normalizeReply(message);

  // "more" / "next" continues the list the retailer was last shown (kept for 30 minutes).
  if (['more', 'next', 'next page', 'show more', 'more products', 'aur', 'aur dikhao', 'aage'].includes(bare)) {
    const ctx = await loadContext(supabase, phone);
    if (ctx?.last_intent !== 'product_list_page') return null;
    const e = ctx.last_entity || {};
    return await buildProductPage(
      supabase, phone,
      { categoryIds: e.categoryIds, productIds: e.productIds, label: e.label },
      Number(e.nextOffset) || 0,
    );
  }

  // Questions that belong to other handlers.
  if (/\b(how many|count|total|price|rate|cost|mrp|stock|order|orders|deliver|delivery|schemes?|offers?|discounts?|dues?|loyalty|points?|when|kab|new|launch)\b/.test(lower)) return null;

  const asksCategories = /\bcategor(y|ies)\b/.test(lower);
  const hasProductWord = /\b(products?|items?|catalog(ue)?)\b/.test(lower);
  const hasListVerb = /\b(show|list|display|dikhao|dikha|batao|bataiye|give|send|see|what|which)\b/.test(lower);
  const exact = new Set(['products', 'product list', 'products list', 'catalog', 'catalogue', 'items', 'item list', 'all products', 'categories']);
  const isListIntent = exact.has(bare) || asksCategories || (hasProductWord && hasListVerb)
    || /^[\p{L}\p{N}\s]+\s(products?|items?)$/u.test(bare);
  if (!isListIntent) return null;

  const term = bare
    .replace(/\b(show|list|display|dikhao|dikha|batao|bataiye|give|send|see|me|all|the|products?|items?|catalog(ue)?|categories|category|in|of|under|from|what|which|are|is|do|you|have|your|our|available|kya|hai|hain|ke|ka|ki|mein|sab|sare|please|plz|a|an|any|full|complete|and|also|let|can|i|want|need|to|get|name|names|wala|wali|my|mere|apne)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "categories" → the list of categories.
  if (!term && asksCategories) {
    const { data: cats } = await supabase.from('product_categories').select('name').order('name').limit(50);
    if (!cats || cats.length === 0) return 'There are no product categories right now.';
    return `📂 *Categories*\n\n${cats.map((c: any) => `• ${c.name}`).join('\n')}\n\nSend for example *show ${cats[0].name} products* to see its items.`;
  }

  // Nothing but "show products" → first page of everything.
  if (!term) return await buildProductPage(supabase, phone, {}, 0);

  // Otherwise the rest of the sentence is a category ("tea") or part of a product name.
  const words = nameWords(term);
  if (words.length === 0) return await buildProductPage(supabase, phone, {}, 0);
  const searchTerms = [...new Set(words.flatMap(w => [w, ...wordVariants(w)]))];

  const { data: cats } = await supabase
    .from('product_categories')
    .select('id, name')
    .or(searchTerms.map(t => `name.ilike.%${t}%`).join(','))
    .limit(20);
  const catHits = (cats || []).filter((c: any) => labelMatch(words, c.name) === 'exact');
  if (catHits.length > 0) {
    return await buildProductPage(supabase, phone, { categoryIds: catHits.map((c: any) => c.id), label: catHits.map((c: any) => c.name).join(', ') }, 0);
  }

  const { data: byName } = await supabase
    .from('products')
    .select('id, name')
    .or(searchTerms.map(t => `name.ilike.%${t}%`).join(','))
    .eq('is_active', true)
    .limit(100);
  const nameHits = (byName || []).filter((p: any) => labelMatch(words, p.name) === 'exact');
  if (nameHits.length > 0) {
    return await buildProductPage(supabase, phone, { productIds: nameHits.map((p: any) => p.id), label: term }, 0);
  }

  return `I could not find a category or product called "${term}". Send *categories* to see all categories.`;
}

// ── Follow-Up Query Handler ─────────────────────────────────────────
async function handleFollowUpQuery(
  supabase: any,
  phone: string,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase().trim();

  // Detect follow-up phrases
  const followUpPatterns = [
    'what are those', 'show them', 'list them', 'list products',
    'tell me more', 'show me', 'batao', 'dikhao', 'kya hai',
    'which ones', 'what products', 'show all',
  ];

  const isFollowUp = followUpPatterns.some(p => lower.includes(p));
  if (!isFollowUp) return null;

  const context = await loadContext(supabase, phone);
  if (!context || !context.last_intent) {
    return "Could you clarify what you're referring to? You can ask about products, orders, or delivery status.";
  }

  if (context.last_intent === 'product_list') {
    // First short page of the catalogue instead of one very long message.
    return await buildProductPage(supabase, phone, {}, 0);
  }

  if (context.last_intent === 'order_query' && context.last_order_id) {
    // Re-fetch that order's status
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, delivery_status, payment_status, total_amount, order_date')
      .eq('id', context.last_order_id)
      .maybeSingle();

    if (order) {
      return `📦 *Order #${order.id.substring(0, 8)}*\n📊 Status: ${order.status}\n🚚 Delivery: ${order.delivery_status || 'Pending'}\n💰 Total: ₹${Number(order.total_amount).toFixed(2)}`;
    }
  }

  return "Could you clarify what you're referring to? You can ask about products, orders, or delivery status.";
}

// ── Delivery Query Handler ──────────────────────────────────────────
async function handleDeliveryQuery(
  supabase: any,
  phone: string,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase();

  const deliveryPatterns = [
    'when will i receive', 'delivery status', 'order delivery',
    'kab milega', 'kab aayega', 'delivery kab', 'when will my order',
    'order kab aayega', 'mera order kab',
  ];

  const isDeliveryQuery = deliveryPatterns.some(p => lower.includes(p));
  if (!isDeliveryQuery) return null;

  const retailer = await findRetailerByPhone(supabase, phone);
  if (!retailer) {
    return "I couldn't find an account linked to this number. Please contact your sales representative.";
  }

  // Check context for last_order_id
  const context = await loadContext(supabase, phone);
  let order: any = null;

  if (context?.last_order_id) {
    const { data } = await supabase
      .from('orders')
      .select('id, status, delivery_status, total_amount, order_date, created_at')
      .eq('id', context.last_order_id)
      .maybeSingle();
    order = data;
  }

  if (!order) {
    // Fetch latest order for this retailer
    const { data } = await supabase
      .from('orders')
      .select('id, status, delivery_status, total_amount, order_date, created_at')
      .eq('retailer_id', retailer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    order = data;
  }

  if (!order) {
    return "❌ No orders found for your account yet.";
  }

  const shortId = order.id.substring(0, 8);
  const orderDate = order.order_date || order.created_at?.split('T')[0] || 'N/A';
  const deliveryStatus = order.delivery_status || 'Pending';

  let expectedDelivery = '';
  if (deliveryStatus === 'delivered') {
    expectedDelivery = '✅ Your order has been delivered!';
  } else if (deliveryStatus === 'dispatched' || deliveryStatus === 'in_transit') {
    expectedDelivery = '🚚 Your order is on the way! Expected delivery within 1-2 days.';
  } else {
    expectedDelivery = '📋 Your order is being processed. Expected delivery within 2-3 business days.';
  }

  // Save context
  await saveContext(supabase, phone, 'order_query', {}, order.id);

  return `🚚 *Delivery Status*\n\n🆔 Order: #${shortId}\n📅 Ordered: ${orderDate}\n📊 Status: ${order.status}\n🚚 Delivery: ${deliveryStatus}\n💰 Total: ₹${Number(order.total_amount).toFixed(2)}\n\n${expectedDelivery}`;
}

// ── Order Status Query Handler ──────────────────────────────────────
async function handleOrderStatusQuery(
  supabase: any,
  phone: string,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase();
  // Intent detection: must contain "order" and "status"
  const isStatusQuery = (lower.includes('order') && lower.includes('status')) ||
    lower.includes('order status');
  if (!isStatusQuery) return null;

  // Find retailer by phone
  const retailer = await findRetailerByPhone(supabase, phone);
  if (!retailer) {
    return "I couldn't find an account linked to this number. Please contact your sales representative.";
  }

  // Extract order ID via regex (UUID or short ID)
  const idMatch = message.match(/order\s*#?\s*([a-f0-9-]{8,36})/i);
  const orderId = idMatch ? idMatch[1] : null;

  let query = supabase
    .from('orders')
    .select('id, status, delivery_status, payment_status, total_amount, order_date, invoice_number, created_at')
    .eq('retailer_id', retailer.id);

  if (orderId) {
    query = query.ilike('id', `${orderId}%`);
  } else {
    query = query.order('created_at', { ascending: false }).limit(1);
  }

  const { data: orders, error } = await query;
  if (error) {
    console.error('Order status query error:', error);
    return "Sorry, I couldn't fetch order details right now. Please try again later.";
  }

  const order = orders?.[0];
  if (!order) {
    return orderId
      ? `❌ No order found with ID #${orderId}. Please check your order ID and try again.`
      : "❌ No orders found for your account yet.";
  }

  const shortId = order.id.substring(0, 8);
  const orderDate = order.order_date || order.created_at?.split('T')[0] || 'N/A';
  const total = order.total_amount != null ? `₹${Number(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A';

  return `📦 *Order Status*

🆔 Order: #${shortId}
📅 Date: ${orderDate}
📊 Status: ${order.status || 'N/A'}
🚚 Delivery: ${order.delivery_status || 'Pending'}
💳 Payment: ${order.payment_status || 'Pending'}
💰 Total: ${total}`;
}
// ── Retailer Info Query Handler ─────────────────────────────────────
async function handleRetailerInfoQuery(
  supabase: any,
  phone: string,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase();

  const isRetailerInfoQuery =
    /\b(my\s*(store|shop|details|retailer|revenue|orders|performance|info))\b/.test(lower) ||
    /\b(store\s*details|retailer\s*details)\b/.test(lower) ||
    /\b(how\s*many\s*orders|total\s*orders|total\s*revenue)\b/.test(lower) ||
    /\b(tell\s*me\s*about\s*my\s*(store|shop))\b/.test(lower) ||
    /\b(give\s*me\s*my\s*(performance|details))\b/.test(lower) ||
    /\b(show\s*my\s*(retailer|store|shop)\s*details)\b/.test(lower);

  if (!isRetailerInfoQuery) return null;

  const retailer = await findRetailerByPhone(supabase, phone);
  if (!retailer) {
    return "I couldn't find a retailer account linked to this number. Please contact your sales representative to register.";
  }

  // Fetch full retailer details
  const { data: retailerDetails } = await supabase
    .from('retailers')
    .select('name, owner_name, address, city, state, phone')
    .eq('id', retailer.id)
    .single();

  // Fetch order stats
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, total_amount, created_at')
    .eq('retailer_id', retailer.id)
    .order('created_at', { ascending: false });

  if (ordersError) {
    console.error('Retailer info orders query error:', ordersError);
  }

  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0) || 0;
  const lastOrderDate = orders?.[0]?.created_at?.split('T')[0] || 'N/A';
  const formattedRevenue = `₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const r = retailerDetails || {};
  const addressParts = [r.address, r.city, r.state].filter(Boolean).join(', ');

  return `📊 *Your Store Details*

🏪 Name: ${r.name || retailer.name || 'N/A'}
👤 Owner: ${r.owner_name || 'N/A'}
📍 Address: ${addressParts || 'N/A'}

📦 Total Orders: ${totalOrders}
💰 Total Revenue: ${formattedRevenue}
📅 Last Order: ${lastOrderDate}`;
}

// ── Product Count Query ─────────────────────────────────────────────
async function handleProductCountQuery(
  supabase: any,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase();

  // Never intercept order/delivery questions ("how many products did I
  // order?") — those belong to the existing handlers and the AI path.
  if (lower.includes('order') || lower.includes('deliver')) return null;

  const isProductCountQuery =
    /(how\s*many|number\s*of|total(\s*number\s*of)?|count\s*of)\s*(active\s*)?products/.test(lower) ||
    /\bproducts?\s*count\b/.test(lower) ||
    /\bkitne\s*products?\b/.test(lower) ||
    /\bproducts?\s*kitne\b/.test(lower);

  if (!isProductCountQuery) return null;

  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    console.error('Product count query error:', error.message);
    return null; // fall through to the normal AI path
  }

  console.log(`📦 Product count intent matched — ${count} active products`);
  return `📦 We currently have *${count ?? 0}* active products in our catalog.`;
}

// ── Schemes / Discounts Query ───────────────────────────────────────
async function handleSchemesQuery(
  supabase: any,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase();

  // Order/delivery questions belong to the existing handlers and AI path.
  if (lower.includes('order') || lower.includes('deliver')) return null;

  if (!/\b(schemes?|offers?|discounts?)\b/.test(lower)) return null;

  const { data: schemes, error } = await supabase
    .from('product_schemes')
    .select('name, scheme_type, discount_percentage, discount_amount, buy_quantity, free_quantity, condition_quantity, min_order_value, buy_quantity_unit, product_id, category_id')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Schemes query error:', error.message);
    return null; // fall through to the normal AI path
  }

  if (!schemes || schemes.length === 0) {
    return 'There are no active schemes or offers right now.';
  }

  // Resolve target product/category names in one batched lookup each.
  const productIds = [...new Set(schemes.map((s: any) => s.product_id).filter(Boolean))];
  const categoryIds = [...new Set(schemes.map((s: any) => s.category_id).filter(Boolean))];
  const productNames = new Map<string, string>();
  const categoryNames = new Map<string, string>();
  const inactiveProducts = new Set<string>();
  if (productIds.length > 0) {
    const { data } = await supabase.from('products').select('id, name, is_active').in('id', productIds);
    for (const p of data || []) {
      if (p.is_active === false) inactiveProducts.add(p.id); // never name an inactive product to a retailer
      else productNames.set(p.id, p.name);
    }
  }
  if (categoryIds.length > 0) {
    const { data } = await supabase.from('product_categories').select('id, name').in('id', categoryIds);
    for (const c of data || []) categoryNames.set(c.id, c.name);
  }

  // Benefit wording is field-driven, not scheme_type-driven, because live
  // type strings vary (buy_x_get_y_free, manual_per_unit_discount, …).
  const describe = (s: any): string => {
    let benefit = '';
    if (Number(s.buy_quantity) > 0 && Number(s.free_quantity) > 0) {
      const unit = s.buy_quantity_unit ? ` ${s.buy_quantity_unit}` : '';
      benefit = `Buy ${s.buy_quantity}${unit} Get ${s.free_quantity} Free`;
    } else if (Number(s.discount_percentage) > 0) {
      benefit = `${Number(s.discount_percentage)}% Off`;
    } else if (Number(s.discount_amount) > 0) {
      benefit = `₹${Number(s.discount_amount)} Off`;
    }
    const target = s.product_id
      ? (productNames.get(s.product_id) || null)
      : s.category_id
        ? (categoryNames.get(s.category_id) ? `${categoryNames.get(s.category_id)} category` : null)
        : 'All products';
    const parts: string[] = [];
    if (benefit) parts.push(benefit);
    if (target) parts.push(`on ${target}`);
    if (Number(s.condition_quantity) > 0 && !(Number(s.buy_quantity) > 0 && Number(s.free_quantity) > 0)) {
      parts.push(`(min qty ${Number(s.condition_quantity)})`);
    }
    if (Number(s.min_order_value) > 0) parts.push(`(min order ₹${Number(s.min_order_value)})`);
    return parts.length > 0 ? `*${s.name}* — ${parts.join(' ')}` : `*${s.name}*`;
  };

  // Schemes on a product that is no longer active are not shown.
  const visibleSchemes = schemes.filter((s: any) => !(s.product_id && inactiveProducts.has(s.product_id)));
  if (visibleSchemes.length === 0) return 'There are no active schemes or offers right now.';

  const MAX_LISTED = 8;
  const lines = visibleSchemes.slice(0, MAX_LISTED).map((s: any, i: number) => `${i + 1}. ${describe(s)}`);
  if (visibleSchemes.length > MAX_LISTED) {
    lines.push(`…and ${visibleSchemes.length - MAX_LISTED} more offers.`);
  }

  console.log(`🎁 Schemes intent matched — ${visibleSchemes.length} active schemes`);
  return `🎁 *Available Schemes & Offers (${visibleSchemes.length})*\n\n${lines.join('\n')}`;
}

// ── Outstanding Dues Query ──────────────────────────────────────────
async function handleDuesQuery(
  supabase: any,
  phone: string,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase();

  // Order/delivery questions belong to the existing handlers and AI path;
  // "points balance" belongs to the loyalty handler.
  if (lower.includes('order') || lower.includes('deliver')) return null;
  if (/\bpoints?\b/.test(lower)) return null;

  const isDuesQuery =
    /\b(dues?|outstanding|bakaya|baki)\b/.test(lower) ||
    /how\s*much\s*(do\s*)?i\s*owe/.test(lower) ||
    /\bpending\s*(amount|payment|balance)\b/.test(lower) ||
    /\bmy\s*(pending|balance)\b/.test(lower);

  if (!isDuesQuery) return null;

  const retailer = await findRetailerByPhone(supabase, phone);
  if (!retailer) {
    return "I couldn't find an account linked to this number. Please contact your sales representative.";
  }

  const { data } = await supabase
    .from('retailers')
    .select('pending_amount')
    .eq('id', retailer.id)
    .maybeSingle();
  const pending = Number(data?.pending_amount ?? 0) || 0;

  console.log(`💰 Dues intent matched — ₹${pending}`);
  return pending > 0
    ? `💰 *Outstanding Balance*\n\nHi *${retailer.name}*, your current outstanding balance is *₹${pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}*.\n\nPlease coordinate with your sales representative for payment.`
    : `✅ Great news, *${retailer.name}* — you have no outstanding balance right now!`;
}

// ── Loyalty Points Query ────────────────────────────────────────────
async function handleLoyaltyQuery(
  supabase: any,
  phone: string,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase();

  if (lower.includes('order') || lower.includes('deliver')) return null;

  const isLoyaltyQuery =
    /\b(loyalty|rewards?)\b/.test(lower) ||
    (/\bpoints?\b/.test(lower) && /\b(my|balance|how\s*many|total|kitne)\b/.test(lower));

  if (!isLoyaltyQuery) return null;

  const retailer = await findRetailerByPhone(supabase, phone);
  if (!retailer) {
    return "I couldn't find an account linked to this number. Please contact your sales representative.";
  }

  const [{ data: earnedRows }, { data: redemptionRows }] = await Promise.all([
    supabase.from('retailer_loyalty_points').select('points').eq('retailer_id', retailer.id),
    supabase
      .from('retailer_loyalty_redemptions')
      .select('points_redeemed, status')
      .eq('retailer_id', retailer.id),
  ]);

  const earned = (earnedRows ?? []).reduce((s: number, r: any) => s + (Number(r.points) || 0), 0);
  const redeemed = (redemptionRows ?? [])
    .filter((r: any) => !['rejected', 'cancelled'].includes(String(r.status ?? '').toLowerCase()))
    .reduce((s: number, r: any) => s + (Number(r.points_redeemed) || 0), 0);
  const balance = Math.max(0, earned - redeemed);

  console.log(`🌟 Loyalty intent matched — earned ${earned}, redeemed ${redeemed}`);
  return `🌟 *Loyalty Points — ${retailer.name}*\n\nEarned: ${earned}\nRedeemed: ${redeemed}\nAvailable balance: *${balance}*`;
}

// ── Next Visit Query ────────────────────────────────────────────────
async function handleNextVisitQuery(
  supabase: any,
  phone: string,
  message: string
): Promise<string | null> {
  const lower = message.toLowerCase();

  if (lower.includes('order') || lower.includes('deliver')) return null;

  const isNextVisitQuery =
    /\bnext\s*visit\b/.test(lower) ||
    (/\bwhen\b/.test(lower) && /\b(visit|come|coming)\b/.test(lower) &&
      /\b(salesman|sales\s*rep|representative|you|team)\b/.test(lower)) ||
    /\b(salesman|sales\s*rep|representative)\b.*\b(kab|aayega|aa\s*raha)\b/.test(lower);

  if (!isNextVisitQuery) return null;

  const retailer = await findRetailerByPhone(supabase, phone);
  if (!retailer) {
    return "I couldn't find an account linked to this number. Please contact your sales representative.";
  }

  const today = new Date().toISOString().split('T')[0];
  const { data: visit } = await supabase
    .from('visits')
    .select('planned_date, status')
    .eq('retailer_id', retailer.id)
    .gte('planned_date', today)
    .neq('status', 'cancelled')
    .order('planned_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  console.log(`📅 Next-visit intent matched — ${visit?.planned_date ?? 'none scheduled'}`);
  if (!visit) {
    return `📅 No upcoming visit is scheduled for your store yet. Your sales representative will plan one soon.`;
  }
  if (visit.planned_date === today) {
    return `📅 *Next Visit*\n\nGood news — your store is on *today's* visit plan!`;
  }
  const d = new Date(`${visit.planned_date}T00:00:00`);
  const label = Number.isNaN(d.getTime())
    ? visit.planned_date
    : d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  return `📅 *Next Visit*\n\nYour store is scheduled for a visit on *${label}*.`;
}

// Retailers see availability, never the exact warehouse count.
async function handleStockQuery(supabase: any, message: string, distributorId?: string | null): Promise<string | null> {
  const lower = message.toLowerCase();
  if (!/\b(stock|available|availability|avail)\b/.test(lower)) return null;
  if (/\b(order|orders|deliver|delivery|schemes?|offers?|dues?|price|rate|cost|mrp|loyalty|points?)\b/.test(lower)) return null;

  const term = lower
    .replace(/\b(how|many|much|quantity|quantities|qty|of|is|are|the|available|availability|avail|stock|in|do|does|you|have|any|kitna|kitne|hai|hain|kya|me|mein|ka|ki|ke|please|plz|check|left|ready|aaj|abhi|show|tell|us|there|for|a|an|can|get|want|need|still|now|today|ya|nahi)\b/g, ' ')
    .replace(/[?!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const CATALOGUE_WORDS = ['product', 'products', 'item', 'items', 'catalog', 'catalogue', 'list', 'all', 'what', 'which', 'new'];
  if (!term || nameWords(term).every(w => CATALOGUE_WORDS.includes(w))) {
    // "show available products" is a catalogue question, not a stock check.
    if (/\b(products?|items?|catalog(ue)?)\b/.test(lower)) return null;
    return 'Which product do you want to check? Send the product name, for example: *Is <product name> available?*';
  }

  const stockWords = nameWords(normalizeGluedSize(term));
  if (stockWords.length === 0) return null;

  const units = await loadSellableUnits(supabase, stockWords);
  const result = searchUnits(units, term);
  if (!result) {
    console.log(`📦 Stock intent matched — no product for "${term}"`);
    return `I could not find *${term}* in our products. Please check the name and try again.`;
  }
  const found = result.shown;
  const closest = result.closest;

  console.log(`📦 Stock intent matched — "${term}" → ${found.length} match(es)`);
  const stock = await loadDistributorStock(supabase, distributorId, found.slice(0, 8));
  return formatProductLines(
    closest ? `Closest matches for "${term}"` : term,
    found,
    result.sizeMissing ? 'We do not have that size. These are the sizes available.' : undefined,
    stock,
  );
}

// ── Product Price Query ───────────────────────────────────────────
async function handlePriceQuery(
  supabase: any,
  message: string,
  distributorId?: string | null
): Promise<string | null> {
  const lower = message.toLowerCase();

  if (lower.includes('order') || lower.includes('deliver')) return null;
  if (!/\b(price|rate|cost|mrp)\b/.test(lower)) return null;

  // Extract the product term: "price of X" / "X ka price" / "X price".
  let term = '';
  const m1 = lower.match(/\b(?:price|rate|cost|mrp)\s+(?:of|for)\s+(.+?)[?.!\s]*$/);
  const m2 = lower.match(/^(.+?)\s+(?:ka\s+|ki\s+)?(?:price|rate|cost|mrp)\b/);
  if (m1) term = m1[1];
  else if (m2) term = m2[1];
  term = term
    .replace(/\b(the|a|an|what|whats|what's|is|are|tell|me|please|much|how|products?|items?|ka|ki|kya|hai)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Too vague to search deterministically — let the AI path handle it.
  if (!term || term.length < 2) return null;

  // Pack-size aware answer: products AND their sizes (variants), each with its own price.
  // The old name search below stays as a fallback for anything this does not find.
  const priceWords = nameWords(normalizeGluedSize(term));
  if (priceWords.length > 0) {
    const units = await loadSellableUnits(supabase, priceWords);
    const result = searchUnits(units, term);
    if (result) {
      const { shown, closest, sizeMissing } = result;
      console.log(`🏷️ Price intent matched — "${term}" → ${shown.length} item(s) incl. sizes`);
      const stock = await loadDistributorStock(supabase, distributorId, shown.slice(0, 8));
      if (shown.length === 1 && !closest && !sizeMissing) {
        const badge = stockBadge(shown[0], stock);
        return `🏷️ *${shown[0].label}* — ${priceText(shown[0])}${badge ? ` · ${badge}` : ''}`;
      }
      return formatProductLines(
        closest ? `Closest matches for "${term}"` : term,
        shown,
        sizeMissing ? 'We do not have that size. These are the sizes available.' : undefined,
        stock,
      );
    }
  }

  // Token-based "grep": every token must match somewhere in the name (AND),
  // so "nivea lotion" finds "Nivea Derma Lotion". If that yields nothing,
  // fall back to any-token matches (OR) so near-miss phrasings still
  // surface the closest products. Tokens are alphanumeric-only, which also
  // keeps the ILIKE/.or() syntax safe.
  const tokens = term
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 2)
    .slice(0, 5);
  if (tokens.length === 0) return null;

  let query = supabase
    .from('products')
    .select('name, rate, unit')
    .eq('is_active', true);
  for (const t of tokens) query = query.ilike('name', `%${t}%`);
  let { data: products } = await query.order('name').limit(5);

  if ((!products || products.length === 0) && tokens.length > 1) {
    const { data: anyMatches } = await supabase
      .from('products')
      .select('name, rate, unit')
      .eq('is_active', true)
      .or(tokens.map((t) => `name.ilike.%${t}%`).join(','))
      .order('name')
      .limit(5);
    products = anyMatches;
  }

  if (!products || products.length === 0) {
    console.log(`🏷️ Price intent matched — no product for "${term}"`);
    return `I couldn't find a product matching "${term}" in our catalog.`;
  }

  console.log(`🏷️ Price intent matched — "${term}" → ${products.length} match(es)`);
  if (products.length === 1) {
    const p = products[0];
    return `🏷️ *${p.name}* — ₹${Number(p.rate).toFixed(2)}/${p.unit || 'unit'}`;
  }
  return (
    `🏷️ *Prices — matches for "${term}"*\n\n` +
    products.map((p: any) => `• ${p.name} — ₹${Number(p.rate).toFixed(2)}/${p.unit || 'unit'}`).join('\n')
  );
}

// ── System Prompt Builder ───────────────────────────────────────────
function buildSystemPrompt(today: string, session: Session): string {
  let prompt = `You are a field sales assistant for a distribution/sales app. Today's date is ${today}.

CRITICAL RULES — follow these without exception:
1. ALWAYS call a tool when the user asks about orders, revenue, sales, retailers, or products. NEVER ask for dates — default to the last 7 days if no dates are specified.
2. Interpret natural language dates relative to today (${today}).
3. If the user provides only dates, check conversation history for context. If unclear, use get_revenue_summary as default.
4. For single-word queries like "Orders" or "Revenue" — immediately call the relevant tool with the last 7 days.
5. Keep replies concise (2-4 lines) and format numbers with ₹ for Indian currency.
6. For general greetings, respond warmly and mention you can help with order queries, revenue, retailer insights, product info, and placing orders.
7. When the user asks about products — call get_products immediately.
8. When the user asks about their store or account details — call get_retailer_info. It only returns the user's own store; never discuss other retailers or company-wide figures.
9. NEVER say "please provide dates". Always infer or default.`;

  if (session.state === 'AWAITING_ORDER_DETAILS') {
    prompt += `\n\n⚠️ CURRENT STATE: The user is placing an order for retailer "${session.retailer_name}".
They need to tell you which products and quantities they want.
When they provide product names with quantities, use the place_order tool to parse them.
Example user input: "5 kg adrak, 3 packets vayu 50g, 2 kg haldi powder"
Parse these into structured items using the place_order tool.
Pack size (like 20g or 100ml) belongs in productName, not in quantity. If the user did not say how many, leave quantity out so the bot can ask.
ALWAYS call place_order when the message names products. NEVER write a list of products, sizes or prices yourself and never ask the user to choose between items: the place_order tool does that.`;
  } else if (session.state === 'CONFIRMING_ORDER') {
    prompt += `\n\n⚠️ CURRENT STATE: The user has a pending order confirmation.
If they say yes/confirm/ok, the order will be confirmed.
If they say no/cancel, the order will be discarded.
Do NOT call any tools — just acknowledge their response naturally.`;
  }

  prompt += `\n\n10. When the user says "Place Order", "I want to order", or similar — tell them you'll help place an order and ask what products they'd like. The place_order tool will handle parsing.`;

  return prompt;
}

// ── Main Handler ────────────────────────────────────────────────────
// ── In-memory caches (warm-instance only, best-effort) ──────────────
const RETAILER_CACHE_TTL = 5 * 60 * 1000;
const retailerByPhoneCache = new Map<string, { value: any; expiresAt: number }>();
const recentMessageSids = new Map<string, number>(); // SID -> timestamp, for dedup
const MSG_DEDUP_TTL = 60 * 1000;

async function getRetailerCached(supabase: any, phone: string): Promise<any | null> {
  const cached = retailerByPhoneCache.get(phone);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await findRetailerByPhone(supabase, phone);
  retailerByPhoneCache.set(phone, { value, expiresAt: Date.now() + RETAILER_CACHE_TTL });
  return value;
}

function setRetailerCache(phone: string, value: any): void {
  retailerByPhoneCache.set(phone, { value, expiresAt: Date.now() + RETAILER_CACHE_TTL });
}

function getCachedRetailerName(phone: string): string {
  const cached = retailerByPhoneCache.get(phone);
  if (!cached || cached.expiresAt <= Date.now()) return '';
  return cleanDisplayName(cached.value?.name || '');
}

function cleanDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 60);
}

const GREETING_SET = new Set(['hi', 'hello', 'hey', 'namaste', 'hii', 'hiii', 'start', 'menu']);
const recentGreetings = new Map<string, number>();
const unknownNumberNotified = new Map<string, number>(); // phone -> last polite reply (best-effort, per instance)
const UNKNOWN_NUMBER_REPLY_TTL = 24 * 60 * 60 * 1000;
const GREETING_DEDUP_TTL = 30_000;

function sendStaticGreetingTwiml(): Response {
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Response><Message>Hello! I am your Field Sales Assistant. How can I help you today?</Message></Response>`;
  return new Response(twiml, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  });
}

async function sendPlaceOrderTemplateAsync(phone: string): Promise<void> {
  try {
    await sendTwilioTemplate(phone);
  } catch (e) {
    console.error('❌ [bg] place-order template error:', e);
  }
}

serve(async (req) => {
  const t0 = performance.now();
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Warm-up ping endpoint: returns 200 immediately, no heavy work ──
  // Hit via GET ?ping=1 (or path ending /ping) to keep the instance hot.
  const url = new URL(req.url);
  if (req.method === 'GET' && (url.searchParams.get('ping') === '1' || url.pathname.endsWith('/ping'))) {
    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let body = '';
    let from = '';
    let messageSid = '';
    let profileName = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.text();
      const params = new URLSearchParams(formData);
      body = params.get('Body') || '';
      from = params.get('From') || '';
      messageSid = params.get('MessageSid') || '';
      profileName = params.get('ProfileName') || '';
    } else {
      const json = await req.json();
      body = json.Body || '';
      from = json.From || '';
      messageSid = json.MessageSid || '';
      profileName = json.ProfileName || '';
    }

    const message = body.trim();
    const phone = from;

    // ── Dedup repeated Twilio retries (in-memory, best-effort) ──
    const now = Date.now();
    for (const [sid, ts] of recentMessageSids) {
      if (now - ts > MSG_DEDUP_TTL) recentMessageSids.delete(sid);
    }
    if (messageSid && recentMessageSids.has(messageSid)) {
      return sendEmptyTwiml();
    }
    if (messageSid) recentMessageSids.set(messageSid, now);

    // No automatic replies for KVP Marketing: acknowledge Twilio with an empty TwiML and stop.
    if (!KVP_AUTO_REPLIES_ENABLED) {
      console.log(`webhook_latency_ms=${(performance.now() - t0).toFixed(0)} path=auto-replies-disabled`);
      return sendEmptyTwiml();
    }

    // ── Fast-path: greeting → instant TwiML text reply, then template w/ button async ──
    if (GREETING_SET.has(message.toLowerCase())) {
      const last = recentGreetings.get(phone);
      if (!last || now - last > GREETING_DEDUP_TTL) {
        recentGreetings.set(phone, now);
        // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(sendPlaceOrderTemplateAsync(phone));
      }
      console.log(`webhook_latency_ms=${(performance.now() - t0).toFixed(0)} path=greeting`);
      return sendStaticGreetingTwiml();
    }

    console.log(`📩 WhatsApp from ${phone}: "${message}" (SID: ${messageSid})`);

    // ── All other messages: process in background, return empty TwiML now ──
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(processMessageAsync(phone, message));
    console.log(`webhook_latency_ms=${(performance.now() - t0).toFixed(0)} path=async`);
    return sendEmptyTwiml();
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return sendEmptyTwiml();
  }
});

// ── Background: full message processing ─────────────────────────────
async function processMessageAsync(phone: string, message: string): Promise<void> {
  const tStart = performance.now();
  const supabase = getSupabaseClient();
  let aiReply = "Sorry, something went wrong.";

  try {
    // Numbers that are not a registered retailer never reach the AI: no AI cost, nothing logged.
    const knownRetailer = await findRetailerByPhone(supabase, phone);
    if (!knownRetailer) {
      const last = unknownNumberNotified.get(phone);
      if (!last || Date.now() - last > UNKNOWN_NUMBER_REPLY_TTL) {
        unknownNumberNotified.set(phone, Date.now());
        await sendTwilioFreeForm(phone, "Sorry, this number is not registered with us. If you are a retailer, please contact your sales representative to get registered.");
      }
      console.log('🚫 [bg] Message from unregistered number ignored (no AI call)');
      return;
    }

    // Photos, voice notes and files arrive with no text; the bot cannot read them yet.
    if (!message) {
      await sendTwilioFreeForm(phone, "I can only read text messages for now. Please type what you need, for example: *place order* or *my orders*.");
      return;
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

    const today = new Date().toISOString().split('T')[0];

    const tSession = performance.now();
    const session = await loadOrCreateSession(supabase, phone);
    console.log(`📋 [bg] Session state: ${session.state}, retailer: ${session.retailer_name || 'none'} (loaded in ${(performance.now() - tSession).toFixed(0)}ms)`);

    // Always attach the chatting retailer to the session. Without this, an order started by typing items
    // (no "place order" first) had no retailer and could never be saved.
    if (!session.retailer_id) {
      session.retailer_id = knownRetailer.id;
      session.retailer_name = knownRetailer.name;
      session.owner_id = knownRetailer.owner_id || knownRetailer.user_id || null;
      session.beat_id = knownRetailer.beat_id || null;
      session.territory_id = knownRetailer.territory_id || null;
    }


      // ── Handle CONFIRMING_ORDER state ──
      if (session.state === 'CONFIRMING_ORDER') {
        const reply = normalizeReply(message);
        if (CONFIRM_WORDS.has(reply)) {
          // Take the draft exactly once: only the first "yes" can flip it out of CONFIRMING_ORDER,
          // so a double tap or a repeated delivery can never save a second order.
          const { data: claimed } = await supabase
            .from('whatsapp_sessions')
            .update({ state: 'IDLE' })
            .eq('id', session.id)
            .eq('state', 'CONFIRMING_ORDER')
            .select('id')
            .maybeSingle();
          if (!claimed) {
            await sendTwilioFreeForm(phone, "Your order is already being placed or was placed. Send *my orders* to check its status.");
            return;
          }

          const result = await confirmOrder(supabase, session);
          aiReply = result.message;
          if (!result.ok && result.restoreDraft) {
            session.state = 'CONFIRMING_ORDER'; // nothing was saved: keep the draft so the retailer can say YES again
          } else if (!result.ok) {
            session.state = 'IDLE';
            session.pending_items = [];
          }
          // Save context with the order ID
          if (result.ok && session.retailer_id) {
            const { data: lastOrder } = await supabase
              .from('orders')
              .select('id')
              .eq('retailer_id', session.retailer_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            await saveContext(supabase, phone, 'order_placed', {}, lastOrder?.id || null);
          }
          await saveSession(supabase, session);
          await sendTwilioFreeForm(phone, aiReply); return;
        } else if (CANCEL_WORDS.has(reply)) {
          const { data: cancelled } = await supabase
            .from('whatsapp_sessions')
            .update({ state: 'IDLE' })
            .eq('id', session.id)
            .eq('state', 'CONFIRMING_ORDER')
            .select('id')
            .maybeSingle();
          if (!cancelled) {
            await sendTwilioFreeForm(phone, "That order was already handled. Send *my orders* to check its status.");
            return;
          }
          session.state = 'IDLE';
          session.pending_items = [];
          await saveSession(supabase, session);
          aiReply = "Order cancelled. Let me know if you need anything else!";
          await sendTwilioFreeForm(phone, aiReply); return;
        }
        // If neither confirm nor cancel, fall through to Gemini
      }

      // ── A bare yes/no when no order is waiting for confirmation ──
      if (session.state !== 'CONFIRMING_ORDER') {
        const bare = normalizeReply(message);
        const isYes = CONFIRM_WORDS.has(bare) && bare !== 'ok' && bare !== 'okay';
        const isNo = CANCEL_WORDS.has(bare);
        if (isYes || isNo) {
          if (isNo && session.state === 'AWAITING_ORDER_DETAILS') {
            session.state = 'IDLE';
            session.pending_items = [];
            aiReply = "Okay, your order was cancelled. Send *place order* any time to start a new one.";
          } else if (isNo) {
            aiReply = "Okay! Let me know if you need anything else.";
          } else {
            aiReply = "There is no order waiting for your confirmation. If you just placed one, send *my orders* to check it. To start a new order, send *place order*.";
          }
          await saveSession(supabase, session);
          await sendTwilioFreeForm(phone, aiReply); return;
        }
      }

      // ── Handle Order Status Query ──
      const statusReply = await handleOrderStatusQuery(supabase, phone, message);
      if (statusReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: statusReply }] }
        );
        // Save context for follow-ups
        const retailer = await findRetailerByPhone(supabase, phone);
        if (retailer) {
          const { data: latestOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('retailer_id', retailer.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          await saveContext(supabase, phone, 'order_query', {}, latestOrder?.id || null);
        }
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, statusReply); return;
      }

      // ── Handle Next Visit Query ──
      // Runs before Retailer Info so "when is the next visit to my store?"
      // gets the visit date instead of the generic store-details card
      // ("my store" alone, without visit wording, still goes to store info).
      const nextVisitReply = await handleNextVisitQuery(supabase, phone, message);
      if (nextVisitReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: nextVisitReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, nextVisitReply); return;
      }

      // ── Handle Retailer Info Query ──
      const retailerInfoReply = await handleRetailerInfoQuery(supabase, phone, message);
      if (retailerInfoReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: retailerInfoReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, retailerInfoReply); return;
      }

      // ── Handle Delivery Query ──
      const deliveryReply = await handleDeliveryQuery(supabase, phone, message);
      if (deliveryReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: deliveryReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, deliveryReply); return;
      }

      // ── Handle Schemes / Discounts Query ──
      // Runs before Follow-Up so Hinglish phrasings like "schemes batao"
      // aren't swallowed by the generic follow-up patterns.
      const schemesReply = await handleSchemesQuery(supabase, message);
      if (schemesReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: schemesReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, schemesReply); return;
      }

      // ── Product list as a PDF ("pdf", "catalogue", "price list") ──
      if (await handleCataloguePdfRequest(supabase, phone, message)) return;

      // ── Handle Follow-Up Query ──
      // ── Handle Product List / Category / "more" ──
      const productListReply = await handleProductListQuery(supabase, phone, message);
      if (productListReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: productListReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, productListReply); return;
      }

      const followUpReply = await handleFollowUpQuery(supabase, phone, message);
      if (followUpReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: followUpReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, followUpReply); return;
      }

      // ── Handle Product Count Query ──
      const productCountReply = await handleProductCountQuery(supabase, message);
      if (productCountReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: productCountReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, productCountReply); return;
      }

      // ── Handle Loyalty Points Query ──
      const loyaltyReply = await handleLoyaltyQuery(supabase, phone, message);
      if (loyaltyReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: loyaltyReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, loyaltyReply); return;
      }

      // ── Handle Outstanding Dues Query ──
      const duesReply = await handleDuesQuery(supabase, phone, message);
      if (duesReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: duesReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, duesReply); return;
      }

      // ── Handle Product Price Query ──
      const priceReply = await handlePriceQuery(supabase, message, knownRetailer.distributor_id);
      if (priceReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: priceReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, priceReply); return;
      }

      // ── Handle Stock / Availability Query ──
      const stockReply = await handleStockQuery(supabase, message, knownRetailer.distributor_id);
      if (stockReply) {
        session.conversation_history.push(
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: stockReply }] }
        );
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, stockReply); return;
      }

      // ── Handle "Place Order" intent — works from ANY state ──
      const lowerMsg = message.toLowerCase();
      const isPlaceOrderIntent = (
        lowerMsg.includes('place order') || lowerMsg.includes('i want to order') ||
        lowerMsg.includes('new order') || lowerMsg.includes('order karna') ||
        lowerMsg.includes('order place') || lowerMsg.includes('order do')
      );
      if (isPlaceOrderIntent) {
        // Reset any stale state
        session.pending_items = [];
        session.conversation_history = [];
        const retailer = await findRetailerByPhone(supabase, phone);
        if (!retailer) {
          aiReply = "I couldn't find a retailer linked to this phone number. Please contact your sales representative to register first.";
          await saveSession(supabase, session);
          await sendTwilioFreeForm(phone, aiReply); return;
        }

        session.retailer_id = retailer.id;
        session.retailer_name = retailer.name;
        session.owner_id = retailer.owner_id || retailer.user_id || null;
        session.beat_id = retailer.beat_id || null;
        session.territory_id = retailer.territory_id || null;
        session.state = 'AWAITING_ORDER_DETAILS';

        // A short welcome with 5 products and how to get the PDF (never the whole catalogue).
        aiReply = await buildWelcomeReply(supabase, retailer.name || 'there');
        await saveSession(supabase, session);
        await sendTwilioFreeForm(phone, aiReply); return;
      }

      // ── Order lines typed without "place order" ("Adrak 250g 5, Adrak 40g 3") start the order ──
      // Only when a quantity is written and at least one item is a real product; a bare name stays a search.
      if (session.state === 'IDLE') {
        const typed = parseOrderLines(message);
        if (typed && typed.length > 0 && typed.some(l => l.quantity !== undefined)) {
          let knownItem = false;
          for (const l of typed) {
            const us = await loadSellableUnits(supabase, nameWords(normalizeGluedSize(l.productName)));
            if (matchSellableUnit(us, l.productName).status !== 'none') { knownItem = true; break; }
          }
          if (knownItem) {
            session.pending_items = [];
            const started = await handlePlaceOrderTool(supabase, typed, session, '');
            if (started?.reply_text) {
              await saveSession(supabase, session);
              await sendTwilioFreeForm(phone, String(started.reply_text)); return;
            }
          }
        }
      }

      // ── A bare product name ("Marinero 130g"): line-by-line list, only when no order is in progress ──
      if (session.state === 'IDLE') {
        const searchReply = await handleProductSearchQuery(supabase, message, knownRetailer.distributor_id);
        if (searchReply) {
          session.conversation_history.push(
            { role: 'user', parts: [{ text: message }] },
            { role: 'model', parts: [{ text: searchReply }] }
          );
          await saveSession(supabase, session);
          await sendTwilioFreeForm(phone, searchReply); return;
        }
      }

      // ── Order step: change the order, or read the retailer's item list without the AI ──
      if (session.state === 'AWAITING_ORDER_DETAILS' || session.state === 'CONFIRMING_ORDER') {
        // "remove adrak", "change aduku to 8", "done"
        const editReply = handleDraftEdit(session, message);
        if (editReply) {
          await saveSession(supabase, session);
          await sendTwilioFreeForm(phone, editReply); return;
        }

        let orderResult: any = null;

        // A bare number answers the last "How many of X?" question.
        const bareQty = parseBareQuantity(message);
        if (bareQty !== null) {
          const ctx = await loadContext(supabase, phone);
          if (session.state === 'AWAITING_ORDER_DETAILS' && ctx?.last_intent === 'awaiting_quantity' && ctx.last_entity?.unit) {
            orderResult = await handlePlaceOrderTool(supabase, [{ resolvedUnit: ctx.last_entity.unit, quantity: bareQty }], session, message);
          } else {
            orderResult = { reply_text: `I am not sure what that number is for. Please send the product name and quantity, for example: *${await orderExample(supabase)}*` };
          }
        } else {
          const parsed = parseOrderLines(message);
          if (parsed && parsed.length > 0) {
            orderResult = await handlePlaceOrderTool(supabase, parsed, session, '');
          }
        }

        if (orderResult?.reply_text) {
          await saveSession(supabase, session);
          await sendTwilioFreeForm(phone, String(orderResult.reply_text)); return;
        }
        // Not an item list (a sentence, a question): the AI reads it below.
      }

      // ── Standard Gemini Chat (IDLE or AWAITING_ORDER_DETAILS) ──
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const systemPrompt = buildSystemPrompt(today, session);

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt,
        tools: allTools as any,
      });

      // Sanitize history: only user/model roles, must start with 'user'
      // While an order is being taken the AI starts fresh on every message. Old replies in its memory
      // (for example from before an update) get copied instead of calling the order tool.
      // The draft itself lives in session.pending_items, so nothing is lost.
      let sanitizedHistory = (session.state === 'AWAITING_ORDER_DETAILS' ? [] : (session.conversation_history || []))
        .filter((h: any) => h.role === 'user' || h.role === 'model');
      while (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') {
        sanitizedHistory.shift();
      }
      console.log(`🤖 Gemini chat (history: ${sanitizedHistory.length} msgs, state: ${session.state})`);

      const chat = model.startChat({ history: sanitizedHistory });
      let result = await chat.sendMessage(message);
      let response = result.response;

      // Handle function calls
      let functionCalls = response.functionCalls();
      let maxRounds = 3;
      let directReply: string | null = null;
      while (functionCalls && functionCalls.length > 0 && maxRounds > 0) {
        maxRounds--;
        console.log(`🔧 Gemini requested ${functionCalls.length} function call(s)`);

        const functionResponses = [];
        for (const call of functionCalls) {
          console.log(`  📊 Executing: ${call.name}(${JSON.stringify(call.args).slice(0, 200)})`);
          const fnResult = await executeFunction(call.name, call.args, session, message);
          console.log(`  ✅ Result preview: ${JSON.stringify(fnResult).slice(0, 200)}`);
          // Save context after meaningful tool executions
          if (call.name === 'get_products' && fnResult?.total_products !== undefined) {
            await saveContext(supabase, phone, 'product_list', { count: fnResult.total_products });
          }
          if (call.name === 'place_order' && fnResult?.reply_text) {
            directReply = String(fnResult.reply_text);
          }
          functionResponses.push({
            functionResponse: { name: call.name, response: fnResult },
          });
        }

        // Questions about unclear items are sent exactly as written, so the AI cannot invent options.
        if (directReply) break;

        result = await chat.sendMessage(functionResponses);
        response = result.response;
        functionCalls = response.functionCalls();
      }

      aiReply = directReply ?? (response.text() || "");
      console.log('✅ Gemini response:', aiReply.slice(0, 200));

      // Detect unhelpful/empty/default responses and log as unhandled
      const FALLBACK_PATTERNS = [
        "sorry, i couldn't process",
        "i'm not sure how to help",
        "i don't have enough information",
      ];
      const isUnhelpful = !aiReply.trim() || FALLBACK_PATTERNS.some(p => aiReply.toLowerCase().includes(p));
      if (isUnhelpful) {
        console.log('⚠️ Gemini response detected as unhelpful, logging unhandled query');
        aiReply = await logUnhandledQuery(supabase, phone, message);
      }

      // Update conversation history (only store user/model text pairs)
      const updatedHistory = [...sanitizedHistory];
      updatedHistory.push({ role: 'user', parts: [{ text: message }] });
      updatedHistory.push({ role: 'model', parts: [{ text: aiReply }] });
      if (updatedHistory.length > MAX_HISTORY) {
        updatedHistory.splice(0, updatedHistory.length - MAX_HISTORY);
        // Re-ensure first entry is 'user' after splicing
        while (updatedHistory.length > 0 && updatedHistory[0].role !== 'user') {
          updatedHistory.shift();
        }
      }
      session.conversation_history = session.state === 'AWAITING_ORDER_DETAILS' ? [] : updatedHistory;

    await saveSession(supabase, session);

    await sendTwilioFreeForm(phone, aiReply);
    console.log(`⏱️ [bg] processMessageAsync (gemini path) total ${(performance.now() - tStart).toFixed(0)}ms`);
  } catch (err) {
    console.error('❌ [bg] Gemini/DB error:', err);
    try {
      const fallback = await logUnhandledQuery(supabase, phone, message);
      await sendTwilioFreeForm(phone, fallback);
    } catch (e) {
      console.error('❌ [bg] fallback send failed:', e);
    }
    console.log(`⏱️ [bg] processMessageAsync (error path) total ${(performance.now() - tStart).toFixed(0)}ms`);
  }
}

const FALLBACK_MESSAGE = "I'm sorry, I couldn't assist with that request at the moment. However, I've shared your query with our internal team, and they'll get back to you shortly!";

async function logUnhandledQuery(supabase: any, phone: string, message: string): Promise<string> {
  try {
    const retailer = await findRetailerByPhone(supabase, phone);
    const today = new Date().toISOString().split('T')[0];

    await supabase
      .from('unhandled_queries')
      .insert({
        phone,
        retailer_id: retailer?.id || null,
        retailer_name: retailer?.name || null,
        message,
        category: 'unknown',
        status: 'open',
        created_date: today,
      })
      .select()
      .maybeSingle(); // ON CONFLICT (dedup index) will silently skip duplicates

    console.log('📝 Logged unhandled query for phone:', phone);
  } catch (logErr) {
    console.error('⚠️ Failed to log unhandled query:', logErr);
  }
  return FALLBACK_MESSAGE;
}

function sendTwiml(message: string): Response {
  // Escape XML special characters
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escaped}</Message>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  });
}

function sendEmptyTwiml(): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;
  return new Response(twiml, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  });
}

async function sendTwilioTemplate(to: string): Promise<void> {
  if (!KVP_AUTO_REPLIES_ENABLED) return;
  const accountSid = 'AC2bed17b2742df7031ebc7de2d726b62f';
  const templateFrom = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
  if (!templateFrom) {
    console.error('TWILIO_WHATSAPP_NUMBER not configured, skipping template send');
    return;
  }
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not configured, skipping template send');
    return;
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const base64Auth = btoa(`${accountSid}:${authToken}`);

  const formBody = new URLSearchParams({
    To: to,
    From: templateFrom.startsWith('whatsapp:') ? templateFrom : `whatsapp:${templateFrom}`,
    ContentSid: 'HXae62614f9e4e3b47ede7db13d75175eb',
    ContentVariables: JSON.stringify({}),
  });

  try {
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('❌ Twilio template send error:', result);
    } else {
      console.log(`✅ Template sent to ${to}: SID ${result.sid}`);
    }
  } catch (err) {
    console.error('❌ Twilio template send exception:', err);
  }
}

// ── Twilio free-form WhatsApp send (Body), with 24h-window template fallback ──
async function sendTwilioFreeForm(to: string, body: string, mediaUrl?: string): Promise<void> {
  if (!KVP_AUTO_REPLIES_ENABLED) return;
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || 'AC2bed17b2742df7031ebc7de2d726b62f';
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not configured, cannot send free-form message');
    return;
  }
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
  if (!fromNumber) {
    console.error('TWILIO_WHATSAPP_NUMBER not configured, cannot send free-form message');
    return;
  }
  const fromFormatted = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const base64Auth = btoa(`${accountSid}:${authToken}`);

  try {
    const tSend = performance.now();
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toFormatted,
        From: fromFormatted,
        Body: body.slice(0, 1600),
        ...(mediaUrl ? { MediaUrl: mediaUrl } : {}),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error(`❌ Twilio free-form send error to ${toFormatted}:`, result);
      // Fall back to greeting template if outside the 24h window
      if (result?.code === 63016) {
        console.log('Outside 24-hour window, falling back to greeting template');
        await sendTwilioTemplate(toFormatted);
      }
    } else {
      console.log(`✅ Twilio reply sent to ${toFormatted} in ${(performance.now() - tSend).toFixed(0)}ms (SID ${result.sid})`);
    }
  } catch (err) {
    console.error('❌ Twilio free-form send exception:', err);
  }
}
