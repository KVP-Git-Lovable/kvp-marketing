export type ConnectorObjective = 'traffic' | 'leads';
export function campaignPayload(name: string, categories: string[], objective: ConnectorObjective = 'traffic') {
  return { name: name.trim(), objective: objective === 'leads' ? 'OUTCOME_LEADS' : 'OUTCOME_TRAFFIC', special_ad_categories: categories, status: 'PAUSED', is_adset_budget_sharing_enabled: false };
}
export const TRAFFIC_CTAS = ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'CONTACT_US', 'ORDER_NOW'] as const;
export const LEAD_CTAS = ['SIGN_UP', 'LEARN_MORE', 'GET_QUOTE', 'APPLY_NOW', 'SUBSCRIBE', 'DOWNLOAD'] as const;
/** Ad set settings that differ between a website-traffic campaign and an Instant Form lead campaign. */
export function adsetGoal(objective: ConnectorObjective, pageId: string) {
  return objective === 'leads'
    ? { optimization_goal: 'LEAD_GENERATION', destination_type: 'ON_AD', promoted_object: { page_id: pageId } }
    : { optimization_goal: 'LINK_CLICKS', destination_type: 'WEBSITE' };
}
/** The creative's button: a website link, or the Instant Form it opens. */
export function creativeLink(objective: ConnectorObjective, cta: string, website: string | undefined, formId: string | undefined) {
  if (objective === 'leads') {
    if (!formId) throw new Error('Choose a lead form.');
    return { link: 'https://fb.me/', call_to_action: { type: cta, value: { lead_gen_form_id: formId } } };
  }
  if (!website) throw new Error('Enter the website URL.');
  return { link: website, call_to_action: { type: cta, value: { link: website } } };
}

export interface TargetingInput {
  countries: string[]; platforms: string[];
  age_min?: number; age_max?: number; genders?: number[]; regions?: Array<{ key: string; name: string }>;
}
/** Ad set targeting. Without the optional fields this is the original connector targeting (18-65, countries). */
export function buildTargeting(d: TargetingInput, audienceExternalId?: string) {
  return {
    ...(audienceExternalId ? { custom_audiences: [{ id: audienceExternalId }] } : {}),
    // Meta rejects a country together with a region inside it, so regions replace the country list.
    geo_locations: d.regions?.length ? { regions: d.regions.map((r) => ({ key: r.key })) } : { countries: d.countries },
    publisher_platforms: d.platforms,
    facebook_positions: d.platforms.includes('facebook') ? ['feed'] : undefined,
    instagram_positions: d.platforms.includes('instagram') ? ['stream'] : undefined,
    age_min: d.age_min ?? 18, age_max: d.age_max ?? 65,
    ...(d.genders?.length === 1 ? { genders: d.genders } : {}),
    targeting_automation: { advantage_audience: 0 },
  };
}
/** Daily budget, or a lifetime budget (which Meta only accepts with an end time). Amounts become minor units. */
export function budgetFields(type: 'daily' | 'lifetime', amount: number): Record<string, number> {
  const minor = Math.round(amount * 100);
  return type === 'lifetime' ? { lifetime_budget: minor } : { daily_budget: minor };
}
/** Whether an approved budget change stays within the step, ceiling and cooldown. Returns a reason when refused. */
export function budgetChangeProblem(current: number, next: number, type: 'daily' | 'lifetime', limits: { step: number; maxDaily: number; maxTotal: number; cooldownHours: number }, lastChangeAt?: string, now = Date.now()): string | null {
  if (!Number.isFinite(next) || next <= 0) return 'Enter a budget greater than zero.';
  if (next === current) return 'The budget is already at that amount.';
  if (Math.abs(next - current) > current * limits.step + 0.005) return `A single change can move the budget by at most ${Math.round(limits.step * 100)}%.`;
  const ceiling = type === 'lifetime' ? limits.maxTotal : limits.maxDaily;
  if (next > current && next > ceiling) return `The agent limit for a ${type === 'lifetime' ? 'total' : 'daily'} budget is ₹${ceiling.toLocaleString('en-IN')}.`;
  if (lastChangeAt && now - Date.parse(lastChangeAt) < limits.cooldownHours * 3600000) return `This budget was changed recently. Wait ${limits.cooldownHours} hours between changes.`;
  return null;
}
