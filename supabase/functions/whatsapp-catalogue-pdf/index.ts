// Builds the product list as a PDF for the WhatsApp bot.
//   - Main products and each variant are separate lines, grouped by category.
//   - Free-sample items "(FS)" are left out.
//   - Every name, size and price is read from the product master (products and product_variants), nothing is typed in here.
//   - The file is kept in the private "report-files" bucket and rebuilt when it is older than 6 hours,
//     or sooner when any product or variant was changed after it was built.
//   - The reply holds a short-lived signed link that Twilio can download.
// Called by the webhook-whatsapp function with the service-role key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const BUCKET = 'report-files';
const FOLDER = 'whatsapp-catalogue';
const PDF_PATH = `${FOLDER}/product-list.pdf`;
const INFO_PATH = `${FOLDER}/product-list.json`;
const CACHE_MS = 6 * 60 * 60 * 1000;
const SIGNED_SECONDS = 60 * 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── rows ────────────────────────────────────────────────────────────
interface Row { category: string; label: string; price: number; perUnit: string | null }

type Size = { amount: number; kind: 'g' | 'ml' };
const SIZE_IN_NAME = /(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|grams?|gms?|g|ml|ltrs?|litres?|liters?|l)\b/i;

// The size saved on the product (weight / volume) when the name does not already say it:
// "DAKSHIN GOLD (HORECA)" with 5000 g saved -> "DAKSHIN GOLD (HORECA) (5kg)".
function labelWithSize(label: string, weightG: unknown, volumeMl: unknown): string {
  if (SIZE_IN_NAME.test(label)) return label;
  const size: Size | null = Number(weightG) > 0 ? { amount: Number(weightG), kind: 'g' }
    : Number(volumeMl) > 0 ? { amount: Number(volumeMl), kind: 'ml' } : null;
  if (!size) return label;
  const big = size.amount >= 1000;
  const n = big ? size.amount / 1000 : size.amount;
  const num = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  return `${label} (${num}${size.kind === 'g' ? (big ? 'kg' : 'g') : (big ? 'l' : 'ml')})`;
}

function isFreeSampleName(name: string): boolean {
  return /\(\s*FS\s*\)/i.test(name);
}

// The database returns at most 1000 rows per request, so read 1000 at a time.
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

