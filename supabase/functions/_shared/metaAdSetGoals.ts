// Pure rules for which ad-set optimization goals fit which campaign objective, and
// what "object to promote" (promoted_object) Meta needs for each. Shared by the
// meta-api edge function and the Ad Set form, so both always agree. No Deno/Node deps.
//
// Why: Meta rejects ads (subcode 1885154) under an ad set that was created without the
// promoted object its objective needs (e.g. a Leads campaign with no pixel/Page), and an
// ad set's promoted object can't be added afterwards — so it must be right at creation.

export const GOALS_BY_OBJECTIVE: Record<string, string[]> = {
  OUTCOME_AWARENESS: ['REACH', 'IMPRESSIONS'],
  OUTCOME_TRAFFIC: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'REACH', 'IMPRESSIONS'],
  OUTCOME_ENGAGEMENT: ['POST_ENGAGEMENT', 'THRUPLAY', 'LINK_CLICKS', 'IMPRESSIONS', 'REACH'],
  OUTCOME_LEADS: ['LEAD_GENERATION', 'OFFSITE_CONVERSIONS', 'LANDING_PAGE_VIEWS', 'LINK_CLICKS', 'IMPRESSIONS', 'REACH'],
  OUTCOME_SALES: ['OFFSITE_CONVERSIONS', 'VALUE', 'LANDING_PAGE_VIEWS', 'LINK_CLICKS', 'IMPRESSIONS', 'REACH'],
  OUTCOME_APP_PROMOTION: ['APP_INSTALLS'],
};

/** Objectives whose website ad sets must name a Meta pixel + conversion event. */
export const PIXEL_OBJECTIVES = new Set(['OUTCOME_LEADS', 'OUTCOME_SALES']);
const PIXEL_GOALS = new Set(['OFFSITE_CONVERSIONS', 'VALUE', 'CONVERSIONS']);
/** Instant-form lead ads: the ad set promotes a Facebook Page and each ad carries a lead form. */
const INSTANT_FORM_GOALS = new Set(['LEAD_GENERATION', 'QUALITY_LEAD']);

export function isInstantFormGoal(goal: string | null | undefined): boolean {
  return INSTANT_FORM_GOALS.has(goal || '');
}

export const CONVERSION_EVENTS_BY_OBJECTIVE: Record<string, string[]> = {
  OUTCOME_LEADS: ['LEAD', 'COMPLETE_REGISTRATION', 'CONTACT'],
  OUTCOME_SALES: ['PURCHASE', 'INITIATED_CHECKOUT', 'ADD_TO_CART'],
};

export const ALL_GOALS = [
  'REACH', 'IMPRESSIONS', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'OFFSITE_CONVERSIONS', 'VALUE',
  'POST_ENGAGEMENT', 'THRUPLAY', 'VIDEO_VIEWS', 'APP_INSTALLS',
];

/** Goals offered for a campaign objective. Unknown/legacy objectives get the full list. */
export function goalsForObjective(objective: string | null | undefined): string[] {
  return (objective && GOALS_BY_OBJECTIVE[objective]) || ALL_GOALS;
}

export function needsPixel(objective: string | null | undefined, goal: string | null | undefined): boolean {
  if (isInstantFormGoal(goal)) return false;
  return PIXEL_OBJECTIVES.has(objective || '') || PIXEL_GOALS.has(goal || '');
}

export type AdSetPromotion =
  | { ok: true; promoted_object?: Record<string, string>; destination_type?: string }
  | { ok: false; error: string };

/** Decide what Meta needs on a new ad set, or a plain-language reason it can't be created. */
export function resolveAdSetPromotion(input: {
  objective: string | null | undefined;
  goal: string | null | undefined;
  pixelId?: string | null;
  conversionEvent?: string | null;
  pageId?: string | null;
}): AdSetPromotion {
  const { objective, goal } = input;
  if (isInstantFormGoal(goal)) {
    if (objective && objective !== 'OUTCOME_LEADS') {
      return { ok: false, error: 'Lead forms (instant forms) can only be used in a Leads campaign.' };
    }
    if (!input.pageId) {
      return { ok: false, error: 'Lead-form ad sets need a Facebook Page — the lead form lives on that Page. Pick a Page and try again.' };
    }
    return { ok: true, promoted_object: { page_id: String(input.pageId) }, destination_type: 'ON_AD' };
  }
  const allowed = objective ? GOALS_BY_OBJECTIVE[objective] : undefined;
  if (allowed && goal && !allowed.includes(goal)) {
    return { ok: false, error: `"${goal.replace(/_/g, ' ')}" can't be used in a ${objective!.replace('OUTCOME_', '')} campaign. Pick one of: ${allowed.map((g) => g.replace(/_/g, ' ')).join(', ')}.` };
  }
  if (needsPixel(objective, goal)) {
    if (!input.pixelId) {
      return { ok: false, error: 'Leads and Sales ad sets need a Meta pixel so Meta knows what result to count. Pick your pixel (and the event it records) and try again.' };
    }
    const events = CONVERSION_EVENTS_BY_OBJECTIVE[objective || ''] || ['LEAD'];
    const event = input.conversionEvent && events.includes(input.conversionEvent) ? input.conversionEvent : events[0];
    return { ok: true, promoted_object: { pixel_id: String(input.pixelId), custom_event_type: event }, destination_type: 'WEBSITE' };
  }
  return { ok: true };
}
