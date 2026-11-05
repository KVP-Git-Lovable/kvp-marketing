/**
 * Admin-authored Overview content for one activity.
 *
 * Every game renders the same sections from this shape; nothing about
 * Productive Visits or New Retailers is written into the frontend. A section
 * the admin left empty is simply absent, and the page skips it rather than
 * drawing a blank card.
 *
 * Stored as a single jsonb column on gamification_actions, so the array order
 * IS the display order and reordering is a rewrite of one value.
 *
 * An item is stored EITHER as the plain string it has always been, OR as
 * { icon, image, title, text }. Both parse to the same object, so rows written before
 * the visual Overview — and anything the AI writer emits — keep working with no
 * migration. jsonb already accepts the richer form.
 */
export interface OverviewItem {
  /** Name from OVERVIEW_ICONS. Optional: derived from the text when absent. */
  icon?: string;
  /** Public URL of an uploaded picture. Wins over `icon` when both are set. */
  image?: string;
  /** Short heading — becomes the large label in the visual. Derived when absent. */
  title?: string;
  /** The admin's sentence. Never derived, never rewritten. */
  text: string;
}

export interface OverviewContent {
  /** About this game. */
  about?: string;
  /** Why it matters — one line of motivation. Hidden when unset. */
  why?: string;
  /** How can you achieve this? — ordered, rendered as a step journey. */
  steps?: OverviewItem[];
  /** What counts? — rendered as tick cards. */
  counts?: OverviewItem[];
  /** What doesn't count? — rendered as cross cards. */
  excludes?: OverviewItem[];
  /** Good to know — rendered as information tiles. */
  notes?: OverviewItem[];
}

export type OverviewListKey = "steps" | "counts" | "excludes" | "notes";

export const OVERVIEW_LISTS: {
  key: OverviewListKey;
  label: string;
  addLabel: string;
  placeholder: string;
  titlePlaceholder: string;
  /** How the user-facing page marks each item. */
  marker: "number" | "tick" | "cross" | "bullet";
  /** Used when neither the admin nor the text suggests an icon. */
  fallbackIcon: string;
}[] = [
  {
    key: "steps",
    label: "How can you achieve this?",
    addLabel: "Add step",
    placeholder: "Plan your journey and visit retailers on your assigned beat",
    titlePlaceholder: "Plan your beat",
    marker: "number",
    fallbackIcon: "ArrowRight",
  },
  {
    key: "counts",
    label: "What counts?",
    addLabel: "Add rule",
    placeholder: "Check-in and check-out completed",
    titlePlaceholder: "Checked in and out",
    marker: "tick",
    fallbackIcon: "CheckCircle2",
  },
  {
    key: "excludes",
    label: "What doesn't count?",
    addLabel: "Add exclusion",
    placeholder: "Duplicate or very short visits",
    titlePlaceholder: "Duplicate visit",
    marker: "cross",
    fallbackIcon: "XCircle",
  },
  {
    key: "notes",
    label: "Good to know",
    addLabel: "Add information",
    placeholder: "Points are credited at the end of the day",
    titlePlaceholder: "End of day",
    marker: "bullet",
    fallbackIcon: "Info",
  },
];

/* ------------------------------------------------------------------ *
 * Derivation
 *
 * Only 2 of 16 activities have any Overview configured. If the visual needed
 * an admin-written icon and short title on every line, the rest would render
 * blank — so both are derived from the sentence when absent. A derived title is
 * a worse title; the fields exist so the games that matter get a real one.
 * ------------------------------------------------------------------ */

/** First keyword wins, so order matters: specific before generic. */
const ICON_HINTS: [RegExp, string][] = [
  [/\btarget|goal|quota\b/i, "Target"],
  [/\bnew retailer|create.*retailer|retailer.*creat/i, "UserPlus"],
  [/\bretailer|store|shop|outlet\b/i, "Store"],
  [/\border|cart|purchase|sale\b/i, "ShoppingCart"],
  [/\bvisit|beat|journey|route\b/i, "MapPin"],
  [/\bphoto|image|capture\b/i, "Camera"],
  [/\bnote|detail|form|field\b/i, "ClipboardList"],
  [/\bpoint|earn|reward|credit\b/i, "Star"],
  [/\brank|leaderboard|score\b/i, "BarChart3"],
  [/\bday|daily|date|period|end of\b/i, "Calendar"],
  [/\bonce|duplicate|repeat\b/i, "Repeat"],
  [/\bcancel|invalid|test|dummy\b/i, "Ban"],
  [/\buser|team|everyone|all field\b/i, "Users"],
  [/\bproduct|item|sku\b/i, "Package"],
];

export function deriveIcon(text: string, key?: OverviewListKey): string {
  for (const [re, name] of ICON_HINTS) if (re.test(text)) return name;
  return OVERVIEW_LISTS.find((l) => l.key === key)?.fallbackIcon ?? "Info";
}

const TIDY = (t: string) => t.replace(/[.,;:]+$/, "").trim();
const CAP = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** A heading is only worth showing if it is a whole thought. */
const HEADING_MAX = 40;

/**
 * A short heading for a sentence, or null when the sentence will not give one.
 *
 * Chopping at a word count produced headings like "Take the order in the" with
 * the full sentence repeated underneath — worse than no heading at all. So this
 * only returns a clause the writer actually ended, or a sentence short enough
 * to BE the heading; otherwise the caller shows the sentence and nothing else.
 */
