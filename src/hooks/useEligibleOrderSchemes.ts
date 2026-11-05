import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineSchemes } from "./useOfflineSchemes";
import { isSchemeActive, type ProductScheme } from "@/utils/schemeEngine";

interface Scope {
  retailerId: string;
  beatId: string | null;
  territoryId: string | null;
  distributorId: string | null;
  salespersonId: string | null;
  hasOrderedBefore: boolean;
  rows: { scheme_id: string; applicability_level: string; entity_id: string | null }[];
}

/** One targeting source for pitch previews, order entry and cart selection. */
export function retailerSchemeEligible(scheme: ProductScheme, scope: Scope): boolean {
  if (scheme.is_first_order_only && scope.hasOrderedBefore) return false;
  if (!scheme.applicability_type || scheme.applicability_type === "global") return true;
  return scope.rows.some(row => row.scheme_id === scheme.id && Boolean(row.entity_id) && (
    (row.applicability_level === "retailer" && row.entity_id === scope.retailerId) ||
    (row.applicability_level === "beat" && row.entity_id === scope.beatId) ||
    (row.applicability_level === "territory" && row.entity_id === scope.territoryId) ||
    (row.applicability_level === "distributor" && row.entity_id === scope.distributorId) ||
    (row.applicability_level === "salesperson" && row.entity_id === scope.salespersonId)
  ));
}

export function useEligibleOrderSchemes(retailerId: string, editOrderId = "") {
  const { schemes, loading: schemesLoading } = useOfflineSchemes();
  const signature = schemes.map(s => s.id).sort().join(",");
  const query = useQuery({
    queryKey: ["order-scheme-retailer-scope", retailerId, editOrderId, signature],
    enabled: Boolean(retailerId) && !schemesLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<Scope> => {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const salespersonId = session.session?.user.id || null;
      const cacheKey = `scheme_scope:${salespersonId || "signed-out"}:${retailerId}:${editOrderId}:${signature}`;
      if (!navigator.onLine) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached) as Scope;
        throw new Error("Retailer scheme eligibility unavailable offline");
      }
      let history = supabase.from("orders").select("id").eq("retailer_id", retailerId).neq("status", "cancelled");
      if (editOrderId) history = history.neq("id", editOrderId);
      const [{ data: retailer, error: retailerError }, { data: previous, error: historyError }] = await Promise.all([
        supabase.from("retailers").select("id, beat_id, territory_id, distributor_id").eq("id", retailerId).maybeSingle(),
        history.limit(1),
      ]);
      if (retailerError || historyError || !retailer) throw retailerError || historyError || new Error("Retailer not found");
      let beatId: string | null = null;
      if (retailer.beat_id) {
        const { data: beat, error } = await supabase.from("beats").select("id").eq("beat_id", retailer.beat_id).limit(1).maybeSingle();
        if (error) throw error;
        beatId = beat?.id || null;
      }
      const rows: Scope["rows"] = [];
      const ids = schemes.filter(s => s.applicability_type && s.applicability_type !== "global").map(s => s.id);
      for (let start = 0; start < ids.length; start += 100) {
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from("scheme_applicability").select("scheme_id, applicability_level, entity_id").in("scheme_id", ids.slice(start, start + 100)).order("id").range(offset, offset + 499);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < 500) break;
        }
      }
      const scope: Scope = { retailerId, beatId, territoryId: retailer.territory_id, distributorId: retailer.distributor_id, salespersonId, hasOrderedBefore: Boolean(previous?.length), rows };
      localStorage.setItem(cacheKey, JSON.stringify(scope));
      return scope;
    },
  });
  return { schemes: useMemo(() => query.data ? schemes.filter(s => isSchemeActive(s) && retailerSchemeEligible(s, query.data)) : [], [schemes, query.data]), loading: schemesLoading || query.isPending };
}