async function loadRows(supabase: any): Promise<Row[]> {
  const products = await fetchAllRows((from, to) =>
    supabase
      .from('products')
      .select('id, name, rate, unit, net_weight_g, net_volume_ml, category:product_categories(name)')
      .eq('is_active', true)
      .or('is_discontinued.is.null,is_discontinued.eq.false')
      .order('name').order('id')
      .range(from, to));
  const variants = await fetchAllRows((from, to) =>
    supabase
      .from('product_variants')
      .select('id, product_id, variant_name, price, variant_weight_g, net_weight_g, net_volume_ml')
      .eq('is_active', true)
      .or('is_discontinued.is.null,is_discontinued.eq.false')
      .order('id')
      .range(from, to));

  const rows: Row[] = [];
  const info = new Map<string, { rate: number; category: string }>();
  for (const p of products) {
    if (isFreeSampleName(p.name)) continue;
    const category = p.category?.name || 'Other';
    info.set(p.id, { rate: Number(p.rate), category });
    rows.push({ category, label: labelWithSize(p.name, p.net_weight_g, p.net_volume_ml), price: Number(p.rate), perUnit: p.unit || null });
  }
  for (const v of variants) {
    const parent = info.get(v.product_id);
    if (!parent || isFreeSampleName(v.variant_name)) continue;
    rows.push({ category: parent.category, label: labelWithSize(v.variant_name, v.variant_weight_g ?? v.net_weight_g, v.net_volume_ml), price: Number(v.price) > 0 ? Number(v.price) : parent.rate, perUnit: null });
  }
  rows.sort((a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
    || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return rows;
}

// ── pdf ─────────────────────────────────────────────────────────────
// The standard PDF fonts cannot draw every character (for example the rupee sign), so only
// plain Latin text is kept and prices are written as "Rs.".
function clean(s: string): string {
  return String(s)
    .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u00D7/g, 'x').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();
}

// The newest change on any product or variant (updated_at), so the saved file is rebuilt after an edit.
async function latestChange(supabase: any): Promise<string> {
  const [a, b] = await Promise.all([
    supabase.from('products').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    supabase.from('product_variants').select('updated_at').order('updated_at', { ascending: false }).limit(1),
  ]);
  return [a.data?.[0]?.updated_at, b.data?.[0]?.updated_at].filter(Boolean).sort().pop() || '';
}

async function buildPdf(rows: Row[], generatedAt: Date): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 40, ROW = 15, TOP = H - 86, BOTTOM = 46;
  const dateText = generatedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const ink = rgb(0.11, 0.14, 0.12), grey = rgb(0.4, 0.43, 0.41), band = rgb(0.9, 0.93, 0.91), line = rgb(0.85, 0.86, 0.85);

  const fit = (text: string, f: any, size: number, max: number): string => {
    if (f.widthOfTextAtSize(text, size) <= max) return text;
    let t = text;
    while (t.length > 1 && f.widthOfTextAtSize(t + '...', size) > max) t = t.slice(0, -1);
    return t + '...';
  };

  let page: any;
  let y = 0;
  const pages: any[] = [];
  const newPage = () => {
    page = pdf.addPage([W, H]); pages.push(page);
    page.drawText('Product list', { x: M, y: H - 50, size: 18, font: bold, color: ink });
    page.drawText(`Prices as of ${dateText}  |  ${rows.length.toLocaleString('en-IN')} items`, { x: M, y: H - 66, size: 9, font, color: grey });
    page.drawText('Item', { x: M, y: TOP + 4, size: 9, font: bold, color: grey });
    const ph = 'Price (Rs.)';
    page.drawText(ph, { x: W - M - bold.widthOfTextAtSize(ph, 9), y: TOP + 4, size: 9, font: bold, color: grey });
    page.drawLine({ start: { x: M, y: TOP }, end: { x: W - M, y: TOP }, thickness: 0.6, color: line });
    y = TOP - ROW;
  };
  newPage();

  let current = '';
  for (const r of rows) {
    const needHeading = r.category !== current;
    if (y < BOTTOM + (needHeading ? ROW * 2 : ROW)) newPage();
    if (needHeading) {
      current = r.category;
      page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: ROW, color: band });
      page.drawText(fit(clean(current).toUpperCase(), bold, 9, W - 2 * M - 12), { x: M + 6, y: y, size: 9, font: bold, color: ink });
      y -= ROW;
    }
    const price = r.price.toFixed(2) + (r.perUnit ? ` / ${clean(r.perUnit)}` : '');
    const priceW = font.widthOfTextAtSize(price, 9.5);
    page.drawText(fit(clean(r.label), font, 9.5, W - 2 * M - priceW - 16), { x: M + 6, y, size: 9.5, font, color: ink });
    page.drawText(price, { x: W - M - priceW, y, size: 9.5, font, color: ink });
    y -= ROW;
  }

  // The example in the footer uses two real items from the list, never made-up names.
  const sample = rows.slice(0, 2).map(r => r.label.replace(/\s*\((?:[\d.]+(?:kg|g|ml|l))\)$/, ''));
  const footerText = `Prices may change. Send your order on WhatsApp, for example: ${sample.length === 2 ? `${sample[0]} 5, ${sample[1]} 3` : 'product name 5'}`;

  pages.forEach((p, i) => {
    const t = `Page ${i + 1} of ${pages.length}`;
    p.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 8), y: 24, size: 8, font, color: grey });
    p.drawText(fit(clean(footerText), font, 8, W - 2 * M - 80), { x: M, y: 24, size: 8, font, color: grey });
  });
  return await pdf.save();
}

// ── request ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const force = (await req.json().catch(() => ({})))?.force === true;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const storage = supabase.storage.from(BUCKET);

    // Reuse the saved file while it is fresh.
    const latest = await latestChange(supabase);
    if (!force) {
      const { data: files } = await storage.list(FOLDER, { search: 'product-list' });
      const pdfFile = (files || []).find((f: any) => f.name === 'product-list.pdf');
      const updated = pdfFile?.updated_at ? new Date(pdfFile.updated_at).getTime() : 0;
      const { data: infoBlob } = pdfFile ? await storage.download(INFO_PATH) : { data: null };
      const info = infoBlob ? JSON.parse(await infoBlob.text()) : {};
      // Fresh = built less than 6 hours ago AND no product or variant changed since.
      if (pdfFile && Date.now() - updated < CACHE_MS && info.latest === latest) {
        const { data: signed, error } = await storage.createSignedUrl(PDF_PATH, SIGNED_SECONDS);
        if (!error && signed?.signedUrl) {
          return json({ url: signed.signedUrl, count: info.count ?? null, generatedAt: info.generatedAt ?? pdfFile.updated_at, cached: true });
        }
      }
    }

    const rows = await loadRows(supabase);
    if (rows.length === 0) return json({ error: 'No products to list' }, 404);

    const generatedAt = new Date();
    const bytes = await buildPdf(rows, generatedAt);
    const up = await storage.upload(PDF_PATH, bytes, { contentType: 'application/pdf', upsert: true });
    if (up.error) throw up.error;
    await storage.upload(INFO_PATH, JSON.stringify({ count: rows.length, generatedAt: generatedAt.toISOString(), latest }), { contentType: 'application/json', upsert: true });

    const { data: signed, error } = await storage.createSignedUrl(PDF_PATH, SIGNED_SECONDS);
    if (error || !signed?.signedUrl) throw error || new Error('No signed URL');
    return json({ url: signed.signedUrl, count: rows.length, generatedAt: generatedAt.toISOString(), cached: false });
  } catch (e) {
    console.error('Catalogue PDF error:', (e as any)?.message || e);
    return json({ error: 'Could not build the product list' }, 500);
  }
});
