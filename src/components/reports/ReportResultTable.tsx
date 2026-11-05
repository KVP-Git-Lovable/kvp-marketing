import { useMemo, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowUpDown } from "lucide-react";
import { format as formatDate } from "date-fns";
import type { ReportResult, ReportRow } from "@/lib/reportBuilder/types";

interface Props {
  result: ReportResult;
  showTotals?: boolean;
  maxHeight?: string;
}

export const ReportResultTable = ({ result, showTotals = true, maxHeight = "60vh" }: Props) => {
  const { format: formatMoney } = useCurrency();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    if (!sortKey) return result.rows;
    const copy = [...result.rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = Number(av);
      const bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn) && av !== "" && bv !== "") {
        return sortDir === "asc" ? an - bn : bn - an;
      }
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
    return copy;
  }, [result.rows, sortKey, sortDir]);

  const renderCell = (row: ReportRow, col: ReportResult["columns"][number]) => {
    const value = row[col.key];
    if (value === null || value === undefined || value === "") return "—";
    if (col.format === "currency") return formatMoney(Number(value));
    if (col.format === "date" || (col.type === "date" && col.format !== "number")) {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : formatDate(d, "dd MMM yyyy");
    }
    if (col.type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return col.format === "integer"
        ? n.toLocaleString()
        : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (col.type === "boolean") return value === true || value === "true" ? "Yes" : "No";
    return String(value);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="rounded-lg border bg-background overflow-auto" style={{ maxHeight }}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr>
            {result.columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className={`cursor-pointer select-none px-3 py-2 font-medium whitespace-nowrap ${
                  c.type === "number" ? "text-right" : "text-left"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={result.columns.length} className="px-3 py-8 text-center text-muted-foreground">
                No rows match this report.
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className="border-t hover:bg-muted/40">
              {result.columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 whitespace-nowrap ${c.type === "number" ? "text-right tabular-nums" : "text-left"}`}
                >
                  {renderCell(row, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {showTotals && result.totals && rows.length > 0 && (
          <tfoot className="sticky bottom-0 bg-muted/80 backdrop-blur">
            <tr className="border-t font-semibold">
              {result.columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 whitespace-nowrap ${c.type === "number" ? "text-right tabular-nums" : "text-left"}`}
                >
                  {result.totals![c.key] === "" || result.totals![c.key] === null
                    ? ""
                    : c.type === "number"
                    ? renderCell(result.totals!, c)
                    : String(result.totals![c.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};
