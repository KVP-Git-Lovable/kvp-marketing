import { useEffect, useId, useState } from "react";
import { CalendarCheck, Check, ChevronDown, ChevronRight, ChevronUp, Gift, Heart, Loader2, MapPin, Flame, Plus, Sparkles, Store, Tag, ThumbsDown, ThumbsUp, TrendingUp, UserPlus, Users, Zap } from "lucide-react";
import { usePitchApplicableSchemes } from "@/hooks/usePitchApplicableSchemes";
import { usePitchFeedback } from "@/hooks/usePitchFeedback";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readPitchCache, writePitchCache } from "@/utils/pitchSuggestionsCache";
import { cn } from "@/lib/utils";
import { usePitchProductImages, pitchImageKey } from "@/hooks/usePitchProductImages";
import { PitchProductImage } from "@/components/PitchProductImage";
import type { VoiceAutoFillResult } from "@/components/TableOrderForm";
import { pitchSchemeSuggestion, type PitchSchemeContext } from "@/utils/pitchSchemeSelection";
import { schemeAppliesToItem, type ProductScheme } from "@/utils/schemeEngine";
import { SchemeDetailsDisplay } from "@/components/SchemeDetailsDisplay";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DISLIKE_REASONS = ["Not relevant", "Already stocked", "Low demand here", "Price too high", "Wrong quantity", "Other"];

/**
 * AI pitch suggestions for the Order Entry page — automatic, per retailer.
 *
 * Consumer of the ai-pitch-suggestions edge function: four fixed categories
 * (Retailer Favourites / Beat Favourite / Top Seller / Schemes & Offers),
 * each computed deterministically from SQL (last-10-productive-visits
 * windows), with Lovable AI Gateway narrating the already-chosen items —
 * it never selects which products appear, only writes the reason text.
 *
 * "Take Action" auto-fills every category's items through the same
 * mechanism Voice Order and Smart Basket use. Add is a toggle: adding
 * again removes the line via onRemove (the order form's cart-sync path).
 */

type CategoryKey = "retailer_favourite" | "beat_favourite" | "top_seller" | "scheme";

export interface PitchCategoryItem {
  productId: string;
  variantId?: string | null;
  name: string;
  qty: number;
  unit: string;
  category: CategoryKey;
  reason: string;
  tag?: "starter" | "territory" | "new_launch";
  evidence?: string;
  details?: string;
  /** % of peer/company retailers who bought this, 0-100. Only set for beat_favourite and top_seller. */
  sharePct?: number;
  /** Raw numerator/denominator behind sharePct (e.g. 9 of 10), for "N of M" phrasing alongside the %. */
  shareCount?: number;
  shareTotal?: number;
}

const TAG_LABEL = { starter: "Starter Picks", territory: "Territory Fallback", new_launch: "New Launch" };
const BESTSELLER_LINE = "Company-wide bestseller · Last 30 days";
const itemKey = (item: PitchCategoryItem) => `${item.productId}:${item.variantId ?? "base"}`;
const itemLabel = (item: PitchCategoryItem) => {
  if (item.tag === "starter" && item.category === "retailer_favourite") return TAG_LABEL.starter;
  if (item.tag === "territory" && item.category === "beat_favourite") return TAG_LABEL.territory;
  if (item.tag === "new_launch" && item.category === "scheme") return TAG_LABEL.new_launch;
  return null;
};

