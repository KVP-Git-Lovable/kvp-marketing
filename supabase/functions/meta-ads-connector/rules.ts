export function campaignPayload(name: string, categories: string[]) {
  return { name: name.trim(), objective: 'OUTCOME_TRAFFIC', special_ad_categories: categories, status: 'PAUSED', is_adset_budget_sharing_enabled: false };
}
