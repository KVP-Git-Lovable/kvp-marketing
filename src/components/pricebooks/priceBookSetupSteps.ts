/**
 * The Price Book & Units setup checklist — one definition used by everything
 * that reads or writes it.
 *
 * Built on the same pattern as the distributor onboarding checklist
 * (`components/distributor/onboardingSteps.ts`): stages, a short plain label,
 * and a `help` line saying what "done" actually means so two people tick it
 * the same way.
 *
 * The difference is that most steps here are not ticked by anyone. A step with
 * a `measure` is answered by `price_book_setup_status()` against the live data
 * — how many products have an MRP, how many distributors have a type — so the
 * checklist reports what IS rather than what somebody remembered to mark. Only
 * the steps nothing can measure (a decision taken, a routine agreed, the team
 * told) carry a stored status, in `price_book_setup_tasks`.
 *
 * `key` is written to price_book_setup_tasks.task_key and must not change.
 */

export type SetupStage = "units" | "prices" | "books" | "golive";

export interface SetupStep {
  key: string;
  /** Short, plain, and about the thing being configured — not the screen. */
  label: string;
  /** What "done" means, so two people read it the same way. */
  help: string;
  stage: SetupStage;
  /**
   * A key returned by `price_book_setup_status()`. When present the step
   * answers itself and cannot be ticked by hand.
   */
  measure?: string;
  /**
   * A measure shown as context on a step that is still a judgement call —
   * the number informs the decision but does not settle it.
   */
  contextMeasure?: string;
  /** How to read the measure's numbers on screen. */
  unit?: string;
  /** Where to go and do it. */
  where?: string;
}

export const SETUP_STAGES: { key: SetupStage; title: string; blurb: string }[] = [
  { key: "units", title: "Units and measures", blurb: "What a price is per" },
  { key: "prices", title: "Product prices", blurb: "Before any book exists" },
  { key: "books", title: "Books and targeting", blurb: "Who pays what" },
  { key: "golive", title: "Go live", blurb: "Before it reaches the field" },
];

