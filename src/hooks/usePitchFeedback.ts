import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PitchFeedback = "like" | "dislike";
export interface PitchFeedbackItem { productId: string; variantId?: string | null; category: string; qty?: number; unit?: string }
const key = (i: { productId: string; variantId?: string | null }) => `${i.productId}:${i.variantId ?? "base"}`;
const PENDING = "ai_pitch_feedback_pending";

type Pending = { retailerId: string; item: PitchFeedbackItem; value: PitchFeedback | null; reason?: string | null };
const readPending = (): Pending[] => { try { return JSON.parse(localStorage.getItem(PENDING) || "[]"); } catch { return []; } };
const writePending = (p: Pending[]) => { try { localStorage.setItem(PENDING, JSON.stringify(p)); } catch { /* ignore */ } };

/** Next state when the rep taps a button: same choice clears, other choice switches. */
export const nextFeedback = (current: PitchFeedback | undefined, tapped: PitchFeedback): PitchFeedback | null =>
  current === tapped ? null : tapped;

async function persist({ retailerId, item, value, reason }: Pending) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) throw new Error("signed out");
  const t = supabase.from("ai_pitch_feedback" as any);
  if (value === null) {
    let q: any = t.delete().eq("user_id", uid).eq("retailer_id", retailerId).eq("product_id", item.productId);
    q = item.variantId ? q.eq("variant_id", item.variantId) : q.is("variant_id", null);
    const { error } = await q;
    if (error) throw error;
    return;
  }
  const { error } = await (t as any).upsert({
    user_id: uid, retailer_id: retailerId, category: item.category, product_id: item.productId,
    variant_id: item.variantId ?? null, suggested_qty: item.qty ?? null, unit: item.unit ?? null, feedback: value, reason: value === "dislike" ? (reason?.trim().slice(0, 200) || null) : null,
  }, { onConflict: "user_id,retailer_id,product_id,variant_key" });
  if (error && error.code !== "23505") throw error;
}

async function flushPending() {
  const queue = readPending();
  if (!queue.length) return;
  const left: Pending[] = [];
  for (const p of queue) { try { await persist(p); } catch { left.push(p); } }
  writePending(left);
}

export function usePitchFeedback(retailerId: string) {
  const [map, setMap] = useState<Record<string, PitchFeedback>>({});
  useEffect(() => {
    setMap({});
    if (!retailerId) return;
    let cancelled = false;
    void (async () => {
      await flushPending().catch(() => undefined);
      const { data } = await supabase.from("ai_pitch_feedback" as any).select("product_id, variant_id, feedback").eq("retailer_id", retailerId);
      const { data: sess } = await supabase.auth.getSession();
      const next: Record<string, PitchFeedback> = {};
      for (const r of (data ?? []) as any[]) next[key({ productId: r.product_id, variantId: r.variant_id })] = r.feedback;
      // Unsynced local taps win over server state.
      for (const p of readPending()) if (p.retailerId === retailerId) { if (p.value) next[key(p.item)] = p.value; else delete next[key(p.item)]; }
      if (!cancelled && sess.session) setMap(next);
    })().catch(() => undefined);
    const onOnline = () => void flushPending();
    window.addEventListener("online", onOnline);
    return () => { cancelled = true; window.removeEventListener("online", onOnline); };
  }, [retailerId]);

  const toggle = useCallback((item: PitchFeedbackItem, tapped: PitchFeedback, reason?: string | null) => {
    const k = key(item);
    let value: PitchFeedback | null = null;
    setMap(prev => {
      value = nextFeedback(prev[k], tapped);
      const n = { ...prev };
      if (value) n[k] = value; else delete n[k];
      return n;
    });
    queueMicrotask(() => {
      const entry: Pending = { retailerId, item, value, reason };
      persist(entry).catch(() => writePending([...readPending().filter(p => !(p.retailerId === retailerId && key(p.item) === k)), entry]));
    });
  }, [retailerId]);

  return { feedback: map, toggle };
}
