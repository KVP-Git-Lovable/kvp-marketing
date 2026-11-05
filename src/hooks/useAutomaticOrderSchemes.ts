import { useEffect, useMemo } from "react";
import { useAppliedSchemes } from "./useAppliedSchemes";
import { useSchemePolicies } from "./useSchemePolicies";
import { selectHighestBenefitSchemes, retainManualSchemes, monetarySchemeBenefit, type FreeRateResolver } from "@/utils/pitchSchemeSelection";
import { isSchemeConditionMet, type ProductScheme, type SchemeItem } from "@/utils/schemeEngine";

export function useAutomaticOrderSchemes(visitId: string, retailerId: string, items: SchemeItem[], schemes: ProductScheme[], resolveFreeRate?: FreeRateResolver, enabled = true) {
  const applied = useAppliedSchemes(visitId, retailerId);
  const { policies, loading } = useSchemePolicies();
  const selected = useMemo(() => {
    const ids = selectHighestBenefitSchemes(items, schemes, policies, resolveFreeRate, applied.manualSelections);
    const subtotal = items.reduce((sum, i) => sum + i.rate * i.quantity, 0);
    // Existing manually chosen offers with unpriced free goods are preserved, not valued by guesses.
    const manualIds = applied.appliedSchemeIds.filter(id => {
      const scheme = schemes.find(s => s.id === id);
      return scheme && isSchemeConditionMet(scheme, items, subtotal) && monetarySchemeBenefit(scheme, items, resolveFreeRate, applied.manualSelections[id]) == null;
    });
    return retainManualSchemes(ids, manualIds, schemes, policies);
  }, [items, schemes, policies, resolveFreeRate, applied.manualSelections, applied.appliedSchemeIds]);
  useEffect(() => {
    if (enabled && !loading && policies.autoApplyBestScheme) applied.replaceSchemes(selected);
  }, [enabled, loading, policies.autoApplyBestScheme, selected, applied.replaceSchemes]);
  return { ...applied, policies, selectedSchemeIds: enabled && !loading && policies.autoApplyBestScheme ? selected : applied.appliedSchemeIds };
}