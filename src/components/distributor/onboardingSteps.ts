/**
 * The distributor onboarding checklist — one definition used by everything
 * that reads or writes it.
 *
 * `key` is written to distributor_evaluation_tasks.task_key and must never
 * change: 126 rows across 9 distributors are already keyed on these. The label
 * and help text are free to be rewritten, and were — the originals read like
 * an audit form ("Infrastructure Assessment Done") rather than something a
 * sales head could act on.
 */

export type OnboardingStage = "paperwork" | "visit" | "golive";

export interface OnboardingStep {
  key: string;
  /** Short, plain, and about the thing that happened — not the form. */
  label: string;
  /** What "done" actually means, so two people tick it the same way. */
  help: string;
  stage: OnboardingStage;
}

export const ONBOARDING_STAGES: { key: OnboardingStage; title: string; blurb: string }[] = [
  {
    key: "paperwork",
    title: "Paperwork",
    blurb: "Who they are, on paper",
  },
  {
    key: "visit",
    title: "Visit and capability",
    blurb: "Can they actually do the job",
  },
  {
    key: "golive",
    title: "Go live",
    blurb: "Everything needed before the first order",
  },
];

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // Paperwork
  {
    key: "business_registration",
    label: "Business registered",
    help: "Registration papers seen, and the name on them matches the name on file.",
    stage: "paperwork",
  },
  {
    key: "gst_certificate",
    label: "GST certificate collected",
    help: "A copy of the GST certificate is saved against this distributor.",
    stage: "paperwork",
  },
  {
    key: "bank_details",
    label: "Bank account confirmed",
    help: "Account number and IFSC checked against a cancelled cheque or passbook.",
    stage: "paperwork",
  },
  {
    key: "address_verified",
    label: "Address confirmed",
    help: "Someone has been to the address on file, or has seen proof of it.",
    stage: "paperwork",
  },

  // Visit and capability
  {
    key: "warehouse_visit",
    label: "Godown visited",
    help: "The storage godown has been seen and has room for our stock.",
    stage: "visit",
  },
  {
    key: "infrastructure_check",
    label: "Storage and handling checked",
    help: "Racking, loading area and stock handling are fit for our products.",
    stage: "visit",
  },
  {
    key: "fleet_verification",
    label: "Vehicles checked",
    help: "The delivery vehicles they claim exist, and run.",
    stage: "visit",
  },
  {
    key: "team_verification",
    label: "Sales team met",
    help: "The salesmen who will carry our products have been met in person.",
    stage: "visit",
  },
  {
    key: "reference_check",
    label: "References spoken to",
    help: "At least one other company or retailer has vouched for them.",
    stage: "visit",
  },
  {
    key: "credit_check",
    label: "Money position checked",
    help: "Turnover, outstanding dues and ability to pay have been looked at.",
    stage: "visit",
  },

  // Go live
  {
    key: "contract_signed",
    label: "Agreement signed",
    help: "The distribution agreement is signed by both sides.",
    stage: "golive",
  },
  {
    key: "training_completed",
    label: "Product training done",
    help: "Their team has been taken through our range, prices and schemes.",
    stage: "golive",
  },
  {
    key: "system_access",
    label: "App access given",
    help: "A portal login exists and the distributor can sign in.",
    stage: "golive",
  },
  {
    key: "first_order",
    label: "First order placed",
    help: "The first primary order has been raised.",
    stage: "golive",
  },
];

export const STEP_BY_KEY: Record<string, OnboardingStep> = Object.fromEntries(
  ONBOARDING_STEPS.map((s) => [s.key, s]),
);

/**
 * Statuses a step can be in. `not_applicable` counts as settled, not as
 * outstanding — a distributor with no vans should not be held back forever by
 * "Vehicles checked".
 */
export const STEP_STATUSES = [
  { value: "pending", label: "Not started", tone: "muted" },
  { value: "in_progress", label: "In progress", tone: "info" },
  { value: "completed", label: "Done", tone: "good" },
  { value: "blocked", label: "Stuck", tone: "bad" },
  { value: "not_applicable", label: "Not needed", tone: "muted" },
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number]["value"];

export const isSettled = (status: string) =>
  status === "completed" || status === "not_applicable";

/** Onboarding is "done" when nothing is left outstanding. */
export const onboardingComplete = (statuses: string[]) =>
  statuses.length > 0 && statuses.every(isSettled);
