// Customer-list preparation for Meta Custom Audiences: normalise, de-duplicate and SHA-256 hash
// on the server, in the order of AUDIENCE_SCHEMA. Raw names, emails and numbers are never stored.

export const AUDIENCE_SCHEMA = ['EMAIL', 'PHONE', 'FN', 'LN'] as const;
export const AUDIENCE_MAX_ROWS = 10000;
/** Meta usually needs about this many matched people before an audience can deliver. */
export const AUDIENCE_RECOMMENDED_ROWS = 100;

export interface AudienceInput { first_name?: string; last_name?: string; email?: string; phone?: string }

export const normalizeEmail = (v: unknown): string => {
  const s = String(v ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
};

/** Digits with country code, no leading zeros or "+". Ten-digit numbers are treated as Indian. */
export const normalizePhone = (v: unknown): string => {
  let digits = String(v ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : '';
};

/** Lower case with punctuation and spaces removed (letters of any script are kept). */
export const normalizeName = (v: unknown): string => String(v ?? '').trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A row needs a usable email or phone; names only improve matching. */
export async function prepareAudience(rows: AudienceInput[]): Promise<{ data: string[][]; invalid: number; duplicates: number }> {
  const seen = new Set<string>();
  const data: string[][] = [];
  let invalid = 0, duplicates = 0;
  for (const r of rows) {
    const email = normalizeEmail(r.email);
    const phone = normalizePhone(r.phone);
    if (!email && !phone) { invalid++; continue; }
    const key = `${email}|${phone}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    const values = [email, phone, normalizeName(r.first_name), normalizeName(r.last_name)];
    data.push(await Promise.all(values.map((x) => (x ? sha256Hex(x) : Promise.resolve('')))));
  }
  return { data, invalid, duplicates };
}
