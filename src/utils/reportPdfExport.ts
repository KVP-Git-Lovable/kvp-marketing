import { format as formatDate } from "date-fns";
import { getDocumentHeaderData } from "@/utils/documentHeaderSource";
import { downloadPDF } from "@/utils/fileDownloader";
import type { ReportResult, ReportRow, SavedReport } from "@/lib/reportBuilder/types";

/** Fetches an image URL and returns a compressed JPEG data URL plus its natural size. */
async function loadImageForPdf(
  url: string,
  maxDim = 200,
  quality = 0.85
): Promise<{ dataUrl: string; width: number; height: number }> {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    let width = img.width;
    let height = img.height;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/jpeg", quality), width: img.width, height: img.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Mirrors ReportResultTable's cell formatting so the PDF matches the on-screen view. */
function formatCellValue(
  row: ReportRow,
  col: ReportResult["columns"][number],
  formatMoney: (n: number | string | null | undefined) => string
): string {
  const value = row[col.key];
  if (value === null || value === undefined || value === "") return "-";
  if (col.format === "currency") return formatMoney(Number(value));
  if (col.format === "date" || (col.type === "date" && col.format !== "number")) {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : formatDate(d, "dd MMM yyyy");
  }
  if (col.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return col.format === "integer" ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (col.type === "boolean") return value === true || value === "true" ? "Yes" : "No";
  return String(value);
}

export interface ExportReportPdfOptions {
  report: SavedReport;
  result: ReportResult;
  /** Label of the report's primary object (e.g. "Order lines (products)"). */
  objectLabel?: string;
  /** PNG/JPEG data URL of the rendered chart — omit for table-only reports. */
  chartImageDataUrl?: string | null;
  formatMoney: (n: number | string | null | undefined) => string;
}

/**
 * Renders a Report Builder result into a branded, paginated PDF: a letterhead
 * (company logo/name from the company profile), the report name as the main
 * heading, the chart if one is shown, the full data table, and a footer with
 * page numbers — then triggers the download. Mirrors the on-screen view
 * (ReportChart + ReportResultTable) so the export matches what the rep sees.
 */
export async function exportReportToPdf({
  report,
  result,
  objectLabel,
  chartImageDataUrl,
  formatMoney,
}: ExportReportPdfOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }, header] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    getDocumentHeaderData("reports"),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // --- Letterhead: company logo + name/contact ---
  let textX = margin;
  let letterheadBottom = y + 12;
  if (header.logo_url) {
    try {
      const { dataUrl, width, height } = await loadImageForPdf(header.logo_url, 200, 0.85);
      const maxH = 16;
      const maxW = 34;
      const aspect = width / height;
      let logoW = maxH * aspect;
      let logoH = maxH;
      if (logoW > maxW) {
        logoW = maxW;
        logoH = maxW / aspect;
      }
      doc.addImage(dataUrl, "JPEG", margin, y, logoW, logoH);
      textX = margin + logoW + 5;
      letterheadBottom = Math.max(letterheadBottom, y + logoH);
    } catch (e) {
      console.warn("Report PDF: failed to load company logo", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(header.name || "Company", textX, y + 5);

  const contactBits = [header.address, header.phone ? `Tel: ${header.phone}` : "", header.email || ""].filter(Boolean);
  if (contactBits.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    const contactLines = doc.splitTextToSize(contactBits.join("  ·  "), pageWidth - textX - margin);
    doc.text(contactLines.slice(0, 2), textX, y + 10);
  }

  y = letterheadBottom + 6;
  doc.setDrawColor(225, 225, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Main heading: report name ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(report.name || "Report", margin, y);
  y += 7;

  if (report.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    const descLines = doc.splitTextToSize(report.description, pageWidth - margin * 2);
    doc.text(descLines, margin, y);
    y += descLines.length * 4.5 + 2;
  }

  const metaBits = [
    objectLabel,
    result.grainLabel,
    `${result.rows.length.toLocaleString()} row${result.rows.length === 1 ? "" : "s"} shown`,
    report.filters?.length ? `${report.filters.length} filter${report.filters.length === 1 ? "" : "s"} applied` : null,
    `Generated ${formatDate(new Date(), "dd MMM yyyy, hh:mm a")}`,
  ].filter(Boolean) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(metaBits.join("   |   "), margin, y);
  y += 9;

  // --- Chart image, when the report is shown as a chart rather than a table ---
  if (chartImageDataUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = chartImageDataUrl;
      });
      const maxW = pageWidth - margin * 2;
      const maxH = 90;
      let w = maxW;
      let h = (img.height / img.width) * w;
      if (h > maxH) {
        h = maxH;
        w = (img.width / img.height) * h;
      }
      if (y + h > pageHeight - 30) {
        doc.addPage();
        y = margin;
      }
      const x = margin + (maxW - w) / 2;
      doc.addImage(chartImageDataUrl, "PNG", x, y, w, h);
      y += h + 10;
    } catch (e) {
      console.warn("Report PDF: failed to embed chart image", e);
    }
  }

  // --- Data table ---
  const head = [result.columns.map((c) => c.label)];
  const body = result.rows.map((row) => result.columns.map((c) => formatCellValue(row, c, formatMoney)));
  const foot = result.totals
    ? [
        result.columns.map((c) =>
          c.type === "number" ? formatCellValue(result.totals!, c, formatMoney) : String(result.totals![c.key] ?? "")
        ),
      ]
    : undefined;

  const columnStyles: Record<number, { halign: "left" | "right" }> = {};
  result.columns.forEach((c, i) => {
    if (c.type === "number") columnStyles[i] = { halign: "right" };
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    showFoot: foot ? "lastPage" : undefined,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [45, 55, 72], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [237, 242, 247], textColor: [20, 20, 20], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    margin: { left: margin, right: margin, bottom: 22, top: margin },
  });

  // --- Footer: footnote + page numbers on every page ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`${header.name || "QuickApp"} · Generated by QuickApp Field Force`, margin, pageHeight - 11);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 11, { align: "right" });
  }

  const blob = doc.output("blob");
  const filename = `${(report.name || "report").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${formatDate(
    new Date(),
    "yyyyMMdd_HHmm"
  )}`;
  await downloadPDF(blob, filename);
}
