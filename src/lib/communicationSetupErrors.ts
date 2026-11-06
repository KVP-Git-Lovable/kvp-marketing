// marketing_contact_list_views.database_type allows the same three databases as marketing_contacts
// (the check was widened to include "event"), so any of them can be saved as a list view.
export function canCreateMarketingListView(databaseType: string): boolean {
  return databaseType === "institutional" || databaseType === "distributor" || databaseType === "event";
}

export function metaTermsUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "business.facebook.com" && url.pathname === "/ads/manage/customaudiences/tos/") return url.href;
  } catch { /* Invalid URLs must never become actionable links. */ }
  return undefined;
}

export async function readMetaFailure(data: any, error: any): Promise<{ message: string; termsUrl?: string } | undefined> {
  let body = data;
  if (error?.context instanceof Response) {
    try { body = await error.context.clone().json(); } catch { /* Preserve the original error below. */ }
  }
  if (!error && !body?.error) return undefined;
  return {
    message: typeof body?.error === "string" ? body.error : error?.message || "Could not create the audience",
    termsUrl: metaTermsUrl(body?.tos_url),
  };
}