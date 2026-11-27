// Spending limits for the Agentic Meta Campaign feature (rupees). Enforced server-side.
export const AGENT_MAX_TOTAL_BUDGET = 25000; // lifetime budget per campaign
export const AGENT_MAX_DAILY_BUDGET = 5000;
export const AGENT_MAX_BUDGET_STEP = 0.2; // an approved change may move a budget by at most 20%
export const AGENT_BUDGET_COOLDOWN_HOURS = 72;
