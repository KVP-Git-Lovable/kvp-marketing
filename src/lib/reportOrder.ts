// Default row ordering for reports.
// Mirrored (intentionally duplicated) in supabase/functions/generate-report/index.ts
// because edge functions cannot import from src/. Keep the two in step.

/**
 * Put a report's rows in an order a reader can use.
 *
 * The order rows arrive in is whatever each RPC happens to return. For the
 * attendance register that is alphabetical, so everyone who worked and everyone
 * who did not are interleaved and the page has to be read line by line before it
 * says anything. Sorting by what the report is actually measuring puts the rows
 * that matter at the top and collects the rows with nothing to show at the end.
 *
 * An explicit sort chosen by the report's author always wins; this only decides
 * the order when nobody has.
 */
export function orderReportRows(
  rows: any[],
  opts: { rowKeys?: unknown[]; valueKeys?: unknown[]; sortKey?: string | null },
): any[] {
  if (rows.length < 2 || opts.sortKey) return rows;

  const keys = Object.keys(rows[0] ?? {});
  const isId = (k: string) => /(^id$|_id$|uuid)/i.test(k);
  const isNumish = (v: unknown) =>
    typeof v === 'number' ? Number.isFinite(v)
      : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim());
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
  const present = (k: string) =>
    rows.map(r => r[k]).filter(v => v !== null && v !== undefined && v !== '');
  const names = (xs?: unknown[]) =>
    (Array.isArray(xs) ? xs : [])
      .map(v => (typeof v === 'string' ? v : (v as any)?.key))
      .filter((k): k is string => typeof k === 'string' && !!k);

  const measures = keys.filter(k => !isId(k) && present(k).length > 0 && present(k).every(isNumish));
  if (!measures.length) return rows;

  // What the report is about: the first measure its author configured, and
  // otherwise the column carrying the most weight — which on a pivot is the
  // total column, exactly the one a reader would have sorted by.
  const weight = (k: string) => rows.reduce((a, r) => a + Math.abs(num(r[k])), 0);
  const measure = names(opts.valueKeys).find(k => measures.includes(k))
    ?? [...measures].sort((a, b) => weight(b) - weight(a))[0];

  const texts = keys.filter(k => !isId(k) && !measures.includes(k));
  const labelKey = names(opts.rowKeys).find(k => texts.includes(k))
    ?? texts.find(k => /name|user|member|retailer|employee|beat|product/i.test(k))
    ?? texts[0];
  if (!labelKey) return rows;

  const label = (r: any) => String(r[labelKey] ?? '');
  const byLabel = (a: any, b: any) =>
    label(a).localeCompare(label(b), undefined, { sensitivity: 'base' });

  // One row per subject — a single day's register, a ranking. Straight down the
  // measure, with the rows that have nothing to show gathered at the bottom
  // rather than scattered through it.
  if (new Set(rows.map(label)).size === rows.length) {
    const active = rows.filter(r => num(r[measure]) !== 0);
    const idle = rows.filter(r => num(r[measure]) === 0);
    active.sort((a, b) => num(b[measure]) - num(a[measure]) || byLabel(a, b));
    idle.sort(byLabel);
    return [...active, ...idle];
  }

  // Several rows per subject — a week of days, say. Ordering every row by the
  // measure would shuffle one person's days out of sequence, so subjects are
  // ranked by their total and each subject's own rows stay in date order.
  const dateKey = texts.find(k =>
    /date|day/i.test(k) && present(k).every(v => /^\d{4}-\d{2}-\d{2}/.test(String(v))));
  const totals = new Map<string, number>();
  rows.forEach(r => totals.set(label(r), (totals.get(label(r)) ?? 0) + num(r[measure])));
  return [...rows].sort((a, b) => {
    const t = (totals.get(label(b)) ?? 0) - (totals.get(label(a)) ?? 0);
    if (t !== 0) return t;
    const l = byLabel(a, b);
    if (l !== 0) return l;
    if (dateKey) return String(a[dateKey] ?? '').localeCompare(String(b[dateKey] ?? ''));
    return num(b[measure]) - num(a[measure]);
  });
}
