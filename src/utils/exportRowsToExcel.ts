import * as XLSX from "xlsx";

/**
 * Write an array of plain objects to a .xlsx file and hand it to the browser.
 *
 * The keys of the first row become the header, so callers build their rows
 * with the column titles they want to see rather than passing a separate
 * header list that can drift out of step with the data.
 */
export function exportRowsToExcel(
  rows: Record<string, string | number | null | undefined>[],
  fileBaseName: string,
  sheetName = "Sheet1",
) {
  if (!rows.length) return false;

  const sheet = XLSX.utils.json_to_sheet(rows);

  // Widen each column to its longest value, so nothing opens as ####.
  const headers = Object.keys(rows[0]);
  sheet["!cols"] = headers.map((h) => ({
    wch: Math.min(
      42,
      Math.max(h.length + 2, ...rows.map((r) => String(r[h] ?? "").length + 2)),
    ),
  }));

  const book = XLSX.utils.book_new();
  // Excel refuses sheet names over 31 characters or containing : \ / ? * [ ]
  XLSX.utils.book_append_sheet(book, sheet, sheetName.replace(/[:\\/?*[\]]/g, "-").slice(0, 31));

  const stamp = new Date().toISOString().slice(0, 10);
  const safe = fileBaseName.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "export";
  XLSX.writeFile(book, `${safe}-${stamp}.xlsx`);
  return true;
}
