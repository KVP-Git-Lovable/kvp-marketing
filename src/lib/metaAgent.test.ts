import { describe, expect, it } from 'vitest';
import { mentionedAmounts, toDraft, validatePlan, type AgentPlan, type PlanContext } from '../../supabase/functions/meta-agent/plan';
import { recommend, toDayStats, type DayStat } from '../../supabase/functions/meta-agent/rules';
import { budgetChangeProblem, budgetFields, buildTargeting } from '../../supabase/functions/meta-ads-connector/rules';

const now = Date.parse('2026-11-26T06:00:00Z');
const plan: AgentPlan = {
  name: 'Karnataka women', objective: 'traffic', budget: 5000, budget_type: 'lifetime',
  start: '2026-12-01T00:00:00+05:30', end: '2026-12-10T23:59:00+05:30', age_min: 25, age_max: 65, genders: [2],
  regions: [{ key: '1738', name: 'Karnataka' }], platforms: ['facebook'], website: 'https://example.com', text: 'Hello', headline: 'Sale', cta: 'LEARN_MORE',
};
const ctx: PlanContext = { now, userText: 'run it for Rs 5,000 in total', leadFormIds: [], audienceIds: [], regionKeys: ['1738'], instagramAvailable: false };

describe('plan validation', () => {
  it('accepts the example plan', () => expect(validatePlan(plan, ctx)).toEqual([]));
  it('reads typed amounts', () => expect(mentionedAmounts('Rs.5000, 5k and 1.5 lakh')).toEqual([5000, 5000, 150000]));
  it('refuses a budget the person never typed', () => expect(validatePlan({ ...plan, budget: 7000 }, ctx).join(' ')).toMatch(/confirm the budget/i));
  it('enforces the ceiling', () => expect(validatePlan({ ...plan, budget: 90000 }, { ...ctx, userText: '90000' }).join(' ')).toMatch(/at most/));
  it('refuses past dates, missing end, bad ages and unverified regions', () => {
    expect(validatePlan({ ...plan, start: '2026-11-01T00:00:00Z' }, ctx).join(' ')).toMatch(/past/);
    expect(validatePlan({ ...plan, end: undefined }, ctx).join(' ')).toMatch(/needs an end date/);
    expect(validatePlan({ ...plan, age_min: 16 }, ctx).join(' ')).toMatch(/18 and 65/);
    expect(validatePlan({ ...plan, regions: [{ key: '1', name: 'X' }] }, ctx).join(' ')).toMatch(/verified/);
  });
  it('needs a known lead form for lead campaigns', () => {
    expect(validatePlan({ ...plan, objective: 'leads', cta: 'SIGN_UP', lead_form_id: '9' }, ctx).join(' ')).toMatch(/lead form/);
    expect(validatePlan({ ...plan, objective: 'leads', cta: 'SIGN_UP', lead_form_id: '9' }, { ...ctx, leadFormIds: ['9'] })).toEqual([]);
  });
  it('builds a connector draft with the person\'s category', () => {
    const d = toDraft(plan, { account_id: 'act_1', page_id: '2' }, { media_path: 'connector/u/a.jpg', media_kind: 'image' }, 'NONE');
    expect(d).toMatchObject({ budget: 5000, budget_type: 'lifetime', genders: [2], age_min: 25, categories: [], countries: ['IN'], start: '2026-11-30T18:30:00.000Z' });
  });
});

describe('connector targeting and budgets', () => {
  it('keeps the original targeting when nothing extra is given', () => {
    expect(buildTargeting({ countries: ['IN'], platforms: ['facebook'] })).toEqual({ geo_locations: { countries: ['IN'] }, publisher_platforms: ['facebook'], facebook_positions: ['feed'], instagram_positions: undefined, age_min: 18, age_max: 65, targeting_automation: { advantage_audience: 0 } });
  });
  it('replaces the country with regions and adds gender', () => {
    const t = buildTargeting({ countries: ['IN'], platforms: ['facebook'], regions: [{ key: '1738', name: 'Karnataka' }], genders: [2], age_min: 25 });
    expect(t.geo_locations).toEqual({ regions: [{ key: '1738' }] });
    expect(t).toMatchObject({ genders: [2], age_min: 25 });
  });
  it('sends minor units', () => { expect(budgetFields('lifetime', 5000)).toEqual({ lifetime_budget: 500000 }); expect(budgetFields('daily', 99.5)).toEqual({ daily_budget: 9950 }); });
  it('limits budget changes', () => {
    const limits = { step: 0.2, maxDaily: 5000, maxTotal: 25000, cooldownHours: 72 };
    expect(budgetChangeProblem(500, 600, 'daily', limits, undefined, now)).toBeNull();
    expect(budgetChangeProblem(500, 700, 'daily', limits, undefined, now)).toMatch(/at most 20%/);
    expect(budgetChangeProblem(4900, 5100, 'daily', limits, undefined, now)).toMatch(/limit/);
    expect(budgetChangeProblem(500, 600, 'daily', limits, new Date(now - 3600000).toISOString(), now)).toMatch(/recently/);
  });
});

describe('recommendations', () => {
  const day = (i: number, o: Partial<DayStat> = {}): DayStat => ({ date: `2026-11-2${i}`, spend: 500, impressions: 1000, clicks: 20, frequency: 1.2, results: 10, ...o });
  const facts = { status: 'ACTIVE', objective: 'traffic' as const, budget: 500, budgetType: 'daily' as const, targetCostPerResult: 100 };
  it('waits for data', () => expect(recommend({ ...facts, days: [day(0, { impressions: 10, spend: 5 })] }, now)[0].kind).toBe('no_action'));
  it('does nothing for paused campaigns', () => expect(recommend({ ...facts, status: 'PAUSED', days: [day(0)] }, now)[0].kind).toBe('no_action'));
  it('pauses spend with no results', () => expect(recommend({ ...facts, days: [day(0, { results: 0 })] }, now)[0]).toMatchObject({ kind: 'pause' }));
  it('raises a cheap, fully used budget by 20%', () => expect(recommend({ ...facts, days: [day(0), day(1), day(2)] }, now)[0]).toMatchObject({ kind: 'increase_budget', proposal: { budget: 600 } }));
  it('spots creative fatigue', () => {
    const days = [day(0), day(1), day(2), day(3, { clicks: 5, frequency: 2, results: 1 }), day(4, { clicks: 5, frequency: 2, results: 1 }), day(5, { clicks: 5, frequency: 2, results: 1 })];
    expect(recommend({ ...facts, days }, now).map((r) => r.kind)).toContain('new_creative');
  });
  it('does not double count leads', () => {
    expect(toDayStats([{ date_start: 'd', spend: '10', actions: [{ action_type: 'lead', value: '3' }, { action_type: 'onsite_conversion.lead_grouped', value: '3' }] }], 'leads')[0].results).toBe(3);
  });
});
