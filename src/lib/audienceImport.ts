import * as XLSX from "xlsx";

export interface AudienceRow {
  rowIndex: number;
  email: string;
  phone: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  resolved: boolean;
  issue?: string;
}

export interface AudienceSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
}

const MIN_AUDIENCE_ROWS = 100;
const MAX_AUDIENCE_ROWS = 10000;

export function normalizeEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export function normalizePhone(v: unknown, defaultCountryCode = "91"): string | null {
  let digits = String(v ?? "").trim().replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  if (digits.length === 10) digits = `${defaultCountryCode}${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function findHeaderIndex(headers: string[], prefixes: string[]): number {
  return headers.findIndex((h) => prefixes.some((p) => h.toLowerCase().trim().startsWith(p)));
}

export async function parseAudienceFile(file: File): Promise<{ email: string; phone: string }[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (!rows.length) return [];
  const headers = (rows[0] as unknown[]).map((h) => String(h ?? ""));
  const emailIdx = findHeaderIndex(headers, ["email"]);
  const phoneIdx = findHeaderIndex(headers, ["phone", "mobile"]);
  const dataRows = rows.slice(1);
  return dataRows.map((r) => ({
    email: emailIdx >= 0 ? String(r[emailIdx] ?? "") : "",
    phone: phoneIdx >= 0 ? String(r[phoneIdx] ?? "") : "",
  }));
}

export function downloadAudienceTemplateCSV() {
  const csv = "email,phone\nexample@email.com,9876543210\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customer_list_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function validateAudienceRows(raw: { email: string; phone: string }[]): { rows: AudienceRow[]; summary: AudienceSummary } {
  const seen = new Set<string>();
  const rows: AudienceRow[] = raw.map((r, i) => {
    const normalizedEmail = normalizeEmail(r.email);
    const normalizedPhone = normalizePhone(r.phone);
    if (!normalizedEmail && !normalizedPhone) {
      return { rowIndex: i, email: r.email, phone: r.phone, normalizedEmail, normalizedPhone, resolved: false, issue: "No valid email or phone" };
    }
    const key = `${normalizedEmail ?? ""}|${normalizedPhone ?? ""}`;
    if (seen.has(key)) {
      return { rowIndex: i, email: r.email, phone: r.phone, normalizedEmail, normalizedPhone, resolved: false, issue: "Duplicate" };
    }
    seen.add(key);
    return { rowIndex: i, email: r.email, phone: r.phone, normalizedEmail, normalizedPhone, resolved: true };
  });
  const valid = rows.filter((r) => r.resolved).length;
  const duplicates = rows.filter((r) => r.issue === "Duplicate").length;
  const invalid = rows.filter((r) => r.issue === "No valid email or phone").length;
  return { rows, summary: { total: rows.length, valid, invalid, duplicates } };
}

export { MIN_AUDIENCE_ROWS, MAX_AUDIENCE_ROWS };
