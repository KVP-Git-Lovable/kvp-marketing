import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journey-actions`;

/**
 * Returns a current access token. If the saved session is expired or about to
 * expire (e.g. the tab was asleep), refresh it first so we never send a stale token.
 */
async function freshAccessToken(forceRefresh = false): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  const expiresAtMs = (session?.expires_at ?? 0) * 1000;
  if (forceRefresh || !session || expiresAtMs - Date.now() < 60_000) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? session?.access_token;
  }
  return session.access_token;
}

/**
 * Calls the journey-actions function with a fresh sign-in token, retrying once
 * after refreshing the session if the server says the token is no longer valid.
 */
export async function journeyActionsFetch(
  init: { method?: "GET" | "POST" | "DELETE"; query?: string; body?: unknown } = {},
): Promise<Response> {
  const method = init.method ?? (init.body === undefined ? "GET" : "POST");
  const url = init.query ? `${FN_URL}?${init.query}` : FN_URL;
  const send = (token?: string) =>
    fetch(url, {
      method,
      headers: {
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${token}`,
      },
      body: method === "GET" || init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  let res = await send(await freshAccessToken());
  if (res.status === 401) {
    res = await send(await freshAccessToken(true));
  }
  return res;
}