// Two short, data-backed labels per item; full source text stays in How to Pitch.
const insightLabels = (item: PitchCategoryItem): { icon: typeof Heart; text: string }[] => {
  const src = `${item.evidence ?? ""} ${item.reason ?? ""}`;
  if (item.category === "top_seller") return [{ icon: TrendingUp, text: "High Demand" }, { icon: Zap, text: "Fast Moving" }];
  if (item.category === "scheme") return [
    { icon: Tag, text: "Scheme Offer" },
    item.tag === "new_launch" ? { icon: Sparkles, text: "New Launch" } : { icon: TrendingUp, text: "Trial Pick" },
  ];
  if (item.tag === "starter") return [{ icon: Store, text: "Store Type" }, { icon: Users, text: "Popular Locally" }];
  if (item.category === "beat_favourite") return [{ icon: Users, text: "Popular Locally" }, { icon: CalendarCheck, text: "Recent Orders" }];
  const repeat = /bought \d+ times|repeat|reorder|times/i.test(src);
  return [
    { icon: TrendingUp, text: repeat ? "Repeat Orders" : "Past Purchase" },
    { icon: CalendarCheck, text: "Recent Orders" },
  ];
};

export interface PitchCategory {
  key: CategoryKey;
  label: string;
  items: PitchCategoryItem[];
}

interface PitchResult {
  kind: string;
  retailerId: string;
  isNewRetailer?: boolean;
  isNewBeat?: boolean;
  categories: PitchCategory[];
  summary?: string;
}

const CATEGORY_STYLE: Record<CategoryKey, { icon: typeof Heart; cls: string; iconCls: string; label: string; ring: string }> = {
  retailer_favourite: { icon: Heart, cls: "bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-950/40 dark:to-rose-950/20", iconCls: "text-rose-600 dark:text-rose-400", label: "Retailer Favourites", ring: "ring-rose-400 dark:ring-rose-600" },
  beat_favourite: { icon: MapPin, cls: "bg-gradient-to-br from-sky-100 to-slate-50 dark:from-sky-950/40 dark:to-slate-950/20", iconCls: "text-sky-600 dark:text-sky-400", label: "Beat Favourite", ring: "ring-sky-400 dark:ring-sky-600" },
  top_seller: { icon: Flame, cls: "bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/20", iconCls: "text-orange-600 dark:text-orange-400", label: "Top Seller", ring: "ring-orange-400 dark:ring-orange-600" },
  scheme: { icon: Gift, cls: "bg-gradient-to-br from-emerald-100 to-green-50 dark:from-emerald-950/40 dark:to-green-950/20", iconCls: "text-emerald-600 dark:text-emerald-400", label: "Schemes & Offers", ring: "ring-emerald-400 dark:ring-emerald-600" },
};

interface Props {
  retailerId: string;
  onAutoFill: (results: VoiceAutoFillResult[]) => void;
  onRemove?: (item: { productId: string; variantId?: string | null }) => void;
  orderedKeys?: string[];
  schemeContext?: PitchSchemeContext;
}

