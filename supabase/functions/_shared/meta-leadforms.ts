// Ported from Trayi Jewellers' meta-leadforms.ts (validation + payload only).
// Lead ads helpers, written against Meta's "Lead Forms for Ads" guide
// (POST /{page-id}/leadgen_forms, link_data.call_to_action.value.lead_gen_form_id).
// Pure functions so they can be unit-tested; the meta-api function does the Graph calls.

/** Question types documented for POST /{page-id}/leadgen_forms. */
export const LEAD_QUESTION_TYPES = [
  "FULL_NAME", "EMAIL", "PHONE", "FIRST_NAME", "LAST_NAME", "CUSTOM", "DATE_TIME",
  "ID_AR_DNI", "ID_CPF", "ID_CL_RUT", "ID_CO_CC", "ID_EC_CI", "ID_PE_DNI", "STORE_LOOKUP",
] as const;
export type LeadQuestionType = typeof LEAD_QUESTION_TYPES[number];

/** Call-to-action types Meta lists for lead ad creatives. */
export const LEAD_CTA_TYPES: readonly string[] = ["SIGN_UP", "LEARN_MORE", "GET_QUOTE", "APPLY_NOW", "SUBSCRIBE", "DOWNLOAD", "GET_OFFER", "BOOK_NOW", "SEE_MORE", "REQUEST_TIME", "GET_PROMOTIONS", "CONTACT_US"];

export const LEAD_LOCALES = ["EN_US", "EN_GB", "HI_IN"] as const;
export const THANK_YOU_BUTTON_TYPES = ["VIEW_WEBSITE", "CALL_BUSINESS"] as const;
export const CONTEXT_CARD_STYLES = ["LIST_STYLE", "PARAGRAPH_STYLE"] as const;

export interface LeadQuestionInput {
  type: string;
  key?: string;
  label?: string;
  options?: Array<{ value: string; key?: string }>;
}

export interface LeadFormInput {
  name: string;
  questions: LeadQuestionInput[];
  privacy_policy: { url: string; link_text?: string };
  follow_up_action_url?: string;
  thank_you_page?: {
    title: string;
    body?: string;
    button_type: string;
    button_text?: string;
    website_url?: string;
    business_phone_number?: string;
    country_code?: string;
  };
  context_card?: { title?: string; content?: string[]; style?: string; button_text?: string };
  locale?: string;
  question_page_custom_headline?: string;
  is_optimized_for_quality?: boolean;
  block_display_for_non_targeted_viewer?: boolean;
}

const slug = (s: string) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "q";

const isHttpUrl = (u: unknown) => typeof u === "string" && /^https?:\/\/[^\s]+$/i.test(u.trim());
const isHttpsUrl = (u: unknown) => typeof u === "string" && /^https:\/\/[^\s]+$/i.test(u.trim());

/** Validates a form; returns human-readable problems (empty when valid). */
export function validateLeadForm(input: LeadFormInput): string[] {
  const errors: string[] = [];
  if (!String(input?.name || "").trim()) errors.push("Form name is required");
  const qs = Array.isArray(input?.questions) ? input.questions : [];
  if (qs.length === 0) errors.push("Add at least one question");
  const keys = new Set<string>();
  qs.forEach((q, i) => {
    const n = i + 1;
    if (!LEAD_QUESTION_TYPES.includes(q.type as LeadQuestionType)) errors.push(`Question ${n}: unsupported type "${q.type}"`);
    const key = q.key || (q.type === "CUSTOM" ? slug(q.label || "") : q.type.toLowerCase());
    if (keys.has(key)) errors.push(`Question ${n}: duplicate key "${key}"`);
    keys.add(key);
    if (q.type === "CUSTOM") {
      if (!String(q.label || "").trim()) errors.push(`Question ${n}: custom questions need a label`);
      if (q.options !== undefined) {
        const opts = (q.options || []).filter((o) => String(o?.value || "").trim());
        if (opts.length < 2) errors.push(`Question ${n}: multiple-choice questions need at least 2 options`);
      }
    }
  });
  if (!isHttpsUrl(input?.privacy_policy?.url)) errors.push("Privacy policy URL is required and must start with https://");
  if (input?.follow_up_action_url && !isHttpUrl(input.follow_up_action_url)) errors.push("Follow-up URL must be a valid http(s) URL");
  const ty = input?.thank_you_page;
  if (ty) {
    if (!String(ty.title || "").trim()) errors.push("Thank-you page: title is required");
    if (!THANK_YOU_BUTTON_TYPES.includes(ty.button_type as typeof THANK_YOU_BUTTON_TYPES[number])) errors.push("Thank-you page: button type must be VIEW_WEBSITE or CALL_BUSINESS");
    if (ty.button_type === "VIEW_WEBSITE" && !isHttpUrl(ty.website_url)) errors.push("Thank-you page: website URL is required for View website");
    if (ty.button_type === "CALL_BUSINESS" && (!String(ty.business_phone_number || "").trim() || !String(ty.country_code || "").trim())) {
      errors.push("Thank-you page: phone number and country code are required for Call business");
    }
  }
  if (input?.context_card?.style && !CONTEXT_CARD_STYLES.includes(input.context_card.style as typeof CONTEXT_CARD_STYLES[number])) errors.push("Intro card style must be LIST_STYLE or PARAGRAPH_STYLE");
  if (input?.locale && !LEAD_LOCALES.includes(input.locale as typeof LEAD_LOCALES[number])) errors.push(`Locale "${input.locale}" is not offered`);
  return errors;
}