export const SETUP_STEPS: SetupStep[] = [
  // ------------------------------------------------------------ units
  {
    key: "units_trimmed",
    label: "Only the units you sell in are switched on",
    help: "Every unit left on appears in every unit picker in the app. A rep choosing AMPOULE on a beverage order is a data error you then have to clean up.",
    stage: "units",
    contextMeasure: "units_enabled",
    unit: "units",
    where: "Admin › Unit Master",
  },
  {
    key: "unit_bases",
    label: "Every unit category has a base unit",
    help: "Conversions inside a category are calculated against its base. With no base, nothing in that category can convert at all.",
    stage: "units",
    measure: "unit_categories_have_base",
    unit: "categories",
    where: "Admin › Unit Master",
  },
  {
    key: "unit_in_master",
    label: "Every product's unit is one the master holds",
    help: "Units are matched by exact text, so 'kg' is not 'KG'. A product whose unit is not in the master has no unit the system recognises.",
    stage: "units",
    measure: "product_unit_in_master",
    unit: "products",
    where: "Product Master",
  },
  {
    key: "unit_category_agrees",
    label: "Every product is filed under the right unit category",
    help: "The category decides what a product can convert to. A product measured in GRAM but filed under Quantity cannot convert to KG.",
    stage: "units",
    measure: "product_unit_category_agrees",
    unit: "products",
    where: "Product Master",
  },
  {
    key: "sales_uom",
    label: "Every product has a default sales unit",
    help: "The unit a rep sells in. Without it an order line has no unit to price against.",
    stage: "units",
    measure: "product_sales_uom",
    unit: "products",
    where: "Product Master",
  },
  {
    key: "purchase_uom",
    label: "Every product has a default purchase unit",
    help: "The pack a distributor buys in. Without it a primary order falls back to the sales unit, which is usually a much smaller pack.",
    stage: "units",
    measure: "product_purchase_uom",
    unit: "products",
    where: "Product Master",
  },
  {
    key: "net_weight",
    label: "Net weight filled where you sell by weight",
    help: "Needed to turn a per-kg price into a pack price. Missing weight means the conversion silently cannot happen.",
    stage: "units",
    measure: "product_net_weight",
    unit: "products",
    where: "Product Master",
  },
  {
    key: "rounding_rule",
    label: "Rounding rule for converted prices agreed",
    help: "A per-kg price on a 250g pack gives fractions of a paisa. Everyone has to round the same way, or invoice and ledger drift apart.",
    stage: "units",
    where: "A decision, then write it down",
  },

  // ----------------------------------------------------------- prices
  {
    key: "price_basis",
    label: "Every product says what its rate is per",
    help: "Whether the rate means per piece or per kg. Wrong here and every converted price is wrong by the pack size.",
    stage: "prices",
    measure: "product_price_basis_uom",
    unit: "products",
    where: "Product Master",
  },
  {
    key: "rate_filled",
    label: "Every product has a rate",
    help: "The base selling price a price book starts from.",
    stage: "prices",
    measure: "product_rate",
    unit: "products",
    where: "Product Master",
  },
  {
    key: "mrp_filled",
    label: "Every product has an MRP",
    help: "The printed ceiling. Without it nothing can warn a rep that a price book rate is above the price on the pack.",
    stage: "prices",
    measure: "product_mrp",
    unit: "products",
    where: "Product Master › MRP",
  },
  {
    key: "mrp_policy",
    label: "Decided whether MRP warns or blocks",
    help: "A ceiling that only warns is a different system from one that refuses. Both are reasonable; the team needs to know which it is.",
    stage: "prices",
    where: "A decision, then it can be built",
  },
  {
    key: "tax_mapped",
    label: "Products mapped to a tax slab",
    help: "GST is a flat 5% written into the code until these are mapped. Any product on a different slab is invoiced wrongly.",
    stage: "prices",
    measure: "variants_mapped_to_tax",
    unit: "variants",
    where: "Admin › Tax Master",
  },

  // ------------------------------------------------------------ books
  {
    key: "structure_decided",
    label: "Book structure decided and written down",
    help: "Books are cheap to create and expensive to reconcile. One sentence: the backbone is one standard book per X, with overrides for Y.",
    stage: "books",
    where: "A decision, then write it down",
  },
  {
    key: "primary_book",
    label: "A live primary price book exists",
    help: "What distributors pay you. This is the book every distributor falls back to.",
    stage: "books",
    measure: "primary_standard_book_exists",
    where: "Price Books › Distributor tab",
  },
  {
    key: "primary_coverage",
    label: "Every active product priced in the primary book",
    help: "A product absent from a book is not blocked — it quietly keeps its own default price, so a half-filled book looks like it is working.",
    stage: "books",
    measure: "primary_book_coverage",
    unit: "products",
    where: "Price Book › Edit & Manage Prices",
  },
  {
    key: "secondary_book",
    label: "A live secondary price book exists",
    help: "What shops pay distributors. Without one, every shop prices from the product default.",
    stage: "books",
    measure: "secondary_standard_book_exists",
    where: "Price Books › Retailer tab",
  },
  {
    key: "secondary_coverage",
    label: "Every active product priced in the secondary book",
    help: "Same trap as the primary book: missing products are invisible rather than loud.",
    stage: "books",
    measure: "secondary_book_coverage",
    unit: "products",
    where: "Price Book › Edit & Manage Prices",
  },
  {
    key: "no_ties",
    label: "No two fallback books compete",
    help: "Two books at the same scope rank the same, so which one applies is decided by date rather than by intent.",
    stage: "books",
    measure: "no_competing_standard_books",
    where: "Price Books",
  },
  {
    key: "categories_real",
    label: "Every book's category is one a distributor is in",
    help: "A book aimed at a category nobody is in looks narrow and silently prices everyone.",
    stage: "books",
    measure: "book_categories_are_real",
    unit: "books",
    where: "Price Book › Edit",
  },
  {
    key: "not_expired",
    label: "No live book has expired",
    help: "A book past its end date stops applying, and says nothing when it does.",
    stage: "books",
    measure: "books_not_expired",
    unit: "books",
    where: "Price Book › Edit",
  },
  {
    key: "dist_types",
    label: "Every distributor has a type",
    help: "Category pricing matches on the distributor's type. One with no type can never be reached by a category book.",
    stage: "books",
    measure: "distributors_have_type",
    unit: "distributors",
    where: "Distributor Master",
  },
  {
    key: "dist_books",
    label: "Every distributor has a price book assigned",
    help: "An unassigned distributor falls back to the standard book. Fine if intended, a surprise if not.",
    stage: "books",
    measure: "distributors_have_book",
    unit: "distributors",
    where: "Distributor Master › Price Book",
  },
  {
    key: "retailer_dist",
    label: "Every shop is attached to a distributor",
    help: "Secondary pricing walks from the shop to its distributor. A shop with no distributor cannot be reached that way at all.",
    stage: "books",
    measure: "retailers_have_distributor",
    unit: "shops",
    where: "Retailer Master",
  },
  {
    key: "visibility_decided",
    label: "Decided whether books also control what is visible",
    help: "Using one book for both is simpler to run and harder to unpick: removing a product to hide it also removes its price.",
    stage: "books",
    where: "A decision, then configure",
  },

  // ----------------------------------------------------------- go live
  {
    key: "simulator_checked",
    label: "Checked with the Price Simulator",
    help: "Five shops by three products. Confirm the book it names is the one you expected.",
    stage: "golive",
    where: "Price Books › Price Simulator",
  },
  {
    key: "before_after",
    label: "Compared order values before and after",
    help: "Filling a standard book changes live prices the moment it is saved. Know the size of the change before it reaches the field.",
    stage: "golive",
    where: "Export a week of orders and re-price them",
  },
  {
    key: "who_can_edit",
    label: "Decided who may create and edit price books",
    help: "Pricing is the most sensitive master in the system. Name the two or three people who should hold it.",
    stage: "golive",
    where: "Admin › Permissions",
  },
  {
    key: "change_routine",
    label: "Price change routine agreed",
    help: "Who approves a rate change, when it takes effect, and how the field is told. Agree it before the books are full, not after.",
    stage: "golive",
    where: "A decision, then write it down",
  },
  {
    key: "team_trained",
    label: "Field team told what changed",
    help: "Reps will see different prices. If nobody tells them, they report it as a bug.",
    stage: "golive",
    where: "One page and a briefing",
  },
  {
    key: "prod_port",
    label: "Ported to production",
    help: "Production has none of this. It goes across as a planned batch with a backup first, not piecemeal.",
    stage: "golive",
    where: "Month-end deployment",
  },
];