export function deriveTitle(text: string): string | null {
  const firstClause = TIDY(text.split(/[.,;:—–]|\s\(/)[0]);
  if (firstClause && firstClause.length < TIDY(text).length && firstClause.length <= HEADING_MAX) {
    return CAP(firstClause);
  }
  const whole = TIDY(text);
  return whole.length <= HEADING_MAX ? CAP(whole) : null;
}

/**
 * Everything the visual needs, with the gaps filled in.
 *
 * `headline` is always present; `sub` is the rest of the sentence when there is
 * a heading worth separating from it, and null when printing both would say the
 * same thing twice.
 */
export function resolveItem(item: OverviewItem, key?: OverviewListKey) {
  const title = item.title?.trim() || deriveTitle(item.text);
  const icon = item.icon?.trim() || deriveIcon(item.text, key);
  const image = item.image?.trim() || undefined;
  return {
    ...item,
    icon,
    image,
    headline: title ?? item.text,
    sub: title && title !== item.text ? item.text : null,
  };
}

/* ------------------------------------------------------------------ *
 * Journey layout
 *
 * The steps can be drawn left to right as numbered tiles, but only when
 * they read as labels. A sentence in a 148px column wraps to five lines and
 * the row becomes a wall of text, so anything outside this window keeps the
 * vertical list instead.
 *
 * 36 characters is about two lines in a tile — "Place Order under the retailer
 * Card" fits, "Check-in and check-out both completed at the shop" does not.
 * ------------------------------------------------------------------ */
export const FLOW_MAX_STEPS = 4;
export const FLOW_MAX_HEADLINE = 36;
export const FLOW_MAX_SUB = 80;

/**
 * Why these steps will NOT draw as a journey, phrased for the admin who wrote
 * them, or null when they will. The rep's page and the editor's hint both read
 * this, so the hint can never disagree with what actually renders.
 */
export function flowBlocker(items: OverviewItem[]): string | null {
  if (items.length < 2) return "Add a second step to show these as a journey.";
  if (items.length > FLOW_MAX_STEPS) {
    return `${items.length} steps is too many for a journey — ${FLOW_MAX_STEPS} is the most that fits.`;
  }
  for (const raw of items) {
    const { headline, sub } = resolveItem(raw, "steps");
    if (headline.length > FLOW_MAX_HEADLINE) {
      return `"${headline}" is ${headline.length} characters. Shorten it to ${FLOW_MAX_HEADLINE} or fewer to show these as a journey.`;
    }
    if ((sub?.length ?? 0) > FLOW_MAX_SUB) {
      return `The description under "${headline}" is too long for a journey tile — keep it to ${FLOW_MAX_SUB} characters.`;
    }
  }
  return null;
}

export const canFlow = (items: OverviewItem[]): boolean => flowBlocker(items) === null;

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

const toItem = (v: unknown): OverviewItem | null => {
  if (typeof v === "string") {
    const text = v.trim();
    return text ? { text } : null;
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const text = String(o.text ?? "").trim();
    if (!text) return null;
    const out: OverviewItem = { text };
    const icon = String(o.icon ?? "").trim();
    const image = String(o.image ?? "").trim();
    const title = String(o.title ?? "").trim();
    if (icon) out.icon = icon;
    // Only http(s). A data: or javascript: URL from a hand-edited row would
    // otherwise go straight into an <img src>.
    if (/^https?:\/\//i.test(image)) out.image = image;
    if (title) out.title = title;
    return out;
  }
  return null;
};

const cleanList = (v: unknown): OverviewItem[] =>
  Array.isArray(v) ? (v.map(toItem).filter(Boolean) as OverviewItem[]) : [];

/** Tolerant read — the column is constrained, but old rows predate it. */
export function parseOverview(raw: unknown): OverviewContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: OverviewContent = {};
  const about = typeof o.about === "string" ? o.about.trim() : "";
  const why = typeof o.why === "string" ? o.why.trim() : "";
  if (about) out.about = about;
  if (why) out.why = why;
  for (const { key } of OVERVIEW_LISTS) {
    const list = cleanList(o[key]);
    if (list.length) out[key] = list;
  }
  return out;
}

/** Drops blank entries and empty sections so "unconfigured" stays unambiguous. */
export function serialiseOverview(c: OverviewContent): OverviewContent {
  return parseOverview(c);
}

/** Whether there is anything at all to show — the tab falls back if not. */
export function hasOverview(c: OverviewContent): boolean {
  return (
    Boolean(c.about) ||
    Boolean(c.why) ||
    OVERVIEW_LISTS.some(({ key }) => (c[key]?.length ?? 0) > 0)
  );
}

/** Immutable list helpers, so the editor stays declarative. */
export const listOps = {
  add: (l: OverviewItem[] = []) => [...l, { text: "" }],
  set: (l: OverviewItem[] = [], i: number, patch: Partial<OverviewItem>) =>
    l.map((x, n) => (n === i ? { ...x, ...patch } : x)),
  remove: (l: OverviewItem[] = [], i: number) => l.filter((_, n) => n !== i),
  move: (l: OverviewItem[] = [], i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= l.length) return l;
    const next = [...l];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  },
};