/** Exact request body for POST /{page-id}/leadgen_forms (documented parameter names only). */
export function buildLeadFormPayload(input: LeadFormInput): Record<string, unknown> {
  const questions = (input.questions || []).map((q) => {
    const out: Record<string, unknown> = { type: q.type };
    out.key = q.key || (q.type === "CUSTOM" ? slug(q.label || "") : q.type.toLowerCase());
    if (q.type === "CUSTOM") {
      out.label = String(q.label || "").trim();
      if (q.options !== undefined) {
        out.options = (q.options || [])
          .filter((o) => String(o?.value || "").trim())
          .map((o) => ({ value: String(o.value).trim(), key: o.key || slug(o.value) }));
      }
    } else if (q.label) {
      out.label = String(q.label).trim();
    }
    return out;
  });
  const payload: Record<string, unknown> = {
    name: String(input.name).trim(),
    questions,
    privacy_policy: {
      url: String(input.privacy_policy.url).trim(),
      link_text: String(input.privacy_policy.link_text || "Privacy Policy").trim(),
    },
  };
  if (input.follow_up_action_url) payload.follow_up_action_url = String(input.follow_up_action_url).trim();
  if (input.thank_you_page) {
    const ty = input.thank_you_page;
    const t: Record<string, unknown> = { title: String(ty.title).trim(), button_type: ty.button_type };
    if (ty.body) t.body = String(ty.body).trim();
    if (ty.button_text) t.button_text = String(ty.button_text).trim();
    if (ty.button_type === "VIEW_WEBSITE") t.website_url = String(ty.website_url).trim();
    if (ty.button_type === "CALL_BUSINESS") {
      t.business_phone_number = String(ty.business_phone_number).trim();
      t.country_code = String(ty.country_code).trim().toUpperCase();
    }
    payload.thank_you_page = t;
  }
  if (input.context_card && (input.context_card.title || (input.context_card.content || []).length)) {
    const cc: Record<string, unknown> = {};
    if (input.context_card.title) cc.title = String(input.context_card.title).trim();
    const content = (input.context_card.content || []).map((c) => String(c).trim()).filter(Boolean);
    if (content.length) cc.content = content;
    cc.style = input.context_card.style || "LIST_STYLE";
    if (input.context_card.button_text) cc.button_text = String(input.context_card.button_text).trim();
    payload.context_card = cc;
  }
  payload.locale = input.locale || "EN_US";
  if (input.question_page_custom_headline) payload.question_page_custom_headline = String(input.question_page_custom_headline).trim();
  if (input.is_optimized_for_quality) payload.is_optimized_for_quality = true;
  if (input.block_display_for_non_targeted_viewer !== undefined) payload.block_display_for_non_targeted_viewer = !!input.block_display_for_non_targeted_viewer;
  return payload;
}

/**
 * object_story_spec for an instant-form lead ad: link_data with link "https://fb.me/" and
 * call_to_action.value.lead_gen_form_id. Throws a plain-language error when something is missing.
 */
export function buildLeadStorySpec(ad: {
  name: string; primary_text?: string | null; headline?: string | null; description?: string | null;
  call_to_action?: string | null; media_url?: string | null;
}, pageId: string | null | undefined, leadFormId: string | null | undefined): Record<string, unknown> {
  if (!pageId) throw new Error("Choose the Facebook Page that owns the lead form.");
  if (!leadFormId) throw new Error("Choose or create a lead form on this ad before publishing.");
  const cta = String(ad.call_to_action || "").trim().toUpperCase();
  if (!LEAD_CTA_TYPES.includes(cta)) {
    throw new Error(`Lead ads need a lead button such as ${LEAD_CTA_TYPES.slice(0, 5).join(", ")}. "${cta || "none"}" is not allowed.`);
  }
  const link_data: Record<string, unknown> = {
    link: "https://fb.me/",
    message: ad.primary_text || "",
    name: ad.headline || ad.name,
    call_to_action: { type: cta, value: { lead_gen_form_id: String(leadFormId) } },
  };
  if (ad.description) link_data.description = ad.description;
  if (ad.media_url) link_data.picture = ad.media_url;
  return { page_id: String(pageId), link_data };
}
