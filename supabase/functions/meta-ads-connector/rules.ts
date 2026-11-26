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