export const SETUP_STEP_BY_KEY: Record<string, SetupStep> = Object.fromEntries(
  SETUP_STEPS.map((s) => [s.key, s]),
);

/** Only steps without a `measure` can be set by hand. */
export const MANUAL_STEP_KEYS = SETUP_STEPS.filter((s) => !s.measure).map((s) => s.key);

/**
 * Statuses a hand-set step can be in — the same five the distributor
 * checklist uses, so the two read alike. `not_applicable` counts as settled:
 * a business that never ports to production should not sit at 97% forever.
 */
export const SETUP_STATUSES = [
  { value: "pending", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Done" },
  { value: "blocked", label: "Stuck" },
  { value: "not_applicable", label: "Not needed" },
] as const;

export type SetupStatus = (typeof SETUP_STATUSES)[number]["value"];

export const isSettled = (status: string) =>
  status === "completed" || status === "not_applicable";

export interface Measure {
  measure_key: string;
  done: number;
  total: number;
  detail: string | null;
}

/** What a measured step reports, reduced to the same five statuses. */
export function statusFromMeasure(m?: Measure): SetupStatus {
  if (!m || m.total === 0) return "pending";
  if (m.done >= m.total) return "completed";
  return m.done > 0 ? "in_progress" : "pending";
}

/** Plural forms used by the steps above, so "1 products left" cannot happen. */
const SINGULAR: Record<string, string> = {
  products: "product",
  variants: "variant",
  categories: "category",
  books: "book",
  distributors: "distributor",
  shops: "shop",
  units: "unit",
};

const noun = (unit: string | undefined, n: number) =>
  !unit ? "" : n === 1 ? (SINGULAR[unit] ?? unit) : unit;

/**
 * The count in words: "144 products left", "0 of 146 products", "all 9".
 *
 * What is LEFT is the useful number on a nearly-finished step, and what is
 * DONE is the useful number on a barely-started one — so each step shows
 * whichever of the two is the smaller, more actionable figure.
 */
export function measureSummary(m: Measure | undefined, unit?: string): string {
  if (!m || m.total === 0) return "nothing to check";
  const left = m.total - m.done;
  if (left <= 0) {
    // A yes/no measure has nothing to count.
    return m.total === 1 ? "yes" : `all ${m.total} ${noun(unit, m.total)}`.trim();
  }
  if (m.total === 1) return "not yet";
  if (m.done === 0) return `0 of ${m.total} ${noun(unit, m.total)}`.trim();
  return `${left} ${noun(unit, left)} left`.replace(/\s+/g, " ").trim();
}

/**
 * A context measure is not a score, so it never reads as success.
 *
 * "Only the units you sell in are switched on" sits next to 41 of 41 — the
 * figure that makes the step worth doing. Phrasing that as "all 41 units"
 * would congratulate the user on the problem.
 */
export function contextSummary(m: Measure | undefined, unit?: string): string {
  if (!m || m.total === 0) return "";
  return `${m.done} of ${m.total} ${noun(unit, m.total)} on`.trim();
}
