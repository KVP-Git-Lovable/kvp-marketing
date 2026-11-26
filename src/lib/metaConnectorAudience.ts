// Reads a customer list (CSV / Excel rows) into the shape the Meta Ads Connector uploads.
// Hashing happens in the edge function; nothing here leaves the browser until the user uploads.

export interface ConnectorAudienceRow { first_name: string; last_name: string; email: string; phone: string }

const find = (headers: string[], names: string[]) => headers.findIndex((h) => names.includes(h));

/** Maps sheet rows (header row first). Accepts "Name" or separate "First name" / "Last name" columns. */
export function mapAudienceSheet(sheet: unknown[][]): ConnectorAudienceRow[] {
  if (sheet.length < 2) return [];
  const headers = sheet[0].map((h) => String(h ?? "").toLowerCase().replace(/[^a-z]/g, ""));
  const first = find(headers, ["firstname", "fname"]);
  const last = find(headers, ["lastname", "lname", "surname"]);
  const full = find(headers, ["name", "fullname", "customername", "contactname"]);
  const email = find(headers, ["email", "emailid", "emailaddress", "mail"]);
  const phone = find(headers, ["phone", "phonenumber", "phoneno", "mobile", "mobilenumber", "mobileno", "contactnumber"]);
  if (email < 0 && phone < 0) throw new Error('The file needs an "email" or a "phone" column.');
  const cell = (row: unknown[], i: number) => (i >= 0 ? String(row[i] ?? "").trim() : "");
  return sheet.slice(1)
    .map((row) => {
      const parts = cell(row, full).split(/\s+/).filter(Boolean);
      return {
        first_name: cell(row, first) || parts[0] || "",
        last_name: cell(row, last) || parts.slice(1).join(" "),
        email: cell(row, email),
        phone: cell(row, phone),
      };
    })
    .filter((r) => r.first_name || r.last_name || r.email || r.phone);
}

/** Rows that have at least a plausible email or phone number (the server re-checks). */
export const usableRows = (rows: ConnectorAudienceRow[]) =>
  rows.filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) || r.phone.replace(/\D/g, "").replace(/^0+/, "").length >= 10);

/** Quotes a CSV cell and neutralises spreadsheet formulas in text coming from lead forms. */
export const csvCell = (value: unknown) => {
  const s = String(value ?? "");
  const safe = /^[=+\-@]/.test(s) && !/^\+?\d[\d\s-]*$/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};
