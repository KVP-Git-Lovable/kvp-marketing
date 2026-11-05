import { supabase } from '@/lib/supabaseLoose';

/**
 * Whose name an invoice goes out in.
 *
 * A retailer that belongs to a distributor is that distributor's customer, so
 * the bill should carry the distributor's name, GSTIN, address and bank --
 * not ours. The decision is per distributor, held in
 * `distributors.invoice_identity_source`: 'own' bills in their name,
 * 'company' keeps ours (an OEM-style arrangement where we invoice directly).
 *
 * `invoice_identity_for_retailer` resolves it in one call, falling back to the
 * company row field by field, so a distributor who has filled in a name but no
 * bank details still gets our bank rather than a blank.
 *
 * The result is overlaid onto the company row rather than replacing it, since
 * the generators also read template, theme and layout fields that only the
 * company carries.
 */
export async function applyInvoiceIdentity<T extends Record<string, any>>(
  company: T,
  retailerId: string | null | undefined,
): Promise<T> {
  if (!company || !retailerId) return company;

  try {
    const { data, error } = await supabase.rpc("invoice_identity_for_retailer", {
      p_retailer_id: retailerId,
    });
    if (error) throw error;

    const id = data as Record<string, any> | null;
    // Null means the caller is not signed in; the company row is the honest
    // answer then, not a blank header.
    if (!id || id.source !== "distributor") return company;

    const overlay: Record<string, any> = {};
    // Only fields the distributor actually supplied; the RPC has already
    // fallen back to the company for the rest.
    const map: Record<string, string> = {
      name: "name",
      address: "address",
      phone: "contact_phone",
      email: "email",
      gstin: "gstin",
      state: "state",
      bank_name: "bank_name",
      bank_account: "bank_account",
      ifsc: "ifsc",
      account_holder_name: "account_holder_name",
      qr_upi: "qr_upi",
      qr_code_url: "qr_code_url",
      logo_url: "logo_url",
      terms_conditions: "terms_conditions",
    };
    for (const [from, to] of Object.entries(map)) {
      const v = id[from];
      if (v !== null && v !== undefined && v !== "") overlay[to] = v;
    }

    return { ...company, ...overlay, __invoice_identity: "distributor" } as T;
  } catch (e) {
    // An invoice in our name is wrong; an invoice that fails to generate is
    // worse. Fall back loudly rather than throwing.
    console.error("Could not resolve the distributor invoice identity:", e);
    return company;
  }
}