export function PitchSuggestionsCard({ retailerId, onAutoFill, onRemove, orderedKeys, schemeContext }: Props) {
  const [result, setResult] = useState<PitchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [openPitchKey, setOpenPitchKey] = useState<string | null>(null);
  const bodyId = useId();

  useEffect(() => {
    if (!retailerId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setOpenCategory(null);
    setExpanded(true);
    setAddedKeys(new Set());
    setOpenPitchKey(null);
    setResult(null);
    setLoading(true);
    setFailed(false);

    void (async () => {
      // Shared session cache — usually already warmed by the visits page
      // (prefetchPitchSuggestions), so the card renders instantly here.
      const cached = readPitchCache(retailerId);
      if (cached) {
        if (!cancelled) {
          setResult(cached);
          setLoading(false);
        }
        return;
      }

      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("signed out");
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-pitch-suggestions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ retailerId }),
          signal: AbortSignal.timeout(30000),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `Failed (${res.status})`);
        if (!cancelled && body?.kind === "pitch") {
          setResult(body);
          writePitchCache(retailerId, body);
        }
      } catch (e) {
        console.error("[PitchSuggestions] load failed:", e);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retailerId]);

  const categories = result?.categories ?? [];
  const images = usePitchProductImages(categories.flatMap(c => c.items));
  const schemeMap = usePitchApplicableSchemes(retailerId, categories.flatMap(c => c.items));
  const { feedback, toggle: toggleFeedback } = usePitchFeedback(retailerId);
  const [schemeView, setSchemeView] = useState<{ name: string; schemes: ProductScheme[] } | null>(null);
  const [dislikeFor, setDislikeFor] = useState<{ item: { productId: string; variantId?: string | null; category: string; qty?: number; unit?: string }; name: string } | null>(null);
  const [dislikeChip, setDislikeChip] = useState<string | null>(null);
  const [dislikeText, setDislikeText] = useState("");
  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const actualAddedKeys = orderedKeys ? new Set(orderedKeys) : addedKeys;
  const preview = (item: PitchCategoryItem) => {
    if (!schemeContext) return { quantity: item.qty };
    const rate = schemeContext.resolveRate(item.productId, item.variantId || undefined, item.unit, item.qty);
    const existing = schemeContext.items.find(line => line.product_id === item.productId && (line.variant_id || null) === (item.variantId || null));
    const schemeItem = { id: itemKey(item), product_id: item.productId, variant_id: item.variantId || undefined, quantity: item.qty, rate: existing?.rate ?? rate ?? 0, unit: item.unit, category_id: existing?.category_id ?? schemeContext.categoryId?.(item.productId) };
    return pitchSchemeSuggestion(schemeItem, schemeContext.items, schemeContext.schemes, schemeContext.policies, schemeContext.resolveFreeRate || schemeContext.resolveRate, quantity => schemeContext.resolveRate(item.productId, item.variantId || undefined, item.unit, quantity));
  };

  const toAutoFillResults = (items: PitchCategoryItem[]): VoiceAutoFillResult[] =>
    items.map((s) => ({
      productId: s.productId,
      productName: s.name,
      ...(s.variantId ? { variantId: s.variantId, variantName: s.name } : {}),
      ...(() => { const p = preview(s); return { quantity: p.quantity, ...(p.schemeId ? { schemeId: p.schemeId } : {}) }; })(),
      unit: s.unit || "",
      confidence: "high" as const,
      searchTerm: s.name,
    }));

  const addItems = (items: PitchCategoryItem[]) => {
    const unique = [...new Map(items.filter(item => !actualAddedKeys.has(itemKey(item))).map(item => [itemKey(item), item])).values()];
    if (!unique.length) return;
    onAutoFill(toAutoFillResults(unique));
    if (!orderedKeys) setAddedKeys(previous => new Set([...previous, ...unique.map(itemKey)]));
  };
  const removeItem = (item: PitchCategoryItem) => {
    onRemove?.({ productId: item.productId, variantId: item.variantId });
    setAddedKeys(previous => {
      const next = new Set(previous);
      next.delete(itemKey(item));
      return next;
    });
  };
  const toggleItem = (item: PitchCategoryItem) => {
    if (actualAddedKeys.has(itemKey(item))) removeItem(item);
    else addItems([item]);
  };
  const closeDislike = () => { setDislikeFor(null); setDislikeChip(null); setDislikeText(""); };
  const handleTakeAction = () => addItems(categories.flatMap(c => c.items));

  if (!retailerId || (!loading && !result && failed)) return null;
  if (!loading && totalItems === 0) return null;
  const selected = categories.find(c => c.key === openCategory);
  const selectedStyle = selected ? CATEGORY_STYLE[selected.key] : null;

  return (
    <section aria-label="AI Suggestions" className="overflow-hidden rounded-xl border-2 border-red-500 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 text-card-foreground dark:border-red-600 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/30">
      <div className="h-1 bg-gradient-to-r from-red-500 via-amber-400 to-orange-500" />
      <div className="flex flex-nowrap items-center justify-between gap-1.5 p-2 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-500/15 to-amber-500/20">
            <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          </span>
          <h3 className="text-xs font-semibold">AI Suggestions</h3>
          {loading && <Loader2 aria-label="Loading suggestions" className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {!loading && totalItems > 0 && <Button size="sm" className="h-7 gap-1 px-2 bg-black text-[11px] text-white hover:bg-black/85 dark:bg-black dark:text-white dark:hover:bg-black/85" onClick={handleTakeAction}>Add All</Button>}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-black dark:text-white" title={expanded ? "Collapse AI Suggestions" : "Expand AI Suggestions"} aria-label={expanded ? "Collapse AI Suggestions" : "Expand AI Suggestions"} aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(previous => !previous)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {!loading && (result?.isNewRetailer || result?.isNewBeat) && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1.5">
          {result?.isNewRetailer && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"><UserPlus className="h-3 w-3" />New Retailer</span>}
          {result?.isNewBeat && <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300"><MapPin className="h-3 w-3" />New Beat</span>}
        </div>
      )}
      {expanded && <div id={bodyId} className="px-3 pb-3">
        {!loading && totalItems > 0 && <div className="-mx-2 flex flex-nowrap gap-1 overflow-x-auto px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Recommendation categories">
          {categories.filter(category => category.items.length > 0).map(category => {
            const style = CATEGORY_STYLE[category.key];
            const Icon = style.icon;
            const isOpen = openCategory === category.key;
            return <Button key={category.key} variant="outline" aria-expanded={isOpen} aria-controls={`${bodyId}-category`} onClick={() => setOpenCategory(previous => previous === category.key ? null : category.key)} className={cn("h-10 w-[150px] shrink-0 justify-start gap-1.5 whitespace-nowrap rounded-md px-2.5 text-left text-[11px] leading-tight transition-colors", isOpen && [style.cls, "ring-2 ring-offset-1", style.ring])}>
              <Icon className={cn("h-4 w-4 shrink-0", style.iconCls)} /><span className="min-w-0 flex-1">{style.label}</span><span className="shrink-0 text-[10px] text-muted-foreground">{category.items.length}</span>
            </Button>;
          })}
        </div>}
        {selected && selectedStyle && <div id={`${bodyId}-category`} className="mt-1.5 border-t pt-2">
          <div className="grid grid-cols-2 gap-1">
            {selected.items.map(item => {
              const label = itemLabel(item);
              const added = actualAddedKeys.has(itemKey(item));
              const suggestion = preview(item);
              const displayQty = suggestion.quantity;
              const rate = schemeContext?.resolveRate(item.productId, item.variantId || undefined, item.unit, item.qty);
              const shareScope = item.category === "beat_favourite" ? "in your beat" : "company-wide";
              const shareLine = item.sharePct != null && item.shareCount != null && item.shareTotal != null
                ? `${item.shareCount} of ${item.shareTotal} retailers ${shareScope} buy this (${item.sharePct}%).`
                : null;
              const reasonLine = item.reason?.trim() || item.evidence?.trim() || (item.category === "top_seller" ? BESTSELLER_LINE : "Recommended for this store.");
              // Real, verified ₹ benefit already computed by preview()/pitchSchemeSuggestion
              // (the same scheme engine Order Entry/Cart use) — never a guessed figure; it's
              // undefined/null whenever any part of it (e.g. a free item's rate) can't be resolved.
              const winningScheme = suggestion.schemeId ? schemeContext?.schemes.find(s => s.id === suggestion.schemeId) : undefined;
              const isFreeGoods = winningScheme?.scheme_type === "buy_x_get_y_free" && (winningScheme.free_quantity ?? 0) > 0;
              const savingsLine = suggestion.benefit && suggestion.benefit > 0
                ? isFreeGoods
                  ? `Free ${winningScheme!.free_quantity}${winningScheme!.free_quantity_unit ? ` ${winningScheme!.free_quantity_unit}` : ""} worth ₹${suggestion.benefit.toFixed(0)} with this scheme.`
                  : `Save ₹${suggestion.benefit.toFixed(0)} with this scheme.`
                : null;
              // The recommended quantity is never bumped up to chase a scheme — if it's
              // short of a scheme's threshold, say exactly how much more would unlock it.
              const nearMissLine = suggestion.nearMiss
                ? `Your usual quantity is ${item.qty}${item.unit ? ` ${item.unit}` : ""}; add just ${suggestion.nearMiss.qtyNeeded}${suggestion.nearMiss.unit ? ` ${suggestion.nearMiss.unit}` : ""} more to unlock this scheme!`
                : null;
              const schemes = schemeContext ? schemeContext.schemes.filter(s => schemeAppliesToItem(s, { id: itemKey(item), product_id: item.productId, variant_id: item.variantId || undefined, rate: 0, quantity: item.qty, category_id: schemeContext.categoryId?.(item.productId) })) : (schemeMap[itemKey(item)] ?? []) as ProductScheme[];
              const fb = feedback[itemKey(item)];
              const fbItem = { productId: item.productId, variantId: item.variantId, category: item.category, qty: item.qty, unit: item.unit };
              const imageUrl = images[pitchImageKey(item)];
              return <article key={itemKey(item)} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-1">
                <div className="flex min-w-0 items-start gap-1.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
                    <PitchProductImage url={imageUrl} name={item.name} className="h-12 w-12 rounded-md" fallback />
                  </div>
                  <div className="min-w-0 flex-1">
                    <button type="button" aria-label={`Details for ${item.name}`} onClick={() => setOpenPitchKey(itemKey(item))} className="text-left">
                      <h5 className="line-clamp-2 break-words text-[11px] font-semibold leading-snug underline-offset-2 hover:underline">{item.name}</h5>
                    </button>
                    <span className="mt-1 block whitespace-nowrap text-[11px] font-medium">Qty: {displayQty}{item.unit ? `\u00A0${item.unit}` : ""}</span>
                  </div>
                  <Dialog open={openPitchKey === itemKey(item)} onOpenChange={open => setOpenPitchKey(open ? itemKey(item) : null)}>
                    <DialogContent className="max-w-xs gap-3 rounded-2xl p-4">
                      <DialogHeader><DialogTitle className="text-sm">Product Details</DialogTitle></DialogHeader>
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/40">
                          <PitchProductImage url={imageUrl} name={item.name} className="h-16 w-16 rounded-xl" fallback />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="break-words text-sm font-semibold leading-snug">{item.name}</h4>
                          <p className="text-xs text-muted-foreground">{displayQty}{item.unit ? ` ${item.unit}` : ""}{rate ? ` · ₹${rate.toFixed(0)}` : ""}</p>
                          {label && <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", selectedStyle.cls, selectedStyle.iconCls)}>{label}</span>}
                        </div>
                      </div>
                      <div className={cn("rounded-xl p-4 text-sm leading-relaxed", selectedStyle.cls)}>
                        <p className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", selectedStyle.iconCls)}><Sparkles className="h-4 w-4" />Why we recommend this</p>
                        <p className="break-words text-foreground">
                          {shareLine && <span className="font-semibold">{shareLine} </span>}
                          {reasonLine}
                        </p>
                        {savingsLine && <p className="mt-1.5 break-words font-semibold text-emerald-700 dark:text-emerald-400">{savingsLine}</p>}
                        {nearMissLine && <p className="mt-1.5 break-words font-semibold text-amber-700 dark:text-amber-400">{nearMissLine}</p>}
                      </div>
                      {schemes.length > 0 && <Button variant="outline" size="sm" className="h-8 w-full justify-between text-xs" onClick={() => { setOpenPitchKey(null); setSchemeView({ name: item.name, schemes }); }}><span className="flex items-center gap-1"><Tag className="h-3 w-3" />{schemes.length > 1 ? `${schemes.length} Schemes Available` : "Scheme Available"}</span><ChevronRight className="h-3 w-3" /></Button>}
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="mt-1.5 min-h-6 w-full">
                  {schemes.length > 0 && <Button variant="ghost" onClick={() => setSchemeView({ name: item.name, schemes })} className="flex h-6 w-full items-center justify-between gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="flex min-w-0 items-center gap-1"><Tag className="h-3 w-3 shrink-0" /><span className="truncate">{schemes.length > 1 ? `${schemes.length} Schemes Available` : "Scheme Available"}</span></span><ChevronRight className="h-3 w-3 shrink-0" />
                  </Button>}
                </div>
                <div className="mt-auto flex items-center gap-1 pt-1.5">
                  <Button variant="ghost" size="icon" title="Dislike" aria-label={`Dislike ${item.name}`} aria-pressed={fb === "dislike"} onClick={() => fb === "dislike" ? toggleFeedback(fbItem, "dislike") : setDislikeFor({ item: fbItem, name: item.name })} className={cn("h-7 w-7 shrink-0 rounded-full", fb === "dislike" ? "bg-red-500 text-white" : "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/40")}><ThumbsDown className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" title="Like" aria-label={`Like ${item.name}`} aria-pressed={fb === "like"} onClick={() => toggleFeedback(fbItem, "like")} className={cn("h-7 w-7 shrink-0 rounded-full", fb === "like" ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40")}><ThumbsUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" title={added ? "Unorder" : "Add to order"} className={cn("h-7 min-w-0 flex-1 gap-1 rounded-full px-1 text-[11px] font-medium", added ? "border border-border text-muted-foreground hover:bg-muted/60" : "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600")} aria-pressed={added} onClick={() => toggleItem(item)}>{added ? <Check className="h-3 w-3" /> : null}{added ? "Added" : "Add"}{!added && <Plus className="h-3 w-3" />}</Button>
                </div>
              </article>;
            })}
          </div>
        </div>}
      </div>}
      {dislikeFor && <Dialog open onOpenChange={open => { if (!open) closeDislike(); }}><DialogContent className="max-w-xs gap-3 p-4"><DialogHeader><DialogTitle className="text-sm">Why don't you like this?</DialogTitle></DialogHeader>
        <p className="-mt-2 line-clamp-1 text-[11px] text-muted-foreground">{dislikeFor.name}</p>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Dislike reasons">{DISLIKE_REASONS.map(r => <Button key={r} type="button" variant="outline" size="sm" aria-pressed={dislikeChip === r} onClick={() => setDislikeChip(c => c === r ? null : r)} className={cn("h-7 rounded-full px-2 text-[11px]", dislikeChip === r && "border-red-400 bg-red-50 text-red-600 dark:bg-red-950/40")}>{r}</Button>)}</div>
        <Textarea aria-label="Dislike reason" value={dislikeText} maxLength={200} onChange={e => setDislikeText(e.target.value)} placeholder="Add a note (optional)" rows={2} className="min-h-0 resize-none text-xs" />
        <div className="flex justify-end gap-2"><Button variant="outline" size="sm" className="h-8" onClick={closeDislike}>Cancel</Button><Button size="sm" className="h-8" disabled={!dislikeChip && !dislikeText.trim()} onClick={() => { toggleFeedback(dislikeFor.item, "dislike", [dislikeChip, dislikeText.trim()].filter(Boolean).join(": ").slice(0, 200)); closeDislike(); }}>Save</Button></div>
      </DialogContent></Dialog>}
      {schemeView && <Dialog open onOpenChange={open => { if (!open) setSchemeView(null); }}><DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Offers for {schemeView.name}</DialogTitle></DialogHeader><div className="space-y-4">{schemeView.schemes.map(scheme => <div key={scheme.id} className="border-b pb-3"><h4 className="mb-2 text-sm font-semibold">{scheme.name}</h4><SchemeDetailsDisplay scheme={scheme} /></div>)}</div></DialogContent></Dialog>}
    </section>
  );
}
