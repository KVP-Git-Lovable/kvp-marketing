// Supabase serves text/html from Edge Functions on the default *.supabase.co domain as
// text/plain, so a function can't render a styled page itself. The OAuth callbacks
// therefore redirect (303) to a page inside the app, /oauth/result, which renders the
// Success / failure screen and closes the popup. The destination origin travels in the
// OAuth `state`, is re-validated here, and only a short result message is passed along.

const EXTRA = (Deno.env.get('OAUTH_ALLOWED_ORIGINS') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

/** Returns the normalised origin if it is a known app origin, else null. */
export function allowedAppOrigin(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const u = new URL(raw);
    if (EXTRA.includes(u.origin)) return u.origin;
    const h = u.hostname;
    const lovableHost = h.endsWith('.lovable.app') || h.endsWith('.lovableproject.com') || h.endsWith('.lovable.dev');
    if (u.protocol === 'https:' && lovableHost) return u.origin;
    if (u.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1')) return u.origin;
    return null;
  } catch {
    return null;
  }
}

/** 303 redirect to the in-app result page; the result rides in the URL fragment. */
export function resultRedirect(origin: string, source: string, ok: boolean, message: string): Response {
  const payload = encodeURIComponent(JSON.stringify({ source, ok, message }));
  return new Response(null, { status: 303, headers: { Location: `${origin}/oauth/result#result=${payload}` } });
}
