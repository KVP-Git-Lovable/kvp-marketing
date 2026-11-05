import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { runReport } from "@/lib/reportBuilder/engine";
import { getObject } from "@/lib/reportBuilder/objects";
import type { ChartType, ReportFilter, ReportResult, SavedReport } from "@/lib/reportBuilder/types";
import { ReportResultTable } from "./ReportResultTable";
import { ReportChart } from "./ReportChart";
import { ReportToolbar } from "./ReportToolbar";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { exportReportToPdf } from "@/utils/reportPdfExport";

interface Props {
  report: SavedReport;
  canEdit: boolean;
  /** From / To chosen on the Analytics page — narrows the report to that period. */
  dateRange?: { from: Date; to: Date };
  pinned?: boolean;
  onTogglePin?: () => void;
  onBack: () => void;
  onEdit: () => void;
}

const isoDay = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const ReportViewer = ({ report, canEdit, dateRange, pinned, onTogglePin, onBack, onEdit }: Props) => {
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>(report.chart_type);
  const [filters, setFilters] = useState<ReportFilter[]>(report.filters || []);
  const [exportingPdf, setExportingPdf] = useState(false);
  const chartCaptureRef = useRef<HTMLDivElement>(null);
  const { format: formatMoney } = useCurrency();

  const dateField = getObject(report.primary_object)?.dateField;

  /** Replace any filter on the dataset's date column with the picked From → To range. */
  const withPickedRange = (activeFilters: ReportFilter[]): ReportFilter[] => {
    if (!dateRange?.from || !dateRange?.to || !dateField) return activeFilters;
    return [
      ...activeFilters.filter((f) => f.field !== dateField),
      {
        id: "analytics-date-range",
        field: dateField,
        operator: "between",
        value: isoDay(dateRange.from),
        value2: isoDay(dateRange.to),
      },
    ];
  };

  const load = async (activeFilters: ReportFilter[] = filters) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await runReport({ ...report, filters: withPickedRange(activeFilters) }));
    } catch (e: any) {
      setError(e?.message || "Could not run this report.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setChartType(report.chart_type);
    setFilters(report.filters || []);
    load(report.filters || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.id]);

  // Re-run whenever the Analytics From / To pickers change.
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const exportCsv = () => {
    if (!result) return;
    const head = result.columns.map((c) => `"${c.label}"`).join(",");
    const body = result.rows
      .map((r) =>
        result.columns
          .map((c) => {
            const v = r[c.key];
            return `"${String(v ?? "").replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Report exported" });
  };

  const exportPdf = async () => {
    if (!result) return;
    setExportingPdf(true);
    try {
      let chartImageDataUrl: string | null = null;
      if (chartType !== "table" && chartCaptureRef.current) {
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(chartCaptureRef.current, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });
        chartImageDataUrl = canvas.toDataURL("image/png");
      }
      await exportReportToPdf({ report, result, objectLabel: obj?.label, chartImageDataUrl, formatMoney });
      toast({ title: "Report exported" });
    } catch (e: any) {
      console.error("Report PDF export failed:", e);
      toast({ title: "Failed to export PDF", description: e?.message, variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  const obj = getObject(report.primary_object);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-1 -ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> All reports
          </Button>
          <h2 className="text-xl font-semibold truncate">{report.name}</h2>
          <p className="text-sm text-muted-foreground">
            {report.description || obj?.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{obj?.label}</Badge>
            <Badge variant="outline">{result?.grainLabel || obj?.grain}</Badge>
            {dateRange?.from && dateRange?.to && (
              <Badge variant="outline">
                {isoDay(dateRange.from)} → {isoDay(dateRange.to)}
              </Badge>
            )}
            {result && <span className="text-muted-foreground">{result.rows.length} rows shown</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!result}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={!result || exportingPdf}>
            {exportingPdf ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-1 h-4 w-4" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      <ReportToolbar
        chartType={chartType}
        onChartTypeChange={setChartType}
        object={obj}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={() => load(filters)}
        canEdit={canEdit}
        onEdit={onEdit}
        pinned={pinned}
        onTogglePin={onTogglePin}
      />

      {result?.truncated && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Showing the most recent {result.baseRowCount.toLocaleString()} records only — narrow the date
          filter for a complete picture.
        </div>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center rounded-lg border">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</div>
      )}

      {!loading && result && (
        <div className="space-y-4">
          {chartType !== "table" && (
            <div ref={chartCaptureRef}>
              <ReportChart result={result} chartType={chartType} />
            </div>
          )}
          <ReportResultTable result={result} showTotals={report.display_options?.showTotals !== false} />
        </div>
      )}
    </div>
  );
};
