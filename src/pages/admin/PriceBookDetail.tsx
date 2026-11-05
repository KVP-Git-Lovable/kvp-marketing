import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseLoose';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Save, Trash2, Package, RefreshCw, ExternalLink, Layers, Boxes,
  AlertTriangle, X, SlidersHorizontal,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { fetchAllPaginated } from '@/utils/fetchAllPaginated';
import { formatCurrency, resolveRate, type RatesMap } from '@/lib/money';
import PriceBookExcelActions from '@/components/pricebook/PriceBookExcelActions';
import { PriceBookWarnings } from '@/components/pricebooks/PriceBookWarnings';
import { PriceBookDistributors } from '@/components/pricebooks/PriceBookDistributors';
import { PriceBookSchemes } from '@/components/pricebooks/PriceBookSchemes';
import { PriceBookHistory } from '@/components/pricebooks/PriceBookHistory';

interface PriceBook {
  id: string;
  name: string;
  description: string | null;
  price_book_type: string;
  target_type: string;
  currency: string;
  is_standard: boolean;
  is_active: boolean;
  restricts_catalogue?: boolean;
}

/**
 * One template for the header and every row, built from the same function so
 * the two can never drift apart.
 *
 * The last track is a fixed width, not `auto`. Sharing the template is not
 * enough on its own: a content-sized track resolves to 0 in the header, whose
 * final cell is an empty spacer, and to ~74px in a row, whose final cell holds
 * the buttons. `minmax(0,1fr)` then hands that width to the name column in the
 * header only, and every column between the two shifts by one place.
 *
 * The trade ladder (MRP, PTR, PTS, Dist, Margin) is five columns that most
 * books never fill. Carrying them always forced the row past 1,180px, so the
 * whole table scrolled sideways and the buttons at the end -- Remove included
 * -- sat permanently off-screen. They are now opt-in, and the default row
 * fits a laptop without scrolling at all.
 */
/** The gutter between columns; the ladder's 13 tracks need the tighter one. */
const pbGap = (ladder: boolean) => (ladder ? "gap-x-2" : "gap-x-3");

const pbGrid = (ladder: boolean) =>
  ladder
    ? [
        /* 5 cells: checkbox, name, List, Final, buttons */
        "grid-cols-[24px_minmax(130px,1fr)_minmax(84px,110px)_minmax(96px,130px)_116px]",
        /* + Disc % */
        "sm:grid-cols-[24px_minmax(150px,1fr)_minmax(84px,120px)_minmax(72px,96px)_minmax(96px,130px)_116px]",
        /* + Min qty, Unit, MRP */
        "md:grid-cols-[24px_minmax(170px,1fr)_80px_minmax(116px,150px)_minmax(82px,110px)_minmax(86px,115px)_minmax(70px,92px)_minmax(94px,125px)_104px]",
        /* + PTR, PTS, Dist, Margin -- all 13 */
        "lg:grid-cols-[24px_minmax(156px,1fr)_76px_minmax(110px,140px)_minmax(78px,104px)_minmax(74px,98px)_minmax(74px,98px)_minmax(78px,104px)_minmax(84px,112px)_minmax(66px,88px)_minmax(88px,118px)_minmax(66px,88px)_104px]",
      ].join(" ")
    : [
        "grid-cols-[24px_minmax(130px,1fr)_minmax(84px,110px)_minmax(96px,130px)_116px]",
        "sm:grid-cols-[24px_minmax(150px,1fr)_minmax(84px,120px)_minmax(72px,96px)_minmax(96px,130px)_116px]",
        /* Every flexible track is capped. The page is full width now, and with
           bare `fr` weights a wide monitor grew the Unit dropdown to 360px and
           the price boxes to 270px. Leftover width goes to the name, which is
           the one column that can use it. */
        "md:grid-cols-[24px_minmax(180px,1fr)_84px_minmax(130px,170px)_minmax(96px,130px)_minmax(76px,100px)_minmax(100px,140px)_116px]",
      ].join(" ");

/**
 * The widest the row can get before the name column would be squeezed.
 *
 * The fixed tracks plus gaps come to roughly this, so below it the grid has
 * to scroll rather than steal width from the product name -- which is what
 * it did: `minmax(0,1fr)` collapsed to nothing and every name sat on top of
 * the Min Qty box. Without the ladder the row fits an ordinary window, so no
 * minimum is forced on it at all.
 */
const pbMinW = (ladder: boolean) =>
  ladder ? "min-w-[620px] md:min-w-[950px] lg:min-w-[1210px]" : "min-w-[480px] md:min-w-0";

interface PriceBookEntry {
  id: string;
  product_id: string;
  variant_id: string | null;
  list_price: number;
  discount_percent: number;
  final_price: number;
  min_quantity: number;
  uom?: string | null;
  uom_id?: string | null;
  mrp?: number | null;
  /** The trade margin ladder. PTR is what the retailer pays, PTS what the
   *  stockist pays, distributor_price what the distributor pays us. */
  ptr?: number | null;
  pts?: number | null;
  distributor_price?: number | null;
  is_active: boolean;
  product?: { name: string; unit: string | null; category_id: string | null; mrp?: number | null } | null;
  variant?: { variant_name: string; mrp?: number | null } | null;
}

interface Product {
  id: string;
  name: string;
  unit?: string | null;
  mrp?: number | null;
  category_id?: string | null;
  product_variants: { id: string; variant_name: string; price?: number | null }[];
}

interface Category {
  id: string;
  name: string;
}

const PriceBookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [priceBook, setPriceBook] = useState<PriceBook | null>(null);
  const [entries, setEntries] = useState<PriceBookEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  /** Each product's packs, from product_uom_mapping: PIECE x1, BOX x24, and
   *  so on. A price book row may name one of these to price that pack. */
  const [uomsByProduct, setUomsByProduct] = useState<Record<string, { id: string; code: string; factor: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [rates, setRates] = useState<RatesMap>({});
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  /** Rows ticked for a bulk change. Pricing a book one row at a time is the
   *  slow part; a discount usually applies to a whole category at once. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkDiscount, setBulkDiscount] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  // The five trade-ladder columns are off until asked for; see pbGrid.
  const [showLadder, setShowLadder] = useState(false);
  /**
   * Edits made but not yet written, keyed by entry id.
   *
   * Every field used to save on its own onChange, so a stray keystroke in a
   * price was already in the database and a mistyped figure could only be
   * undone by retyping it. Nothing here reaches the server until Save is
   * pressed, and Discard throws the lot away.
   */
  const [drafts, setDrafts] = useState<Record<string, Record<string, any>>>({});
  const [saving, setSaving] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [newEntry, setNewEntry] = useState({
    list_price: 0,
    discount_percent: 0,
    min_quantity: 1,
    uom: '',
  });

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  /* A reload or a closed tab would take unsaved prices with it. */
  useEffect(() => {
    if (Object.keys(drafts).length === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [drafts]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [priceBookRes, entriesRes, productsAll, categoriesRes, companyRes, ratesRes] = await Promise.all([
        supabase.from('price_books').select('*').eq('id', id).single(),
        supabase
          .from('price_book_entries')
          .select(`
            *,
            product:products(name, unit:base_unit, category_id, mrp),
            variant:product_variants(variant_name, mrp)
          `)
          .eq('price_book_id', id)
          .order('min_quantity', { ascending: true }),
        fetchAllPaginated<any>((from, to) =>
          supabase
            .from('products')
            .select('id, name, unit:base_unit, rate, category_id, product_variants(id, variant_name, price)')
            .eq('is_active', true)
            .order('name')
            .range(from, to)
        ),

        supabase
          .from('product_categories')
          .select('id, name')
          .order('name'),
        supabase
          .from('companies')
          .select('base_currency, currency')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('exchange_rates')
          .select('base_currency, quote_currency, rate, effective_date')
          .order('effective_date', { ascending: true }),
      ]);

      if (priceBookRes.error) throw priceBookRes.error;
      if (entriesRes.error) throw entriesRes.error;

      setPriceBook({
        ...priceBookRes.data,
        target_type: priceBookRes.data.target_type || 'distributor'
      });
      setEntries(entriesRes.data || []);
      setCategories(categoriesRes.data || []);

      // The packs each priced product comes in. Typing a unit by hand could
      // never work: the engine matches on uom_id, so the field has to offer
      // the product's real ladder rather than free text.
      const pricedIds = Array.from(new Set((entriesRes.data || []).map((e: any) => e.product_id).filter(Boolean)));
      if (pricedIds.length > 0) {
        /* The codes are fetched on their own rather than embedded.
           product_uom_mapping.uom_id has no foreign key to uom_master, so
           PostgREST cannot resolve `uom_master(code)` -- it answers with
           PGRST200 and no rows. The error was discarded, so every product
           looked as though it had no units: the Unit dropdown offered only
           "All units" and Add pack always said to set units up first. */
        const [ladderRes, codeRes] = await Promise.all([
          supabase.from('product_uom_mapping')
            .select('product_id, uom_id, conversion_to_base')
            .in('product_id', pricedIds),
          supabase.from('uom_master').select('id, code'),
        ]);
        if (ladderRes.error || codeRes.error) {
          console.error('Could not load the unit ladder',
            ladderRes.error ?? codeRes.error);
          toast.error('Units could not be loaded, so pack pricing is unavailable');
        }
        const codeById = new Map<string, string>(
          ((codeRes.data as any[]) || []).map((u) => [u.id, u.code]));
        const byProduct: Record<string, { id: string; code: string; factor: number }[]> = {};
        ((ladderRes.data as any[]) || []).forEach((m) => {
          const code = codeById.get(m.uom_id);
          if (!code) return;
          (byProduct[m.product_id] ??= []).push({
            id: m.uom_id, code, factor: Number(m.conversion_to_base) || 1,
          });
        });
        Object.values(byProduct).forEach((list) => list.sort((a, b) => a.factor - b.factor));
        setUomsByProduct(byProduct);
      }

      const comp: any = (companyRes as any)?.data || {};
      setBaseCurrency(comp.base_currency || comp.currency || 'INR');
      const map: RatesMap = {};
      for (const r of ((ratesRes as any)?.data || []) as any[]) {
        const rate = Number(r.rate);
        if (rate > 0) map[`${r.base_currency}->${r.quote_currency}`] = rate;
      }
      setRates(map);

      
      // Map products to match Product interface
      const mappedProducts: Product[] = (productsAll || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        mrp: p.rate,
        category_id: p.category_id,
        product_variants: p.product_variants || []
      }));
      setProducts(mappedProducts);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load price book');
      navigate('/admin/price-books');
    } finally {
      setLoading(false);
    }
  };

  const bookCurrency = priceBook?.currency || baseCurrency;
  const isForeignBook = !!priceBook && bookCurrency !== baseCurrency;
  const fxRate = isForeignBook ? resolveRate(baseCurrency, bookCurrency, rates, baseCurrency) : 1;

  const fmtBook = (v: number | null | undefined) => formatCurrency(v, bookCurrency);

  // mode: 'default' = base-currency copy (same-currency books) or blank for foreign books
  //       'convert' = seed foreign book from base price at the latest exchange rate
  const syncAllProducts = async (mode: 'default' | 'convert' = 'default') => {
    if (!id || !priceBook) return;

    const convert = mode === 'convert' && isForeignBook && !!fxRate;
    const blank = isForeignBook && !convert;

    if (mode === 'convert' && !fxRate) {
      toast.error(`No exchange rate found for ${baseCurrency} → ${bookCurrency}`);
      return;
    }

    const priceFor = (base: number | null | undefined) => {
      if (blank) return 0;
      const n = Number(base) || 0;
      return convert ? Math.round(n * (fxRate as number) * 100) / 100 : n;
    };

    setSyncing(true);
    setSyncNotice(null);
    try {
      // Get existing product/variant combinations
      const existingKeys = new Set(
        entries.map(e => `${e.product_id}-${e.variant_id || 'null'}`)
      );

      const newEntries: any[] = [];
      
      products.forEach(product => {
        // Check base product
        const baseKey = `${product.id}-null`;
        if (!existingKeys.has(baseKey)) {
          const price = priceFor(product.mrp);
          newEntries.push({
            price_book_id: id,
            product_id: product.id,
            variant_id: null,
            list_price: price,
            discount_percent: 0,
            final_price: price,
            min_quantity: 1,
          });
        }

        // Check variants
        product.product_variants.forEach(variant => {
          const variantKey = `${product.id}-${variant.id}`;
          if (!existingKeys.has(variantKey)) {
            const price = priceFor(variant.price ?? product.mrp);
            newEntries.push({
              price_book_id: id,
              product_id: product.id,
              variant_id: variant.id,
              list_price: price,
              discount_percent: 0,
              final_price: price,
              min_quantity: 1,
            });
          }
        });
      });

      if (newEntries.length > 0) {
        const { error } = await supabase.from('price_book_entries').insert(newEntries);
        if (error) throw error;
        toast.success(`Added ${newEntries.length} new products`);
        if (blank) {
          setSyncNotice(
            `Products added with no price. Enter local ${bookCurrency} prices — base-currency prices are not copied into a foreign-currency book.`
          );
        } else if (convert) {
          setSyncNotice(
            `Seeded ${newEntries.length} products from ${baseCurrency} at rate ${fxRate} (1 ${baseCurrency} = ${fxRate} ${bookCurrency}). Review these as a starting point.`
          );
        }
        fetchData();
      } else {
        toast.info('All products already in price book');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync products');
    } finally {
      setSyncing(false);
    }
  };


  const handleAddEntry = async () => {
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    const finalPrice = newEntry.list_price * (1 - newEntry.discount_percent / 100);

    try {
      const { error } = await supabase.from('price_book_entries').insert({
        price_book_id: id,
        product_id: selectedProduct,
        variant_id: selectedVariant && selectedVariant !== '__base__' ? selectedVariant : null,
        list_price: newEntry.list_price,
        discount_percent: newEntry.discount_percent,
        final_price: finalPrice,
        min_quantity: newEntry.min_quantity,
      });

      if (error) throw error;
      toast.success('Product added to price book');
      setIsAddOpen(false);
      resetAddForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add product');
    }
  };

  /** The MRP a row is judged against: the book's own, else the pack's, else
   *  the product's. A book may legitimately carry a state-specific MRP. */
  const mrpFor = (e: PriceBookEntry): number | null =>
    e.mrp ?? e.variant?.mrp ?? e.product?.mrp ?? null;

  /** Retailer margin: what the shop keeps selling at MRP. The number the
   *  pricing conversation actually turns on. */
  const marginFor = (e: PriceBookEntry): number | null => {
    const mrp = mrpFor(e);
    const price = Number(e.final_price);
    if (!mrp || !price || mrp <= 0) return null;
    return ((mrp - price) / mrp) * 100;
  };

  /**
   * Is the trade margin ladder the right way up?
   *
   * Money moves distributor -> stockist -> retailer -> shopper, so each step
   * must not exceed the next: distributor <= PTS <= PTR <= MRP. A ladder that
   * inverts means somebody downstream buys higher than they sell, which is a
   * typo nobody catches by reading four numbers in a row.
   *
   * Only the steps that are filled are checked -- an unset step is unknown,
   * not wrong.
   */
  const ladderFault = (e: PriceBookEntry): string | null => {
    const mrp = mrpFor(e);
    const steps: { label: string; value: number }[] = [];
    if (e.distributor_price != null) steps.push({ label: 'Distributor', value: Number(e.distributor_price) });
    if (e.pts != null) steps.push({ label: 'PTS', value: Number(e.pts) });
    if (e.ptr != null) steps.push({ label: 'PTR', value: Number(e.ptr) });
    if (mrp != null) steps.push({ label: 'MRP', value: Number(mrp) });
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].value < steps[i - 1].value) {
        return `${steps[i].label} (${steps[i].value}) is below ${steps[i - 1].label} (${steps[i - 1].value})`;
      }
    }
    return null;
  };

  const toggleRow = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  /** A book that restricts the catalogue decides what a customer may order
   *  at all, not only what they pay. Off by default on every existing book. */
  const toggleCatalogue = async (on: boolean) => {
    if (!priceBook) return;
    const previous = priceBook.restricts_catalogue ?? false;
    setPriceBook({ ...priceBook, restricts_catalogue: on });
    const { error } = await supabase.from('price_books')
      .update({ restricts_catalogue: on }).eq('id', priceBook.id);
    if (error) {
      setPriceBook({ ...priceBook, restricts_catalogue: previous });
      toast.error('Could not change that: ' + error.message);
      return;
    }
    toast.success(on
      ? 'Customers on this book can now only order the products listed here'
      : 'This book sets prices only; it no longer limits what can be ordered');
  };

  /** Price a whole category in one go — the unit a price revision actually
   *  arrives in. Applies to every row of that category in this book. */
  /** Stage a discount across a group. Like every edit, it waits for Save. */
  const applyGroupDiscount = (label: string, rows: PriceBookEntry[]) => {
    const raw = window.prompt(
      `Discount % to apply to all ${rows.length} row${rows.length === 1 ? '' : 's'} in ${label}`, '');
    if (raw === null) return;
    const pct = parseFloat(raw);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Enter a discount between 0 and 100');
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      rows.forEach((e) => {
        if (Number(e.discount_percent) === pct && !next[e.id]) return;
        next[e.id] = { ...next[e.id], discount_percent: pct };
      });
      return next;
    });
    toast.success(`${rows.length} row${rows.length === 1 ? '' : 's'} set to ${pct}% — press Save to keep it`);
  };

  /** One discount across every ticked row, in a single round trip each. */
  const applyBulkDiscount = () => {
    const pct = parseFloat(bulkDiscount);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Enter a discount between 0 and 100');
      return;
    }
    const rows = entries.filter((e) => picked.has(e.id));
    setDrafts((prev) => {
      const next = { ...prev };
      rows.forEach((e) => { next[e.id] = { ...next[e.id], discount_percent: pct }; });
      return next;
    });
    toast.success(`${rows.length} row${rows.length === 1 ? '' : 's'} set to ${pct}% — press Save to keep it`);
    setPicked(new Set());
    setBulkDiscount('');
  };

  const deletePicked = async () => {
    const ids = [...picked];
    setBulkBusy(true);
    try {
      const { error } = await supabase.from('price_book_entries').delete().in('id', ids);
      if (error) throw error;
      setEntries((prev) => prev.filter((e) => !picked.has(e.id)));
      setDrafts((prev) => {
        const next = { ...prev };
        ids.forEach((i) => delete next[i]);
        return next;
      });
      toast.success(`${ids.length} product${ids.length === 1 ? '' : 's'} removed from this book`);
      setPicked(new Set());
    } catch (err: any) {
      toast.error('Could not remove those: ' + (err?.message ?? ''));
    } finally {
      setBulkBusy(false);
    }
  };

  /** Final price always follows list and discount, draft values included. */
  const finalOf = (e: PriceBookEntry, d?: Record<string, any>) => {
    const list = Number(d?.list_price ?? e.list_price) || 0;
    const disc = Number(d?.discount_percent ?? e.discount_percent) || 0;
    return list * (1 - disc / 100);
  };

  /** An entry as the screen should show it: saved values plus any draft. */
  const view = (e: PriceBookEntry): PriceBookEntry => {
    const d = drafts[e.id];
    if (!d) return e;
    return { ...e, ...d, final_price: finalOf(e, d) } as PriceBookEntry;
  };

  const isDirty = (id: string) => drafts[id] != null;
  const dirtyCount = Object.keys(drafts).length;

  /** Record an edit locally. Nothing is written until Save. */
  const handleUpdateEntry = (
    entry: PriceBookEntry, field: string, value: number | string | null,
  ) => {
    setDrafts((prev) => {
      const next = { ...prev, [entry.id]: { ...prev[entry.id], [field]: value } };
      // A field edited back to what it already was is not a change, and a row
      // with nothing left in it should stop counting towards the Save badge.
      const row = next[entry.id];
      const clean = Object.keys(row).every(
        (k) => String(row[k] ?? '') === String((entry as any)[k] ?? ''));
      if (clean) delete next[entry.id];
      return next;
    });
  };

  const discardDrafts = () => setDrafts({});

  /** Write every drafted row, then fold the values into the loaded list. */
  const saveDrafts = async () => {
    const ids = Object.keys(drafts);
    if (ids.length === 0) return;
    setSaving(true);
    try {
      /* A row deleted while its edit was still pending leaves an id with no
         entry behind it; writing that would throw rather than save. */
      const live = ids.filter((id) => entries.some((e) => e.id === id));
      const results = await Promise.all(live.map((id) => {
        const entry = entries.find((e) => e.id === id)!;
        const payload = { ...drafts[id], final_price: finalOf(entry, drafts[id]) };
        return supabase.from('price_book_entries').update(payload).eq('id', id);
      }));
      const failed = results.filter((r) => r.error);
      if (failed.length > 0) throw failed[0].error;
      setEntries((prev) => prev.map((e) => (drafts[e.id]
        ? { ...e, ...drafts[e.id], final_price: finalOf(e, drafts[e.id]) }
        : e)));
      setDrafts({});
      toast.success(`${live.length} row${live.length === 1 ? '' : 's'} saved`);
    } catch (err: any) {
      toast.error('Nothing was saved: ' + (err?.message ?? 'update failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('price_book_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      toast.success('Product removed');
      setEntries(entries.filter(e => e.id !== entryId));
      setDrafts(({ [entryId]: _gone, ...rest }) => rest);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove');
    }
  };

  /** Duplicate an entry as a higher quantity slab (volume pricing). */
  const handleAddSlab = async (entry: PriceBookEntry) => {
    const siblings = entries.filter(
      e => e.product_id === entry.product_id && (e.variant_id || null) === (entry.variant_id || null)
    );
    const nextMin = Math.max(...siblings.map(e => e.min_quantity || 1)) + 10;

    try {
      const { error } = await supabase.from('price_book_entries').insert({
        price_book_id: id,
        product_id: entry.product_id,
        variant_id: entry.variant_id,
        list_price: entry.list_price,
        discount_percent: entry.discount_percent,
        final_price: entry.final_price,
        min_quantity: nextMin,
        uom: entry.uom || null,
      });
      if (error) throw error;
      toast.success(`Slab added for quantity ≥ ${nextMin}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add slab');
    }
  };

  /**
   * Price this product in another pack.
   *
   * A product can carry one row per pack -- PIECE, TRAY16, TRAY24, BOX -- each
   * with its own price, because a tray of 24 is not two trays of 12. This adds
   * the next pack from the product's own ladder that is not priced yet, seeded
   * from the current row so only the price has to be changed.
   */
  const handleAddUnit = async (entry: PriceBookEntry) => {
    const ladder = uomsByProduct[entry.product_id] ?? [];
    if (ladder.length === 0) {
      toast.error('This product has no units set up. Add them in Product Master first.');
      return;
    }
    const taken = new Set(
      entries
        .filter(e => e.product_id === entry.product_id
                  && (e.variant_id || null) === (entry.variant_id || null))
        .map(e => e.uom_id ?? '__any__')
    );
    const next = ladder.find(u => !taken.has(u.id));
    if (!next) {
      toast.error('Every unit for this product is already priced in this book.');
      return;
    }
    try {
      const { error } = await supabase.from('price_book_entries').insert({
        price_book_id: id,
        product_id: entry.product_id,
        variant_id: entry.variant_id,
        uom_id: next.id,
        // Seeded from the base row and scaled by the pack, so the starting
        // number is sensible rather than zero. It is meant to be edited.
        list_price: Number(entry.list_price || 0) * (next.factor || 1),
        discount_percent: entry.discount_percent || 0,
        final_price: Number(entry.final_price || 0) * (next.factor || 1),
        min_quantity: 1,
      });
      if (error) throw error;
      toast.success(`${next.code} added${next.factor > 1 ? ` (${next.factor} per pack)` : ''} — set its price`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add that unit');
    }
  };

  const resetAddForm = () => {
    setSelectedProduct('');
    setSelectedVariant('');
    setNewEntry({ list_price: 0, discount_percent: 0, min_quantity: 1, uom: '' });
  };

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return 'Uncategorized';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'Uncategorized';
  };

  /**
   * The categories this book actually prices, with how many each holds.
   *
   * The filter used to list every category in product_categories, so it
   * offered categories the book has nothing in -- and a category whose last
   * product had just been removed stayed in the list, which reads as the
   * removal not having worked. Built from `entries` rather than the filtered
   * set, so choosing a category does not shrink its own options.
   */
  const bookCategories = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((e) => {
      counts.set(e.product?.category_id ?? 'uncategorized',
                 (counts.get(e.product?.category_id ?? 'uncategorized') ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        name: getCategoryName(id === 'uncategorized' ? null : id),
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, categories]);

  // Removing the last product of the category being filtered on would
  // otherwise leave the page showing an empty list under a dead filter.
  useEffect(() => {
    if (selectedCategory !== 'all' && !bookCategories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [bookCategories, selectedCategory]);

  const selectedProductData = products.find(p => p.id === selectedProduct);

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.variant?.variant_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || entry.product?.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  /**
   * The rows of one category, gathered under the product they price.
   *
   * A product carrying six variants used to render its own name six times
   * over, each with the thing that actually told the rows apart -- the
   * variant, the pack -- demoted to a badge beside it. Grouping puts the
   * product name once at the top and lets each row be identified by what
   * makes it different.
   */
  /** The span of final prices in a group, or null when nothing is priced. */
  const priceRange = (rows: PriceBookEntry[]) => {
    const vals = rows.map((r) => Number(r.final_price)).filter((v) => v > 0);
    if (vals.length === 0) return null;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return lo === hi ? fmtBook(lo) : `${fmtBook(lo)} – ${fmtBook(hi)}`;
  };

  const groupByProduct = (rows: PriceBookEntry[]) => {
    const out = new Map<string, { name: string; rows: PriceBookEntry[] }>();
    rows.forEach((e) => {
      const key = e.product_id ?? 'unknown';
      if (!out.has(key)) out.set(key, { name: e.product?.name ?? 'Product', rows: [] });
      out.get(key)!.rows.push(e);
    });
    return Array.from(out.entries())
      .map(([productId, g]) => ({ productId, ...g }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Group entries by category for display
  const entriesByCategory = filteredEntries.reduce((acc, entry) => {
    const categoryId = entry.product?.category_id || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(entry);
    return acc;
  }, {} as Record<string, PriceBookEntry[]>);

  if (loading) {
    return (
      <Layout>
        <div className="p-4 text-center">Loading...</div>
      </Layout>
    );
  }

  if (!priceBook) {
    return (
      <Layout>
        <div className="p-4 text-center">Price book not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Not `container`: it is configured to stop at 1400px and add 2rem of
          padding either side, which is the margin that framed this page on a
          wide screen. A pricing grid wants the width. */}
      <div className="w-full px-4 sm:px-6 py-6 pb-24">
        <div className="mb-6 space-y-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="min-w-0 flex-1 pt-0.5">

              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight break-words">{priceBook.name}</h1>
                <Badge className={priceBook.is_active ? 'bg-green-100 text-green-800' : 'bg-muted'}>
                  {priceBook.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="outline">
                  {priceBook.target_type === 'retailer' ? 'Retailer' : 'Distributor'}
                </Badge>
                <Badge variant="secondary">{priceBook.currency}</Badge>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                {entries.length} products • {priceBook.currency}
                {isForeignBook && ` • prices stored natively in ${bookCurrency}`}
              </p>
            </div>
          </div>

          <PriceBookWarnings book={priceBook as any} />

          {/* The other end of the same assignment. Doing it from here or from
              Distributor Master writes the one distributor_price_books row,
              so the two views cannot disagree. */}
          <PriceBookDistributors
            priceBookId={priceBook.id}
            priceBookName={priceBook.name}
            targetType={priceBook.target_type}
            entriesCount={entries.length}
          />

          {/* What a book controls. Pricing is always on; limiting the
              catalogue is the opt-in that makes the book decide what the
              customer is even offered. */}
          <div className="mt-4 flex items-start gap-3 rounded-lg border bg-card p-3">
            <Checkbox
              id="restricts-catalogue"
              className="mt-0.5"
              checked={!!priceBook.restricts_catalogue}
              onCheckedChange={(v) => toggleCatalogue(v === true)}
            />
            <label htmlFor="restricts-catalogue" className="cursor-pointer">
              <span className="block text-sm font-medium">
                Only let these customers order the products in this book
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {priceBook.restricts_catalogue
                  ? `They see these ${entries.length} products and nothing else.`
                  : 'Off — this book sets prices but shows the whole catalogue.'}
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-12 lg:justify-end">
            <Button variant="outline" onClick={() => syncAllProducts('default')} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync All Products
            </Button>
            <PriceBookExcelActions
              priceBookId={id as string}
              bookName={priceBook.name}
              currency={bookCurrency}
              onImported={fetchData}
            />
            {isForeignBook && (
              <Button
                variant="outline"
                onClick={() => syncAllProducts('convert')}
                disabled={syncing || !fxRate}
                title={fxRate ? `1 ${baseCurrency} = ${fxRate} ${bookCurrency}` : 'No exchange rate available'}
              >
                Seed from base at exchange rate
              </Button>
            )}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetAddForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Product to Price Book</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Product *</Label>
                    <Select value={selectedProduct} onValueChange={(val) => {
                      setSelectedProduct(val);
                      setSelectedVariant('');
                      const prod = products.find(p => p.id === val);
                      if (prod) {
                        setNewEntry({ ...newEntry, list_price: prod.mrp || 0 });
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProductData?.product_variants?.length > 0 && (
                    <div className="space-y-2">
                      <Label>Variant (Optional)</Label>
                      <Select value={selectedVariant} onValueChange={(val) => {
                        setSelectedVariant(val);
                        const variantData = selectedProductData.product_variants.find(v => v.id === val);
                        if (variantData) {
                          setNewEntry({ ...newEntry, list_price: variantData.price || selectedProductData.mrp || 0 });
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select variant" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__base__">No variant (Base product)</SelectItem>
                          {selectedProductData.product_variants.map(variant => (
                            <SelectItem key={variant.id} value={variant.id}>
                              {variant.variant_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>List Price</Label>
                      <Input
                        type="number"
                        value={newEntry.list_price}
                        onChange={(e) => setNewEntry({ ...newEntry, list_price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Discount %</Label>
                      <Input
                        type="number"
                        value={newEntry.discount_percent}
                        onChange={(e) => setNewEntry({ ...newEntry, discount_percent: parseFloat(e.target.value) || 0 })}
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Min Quantity</Label>
                    <Input
                      type="number"
                      value={newEntry.min_quantity}
                      onChange={(e) => setNewEntry({ ...newEntry, min_quantity: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Final Price</p>
                    <p className="text-lg font-bold">
                      {fmtBook(newEntry.list_price * (1 - newEntry.discount_percent / 100))}
                    </p>
                  </div>

                  <Button onClick={handleAddEntry} className="w-full">Add Product</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Unsaved work follows the page down, so Save is reachable from
            wherever the edit was made. Nothing on this screen writes on its
            own any more -- see the drafts buffer. */}
        {dirtyCount > 0 && (
          <div className="sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 shadow-sm dark:border-amber-800 dark:bg-amber-950/60">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="text-sm font-medium">
              {dirtyCount} row{dirtyCount === 1 ? '' : 's'} edited but not saved
            </span>
            <Button size="sm" className="h-8 ml-auto gap-1.5"
              disabled={saving} onClick={saveDrafts}>
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5"
              disabled={saving} onClick={discardDrafts}>
              <X className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        )}

        {/* Appears only when something is ticked, so it never takes space
            from the list it acts on. */}
        {picked.size > 0 && (
          <div className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
            <Badge variant="secondary" className="tabular-nums">
              {picked.size} selected
            </Badge>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={100}
                value={bulkDiscount}
                onChange={(e) => setBulkDiscount(e.target.value)}
                placeholder="Disc %"
                className="h-8 w-24 text-right"
              />
              <Button size="sm" className="h-8" disabled={bulkBusy || bulkDiscount === ''}
                onClick={applyBulkDiscount}>
                Set {picked.size} to this %
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-destructive gap-1.5"
              disabled={bulkBusy} onClick={deletePicked}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
            <Button variant="ghost" size="sm" className="h-8 ml-auto gap-1.5"
              onClick={() => setPicked(new Set())}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        )}

        {/* Search and Category Filter. Wraps rather than pushing a control
            off the edge, and Save sits next to the search box rather than in
            the bottom-right corner, where a floating help widget covers it. */}
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {/* Always on screen, disabled until there is something to write.
              Shown only while dirty, it could not be found before it was
              needed, and nothing told you edits were being held back. */}
          <Button
            className="h-10 shrink-0 gap-2"
            disabled={dirtyCount === 0 || saving}
            onClick={saveDrafts}
            title={dirtyCount === 0
              ? 'Nothing to save yet — prices are kept until you press this'
              : `Write ${dirtyCount} edited row${dirtyCount === 1 ? '' : 's'}`}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : dirtyCount === 0 ? 'Save' : `Save ${dirtyCount}`}
          </Button>
          {dirtyCount > 0 && (
            <Button variant="outline" className="h-10 shrink-0 gap-2"
              disabled={saving} onClick={discardDrafts}>
              <X className="h-4 w-4" /> Discard
            </Button>
          )}

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px] sm:shrink-0">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories ({entries.length})</SelectItem>
              {bookCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Five more columns, only for the books that use them. Off by
              default so the row fits the window and nothing is pushed out of
              reach at the right-hand end. */}
          <label className="flex items-center gap-2 rounded-md border bg-card px-3 h-10 shrink-0 cursor-pointer">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm whitespace-nowrap">Trade ladder</span>
            <Switch
              checked={showLadder}
              onCheckedChange={setShowLadder}
              aria-label="Show MRP, PTR, PTS, distributor price and margin"
            />
          </label>
        </div>
        <p className="-mt-4 mb-6 text-xs text-muted-foreground">
          Edits are held on screen until you press Save — nothing is written as you type.
        </p>
        {showLadder && (
          <p className="-mt-5 mb-6 text-xs text-muted-foreground">
            MRP, PTR, PTS, distributor price and margin are now shown. If the row
            runs past the window it scrolls sideways, and the buttons at the end
            stay pinned.
          </p>
        )}

        {syncNotice && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {syncNotice}
          </div>
        )}

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No products in this price book</p>
              <Button onClick={() => syncAllProducts('default')} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Add All Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(entriesByCategory).map(([categoryId, categoryEntries]) => (
              <div key={categoryId} className="rounded-lg border overflow-hidden">
                {/* One header per category, with a tick-all for that group —
                    a price change almost always lands on a whole category.
                    It sits outside the scroller so it stays put while the
                    ladder columns are scrolled. */}
                <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
                  <Checkbox
                    aria-label={`Select all in ${getCategoryName(categoryId === 'uncategorized' ? null : categoryId)}`}
                    checked={categoryEntries.every((e) => picked.has(e.id)) && categoryEntries.length > 0}
                    onCheckedChange={(v) => toggleAll(categoryEntries.map((e) => e.id), v === true)}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getCategoryName(categoryId === 'uncategorized' ? null : categoryId)}
                  </span>
                  <Badge variant="secondary" className="text-[10px] tabular-nums">
                    {categoryEntries.length} priced
                  </Badge>
                  {/* A price revision usually arrives for a whole category,
                      so it can be priced without ticking every row. */}
                  <Button
                    variant="outline" size="sm"
                    className="ml-auto h-7 px-2 text-[11px]"
                    disabled={bulkBusy}
                    onClick={() => applyGroupDiscount(
                      getCategoryName(categoryId === 'uncategorized' ? null : categoryId),
                      categoryEntries)}
                  >
                    Price all
                  </Button>
                </div>

                {/* Always a scroller: the ladder pushes the row past any
                    window, and even without it the row keeps a 480px floor so
                    the name is not crushed on a phone. */}
                <div className="overflow-x-auto">
                 <div className={pbMinW(showLadder)}>
                  <div className={cn(
                    "grid items-center px-3 py-1.5 border-b bg-muted/30", pbGap(showLadder),
                    "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                    pbGrid(showLadder),
                  )}>
                    <span />
                    <span>Pack / variant</span>
                    <span className="hidden md:block text-center">Min qty</span>
                    <span className="hidden md:block text-center">Unit</span>
                    {/* The trade margin ladder, in the order money moves:
                        we sell at Distributor, they sell on at PTS, the
                        retailer buys at PTR, the shopper pays MRP. */}
                    {showLadder && <span className="hidden md:block text-right">MRP</span>}
                    {showLadder && <span className="hidden lg:block text-right" title="Price to retailer">PTR</span>}
                    {showLadder && <span className="hidden lg:block text-right" title="Price to stockist">PTS</span>}
                    {showLadder && <span className="hidden lg:block text-right" title="What the distributor pays us">Dist.</span>}
                    <span className="text-right">List</span>
                    <span className="hidden sm:block text-right">Disc %</span>
                    <span className="text-right">Final</span>
                    {showLadder && <span className="hidden lg:block text-right">Margin</span>}
                    <span />
                  </div>

                  <div className="divide-y">
                    {groupByProduct(categoryEntries).map((group) => {
                      const ladderUoms = uomsByProduct[group.productId] ?? [];
                      return (
                      <div key={group.productId} className="bg-card">
                        {/* The product, once. Everything under it is a way of
                            buying this same product, so repeating the name on
                            every row only crowded out the part that differs. */}
                        <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5">
                          {/* Lines up with the row checkboxes below it, so
                              every row of one product can be ticked without
                              taking the whole category. */}
                          <Checkbox
                            className="shrink-0"
                            aria-label={`Select every row of ${group.name}`}
                            checked={group.rows.every((e) => picked.has(e.id))}
                            onCheckedChange={(v) =>
                              toggleAll(group.rows.map((e) => e.id), v === true)}
                          />
                          <button
                            onClick={() => navigate(`/product-management?product=${group.productId}`)}
                            className="font-semibold text-sm text-primary hover:underline inline-flex items-center gap-1 min-w-0"
                          >
                            <span className="truncate">{group.name}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </button>
                          <span className="text-[11px] text-muted-foreground tabular-nums truncate">
                            {group.rows.length} row{group.rows.length === 1 ? '' : 's'}
                            {ladderUoms.length > 0 &&
                              ` · ${ladderUoms.length} unit${ladderUoms.length === 1 ? '' : 's'} set up`}
                            {priceRange(group.rows.map(view)) && ` · ${priceRange(group.rows.map(view))}`}
                          </span>
                          {/* A revision usually lands on one product's whole
                              set of packs, which the category button is too
                              blunt for and ticking each row too slow. */}
                          <Button
                            variant="ghost" size="sm"
                            className="ml-auto h-7 shrink-0 px-2 text-[11px]"
                            disabled={bulkBusy}
                            onClick={() => applyGroupDiscount(group.name, group.rows)}
                          >
                            Price all
                          </Button>
                        </div>

                        {group.rows.map(saved => {
                          /* Everything below reads the draft-merged view, so
                             an unsaved edit shows its effect -- the new final
                             price, a margin warning -- before it is written. */
                          const entry = view(saved);
                          const dirty = isDirty(saved.id);
                          const mrp = mrpFor(entry);
                          const margin = marginFor(entry);
                          const fault = ladderFault(entry);
                          const overMrp = mrp != null && Number(entry.final_price) > mrp;
                          const pack = entry.uom_id
                            ? ladderUoms.find((x) => x.id === entry.uom_id)
                            : null;
                          return (
                          <div
                            key={entry.id}
                            className={cn(
                              "grid items-center px-3 py-2 transition-colors border-t", pbGap(showLadder),
                              picked.has(entry.id) ? "bg-primary/5"
                                : dirty ? "bg-amber-50 dark:bg-amber-950/30"
                                : "bg-card hover:bg-muted/40",
                              pbGrid(showLadder),
                            )}
                          >
                            <Checkbox
                              aria-label={`Select ${entry.variant?.variant_name ?? entry.product?.name ?? 'product'}`}
                              checked={picked.has(entry.id)}
                              onCheckedChange={() => toggleRow(entry.id)}
                            />
                            {/* What tells this row apart from its siblings:
                                the variant, the pack and the quantity slab. */}
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              {entry.variant ? (
                                <span className="font-medium text-sm truncate">
                                  {entry.variant.variant_name}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Base product</span>
                              )}
                              {pack && (
                                <Badge className="text-[10px] bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300">
                                  {pack.code}{pack.factor > 1 ? ` × ${pack.factor}` : ''}
                                </Badge>
                              )}
                              {entry.min_quantity > 1 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Qty ≥ {entry.min_quantity}
                                </Badge>
                              )}
                              {dirty && (
                                <Badge className="text-[10px] bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200">
                                  unsaved
                                </Badge>
                              )}
                            </div>

                            <Input
                              type="number"
                              value={entry.min_quantity}
                              onChange={(e) => handleUpdateEntry(entry, 'min_quantity', parseInt(e.target.value) || 1)}
                              className="hidden md:block h-8 text-center"
                              min={1}
                            />
                            {/* "All units" is uom_id NULL -- one price however
                                it is ordered, which is what every existing row
                                means. Pick a pack and this row prices THAT
                                pack, so a tray of 24 and a tray of 12 can
                                differ without either being a multiple of the
                                base unit. */}
                            <Select
                              value={entry.uom_id ?? '__any__'}
                              onValueChange={(v) => handleUpdateEntry(entry, 'uom_id', v === '__any__' ? null : v)}
                            >
                              <SelectTrigger
                                className="hidden md:flex h-8 px-2 text-xs"
                                title={entry.uom_id
                                  ? 'This row prices that pack only'
                                  : 'One price however this product is ordered'}
                              >
                                <SelectValue placeholder="All units" />
                              </SelectTrigger>
                              <SelectContent>
                                {/* Short enough to survive the trigger, which
                                    renders the chosen item verbatim: the long
                                    form truncated to "All units — one…". */}
                                <SelectItem value="__any__" className="text-xs">
                                  All units
                                </SelectItem>
                                {ladderUoms.map((u) => (
                                  <SelectItem key={u.id} value={u.id} className="text-xs">
                                    {u.code}{u.factor > 1 ? ` × ${u.factor}` : ''}
                                  </SelectItem>
                                ))}
                                {ladderUoms.length === 0 && (
                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    No units set up for this product
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            {/* MRP is the ceiling the rest of the row is read
                                against, so it sits before the prices. Editable
                                here because a book may carry a state MRP. */}
                            {showLadder && (
                              <Input
                                type="number"
                                value={entry.mrp ?? ''}
                                onChange={(e) => handleUpdateEntry(entry, 'mrp',
                                  e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                                className={cn("hidden md:block h-8 text-right",
                                  entry.mrp == null && "placeholder:text-muted-foreground/60")}
                                placeholder={mrp != null ? String(mrp) : '—'}
                                title={entry.mrp == null && mrp != null
                                  ? 'Inherited from the product master'
                                  : undefined}
                              />
                            )}
                            {/* The ladder itself. Blank is honest -- it means
                                the margin has not been set, not that it is
                                zero. */}
                            {showLadder && (['ptr', 'pts', 'distributor_price'] as const).map((f) => (
                              <Input
                                key={f}
                                type="number"
                                value={entry[f] ?? ''}
                                onChange={(e) => handleUpdateEntry(entry, f,
                                  e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                                className="hidden lg:block h-8 text-right"
                                placeholder="—"
                              />
                            ))}
                            <Input
                              type="number"
                              value={entry.list_price}
                              onChange={(e) => handleUpdateEntry(entry, 'list_price', parseFloat(e.target.value) || 0)}
                              className="h-8 text-right"
                            />
                            <Input
                              type="number"
                              value={entry.discount_percent}
                              onChange={(e) => handleUpdateEntry(entry, 'discount_percent', parseFloat(e.target.value) || 0)}
                              className="hidden sm:block h-8 text-right"
                              min={0}
                              max={100}
                            />
                            <div className="text-right">
                              {Number(entry.final_price) > 0 ? (
                                <p className={cn("font-semibold tabular-nums",
                                  overMrp ? "text-destructive" : "text-primary")}
                                  title={overMrp ? `Above the MRP of ${fmtBook(mrp!)}` : undefined}>
                                  {fmtBook(entry.final_price)}
                                </p>
                              ) : (
                                <span className="text-xs text-muted-foreground">not set</span>
                              )}
                            </div>
                            {/* What the shop keeps if it sells at MRP — the
                                number the pricing conversation turns on. */}
                            {showLadder && (
                              <div className="hidden lg:block text-right">
                                {overMrp ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                                    <AlertTriangle className="h-3 w-3" /> over MRP
                                  </span>
                                ) : fault ? (
                                  /* An inverted ladder matters more than the
                                     margin figure: the margin is only
                                     meaningful once the steps are the right
                                     way up. */
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive"
                                        title={fault}>
                                    <AlertTriangle className="h-3 w-3" /> ladder
                                  </span>
                                ) : margin != null ? (
                                  <span className={cn("text-xs tabular-nums",
                                    margin < 5 ? "text-amber-600" : "text-muted-foreground")}>
                                    {margin.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground/60">—</span>
                                )}
                              </div>
                            )}

                            {/* Pinned to the right edge: with the ladder on
                                the row scrolls, and these used to scroll out
                                of reach -- Remove among them. */}
                            <div className={cn(
                              "flex items-center justify-end gap-0.5",
                              showLadder && "sticky right-0 bg-inherit pl-2 -mr-1 pr-1",
                            )}>
                              {/* Row-level warning, where the Margin column
                                  is not on screen to carry it. */}
                              {!showLadder && (overMrp || fault) && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 text-destructive mr-1 shrink-0"
                                  aria-label={overMrp ? 'Above MRP' : 'Trade ladder is inverted'}
                                />
                              )}
                              {/* A pack is priced for one variant, not for
                                  the product as a whole, so this sits on the
                                  row that names the variant. */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title={ladderUoms.length === 0
                                  ? 'No units set up for this product in Product Master'
                                  : 'Price this variant in another pack'}
                                onClick={() => handleAddUnit(entry)}
                              >
                                <Boxes className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Add a higher quantity slab"
                                onClick={() => handleAddSlab(entry)}
                              >
                                <Layers className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                title="Remove this row from the book"
                                onClick={() => handleDeleteEntry(entry.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                      );
                    })}
                  </div>
                 </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <PriceBookSchemes
          priceBookId={priceBook.id}
          productIds={Array.from(new Set(entries.map((e) => e.product_id).filter(Boolean)))}
        />

        <PriceBookHistory priceBookId={priceBook.id} />
      </div>
    </Layout>
  );
};

export default PriceBookDetail;