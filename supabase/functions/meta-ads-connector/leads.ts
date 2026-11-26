// Turning Meta lead records into rows for the app.

export interface MetaLead { id: string; created_time?: string; ad_id?: string; field_data?: Array<{ name?: string; values?: unknown[] }> }

export const leadFields = (lead: MetaLead): Record<string, string> =>
  Object.fromEntries((lead.field_data || []).filter((f) => f.name).map((f) => [String(f.name), (f.values || []).map(String).join(', ')]));

/** One form can serve several ads: keep only the leads that came from this campaign's ad. */
export const leadRows = (leads: MetaLead[], campaignRowId: string, formId: string, adId: string) =>
  leads.filter((l) => l.id && l.ad_id === adId).map((l) => ({
    campaign_id: campaignRowId, lead_id: String(l.id), form_id: formId, ad_id: adId,
    created_time: l.created_time ?? null, fields: leadFields(l), synced_at: new Date().toISOString(),
  }));
