// The campaign plan the model proposes, and the checks code applies before anything reaches Meta.
import { LEAD_CTAS, TRAFFIC_CTAS } from '../meta-ads-connector/rules.ts';
import { AGENT_MAX_DAILY_BUDGET, AGENT_MAX_TOTAL_BUDGET } from '../_shared/meta-agent-limits.ts';

export interface AgentPlan {
  name: string;
  objective: 'traffic' | 'leads';
  budget: number;
  budget_type: 'daily' | 'lifetime';
  start?: string;
  end?: string;
  age_min: number;
  age_max: number;
  /** [] = everyone, [1] = men, [2] = women */
  genders: number[];
  regions: Array<{ key: string; name: string }>;
  platforms: Array<'facebook' | 'instagram'>;
  website?: string;
  lead_form_id?: string;
  audience_id?: string;
  text: string;
  headline: string;
  description?: string;
  cta: string;
  reasoning?: string;
}

export interface PlanContext {
  now: number;
  /** Everything the person typed, used to confirm the budget is theirs and not the model's. */
  userText: string;
  leadFormIds: string[];
  audienceIds: string[];
  regionKeys: string[];
  instagramAvailable: boolean;
}

/** Amounts a person typed: "5,000", "Rs.5000", "5k", "1.5 lakh". */
export function mentionedAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k\b|lakhs?\b|lacs?\b|thousand\b)?/gi)) {
    const base = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(base)) continue;
    const unit = (m[2] || '').toLowerCase();
    out.push(unit.startsWith('k') || unit.startsWith('t') ? base * 1000 : unit.startsWith('l') ? base * 100000 : base);
  }
  return out;
}

export function validatePlan(p: AgentPlan, ctx: PlanContext): string[] {
  const errors: string[] = [];
  if (!p.name?.trim()) errors.push('The campaign needs a name.');
  if (p.objective !== 'traffic' && p.objective !== 'leads') errors.push('Only website traffic and lead generation campaigns are supported so far.');
  if (p.budget_type !== 'daily' && p.budget_type !== 'lifetime') errors.push('Say whether the budget is per day or for the whole campaign.');
  if (!Number.isFinite(p.budget) || p.budget <= 0) errors.push('A budget is required.');
  else {
    if (!mentionedAmounts(ctx.userText).includes(p.budget)) errors.push(`Please confirm the budget: type the amount in rupees (the plan says ${p.budget}).`);
    const ceiling = p.budget_type === 'lifetime' ? AGENT_MAX_TOTAL_BUDGET : AGENT_MAX_DAILY_BUDGET;
    if (p.budget > ceiling) errors.push(`The agent can plan at most ₹${ceiling.toLocaleString('en-IN')} as a ${p.budget_type === 'lifetime' ? 'total' : 'daily'} budget.`);
  }
  const start = p.start ? Date.parse(p.start) : NaN;
  const end = p.end ? Date.parse(p.end) : NaN;
  if (p.start && Number.isNaN(start)) errors.push('The start date is not valid.');
  if (p.end && Number.isNaN(end)) errors.push('The end date is not valid.');
  if (p.start && start < ctx.now - 15 * 60000) errors.push('The start date is in the past.');
  if (p.end && end <= Math.max(ctx.now, Number.isNaN(start) ? 0 : start)) errors.push('The end date must be after the start date and in the future.');
  if (p.budget_type === 'lifetime' && !p.end) errors.push('A total budget needs an end date.');
  if (!Number.isInteger(p.age_min) || !Number.isInteger(p.age_max) || p.age_min < 18 || p.age_max > 65 || p.age_min > p.age_max) errors.push('Ages must be between 18 and 65.');
  if (!Array.isArray(p.genders) || p.genders.some((g) => g !== 1 && g !== 2)) errors.push('Gender targeting is not valid.');
  if ((p.regions || []).some((r) => !ctx.regionKeys.includes(r.key))) errors.push('A region could not be verified with Meta. Name the state again.');
  if (!p.platforms?.length || p.platforms.some((x) => x !== 'facebook' && x !== 'instagram')) errors.push('Choose Facebook and/or Instagram.');
  if (p.platforms?.includes('instagram') && !ctx.instagramAvailable) errors.push('Instagram is not verified for this Page and ad account.');
  if (p.objective === 'traffic') {
    if (!/^https:\/\/[^\s]+\.[^\s]+/.test(p.website || '')) errors.push('A website address starting with https:// is required.');
  } else if (!p.lead_form_id || !ctx.leadFormIds.includes(p.lead_form_id)) errors.push('Choose or create a lead form first.');
  if (p.audience_id && !ctx.audienceIds.includes(p.audience_id)) errors.push('That customer list was not found.');
  if (!p.text?.trim() || !p.headline?.trim()) errors.push('The ad needs primary text and a headline.');
  if ((p.text || '').length > 2000 || (p.headline || '').length > 255 || (p.description || '').length > 255) errors.push('The ad copy is too long.');
  const ctas: readonly string[] = p.objective === 'leads' ? LEAD_CTAS : TRAFFIC_CTAS;
  if (!ctas.includes(p.cta)) errors.push('That button is not available for this campaign type.');
  return errors;
}

export interface DraftAssets { account_id: string; page_id: string; instagram_id?: string }
export interface DraftMedia { media_path: string; media_kind: 'image' | 'video'; thumbnail_path?: string }

/** The connector's campaign draft. The special ad category is the person's own declaration, never the model's. */
export function toDraft(p: AgentPlan, assets: DraftAssets, media: DraftMedia, category: string) {
  return {
    name: p.name.trim(), objective: p.objective, account_id: assets.account_id, page_id: assets.page_id,
    ...(p.platforms.includes('instagram') && assets.instagram_id ? { instagram_id: assets.instagram_id } : {}),
    ...(p.objective === 'leads' ? { lead_form_id: p.lead_form_id } : { website: p.website }),
    ...(p.audience_id ? { audience_id: p.audience_id } : {}),
    text: p.text.trim(), headline: p.headline.trim(), description: p.description || '', cta: p.cta,
    budget: p.budget, budget_type: p.budget_type, age_min: p.age_min, age_max: p.age_max,
    ...(p.genders.length === 1 ? { genders: p.genders } : {}),
    ...(p.regions?.length ? { regions: p.regions } : {}),
    countries: ['IN'], platforms: p.platforms,
    categories: category === 'NONE' ? [] : [category], declaration_confirmed: true,
    ...(p.start ? { start: new Date(p.start).toISOString() } : {}), ...(p.end ? { end: new Date(p.end).toISOString() } : {}),
    media_path: media.media_path, media_kind: media.media_kind, ...(media.thumbnail_path ? { thumbnail_path: media.thumbnail_path } : {}),
  };
}
