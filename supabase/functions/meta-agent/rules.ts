// Recommendation rules. Code decides what is proposed; the model only explains it.
import { AGENT_BUDGET_COOLDOWN_HOURS, AGENT_MAX_BUDGET_STEP, AGENT_MAX_DAILY_BUDGET } from '../_shared/meta-agent-limits.ts';

export interface DayStat { date: string; spend: number; impressions: number; clicks: number; frequency: number; results: number }

export interface CampaignFacts {
  status: string;
  objective: 'traffic' | 'leads';
  budget: number;
  budgetType: 'daily' | 'lifetime';
  days: DayStat[];
  targetCostPerResult?: number;
  lastBudgetChangeAt?: string;
}

export interface Recommendation {
  kind: 'no_action' | 'pause' | 'increase_budget' | 'new_creative';
  reason: string;
  evidence: Record<string, number>;
  proposal?: { budget?: number; status?: 'PAUSED' };
}

/** Rows from Meta insights (one per day) into the numbers the rules use. */
export function toDayStats(rows: Array<Record<string, any>>, objective: 'traffic' | 'leads'): DayStat[] {
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return rows.map((r) => {
    const actions: Array<{ action_type: string; value: string }> = r.actions || [];
    const action = (type: string) => num(actions.find((a) => a.action_type === type)?.value);
    // "lead" is Meta's total; the on-site type is used only when the total is absent (they overlap).
    const results = objective === 'leads' ? action('lead') || action('onsite_conversion.lead_grouped') : num(r.inline_link_clicks);
    return { date: String(r.date_start || ''), spend: num(r.spend), impressions: num(r.impressions), clicks: num(r.clicks), frequency: num(r.frequency), results };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

const sum = (days: DayStat[], key: 'spend' | 'impressions' | 'clicks' | 'results') => days.reduce((t, d) => t + d[key], 0);
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const round = (n: number) => Math.round(n * 100) / 100;

export function recommend(f: CampaignFacts, now = Date.now()): Recommendation[] {
  const spend = sum(f.days, 'spend'), results = sum(f.days, 'results'), impressions = sum(f.days, 'impressions');
  const evidence = { days: f.days.length, spend: round(spend), results, impressions, cost_per_result: results ? round(spend / results) : 0 };
  const none = (reason: string): Recommendation[] => [{ kind: 'no_action', reason, evidence }];
  if (f.status !== 'ACTIVE') return none('The campaign is not active, so there is nothing to optimise.');
  const target = f.targetCostPerResult && f.targetCostPerResult > 0 ? f.targetCostPerResult : undefined;
  if (impressions < 1000 || spend < (target ?? 200)) return none('Not enough data yet to judge this campaign.');

  if (target && results === 0 && spend >= 2 * target) {
    return [{ kind: 'pause', reason: `Spent ₹${round(spend)} with no results, more than twice the target cost of ₹${target}.`, evidence, proposal: { status: 'PAUSED' } }];
  }
  const out: Recommendation[] = [];
  const recent = f.days.slice(-3);
  if (target && f.budgetType === 'daily' && recent.length === 3) {
    const cheap = recent.every((d) => d.results > 0 && d.spend / d.results <= 0.8 * target);
    const used = avg(recent.map((d) => d.spend)) >= 0.9 * f.budget;
    const cooled = !f.lastBudgetChangeAt || now - Date.parse(f.lastBudgetChangeAt) >= AGENT_BUDGET_COOLDOWN_HOURS * 3600000;
    const next = Math.min(AGENT_MAX_DAILY_BUDGET, Math.floor(f.budget * (1 + AGENT_MAX_BUDGET_STEP)));
    if (cheap && used && cooled && next > f.budget) {
      out.push({ kind: 'increase_budget', reason: `Each of the last 3 days beat the target cost and used the budget. Raise it from ₹${f.budget} to ₹${next} a day.`, evidence, proposal: { budget: next } });
    }
  }
  if (f.days.length >= 6) {
    const last = f.days.slice(-3), before = f.days.slice(0, -3);
    const ctr = (d: DayStat[]) => (sum(d, 'impressions') ? sum(d, 'clicks') / sum(d, 'impressions') : 0);
    const freqNow = avg(last.map((d) => d.frequency)), freqBefore = avg(before.map((d) => d.frequency));
    if (freqBefore > 0 && freqNow >= 1.2 * freqBefore && ctr(before) > 0 && ctr(last) <= 0.8 * ctr(before)) {
      out.push({ kind: 'new_creative', reason: 'People are seeing the ad more often while clicking less. Try a new image or new copy.', evidence: { ...evidence, frequency_before: round(freqBefore), frequency_now: round(freqNow) } });
    }
  }
  return out.length ? out : none(target ? 'Performance is within range. No change suggested.' : 'No change suggested. Enter a target cost per result for budget and pause advice.');
}
