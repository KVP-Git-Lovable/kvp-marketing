import { supabase } from "@/integrations/supabase/client";

/**
 * supabase-js's FunctionsHttpError.message is hardcoded to "Edge Function
 * returned a non-2xx status code" — the actual JSON body the function sent
 * back only lives in error.context (an unread Response), so it has to be
 * read out explicitly or every Meta-side error looks identical to the caller.
 * Returns the real message when one can be recovered, otherwise the
 * original error unchanged.
 */
async function resolveFunctionError(error: unknown): Promise<unknown> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (!(ctx instanceof Response)) return error;
  try {
    const body = await ctx.clone().json();
    if (body?.error) return new Error(body.error);
  } catch {
    // response wasn't JSON (or already consumed) — fall back to the original error
  }
  return error;
}

/** Calls the meta-api edge function, throwing its real error message on failure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers read ad-hoc response fields
export async function invokeMetaApi<T = any>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
  if (error) throw await resolveFunctionError(error);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** Same as invokeMetaApi, but skips the data?.error check (for callers that need the raw payload). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers read ad-hoc response fields
export async function invokeMetaApiRaw<T = any>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
  if (error) throw await resolveFunctionError(error);
  return data as T;
}
