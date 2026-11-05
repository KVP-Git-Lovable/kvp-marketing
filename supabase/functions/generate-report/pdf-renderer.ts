// jsPDF + jspdf-autotable renderer for report subscriptions.
// Consumes a neutral ReportModel. Reads branding from the DB via ./branding.ts.
// Supports header style variants, orientation, wide-column splitting.

import { jsPDF } from 'npm:jspdf@2.5.1';
import autoTableImport from 'npm:jspdf-autotable@3.8.2';
const autoTable: any = (autoTableImport as any).default ?? autoTableImport;
import { Branding, formatCurrency, formatDateToken } from './branding.ts';
import {
  loadUnicodeFont, registerFontOnDoc,
  loadDevanagariFont, registerScriptFontOnDoc, DEVANAGARI_RE,
} from './font-loader.ts';

export interface ReportColumn {
  /** Carried for a KPI tile's total but not printed as a table column. */
  hidden?: boolean;
  key: string;
  label: string;
  numeric: boolean;
  currency?: boolean;
  /** Declared format 'percent': the sign rides on every figure, cards included. */
  percent?: boolean;
  /** Printed after the figure on a KPI tile, e.g. 'KG'. */
  unit?: string | null;
  /** 'vs100': 100 is the line — at or above reads well, below needs a look. */
  tone?: string | null;
  /** False when the dataset declares a non-additive aggregate (e.g. avg) —
   *  summing an average across groups produces a meaningless figure. */
  summable?: boolean;
}

export interface ReportModel {
  title: string;
  subtitle?: string;
  period: { label: string; date_from?: string; date_to?: string };
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, number> | null; // key -> summed value
  meta: {
    generated_at: Date;
    recipient_name?: string | null;
    scope_label?: string | null;
    filters_label?: string | null;
    ai_summary?: string | null;
  };
}

export interface PdfTemplate {
  header_style?: 'standard' | 'centered' | 'band' | 'compact';
  title_override?: string;
  subtitle?: string;
  show_period?: boolean;
  show_contact_line?: boolean;
  branding?: 'company' | 'distributor' | 'none';
  orientation?: 'auto' | 'portrait' | 'landscape';
  include_meta?: boolean;
  include_totals?: boolean;
  /**
   * Put a subtotal line under each run of rows sharing this column's value.
   *
   * A rep who worked five beats is five lines; this adds the sixth that says
   * what the five came to. Null means no grouping, which is how every report
   * that predates this keeps rendering.
   */
  group_by?: string | null;
  show_kpis?: boolean;
  kpi_keys?: string[] | null;
  date_format?: string | null;
  include_page_numbers?: boolean;
  footer_note?: string;
  /** Preset id from src/lib/pdfThemes.ts, or 'custom' to use theme_custom. */
  theme?: string;
  /** Four hex values, used only when theme is 'custom'. */
  theme_custom?: { accent?: string; band?: string; headFill?: string; headText?: string } | null;
  /** Document template: layout, typography and table density. */
  layout?: 'classic' | 'executive' | 'operational' | 'editorial' | 'modern';
  /**
   * The body, in the order it is drawn. Absent means the order this renderer
   * has always used (cards, table, summary), so every report that predates
   * this keeps rendering exactly as it did.
   */
  blocks?: LayoutBlock[] | null;
}

export type LayoutBlockType = 'kpis' | 'table' | 'ai_summary' | 'chart' | 'leaderboard' | 'highlights';

/** One movable piece of the report body. */
export interface LayoutBlock {
  /** Stable handle for the builder's drag list; the renderer never needs it. */
  id?: string;
  type: LayoutBlockType;
  /** Kept in the layout but not drawn, so an order survives being toggled off. */
  hidden?: boolean;
  /** kpis: which measures get a card, in the order chosen. */
  keys?: string[] | null;
  /** chart: how to draw it. */
  chart?: 'bar' | 'line' | 'pie';
  /** chart: the dimension along the category axis. */
  x?: string | null;
  /** chart: one or more measures. A pie reads only the first. */
  y?: string[] | null;
  /** chart: bars down the page or across it. Ignored by line and pie. */
  orientation?: 'vertical' | 'horizontal';
  /** chart: keep the top N categories and roll the rest into "Others". */
  limit?: number | null;
  /** chart: heading above the plot. */
  title?: string | null;
  /** chart: hex for the FIRST series. Later series keep the standard palette,
   *  minus anything too close to this one. */
  color?: string | null;
  /** highlights: how the two sides are headed. */
  high_label?: string | null;
  low_label?: string | null;
  /**
   * ai_summary: what kind of note to write.
   *   note        one short paragraph ending in a follow-up line
   *   sections    two halves, highlights and the other side
   *   actions     a short list of things to do next
   *   exceptions  only what looks wrong
   * `ai_sections: true` is the older spelling of 'sections' and still read.
   */
  ai_mode?: 'note' | 'sections' | 'actions' | 'exceptions';
  ai_sections?: boolean;
  /** sections mode: what belongs in each half, in the author's own words. */
  high_prompt?: string | null;
  low_prompt?: string | null;
  /** Any mode: extra instruction, appended to whatever the mode asks for. */
  extra_prompt?: string | null;
}

/** What a report draws when it has never been given an explicit order. */
const DEFAULT_BLOCKS: LayoutBlock[] = [
  { type: 'kpis' }, { type: 'table' }, { type: 'ai_summary' },
];

// Mirror of src/lib/pdfThemes.ts (edge functions cannot import from src/).
const PDF_THEMES: Record<string, { accent: string | null; band: string; headFill: string; headText: string }> = {
  default: { accent: null, band: '#111111', headFill: '#f6f6f4', headText: '#464646' },
  amber: { accent: '#f59e0b', band: '#78350f', headFill: '#fef3c7', headText: '#78350f' },
  blue_black: { accent: '#2563eb', band: '#0f172a', headFill: '#dbeafe', headText: '#1e3a8a' },
  light_pink: { accent: '#ec4899', band: '#831843', headFill: '#fce7f3', headText: '#831843' },
  teal: { accent: '#0d9488', band: '#134e4a', headFill: '#ccfbf1', headText: '#115e59' },
  forest: { accent: '#16a34a', band: '#14532d', headFill: '#dcfce7', headText: '#166534' },
  ocean: { accent: '#0284c7', band: '#0c4a6e', headFill: '#e0f2fe', headText: '#075985' },
  indigo: { accent: '#6366f1', band: '#312e81', headFill: '#e0e7ff', headText: '#3730a3' },
  plum: { accent: '#9333ea', band: '#4c1d95', headFill: '#f3e8ff', headText: '#6b21a8' },
  crimson: { accent: '#dc2626', band: '#7f1d1d', headFill: '#fee2e2', headText: '#991b1b' },
  graphite: { accent: '#64748b', band: '#1e293b', headFill: '#f1f5f9', headText: '#334155' },
  custom: { accent: '#534ab7', band: '#1f2937', headFill: '#eef2f7', headText: '#334155' },
};

const DEFAULTS: Required<Omit<PdfTemplate, 'title_override' | 'subtitle' | 'footer_note'>> & {
  title_override: string;
  subtitle: string;
  footer_note: string;
} = {
  header_style: 'standard',
  title_override: '',
  subtitle: '',
  show_period: true,
  show_contact_line: false,
  branding: 'company',
  orientation: 'auto',
  // The header states the data period and the generation time, so the strip that
  // repeated them underneath is off unless a report asks for it back.
  include_meta: false,
  include_totals: true,
  show_kpis: true,
  include_page_numbers: true,
  footer_note: '',
  theme: 'default',
  layout: 'classic',
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Fit an image inside a box while preserving its aspect ratio (never stretch).
// Returns the centred draw rectangle inside the box.
function fitImage(
  doc: any,
  dataUrl: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): { x: number; y: number; w: number; h: number } {
  let ratio = 1;
  try {
    const p = doc.getImageProperties(dataUrl);
    if (p?.width && p?.height) ratio = p.width / p.height;
  } catch (_) { /* fall back to square */ }
  let w = boxW;
  let h = w / ratio;
  if (h > boxH) { h = boxH; w = h * ratio; }
  return { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, w, h };
}


const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format a bare YYYY-MM-DD from its own digits. Parsing it into a Date first
 *  reads it as UTC midnight, which prints as the day before west of Greenwich. */
function applyDateFormat(v: string, fmt?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m || !fmt) return null;
  const [, y, mo, d] = m;
  const mmm = MONTHS_SHORT[Number(mo) - 1] ?? '';
  switch (fmt) {
    case 'DD/MM/YYYY':   return `${d}/${mo}/${y}`;
    case 'DD-MM-YYYY':   return `${d}-${mo}-${y}`;
    case 'DD MMM YYYY':  return `${d} ${mmm} ${y}`;
    case 'MMM DD, YYYY': return `${mmm} ${d}, ${y}`;
    case 'MM/DD/YYYY':   return `${mo}/${d}/${y}`;
    default:             return null;   // YYYY-MM-DD, already in that shape
  }
}

function fmtCell(value: unknown, col: ReportColumn, brand: Branding, unicodeSafe: boolean, dateFormat?: string | null): string {
  if (value === null || value === undefined || value === '') return '';
  if (!col.numeric && typeof value === 'string') {
    const d = applyDateFormat(value, dateFormat);
    if (d) return d;
  }
  if (col.numeric) {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n)) {
      if (col.currency) return formatCurrency(n, brand.currency, unicodeSafe);
      // Whole numbers throughout. Rows round independently of the total, so a
      // column of rounded rows can differ from its rounded total by a unit -
      // the total is right, being rounded once from the real sum.
      const digits = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
      // A percent sign belongs to the figure itself, so it is printed in every
      // cell. A unit like KG describes the whole column and stays on the heading.
      return col.percent ? `${digits}%` : digits;
    }
  }
  return String(value);
}

function parseIsoDate(s: string | undefined): Date | null {
  if (!s) return null;
  // 'YYYY-MM-DD'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * The data period, written in the format the REPORT chose.
 *
 * It used to take the company's date_format whatever the report asked for, so a
 * report set to DD/MM/YYYY printed its cells one way and its own header the
 * other. The report's choice wins; the company setting answers for a report
 * that never made one.
 */
function formatPeriod(model: ReportModel, brand: Branding, fmt?: string | null): string {
  const f = fmt || brand.date_format;
  const from = parseIsoDate(model.period.date_from);
  const to = parseIsoDate(model.period.date_to);
  if (from && to) {
    const a = formatDateToken(from, f);
    const b = formatDateToken(to, f);
    return a === b ? a : `${a} – ${b}`;
  }
  return model.period.label || '';
}

/** Where a block landed on the page. Preview only; see renderReportPdf. */
export interface BlockBox {
  id: string;
  type: LayoutBlockType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function renderReportPdf(
  model: ReportModel,
  template: PdfTemplate,
  brand: Branding,
  /**
   * Called once per drawn block with the box it occupies, in PDF points.
   *
   * The preview shows the real PDF painted to a canvas, so there is no HTML to
   * attach a drag handle to. Reporting where each block landed lets the builder
   * lay invisible handles over the canvas at exactly those positions — you drag
   * what looks like the report, and the picture under it stays the real file.
   */
  onBlock?: (box: BlockBox) => void,
): Promise<Uint8Array> {
  const t = { ...DEFAULTS, ...(template || {}) };

  // Auto-orient rule: portrait when <=6 columns, landscape otherwise.
  const orientation: 'p' | 'l' =
    t.orientation === 'portrait' ? 'p'
    : t.orientation === 'landscape' ? 'l'
    : (model.columns.length > 6 ? 'l' : 'p');

  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

  // Register a Unicode TTF so ₹ and other non-WinAnsi glyphs render.
  const unicodeFont = await loadUnicodeFont();
  const fontFamily = unicodeFont ? unicodeFont.name : 'helvetica';
  if (unicodeFont) registerFontOnDoc(doc, unicodeFont);
  const unicodeSafe = !!unicodeFont;

  // Devanagari is loaded only when this report carries any, and the scan covers
  // the cells as well as the headings, because the Hindi is usually in the data.
  const hasDevanagari =
    DEVANAGARI_RE.test(model.title ?? '') ||
    DEVANAGARI_RE.test(model.subtitle ?? '') ||
    DEVANAGARI_RE.test(model.meta.scope_label ?? '') ||
    DEVANAGARI_RE.test(model.meta.ai_summary ?? '') ||
    model.columns.some(c => DEVANAGARI_RE.test(c.label ?? '')) ||
    model.rows.some(r => Object.values(r).some(
      v => typeof v === 'string' && DEVANAGARI_RE.test(v)));
  const devFont = hasDevanagari ? await loadDevanagariFont() : null;
  if (devFont) registerScriptFontOnDoc(doc, devFont);
  /** The family that can actually draw this string. */
  const scriptFamily = (str: string) =>
    devFont && DEVANAGARI_RE.test(str) ? devFont.name : null;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  const basePalette = PDF_THEMES[(t as any).theme as string] ?? PDF_THEMES.default;
  // A custom palette is four hex values carried on the subscription. Each is
  // validated on its own, so one bad value falls back to the preset underneath
  // instead of blanking a colour and printing white text on white paper.
  const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const customIn = ((t as any).theme_custom ?? {}) as Record<string, unknown>;
  const pickHex = (k: string, fallback: string | null) => {
    const v = customIn[k];
    return typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : fallback;
  };
  const themeDef = (t as any).theme === 'custom'
    ? {
        accent: pickHex('accent', basePalette.accent),
        band: pickHex('band', basePalette.band) as string,
        headFill: pickHex('headFill', basePalette.headFill) as string,
        headText: pickHex('headText', basePalette.headText) as string,
      }
    : basePalette;
  const brandRgb = hexToRgb(themeDef.accent ?? brand.brand_color);
  const bandRgb = hexToRgb(themeDef.band);
  const headFillRgb = hexToRgb(themeDef.headFill);
  const headTextRgb = hexToRgb(themeDef.headText);

  // --- Template. 'classic' reproduces the original output exactly, so every
  // subscription that predates templates keeps rendering unchanged; the four
  // named templates each set their own header, figure band and table style.
  // Colour stays with the theme, so any template works in any theme. ---
  type LayoutSpec = {
    header: 'mast' | 'bar' | 'centered' | 'card' | null;
    kpi: 'hairline' | 'strip' | 'centered' | 'cards';
    table: 'hairline' | 'zebra' | 'dotted' | 'soft';
    serif: boolean;
    dense: boolean;
    radius: number;
    cardRule: boolean;
    heroTile: boolean;
  };
  const LAYOUTS: Record<string, LayoutSpec> = {
    classic:     { header: null,       kpi: 'cards',    table: 'hairline', serif: false, dense: false, radius: 3, cardRule: true,  heroTile: false },
    executive:   { header: 'mast',     kpi: 'hairline', table: 'hairline', serif: true,  dense: false, radius: 0, cardRule: false, heroTile: false },
    operational: { header: 'bar',      kpi: 'strip',    table: 'zebra',    serif: false, dense: true,  radius: 0, cardRule: false, heroTile: false },
    editorial:   { header: 'centered', kpi: 'centered', table: 'dotted',   serif: true,  dense: false, radius: 0, cardRule: false, heroTile: false },
    modern:      { header: 'card',     kpi: 'cards',    table: 'soft',     serif: false, dense: false, radius: 5, cardRule: false, heroTile: true  },
  };
  const spec = LAYOUTS[(t as any).layout as string] ?? LAYOUTS.classic;

  // jsPDF ships no serif Unicode face and the loaded Roboto is sans, so the
  // serif templates use the built-in 'times' per string. It is Latin-1 only:
  // safe for figures, uppercase labels and most titles, and never chosen for
  // a string it would render as garbage.
  const ASCII_ONLY = /^[\x20-\x7E]*$/;
  const fam = (str: string, serif: boolean) =>
    scriptFamily(str) ?? (serif && ASCII_ONLY.test(str) ? 'times' : fontFamily);

  const displayTitle = (t.title_override || model.title || 'Report').trim();
  const displaySubtitle = (t.subtitle || model.subtitle || '').trim();
  // Both stamps follow the report's own date format, so every date on the page
  // reads the same way as the dates inside its table.
  const dateFmt = t.date_format || brand.date_format;
  const generatedAt = formatDateToken(model.meta.generated_at, `${dateFmt} HH:mm`);
  const periodLabel = formatPeriod(model, brand, dateFmt);
  const contactBits = [brand.company_name, brand.address, brand.gstin ? `GSTIN ${brand.gstin}` : '', brand.contact_phone]
    .filter(Boolean).join(' · ');

  // The company owns the page, so it leads; the report name sits under it.
  const companyBig = (brand.header_name || brand.company_name || '').trim();
  const companySub =
    brand.header_name && brand.company_name && brand.header_name !== brand.company_name
      ? brand.company_name : '';

  // The two dates a reader must never conflate: the period the figures describe,
  // and the moment the file was produced. A report generated this morning almost
  // always describes yesterday, so both are labelled rather than left as bare
  // dates for the reader to guess between.
  const stamp: Array<[string, string]> = [];
  if (t.show_period && periodLabel) stamp.push(['DATA PERIOD', periodLabel]);
  stamp.push(['GENERATED', generatedAt]);
  /** A real PDF link annotation, not text that merely looks like one. */
  const drawPoweredBy = (rightX: number, y: number, onDark = false) => {
    const txt = 'Powered by QuickApp.ai';
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(7.5);
    if (onDark) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    const w = doc.getTextWidth(txt);
    doc.textWithLink(txt, rightX - w, y, { url: 'https://quickapp.ai/' });
  };

  const drawStamp = (rightX: number, topY: number, muted = 150, strong = 60, onDark = false,
                     items: Array<[string, string]> = stamp) => {
    let y = topY;
    drawPoweredBy(rightX, y, onDark); y += 11;
    for (const [label, value] of items) {
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(6.5); doc.setTextColor(muted);
      doc.text(label, rightX, y, { align: 'right' }); y += 8;
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(8.5); doc.setTextColor(strong);
      doc.text(value, rightX, y, { align: 'right' }); y += 12;
    }
    return y;
  };

  // --- Header band ---
  let cursorY = margin;

  const drawStandardOrCentered = (centered: boolean) => {
    const logoBoxW = centered ? 165 : 105, logoBoxH = centered ? 54 : 46;
    if (centered) {
      const blockW = pageW - margin * 2;
      let y = cursorY;
      if (brand.logo_data_url && brand.logo_format) {
        const f = fitImage(doc, brand.logo_data_url, margin + (blockW - logoBoxW) / 2, y, logoBoxW, logoBoxH);
        doc.addImage(brand.logo_data_url, brand.logo_format, f.x, f.y, f.w, f.h);
        y += logoBoxH + 6;
      }
      if (companyBig) {
        doc.setFont(fontFamily, 'bold'); doc.setFontSize(12); doc.setTextColor(90);
        doc.text(companyBig, pageW / 2, y + 10, { align: 'center' }); y += 14;
      }
      if (companySub) {
        doc.setFont(fontFamily, 'normal'); doc.setFontSize(8); doc.setTextColor(130);
        doc.text(companySub, pageW / 2, y + 8, { align: 'center' }); y += 10;
      }
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(15); doc.setTextColor(20);
      doc.text(displayTitle, pageW / 2, y + 13, { align: 'center' }); y += 18;
      if (displaySubtitle) {
        doc.setFont(fontFamily, 'italic'); doc.setFontSize(9); doc.setTextColor(120);
        doc.text(displaySubtitle, pageW / 2, y + 8, { align: 'center' }); y += 12;
      }
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(8.5); doc.setTextColor(110);
      if (t.show_period && periodLabel) {
        doc.text(`Data period: ${periodLabel}`, pageW / 2, y + 8, { align: 'center' }); y += 11;
      }
      doc.text(`Generated: ${generatedAt}`, pageW / 2, y + 8, { align: 'center' }); y += 11;
      if (t.show_contact_line && contactBits) {
        doc.setFont(fontFamily, 'normal'); doc.setFontSize(8); doc.setTextColor(130);
        doc.text(contactBits, pageW / 2, y + 8, { align: 'center' }); y += 10;
      }
      cursorY = y + 6;
    } else {
      let leftX = margin;
      if (brand.logo_data_url && brand.logo_format) {
        const f = fitImage(doc, brand.logo_data_url, margin, cursorY, logoBoxW, logoBoxH);
        doc.addImage(brand.logo_data_url, brand.logo_format, f.x, f.y, f.w, f.h);
        leftX = margin + logoBoxW + 10;
      }
      let ty = cursorY + 2;
      if (companyBig) {
        doc.setFont(fontFamily, 'bold'); doc.setFontSize(12); doc.setTextColor(90);
        doc.text(companyBig, leftX, ty + 10); ty += 13;
      }
      if (companySub) {
        doc.setFont(fontFamily, 'normal'); doc.setFontSize(8); doc.setTextColor(130);
        doc.text(companySub, leftX, ty + 8); ty += 10;
      }
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(15); doc.setTextColor(20);
      doc.text(displayTitle, leftX, ty + 13); ty += 18;
      if (displaySubtitle) {
        doc.setFont(fontFamily, 'italic'); doc.setFontSize(9); doc.setTextColor(120);
        doc.text(displaySubtitle, leftX, ty + 8); ty += 12;
      }
      if (t.show_contact_line && contactBits) {
        doc.setFont(fontFamily, 'normal'); doc.setFontSize(8); doc.setTextColor(130);
        doc.text(contactBits, leftX, ty + 8); ty += 10;
      }
      const sStampEnd = drawStamp(pageW - margin, cursorY + 10);
      cursorY = Math.max(ty, cursorY + logoBoxH, sStampEnd - 4) + 6;
    }
    doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    doc.rect(margin, cursorY, pageW - margin * 2, 2.5, 'F');
    cursorY += 10;
  };

  const drawBand = () => {
    // Dark, professional masthead: white logo plate on the left, company +
    // report title beside it, period/date range right-aligned.
    const bandH = 78;
    const bandW = pageW - margin * 2;
    doc.setFillColor(bandRgb[0], bandRgb[1], bandRgb[2]);
    doc.roundedRect(margin, cursorY, bandW, bandH, 4, 4, 'F');

    let x = margin + 14;
    if (brand.logo_data_url && brand.logo_format) {
      const plateW = 104, plateH = 54;
      const plateY = cursorY + (bandH - plateH) / 2;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, plateY, plateW, plateH, 3, 3, 'F');
      const f = fitImage(doc, brand.logo_data_url, x + 6, plateY + 5, plateW - 12, plateH - 10);
      doc.addImage(brand.logo_data_url, brand.logo_format, f.x, f.y, f.w, f.h);
      x += plateW + 14;
    }

    doc.setTextColor(255);
    let ty = cursorY + (companyBig ? 24 : 38);
    if (companyBig) {
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(10);
      doc.setTextColor(215);
      doc.text(companyBig, x, ty);
      ty += 17;
    }
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(15);
    doc.setTextColor(255);
    doc.text(displayTitle, x, ty);

    // Light on dark, so the stamp inverts rather than disappearing.
    drawStamp(pageW - margin - 14, cursorY + 15, 190, 255, true);
    cursorY += bandH + 14;
  };



  const drawCompact = () => {
    const logoBoxW = 84, logoBoxH = 30;
    let leftX = margin;
    if (brand.logo_data_url && brand.logo_format) {
      const f = fitImage(doc, brand.logo_data_url, margin, cursorY, logoBoxW, logoBoxH);
      doc.addImage(brand.logo_data_url, brand.logo_format, f.x, f.y, f.w, f.h);
      leftX = margin + logoBoxW + 8;
    }
    if (companyBig) {
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(9.5); doc.setTextColor(110);
      doc.text(companyBig, leftX, cursorY + 11);
    }
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(12.5); doc.setTextColor(20);
    doc.text(displayTitle, leftX, cursorY + 25);
    const cStampEnd = drawStamp(pageW - margin, cursorY + 8);
    cursorY = Math.max(cursorY + Math.max(logoBoxH, 34), cStampEnd - 4) + 4;
    doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    doc.rect(margin, cursorY, pageW - margin * 2, 1.5, 'F');
    cursorY += 8;
  };

  // --- Template headers. Each owns its spacing and closes itself off, so none
  // of them depends on the segmented "Header style" control. ---
  const logoShown = !!brand.logo_data_url && t.branding !== 'none';

  // Executive: an eyebrow, the title, the period on the right, one rule. No fills.
  const drawMast = () => {
    const ty = cursorY;
    let x = margin;
    if (logoShown) {
      const f = fitImage(doc, brand.logo_data_url!, margin, ty, 104, 40);
      doc.addImage(brand.logo_data_url!, brand.logo_format, f.x, f.y, f.w, f.h);
      x = margin + 114;
    }
    if (companyBig) {
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(11.5); doc.setTextColor(105);
      doc.text(companyBig, x, ty + 11);
    }
    doc.setFont(fam(displayTitle, spec.serif), 'bold'); doc.setFontSize(17);
    doc.setTextColor(bandRgb[0], bandRgb[1], bandRgb[2]);
    doc.text(displayTitle, x, ty + 30);
    let sy = ty + 30;
    if (displaySubtitle) {
      doc.setFont(fontFamily, 'italic'); doc.setFontSize(8.5); doc.setTextColor(120);
      doc.text(displaySubtitle, x, sy + 13); sy += 13;
    }
    // The period the figures describe belongs with the name of the report, not
    // in the corner beside the moment the file was made. Only the mast reads
    // this way; the other headers keep both dates stacked on the right.
    if (t.show_period && periodLabel) {
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(9); doc.setTextColor(110);
      doc.text(`Data period: ${periodLabel}`, x, sy + 14); sy += 14;
    }
    const stampEnd = drawStamp(pageW - margin, ty + 10, 150, 60, false,
      stamp.filter(([label]) => label !== 'DATA PERIOD'));
    if (t.show_contact_line && contactBits) {
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(7.5); doc.setTextColor(145);
      doc.text(contactBits, pageW - margin, stampEnd, { align: 'right' });
    }
    cursorY = Math.max(sy + 10, stampEnd - 2, ty + 46);
    doc.setFillColor(bandRgb[0], bandRgb[1], bandRgb[2]);
    doc.rect(margin, cursorY, pageW - margin * 2, 1.6, 'F');
    cursorY += 13;
  };

  // Operational: one dark bar, as short as it can be and still read.
  const drawBar = () => {
    const h = 32;
    doc.setFillColor(bandRgb[0], bandRgb[1], bandRgb[2]);
    doc.rect(margin, cursorY, pageW - margin * 2, h, 'F');
    let x = margin + 10;
    if (logoShown) {
      const plateW = 88, plateH = 24;
      doc.setFillColor(255, 255, 255);
      doc.rect(x, cursorY + 4, plateW, plateH, 'F');
      const f = fitImage(doc, brand.logo_data_url!, x + 3, cursorY + 7, plateW - 6, plateH - 6);
      doc.addImage(brand.logo_data_url!, brand.logo_format, f.x, f.y, f.w, f.h);
      x += plateW + 8;
    }
    doc.setTextColor(255);
    // Report name leads here too; the company trails it on the same line,
    // because the bar is one line by design.
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(12);
    doc.text(displayTitle, x, cursorY + 20);
    if (companyBig) {
      const w = doc.getTextWidth(displayTitle);
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(8.5); doc.setTextColor(210);
      doc.text(companyBig, x + w + 10, cursorY + 20);
    }
    // One line, because the bar exists to be short.
    const right = [
      t.show_period && periodLabel ? `Data ${periodLabel}` : '',
      `Generated ${generatedAt}`,
    ].filter(Boolean).join('   ·   ');
    doc.setFont(fontFamily, 'normal'); doc.setFontSize(7.5); doc.setTextColor(222);
    const rW = doc.getTextWidth(right);
    doc.text(right, pageW - margin - 10, cursorY + 20, { align: 'right' });
    drawPoweredBy(pageW - margin - 10 - rW - 14, cursorY + 20, true);
    cursorY += h + 6;
  };

  // Editorial: a centred masthead closed by a double rule.
  const drawCentredMast = () => {
    const cx = pageW / 2;
    let ty = cursorY;
    if (logoShown) {
      const f = fitImage(doc, brand.logo_data_url!, cx - 80, ty, 160, 50);
      doc.addImage(brand.logo_data_url!, brand.logo_format, f.x, f.y, f.w, f.h);
      ty += 56;
    }
    if (companyBig) {
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(8);
      doc.setTextColor(brandRgb[0], brandRgb[1], brandRgb[2]);
      // No letter-spacing API in jsPDF; spacing the characters gives the tracked
      // line above the masthead that this template depends on.
      doc.text(companyBig.toUpperCase().split('').join(' '), cx, ty + 9, { align: 'center' });
      ty += 14;
    }
    doc.setFont(fam(displayTitle, spec.serif), 'bold'); doc.setFontSize(18);
    doc.setTextColor(bandRgb[0], bandRgb[1], bandRgb[2]);
    doc.text(displayTitle, cx, ty + 17, { align: 'center' });
    ty += 23;
    if (displaySubtitle) {
      doc.setFont(fontFamily, 'italic'); doc.setFontSize(8.5); doc.setTextColor(140);
      doc.text(displaySubtitle, cx, ty + 9, { align: 'center' }); ty += 13;
    }
    doc.setFont(fontFamily, 'normal'); doc.setFontSize(8); doc.setTextColor(125);
    const edLine = [
      t.show_period && periodLabel ? `Data period ${periodLabel}` : '',
      `Generated ${generatedAt}`,
    ].filter(Boolean).join('   ·   ');
    doc.text(edLine, cx, ty + 9, { align: 'center' }); ty += 13;
    // Centred like everything else in this masthead.
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(7.5);
    drawPoweredBy(cx + doc.getTextWidth('Powered by QuickApp.ai') / 2, ty + 8);
    ty += 12;
    if (t.show_contact_line && contactBits) {
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(7.5); doc.setTextColor(145);
      doc.text(contactBits, cx, ty + 8, { align: 'center' }); ty += 11;
    }
    cursorY = ty + 6;
    doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
    doc.rect(margin, cursorY, pageW - margin * 2, 1.3, 'F');
    doc.rect(margin, cursorY + 4.8, pageW - margin * 2, 0.6, 'F');
    cursorY += 19;
  };

  // Modern: eyebrow and title left, period as a pill on the right.
  const drawCardHeader = () => {
    const ty = cursorY;
    let x = margin;
    if (logoShown) {
      const f = fitImage(doc, brand.logo_data_url!, margin, ty, 92, 36);
      doc.addImage(brand.logo_data_url!, brand.logo_format, f.x, f.y, f.w, f.h);
      x = margin + 102;
    }
    if (companyBig) {
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(11); doc.setTextColor(107, 114, 128);
      doc.text(companyBig, x, ty + 10);
    }
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(15); doc.setTextColor(17, 24, 39);
    doc.text(displayTitle, x, ty + 28);
    let sy = ty + 28;
    if (displaySubtitle) {
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(8.5); doc.setTextColor(120);
      doc.text(displaySubtitle, x, sy + 13); sy += 13;
    }
    const mStampEnd = drawStamp(pageW - margin, ty + 10, 154, 55);
    if (t.show_contact_line && contactBits) {
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(7.5); doc.setTextColor(145);
      doc.text(contactBits, x, sy + 12); sy += 12;
    }
    cursorY = Math.max(sy + 14, mStampEnd + 4, ty + 44);
  };

  const drawHeader = () => {
    if (spec.header === 'mast') return drawMast();
    if (spec.header === 'bar') return drawBar();
    if (spec.header === 'centered') return drawCentredMast();
    if (spec.header === 'card') return drawCardHeader();
    if (t.header_style === 'centered') drawStandardOrCentered(true);
    else if (t.header_style === 'band') drawBand();
    else if (t.header_style === 'compact') drawCompact();
    else drawStandardOrCentered(false);
  };

  drawHeader();

  // --- Meta block: label above value, evenly spaced columns ---
  if (t.include_meta) {
    const items: Array<[string, string]> = [['Generated', generatedAt]];
    if (periodLabel) items.push(['Period', periodLabel]);
    if (model.meta.scope_label) items.push(['Dataset / Scope', model.meta.scope_label]);
    if (model.meta.recipient_name) items.push(['Prepared for', model.meta.recipient_name]);
    // Omitted rather than printed as "None": a report that was not narrowed has
    // nothing to say here, and the remaining columns spread to fill the row.
    if (model.meta.filters_label) items.push(['Filters', model.meta.filters_label]);

    const blockW = pageW - margin * 2;
    const colW = blockW / items.length;
    const blockH = spec.dense ? 28 : 34;
    // The unboxed templates close this strip with a hairline instead of a card,
    // so the one shape they set out to avoid is not reintroduced here.
    const open = spec.radius === 0;
    const padX = open ? 0 : 12;
    if (open) {
      doc.setDrawColor(230);
      doc.line(margin, cursorY + blockH, pageW - margin, cursorY + blockH);
    } else {
      doc.setDrawColor(228);
      doc.setFillColor(250, 250, 249);
      doc.roundedRect(margin, cursorY, blockW, blockH, spec.radius, spec.radius, 'FD');
    }

    items.forEach(([label, value], i) => {
      const x = margin + padX + i * colW;
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(7); doc.setTextColor(150);
      doc.text(label.toUpperCase(), x, cursorY + (spec.dense ? 11 : 13));
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(8.5); doc.setTextColor(60);
      doc.text(doc.splitTextToSize(String(value), colW - padX - 6)[0] ?? '', x, cursorY + (spec.dense ? 22 : 25));
      if (i > 0 && !open) {
        doc.setDrawColor(232);
        doc.line(margin + i * colW, cursorY + 7, margin + i * colW, cursorY + blockH - 7);
      }
    });
    cursorY += blockH + (spec.dense ? 10 : 14);
  }


  const drawKpis = (blk: LayoutBlock) => {
    // --- Count tiles: the measures this report already totals, read at a glance.
    // Reuses model.totals, so a tile can never disagree with the totals row. ---
    if (t.show_kpis && model.totals) {
      // An explicit selection wins, in the order it was chosen, so a report can
      // lead with a figure that is not one of its columns. With none chosen the
      // band falls back to every measure the report already totals.
      // Chosen tiles may name a measure that is not a column, so the lookup spans
      // every column including the hidden ones. The automatic fallback below uses
      // only the visible measures, since nothing was asked for.
      const eligible = model.columns
        .filter(c => c.numeric && c.summable !== false && model.totals![c.key] !== undefined);
      const visible = eligible.filter(c => !c.hidden);

      // A row-per-record report has no present/absent/leave columns — it carries a
      // status word per row — so cards for those counted nothing and disappeared.
      const STATUS_OF: Record<string, string> = {
        present: 'present', absent: 'absent', on_leave: 'leave', half_day: 'half_day_leave',
      };
      const LABEL_OF: Record<string, string> = {
        present: 'Present', absent: 'Absent', on_leave: 'On leave', half_day: 'Half day',
      };
      const derived = (key: string) => {
        const want = STATUS_OF[key];
        if (!want || !model.rows.some(r => 'status' in (r as any))) return null;
        const n = model.rows.filter(r => String((r as any).status ?? '') === want).length;
        return { key, label: LABEL_OF[key] ?? key, numeric: true, currency: false,
                 summable: true, _derived: n } as ReportColumn & { _derived: number };
      };

      // The block's own list wins; t.kpi_keys is what a report chose before
      // cards became a movable block, and still answers for those.
      const chosen = ((blk.keys ?? t.kpi_keys) ?? []).filter(Boolean);
      const tiles = (chosen.length
        ? chosen.map(k => eligible.find(c => c.key === k) ?? derived(k)).filter(Boolean) as ReportColumn[]
        : (visible.length ? visible
           : ['present', 'absent', 'on_leave'].map(derived).filter(Boolean) as ReportColumn[])
      ).slice(0, 6);
      if (tiles.length > 0) {
        const blockW = pageW - margin * 2;
        const fig = (c: ReportColumn) => {
          const v = fmtCell((c as any)._derived ?? model.totals![c.key], c, brand, unicodeSafe);
          // "7,315" leaves the reader guessing; "7,315 KG" does not. Currency
          // already carries its own mark, so a unit there would only repeat it.
          return c.unit && !c.currency ? `${v} ${c.unit}` : v;
        };
        const cap = (c: ReportColumn) => c.label.toUpperCase();
        // A figure that does not fit has to shrink, not lose its tail. Wrapping it
        // and keeping the first line turned "₹ 25,47,547.51" into "₹" as soon as
        // six tiles made the tiles narrow enough to wrap it. The caller sets the
        // font first, because the width is measured in that font.
        const put = (
          str: string, x: number, yy: number, maxW: number,
          start: number, floor: number, align?: 'center',
        ) => {
          let size = start;
          doc.setFontSize(size);
          while (size > floor && doc.getTextWidth(str) > maxW) {
            size -= 0.5;
            doc.setFontSize(size);
          }
          doc.text(str, x, yy, align ? { align } : undefined);
        };

        if (spec.kpi === 'hairline') {
          // Executive: nothing enclosed. The figures are divided by hairlines,
          // which is what makes the band read as quiet rather than dashboard-y.
          const colW = blockW / tiles.length;
          const h = 40;
          tiles.forEach((c, i) => {
            const x = margin + i * colW;
            if (i > 0) { doc.setDrawColor(226); doc.line(x, cursorY + 1, x, cursorY + h - 7); }
            const tx = x + (i === 0 ? 0 : 12);
            const w = colW - (i === 0 ? 14 : 24);
            doc.setFont(fam(fig(c), spec.serif), 'bold');
            doc.setTextColor(bandRgb[0], bandRgb[1], bandRgb[2]);
            put(fig(c), tx, cursorY + 20, w, 19, 10);
            doc.setFont(fontFamily, 'normal'); doc.setTextColor(140);
            put(cap(c), tx, cursorY + 33, w, 6.5, 5);
          });
          cursorY += h + 12;
        } else if (spec.kpi === 'strip') {
          // Operational: label over figure in one 30pt strip. Every point saved
          // here is a row kept on the page, which is the whole point of this one.
          const h = 30;
          const colW = blockW / tiles.length;
          doc.setFillColor(headFillRgb[0], headFillRgb[1], headFillRgb[2]);
          doc.setDrawColor(217, 224, 232);
          doc.rect(margin, cursorY, blockW, h, 'FD');
          tiles.forEach((c, i) => {
            const x = margin + i * colW;
            if (i > 0) { doc.setDrawColor(228, 233, 239); doc.line(x, cursorY, x, cursorY + h); }
            doc.setFont(fontFamily, 'bold');
            doc.setTextColor(headTextRgb[0], headTextRgb[1], headTextRgb[2]);
            put(cap(c), x + 8, cursorY + 11, colW - 14, 6.5, 5);
            doc.setFont(fontFamily, 'bold');
            doc.setTextColor(bandRgb[0], bandRgb[1], bandRgb[2]);
            put(fig(c), x + 8, cursorY + 24, colW - 14, 12, 7.5);
          });
          cursorY += h + 10;
        } else if (spec.kpi === 'centered') {
          // Editorial: centred in equal columns, no rules at all.
          const colW = blockW / tiles.length;
          const h = 40;
          tiles.forEach((c, i) => {
            const cx = margin + i * colW + colW / 2;
            doc.setFont(fam(fig(c), spec.serif), 'bold');
            doc.setTextColor(bandRgb[0], bandRgb[1], bandRgb[2]);
            put(fig(c), cx, cursorY + 18, colW - 10, 18, 10, 'center');
            doc.setFont(fontFamily, 'normal');
            doc.setTextColor(brandRgb[0], brandRgb[1], brandRgb[2]);
            put(cap(c), cx, cursorY + 31, colW - 10, 6.5, 5, 'center');
          });
          cursorY += h + 12;
        } else {
          // Classic and Modern: cards. Modern fills the first one so the headline
          // figure separates from the counts beside it.
          const gap = 8;
          const tileW = (blockW - gap * (tiles.length - 1)) / tiles.length;
          const tileH = 44;
          tiles.forEach((c, i) => {
            const x = margin + i * (tileW + gap);
            const isHero = spec.heroTile && i === 0;
            if (isHero) {
              doc.setFillColor(bandRgb[0], bandRgb[1], bandRgb[2]);
              doc.setDrawColor(bandRgb[0], bandRgb[1], bandRgb[2]);
            } else {
              doc.setDrawColor(228); doc.setFillColor(252, 252, 251);
            }
            doc.roundedRect(x, cursorY, tileW, tileH, spec.radius, spec.radius, 'FD');
            if (spec.cardRule) {
              // Brand rule along the top edge, so the band reads as one unit.
              doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
              doc.rect(x + 3, cursorY, tileW - 6, 2, 'F');
            }
            doc.setFont(fontFamily, 'bold');
            doc.setTextColor(isHero ? 255 : 40);
            put(fig(c), x + 10, cursorY + 24, tileW - 20, 14, 8);
            doc.setFont(fontFamily, 'normal');
            if (isHero) doc.setTextColor(205, 205, 205); else doc.setTextColor(140);
            put(cap(c), x + 10, cursorY + 36, tileW - 20, 7, 5);
          });
          cursorY += tileH + 14;
        }
      }
    }
  };

  const drawTable = () => {
    // --- Wide-column handling: split into chunks that fit ---
    const isEmpty = model.rows.length === 0;
    // Measures carried only for a KPI tile are totalled but never printed, so the
    // table shows exactly the columns the report was built with.
    const cols = model.columns.filter(c => !c.hidden);
    const rowLabelCount = 1; // first column repeats

    // Usable text width per column, once 16pt of horizontal cell padding is taken
    // out, has to stay wide enough for real values ("Vijayanagar & Kuvempunagar",
    // "A01 Aruna Chicken Sukka Masala 200G"). The old 12/7 packed 13 columns onto
    // one landscape page at ~48pt of text each — under ten characters — so every
    // column wrapped and rows grew to a dozen lines tall.
    // --- What each column actually needs to be wide ---
    // A flat column count charged a four-digit figure the same width as a
    // retailer name, so an eleven-column landscape report spilled onto a second
    // page while 200pt of the first sat empty. Measure the real content instead.
    const usableW0 = pageW - margin * 2;
    const cellPad = spec.dense ? 14 : 16;
    // Kept in step with headStyles/footStyles.fontSize below; must not drift.
    const headSizeFor = (body: number) => Math.max(6.5, body - 0.5);
    const footSizeFor = (body: number) => Math.max(6.5, body);
    const sampleRows = Math.min(model.rows.length, 400);
    const needAt = (c: (typeof cols)[number], size: number) => {
      // A heading wraps at its spaces, so its longest word must fit a line --
      // but let it wrap no further than two, because a four-line heading costs
      // more height than the width it saves. Measured at the size the head is
      // actually drawn at: in portrait the body shrinks past the head's floor,
      // and half a point there is the difference between "Unproductive"
      // fitting and breaking across two lines.
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(headSizeFor(size));
      const label = String(c.label ?? '');
      let widest = Math.max(
        label.split(/\s+/).reduce((w, word) => Math.max(w, doc.getTextWidth(word)), 0),
        Math.ceil(doc.getTextWidth(label) / 2) + 4,
      );
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(size);
      const measure = (v: unknown) => {
        const s = String(fmtCell(v, c, brand, unicodeSafe, t.date_format) ?? '');
        // Figures must never wrap.
        if (c.numeric) { widest = Math.max(widest, doc.getTextWidth(s)); return; }
        // Text may wrap, so a long value is capped at a sane column -- but never
        // mid-word, so its longest word is the floor. Without it the fit test
        // passed on a width that then broke "Unproductive" across two lines.
        const word = s.split(/\s+/)
          .reduce((w: number, part: string) => Math.max(w, doc.getTextWidth(part)), 0);
        widest = Math.max(widest, Math.min(doc.getTextWidth(s), 130), word);
      };
      for (let i = 0; i < sampleRows; i++) measure(model.rows[i][c.key]);
      // The totals row carries the widest figure in the report by definition,
      // and autoTable sets it bold at its own size, so it is measured that way
      // -- otherwise a total alone wraps, as "₹8,39,852" did.
      if (c.numeric && model.totals) {
        const tv = (model.totals as any)[c.key];
        if (tv !== undefined && tv !== null) {
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(footSizeFor(size));
          measure(tv);
          doc.setFont(fontFamily, 'normal');
          doc.setFontSize(size);
        }
      }
      return Math.ceil(widest) + cellPad;
    };

    const shrinkFontFloor = 6;
    let chunks: number[][] = [];
    let colWidths: number[] = [];
    let bodyFontSize = spec.dense ? 8 : 9;

    if (isEmpty) {
      chunks = [cols.map((_, i) => i)];
    } else {
      // Shrink before spilling: one slightly smaller table reads far better than
      // the same rows split across two pages that have to be compared side by side.
      const ladder = [bodyFontSize, bodyFontSize - 1, bodyFontSize - 2, shrinkFontFloor]
        .filter((s, i, a) => s >= shrinkFontFloor && a.indexOf(s) === i);
      let fits = false;
      for (const size of ladder) {
        bodyFontSize = size;
        colWidths = cols.map(c => needAt(c, size));
        if (colWidths.reduce((a, b) => a + b, 0) <= usableW0) { fits = true; break; }
      }
      if (fits) {
        chunks = [cols.map((_, i) => i)];
      } else {
        // Genuinely too wide even at the floor: spill, but pack each chunk by the
        // width it needs rather than by a fixed count, repeating the row label.
        const rowLabelIdx = 0;
        const budget = Math.max(1, usableW0 - colWidths[rowLabelIdx]);
        const rest = cols.map((_, i) => i).filter(i => i !== rowLabelIdx);
        let run: number[] = [];
        let used = 0;
        for (const i of rest) {
          if (run.length && used + colWidths[i] > budget) {
            chunks.push([rowLabelIdx, ...run]);
            run = []; used = 0;
          }
          run.push(i); used += colWidths[i];
        }
        if (run.length) chunks.push([rowLabelIdx, ...run]);
        // A trailing chunk carrying one figure beside the row label is not worth a
        // page of its own — fold it back into the chunk before it.
        if (chunks.length > 1 && chunks[chunks.length - 1].length <= rowLabelCount + 1) {
          const tail = chunks.pop()!;
          chunks[chunks.length - 1].push(...tail.slice(rowLabelCount));
        }
      }
    }

    // Only group on a column this report actually has; a stale key from an
    // edited report must not silently blank the table.
    const groupKey = t.group_by && cols.some(c => c.key === t.group_by) ? t.group_by : null;

    const totalsRow = t.include_totals && model.totals
      ? cols.map((c) => {
          if (!c.numeric) return '';
          const v = (model.totals as any)[c.key];
          return v === undefined || v === null ? '' : fmtCell(v, c, brand, unicodeSafe, t.date_format);
        })
      : null;

    chunks.forEach((chunkIdxs, chunkI) => {
      if (chunkI > 0) {
        doc.addPage();
        cursorY = margin;
        doc.setFont(fontFamily, 'italic'); doc.setFontSize(9); doc.setTextColor(120);
        const first = chunkIdxs[1] ?? chunkIdxs[0];
        const last = chunkIdxs[chunkIdxs.length - 1];
        doc.text(`${displayTitle} — columns ${first + 1}–${last + 1}, continued`, margin, cursorY + 10);
        cursorY += 18;
      }

      const head = [chunkIdxs.map(i => cols[i].label)];

      // Rows, with a subtotal line closing each group. The grouping column is
      // read from the ROW, not the chunk, so a wide table split across pages
      // still groups by the same field on every chunk.
      const groupCol = groupKey ? cols.find(c => c.key === groupKey) : null;
      const bodyRows: any[] = [];
      const dataRows: Array<any | null> = [];
      if (!isEmpty) {
        const cells = (r: any) =>
          chunkIdxs.map(i => fmtCell(r[cols[i].key], cols[i], brand, unicodeSafe, t.date_format));

        if (!groupCol) {
          model.rows.forEach(r => { bodyRows.push(cells(r)); dataRows.push(r); });
        } else {
          const subtotalFor = (run: any[], label: string) =>
            chunkIdxs.map((i, idx) => {
              const c = cols[i];
              if (idx === 0) return `${label} — ${run.length} row${run.length === 1 ? '' : 's'}`;
              // Only a genuinely additive measure may be summed. An average or
              // a rank added up is a number that means nothing.
              if (!c.numeric || c.summable === false) return '';
              const sum = run.reduce((acc, r) => {
                const n = Number(r[c.key]);
                return Number.isFinite(n) ? acc + n : acc;
              }, 0);
              return fmtCell(sum, c, brand, unicodeSafe, t.date_format);
            });

          let run: any[] = [];
          let runKey: any;
          const flush = () => {
            // A one-row group's subtotal is that row again. Printing it adds a
            // line and says nothing.
            if (run.length < 2) { run = []; return; }
            const label = String(run[0][groupCol.key] ?? '—');
            bodyRows.push({ _subtotal: true, cells: subtotalFor(run, label) });
            dataRows.push(null);
            run = [];
          };
          model.rows.forEach(r => {
            const k = r[groupCol.key];
            if (run.length && k !== runKey) flush();
            runKey = k;
            run.push(r);
            bodyRows.push(cells(r));
            dataRows.push(r);
          });
          flush();
        }
      }

      // autoTable wants plain arrays; the marker rides alongside by index.
      // sourceRow maps a RENDERED row back to the data row behind it -- null on
      // a subtotal. Without it, inserting subtotals shifts every index and the
      // per-cell lookups below start reading the wrong row.
      const subtotalRowIdx = new Set<number>();
      const sourceRow = dataRows;
      const body = isEmpty
        ? [[{ content: 'No records for this period.', colSpan: chunkIdxs.length, styles: { halign: 'center', textColor: 120 } }]]
        : bodyRows.map((r, i) => {
            if (r && r._subtotal) { subtotalRowIdx.add(i); return r.cells; }
            return r;
          });
      const foot = totalsRow
        ? [chunkIdxs.map((i, idx) => (idx === 0 && !cols[i].numeric ? 'Total' : totalsRow[i]))]
        : undefined;

      // Column sizing: numeric columns fit to content (so long values like
      // totals are never truncated), the dimension column takes the remaining
      // width. Alignment: numerics right, dimension left — applied to head,
      // body and foot via columnStyles.
      // Every column carries a minCellWidth. Previously the first column was the
      // only flexible one ('auto') while the rest were 'wrap'; once the wrap
      // columns overflowed the table, autoTable squeezed that single flexible
      // column down to one character, printing values vertically (P/I/E/C/E).
      const usableW = pageW - margin * 2;
      const minText = bodyFontSize <= 7 ? 34 : 40; // + 16pt padding
      const minCellWidth = Math.max(
        28,
        Math.min(minText, Math.floor(usableW / Math.max(1, chunkIdxs.length)) - 4)
      );
      // The table spans the page, so the slack has to land somewhere. Spreading
      // it evenly over every column opened gulfs between the figures. Pinning
      // each figure column to the width it measured hands the slack to the text
      // columns instead, which is where long beat and retailer names need it.
      const hasTextCol = chunkIdxs.some(ci => !cols[ci].numeric);
      const columnStyles: Record<number, any> = {};
      chunkIdxs.forEach((ci, idx) => {
        const c = cols[ci];
        if (c.numeric) {
          const fixed = hasTextCol && colWidths[ci] ? colWidths[ci] : 'auto';
          columnStyles[idx] = { halign: 'right', cellWidth: fixed, minCellWidth };
        } else if (idx === 0) {
          columnStyles[idx] = { halign: 'left', cellWidth: 'auto', minCellWidth, fontStyle: 'bold' };
        } else {
          columnStyles[idx] = { halign: 'left', cellWidth: 'auto', minCellWidth };
        }
      });

      // --- Table style, per template. 'hairline' with no mast reproduces the
      // original exactly, so Classic is byte-for-byte what it always was. ---
      const pad = spec.dense
        ? { top: 3.5, right: 7, bottom: 3.5, left: 7 }
        : { top: 6, right: 8, bottom: 6, left: 8 };
      const headPad = spec.dense
        ? { top: 4.5, right: 7, bottom: 4.5, left: 7 }
        : { top: 7, right: 8, bottom: 7, left: 8 };
      const openHead = spec.table === 'dotted' || spec.table === 'hairline' && spec.header === 'mast';
      const bodyLine: [number, number, number] =
        spec.table === 'dotted' ? [221, 210, 192]
        : spec.table === 'zebra' ? [239, 243, 247]
        : spec.table === 'soft' ? [241, 243, 247]
        : [235, 235, 233];
      // Every template reads its table head from the theme, so the two controls
      // genuinely combine: Amber tints Modern's head row and Executive's column
      // labels, not only Classic's. Only the open-head templates skip the fill,
      // because not having one is the point of them.
      const headFill: any = openHead ? false : headFillRgb;
      const headText: [number, number, number] =
        openHead && spec.table === 'dotted' ? brandRgb : headTextRgb;
      const headRule: [number, number, number] = openHead ? bandRgb : [205, 205, 200];

      autoTable(doc, {
        head, body, foot: foot as any,
        startY: cursorY,
        margin: { left: margin, right: margin, bottom: margin + 24 },
        tableWidth: pageW - margin * 2,
        theme: 'plain',
        styles: {
          font: fontFamily,
          fontSize: bodyFontSize,
          cellPadding: pad,
          overflow: 'linebreak',
          valign: 'middle',
          textColor: [45, 45, 45],
          lineColor: bodyLine,
          lineWidth: { top: 0, right: 0, bottom: 0.5, left: 0 } as any,
          minCellHeight: spec.dense ? 13 : 18,
        },
        ...(spec.table === 'zebra'
          ? { alternateRowStyles: { fillColor: [248, 250, 252] as any } }
          : {}),
        headStyles: {
          fillColor: headFill,
          textColor: headText,
          fontStyle: 'bold',
          fontSize: headSizeFor(bodyFontSize),
          font: fontFamily,
          lineColor: headRule,
          lineWidth: { top: 0, right: 0, bottom: openHead ? 1 : 0.8, left: 0 } as any,
          cellPadding: headPad,
        },
        // The grand total belongs at the end of the report, not at the foot of
        // every page -- repeated, it reads as a page total and is wrong.
        showFoot: 'lastPage',
        footStyles: {
          fillColor: openHead ? false : [252, 252, 251],
          textColor: [17, 17, 17],
          fontStyle: 'bold',
          fontSize: footSizeFor(bodyFontSize),
          font: fontFamily,
          lineColor: openHead ? bandRgb : [120, 120, 118],
          lineWidth: { top: openHead ? 1.6 : 1.2, right: 0, bottom: 0, left: 0 } as any,
          cellPadding: headPad,
        },
        columnStyles,
        // columnStyles only apply to BODY cells in jspdf-autotable v3, which is
        // why headers/totals used to drift left while numbers were right-aligned.
        // Force head + foot to inherit the column's alignment.
        didParseCell: (data: any) => {
          if (data.section === 'head' || data.section === 'foot') {
            const st = columnStyles[data.column.index];
            if (st?.halign) data.cell.styles.halign = st.halign;
          }
          // A column declared 'vs100' is a comparison, not a measurement: 100
          // is par, so each cell carries its own verdict rather than making the
          // reader hold the line in their head down forty rows.
          if (data.section === 'body') {
            const col = cols[chunkIdxs[data.column.index]];
            // A subtotal closes its group: grey band, bold, and no per-cell
            // verdict -- a group's average against par is not the row's.
            if (subtotalRowIdx.has(data.row.index)) {
              data.cell.styles.fillColor = [238, 240, 245];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [40, 44, 60];
            } else if (col?.tone === 'vs100') {
              const n = Number(sourceRow[data.row.index]?.[col.key]);
              if (Number.isFinite(n)) {
                data.cell.styles.textColor = n >= 100 ? [22, 130, 85] : [176, 58, 58];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
          // A cell is drawn in one font, so each one takes the family that can
          // render its own text rather than the table's default.
          const text = Array.isArray(data.cell.text) ? data.cell.text.join('') : String(data.cell.text ?? '');
          const f = scriptFamily(text);
          if (f) data.cell.styles.font = f;
        },
      });

    });
    // Hand the cursor on so whatever is ordered after the table starts below it.
    cursorY = (doc as any).lastAutoTable?.finalY ?? cursorY;
  };

  const drawSummary = () => {
    // The summary block carries its own settings; find it once.
    const aiBlk = (t.blocks ?? []).find(b => b?.type === 'ai_summary') as LayoutBlock | undefined;
    if (!model.meta.ai_summary) return;

    const blockW = pageW - margin * 2;
    doc.setFontSize(9);
    const paras = String(model.meta.ai_summary).split('\n').map(x => x.trim()).filter(Boolean);
    // A two-section note comes back with bare capitalised markers whatever the
    // author renamed the halves to, so the split never depends on the labels.
    const HEAD = /^(HIGHLIGHTS|AREAS FOR IMPROVEMENT)$/i;

    // Parse the note into any opening line and the labelled halves after it.
    const halves: Array<{ label: string; good: boolean; points: string[] }> = [];
    const openers: string[] = [];
    paras.forEach((para) => {
      if (HEAD.test(para)) {
        const good = /^HIGHLIGHTS$/i.test(para);
        const named = good ? aiBlk?.high_label : aiBlk?.low_label;
        halves.push({ label: String(named || para).toUpperCase(), good, points: [] });
      } else if (halves.length) {
        halves[halves.length - 1].points.push(para);
      } else {
        openers.push(para);
      }
    });
    // A half the model left empty is dropped rather than drawn over nothing.
    const filled = halves.filter(h => h.points.length > 0);

    const LINE = 12;
    const GAP = 3;

    // --- Two filled halves: a panel each, side by side. A note that has to be
    // read as two verdicts reads as two objects, not as one undifferentiated
    // list. Every template, squared off where the template has no radius --
    // the two verdicts are the point, and a reader asked for the boxes. ---
    if (filled.length === 2 && openers.length === 0) {
      const EYEBROW = 16, PAD = 12, BAND = 17, gutter = 14;
      const panelW = (blockW - gutter) / 2;
      const textW = panelW - PAD * 2 - 11;
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(9);
      // A line is measured in the family it will be drawn in, or a Devanagari
      // beat name is wrapped against Latin metrics and then drawn as nothing.
      const wrapped = filled.map(h => h.points.map(p => {
        doc.setFont(fam(p, false), 'normal');
        return doc.splitTextToSize(p, textW) as string[];
      }));
      const bodyH = (w: string[][]) =>
        w.reduce((a, ls) => a + ls.length * LINE, 0) + Math.max(0, w.length - 1) * GAP;
      // Both panels take the taller one's height, so the pair reads as a pair.
      const panelH = BAND + PAD + Math.max(...wrapped.map(bodyH)) + PAD - 2;
      const blockH = EYEBROW + panelH;

      let y = cursorY + 16;
      if (y + blockH > pageH - margin - 24) { doc.addPage(); y = margin; }

      doc.setFont(fontFamily, 'bold'); doc.setFontSize(7); doc.setTextColor(150);
      doc.text('SUMMARY', margin, y + 8);

      const top = y + EYEBROW;
      const r = spec.radius;
      filled.forEach((h, hi) => {
        const x = margin + hi * (panelW + gutter);
        const ink: [number, number, number] = h.good ? [22, 130, 85] : [176, 58, 58];
        const tint: [number, number, number] = h.good ? [237, 247, 241] : [253, 240, 240];

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, top, panelW, panelH, r, r, 'F');
        // The heading sits in its own tinted band, so which half is which reads
        // before a word of either is. Square off the band's lower corners.
        doc.setFillColor(tint[0], tint[1], tint[2]);
        doc.roundedRect(x, top, panelW, BAND, r, r, 'F');
        if (r > 0) doc.rect(x, top + BAND - r, panelW, r, 'F');
        doc.setDrawColor(228); doc.setLineWidth(0.5);
        doc.line(x, top + BAND, x + panelW, top + BAND);
        // Outline last, so it sits over the fills rather than under them.
        doc.roundedRect(x, top, panelW, panelH, r, r, 'S');
        doc.setLineWidth(0.2);

        doc.setFont(fam(h.label, false), 'bold'); doc.setFontSize(7.5);
        doc.setTextColor(ink[0], ink[1], ink[2]);
        doc.text(h.label, x + PAD, top + 11.5);

        let ty = top + BAND + PAD + 2;
        wrapped[hi].forEach((ls, pi) => {
          if (pi > 0) ty += GAP;
          // Drawn as a disc rather than typed: the summary may be set in a
          // script font that carries no bullet glyph of its own.
          doc.setFillColor(ink[0], ink[1], ink[2]);
          doc.circle(x + PAD + 3, ty - 3, 1.4, 'F');
          doc.setFontSize(9); doc.setTextColor(70);
          ls.forEach((ln, li) => {
            doc.setFont(fam(ln, false), 'normal');
            doc.text(ln, x + PAD + 11, ty + li * LINE);
          });
          ty += ls.length * LINE;
        });
      });
      cursorY = top + panelH;
      return;
    }

    // --- Everything else: one card. A short note, a single half, an opening
    // line before the headings, or a template that does not draw boxes. ---
    {
      const textW = blockW - 28;
      const lines: Array<{ text: string; lead: boolean; head?: boolean; good?: boolean;
                          bullet?: boolean; indent?: number }> = [];
      let seenHead = false;
      paras.forEach((para, pi) => {
        if (HEAD.test(para)) {
          const good = /^HIGHLIGHTS$/i.test(para);
          const named = good ? aiBlk?.high_label : aiBlk?.low_label;
          seenHead = true;
          lines.push({ text: String(named || para).toUpperCase(), lead: false, head: true, good });
          return;
        }
        const lead = !seenHead && pi === 0;
        const point = seenHead;
        const indent = point ? 11 : 0;
        doc.setFont(fam(para, false), lead ? 'bold' : 'normal');
        (doc.splitTextToSize(para, textW - indent) as string[])
          .forEach((ln, li) => lines.push({ text: ln, lead, indent, bullet: point && li === 0 }));
      });
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].head && (i === lines.length - 1 || lines[i + 1]?.head)) lines.splice(i, 1);
      }
      const headGaps = lines.filter((l, i) => l.head && i > 0).length;
      const pointGaps = lines.filter((l, i) => l.bullet && i > 0 && !lines[i - 1]?.head).length;
      const blockH = 26 + lines.length * LINE + headGaps * 6 + pointGaps * GAP
        + (paras.length > 1 ? 4 : 0);

      let y = cursorY + 16;
      if (y + blockH > pageH - margin - 24) { doc.addPage(); y = margin; }

      if (spec.radius === 0) {
        doc.setDrawColor(brandRgb[0], brandRgb[1], brandRgb[2]);
        doc.setLineWidth(1);
        doc.line(margin, y, pageW - margin, y);
        doc.setDrawColor(226); doc.setLineWidth(0.5);
        doc.line(margin, y + blockH, pageW - margin, y + blockH);
        doc.setLineWidth(0.2);
      } else {
        doc.setDrawColor(228);
        doc.setFillColor(250, 250, 249);
        doc.roundedRect(margin, y, blockW, blockH, spec.radius, spec.radius, 'FD');
        doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
        doc.rect(margin, y + 3, 2.5, blockH - 6, 'F');
      }

      doc.setFont(fontFamily, 'bold'); doc.setFontSize(7); doc.setTextColor(150);
      doc.text('SUMMARY', margin + 14, y + 14);
      let ty2 = y + 28;
      lines.forEach((ln, i) => {
        if (ln.head) {
          if (i > 0) ty2 += 6;
          doc.setFont(fontFamily, 'bold'); doc.setFontSize(7);
          if (ln.good) doc.setTextColor(22, 130, 85); else doc.setTextColor(170, 60, 60);
          doc.text(ln.text, margin + 14, ty2);
        } else {
          if (ln.bullet && i > 0 && !lines[i - 1]?.head) ty2 += GAP;
          doc.setFont(fam(ln.text, false), ln.lead ? 'bold' : 'normal'); doc.setFontSize(9);
          if (ln.bullet) {
            doc.setFillColor(168, 168, 168);
            doc.circle(margin + 17, ty2 - 3, 1.4, 'F');
          }
          doc.setTextColor(ln.lead ? 35 : 70);
          doc.text(ln.text, margin + 14 + (ln.indent ?? 0), ty2);
        }
        ty2 += LINE;
      });
      cursorY = y + blockH;
    }
  };

  /**
   * Charts, drawn with jsPDF primitives.
   *
   * There is no charting library on this side of the app: recharts runs in a
   * browser and a scheduled report renders on a server, so bars, lines and
   * slices are built from rectangles, straight lines and polygons. The output
   * is vector, so it stays sharp at any zoom, and it costs no new dependency.
   *
   * The numbers come from the same rows the table prints, grouped here, so a
   * chart and the table beneath it can never disagree.
   */
  // The accent leads, then a fixed set. A preset whose accent already IS one of
  // them would otherwise draw two series in the same colour, which is how a
  // grouped bar chart stops being readable.
  const HEX6 = /^#?([0-9a-fA-F]{6})$/;
  const chartPalette = (lead?: string | null): Array<[number, number, number]> => {
    const rest: Array<[number, number, number]> = [
      [37, 99, 235], [13, 148, 136], [217, 119, 6], [147, 51, 234], [220, 38, 38], [71, 85, 105],
    ];
    const m = lead ? HEX6.exec(lead.trim()) : null;
    const head: [number, number, number] = m ? hexToRgb(m[1]) : brandRgb;
    const near = (a: [number, number, number], b: [number, number, number]) =>
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 48;
    return [head, ...rest.filter(c => !near(c, head))];
  };

  const drawChart = (blk: LayoutBlock) => {
    const xKey = blk.x ?? null;
    const yKeys = (blk.y ?? []).filter(Boolean);
    if (!xKey || yKeys.length === 0 || model.rows.length === 0) return;

    const colOf = (k: string) => model.columns.find(c => c.key === k) ?? null;
    const label = (k: string) => colOf(k)?.label ?? humanise(k);

    // Group the rows by the category, summing each measure.
    const byCat = new Map<string, number[]>();
    for (const r of model.rows) {
      const cat = String((r as any)[xKey] ?? '').trim() || '—';
      const cur = byCat.get(cat) ?? yKeys.map(() => 0);
      yKeys.forEach((k, i) => { cur[i] += Number((r as any)[k] ?? 0) || 0; });
      byCat.set(cat, cur);
    }
    let cats = Array.from(byCat.entries());
    if (cats.length === 0) return;

    // A date axis runs forwards. Rows arrive in the report's own sort order,
    // which is usually newest first, and a line drawn in that order shows the
    // month running backwards.
    const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
    const dateAxis = cats.every(c => ISO_DAY.test(c[0]));
    if (dateAxis) cats.sort((a, b) => a[0].localeCompare(b[0]));

    // Biggest first, then "Others" — a chart of forty retailers reads as noise,
    // and the tail still has to be in the total or the picture lies.
    const limit = Math.max(0, Number(blk.limit ?? 0));
    // An "Others" bar adds the tail up, which is only honest for a measure that
    // adds up. Summing an average — drop size, beat AOV — would print a number
    // that means nothing, so for those the tail is simply not drawn and the
    // heading says the chart is a top N.
    const additive = yKeys.every(k => (colOf(k)?.summable ?? true) !== false);
    if (limit > 0 && cats.length > limit) {
      // Biggest first — except on a date axis, where the order IS the meaning.
      if (!dateAxis) cats.sort((a, b) => b[1][0] - a[1][0]);
      const keep = cats.slice(0, limit);
      const rest = cats.slice(limit);
      if (additive) {
        const others = yKeys.map((_, i) => rest.reduce((sum, c) => sum + c[1][i], 0));
        cats = [...keep, [`Others (${rest.length})`, others] as [string, number[]]];
      } else {
        cats = keep;
      }
    }

    // A chart can lead in its own colour, so two charts on one page are told
    // apart at a glance rather than by reading their headings.
    const INK = chartPalette(blk.color);
    const kind = blk.chart ?? 'bar';
    const horizontal = kind === 'bar' && blk.orientation === 'horizontal';
    const blockW = pageW - margin * 2;
    const titleH = 18;
    const plotH = Math.max(110, Math.min(230, horizontal ? 26 + cats.length * 20 : 150));
    const legendH = yKeys.length > 1 ? 14 : 0;
    const totalH = titleH + plotH + legendH + 24;

    if (cursorY + totalH > pageH - margin - 20) { doc.addPage(); cursorY = margin; }

    const top = cursorY;
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(9); doc.setTextColor(40);
    const headline = blk.title
      || `${label(yKeys[0])} by ${label(xKey)}`
        + (!additive && limit > 0 && byCat.size > limit ? ` — top ${limit}` : '');
    doc.text(headline, margin, top + 10);

    const padL = horizontal ? 104 : 54;
    const padB = horizontal ? 18 : 30;
    const x0 = margin + padL;
    const y0 = top + titleH;
    const w = blockW - padL - 10;
    const h = plotH - padB;

    const fmtVal = (v: number, k: string) => {
      const c = colOf(k);
      return c ? fmtCell(v, c, brand, unicodeSafe, t.date_format) : String(Math.round(v));
    };
    const short = (v: number) =>
      Math.abs(v) >= 1e7 ? (v / 1e7).toFixed(1) + 'Cr'
      : Math.abs(v) >= 1e5 ? (v / 1e5).toFixed(1) + 'L'
      : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'k'
      : String(Math.round(v));
    // The same formatter the table uses, so a date on the axis and a date in
    // the rows beneath it are written the same way.
    const xCol = colOf(xKey);
    const catText = (raw: string) =>
      xCol ? String(fmtCell(raw, xCol, brand, unicodeSafe, t.date_format) || raw) : raw;
    const clip = (str: string, maxW: number) => {
      let out = String(str);
      while (out.length > 1 && doc.getTextWidth(out) > maxW) out = out.slice(0, -1);
      return out === String(str) ? out : out.slice(0, -1) + '…';
    };

    if (kind === 'pie') {
      const vals = cats.map(c => Math.max(0, c[1][0]));
      const sum = vals.reduce((a, b) => a + b, 0);
      if (sum <= 0) { cursorY = top + totalH; return; }
      const cx = margin + 86, cy = y0 + h / 2, rad = Math.min(h / 2 - 4, 68);
      let angle = -Math.PI / 2;
      vals.forEach((v, i) => {
        const sweep = (v / sum) * Math.PI * 2;
        const steps = Math.max(2, Math.ceil((sweep * 180) / Math.PI / 3));
        // A slice is a polygon from the centre out along the arc and back; jsPDF
        // has no filled-arc primitive, so the curve is walked in ~3° steps.
        const pts: Array<[number, number]> = [];
        let px = cx, py = cy;
        for (let sIdx = 0; sIdx <= steps; sIdx++) {
          const a = angle + (sweep * sIdx) / steps;
          const nx = cx + Math.cos(a) * rad, ny = cy + Math.sin(a) * rad;
          pts.push([nx - px, ny - py]); px = nx; py = ny;
        }
        pts.push([cx - px, cy - py]);
        const ink = INK[i % INK.length];
        doc.setFillColor(ink[0], ink[1], ink[2]);
        (doc as any).lines(pts, cx, cy, [1, 1], 'F', true);
        angle += sweep;
      });
      doc.setFont(fontFamily, 'normal'); doc.setFontSize(7.5);
      let ly = y0 + 6;
      cats.forEach((c, i) => {
        if (ly > y0 + h) return;
        const ink = INK[i % INK.length];
        doc.setFillColor(ink[0], ink[1], ink[2]);
        doc.rect(margin + 176, ly - 5, 6, 6, 'F');
        doc.setTextColor(70);
        const pct = sum > 0 ? Math.round((vals[i] / sum) * 100) : 0;
        doc.text(clip(`${catText(c[0])} — ${fmtVal(vals[i], yKeys[0])} (${pct}%)`, blockW - 200),
                 margin + 187, ly);
        ly += 12;
      });
      cursorY = top + totalH;
      return;
    }

    // Shared scale for bars and lines.
    let max = 0;
    cats.forEach(c => yKeys.forEach((_, i) => { if (c[1][i] > max) max = c[1][i]; }));
    if (max <= 0) max = 1;
    const TICKS = 4;

    doc.setFont(fontFamily, 'normal'); doc.setFontSize(6.5); doc.setTextColor(150);
    doc.setDrawColor(232); doc.setLineWidth(0.4);
    for (let i = 0; i <= TICKS; i++) {
      const v = (max / TICKS) * i;
      if (horizontal) {
        const gx = x0 + (w / TICKS) * i;
        doc.line(gx, y0, gx, y0 + h);
        doc.text(short(v), gx, y0 + h + 10, { align: 'center' });
      } else {
        const gy = y0 + h - (h / TICKS) * i;
        doc.line(x0, gy, x0 + w, gy);
        doc.text(short(v), x0 - 6, gy + 2, { align: 'right' });
      }
    }
    doc.setDrawColor(170); doc.setLineWidth(0.6);
    doc.line(x0, y0 + h, x0 + w, y0 + h);
    if (!horizontal) doc.line(x0, y0, x0, y0 + h);

    const slot = (horizontal ? h : w) / cats.length;
    doc.setFontSize(6.5);

    if (kind === 'line') {
      yKeys.forEach((k, si) => {
        const ink = INK[si % INK.length];
        doc.setDrawColor(ink[0], ink[1], ink[2]); doc.setLineWidth(1.2);
        let prev: [number, number] | null = null;
        cats.forEach((c, ci) => {
          const px = x0 + slot * (ci + 0.5);
          const py = y0 + h - (c[1][si] / max) * h;
          if (prev) doc.line(prev[0], prev[1], px, py);
          prev = [px, py];
          doc.setFillColor(ink[0], ink[1], ink[2]);
          doc.circle(px, py, 1.8, 'F');
        });
      });
    } else {
      const groupPad = slot * 0.22;
      const barThick = Math.max(2, (slot - groupPad * 2) / yKeys.length);
      cats.forEach((c, ci) => {
        yKeys.forEach((k, si) => {
          const ink = INK[si % INK.length];
          doc.setFillColor(ink[0], ink[1], ink[2]);
          const v = c[1][si];
          if (horizontal) {
            const by = y0 + slot * ci + groupPad + barThick * si;
            const bw = Math.max(0, (v / max) * w);
            doc.rect(x0, by, bw, Math.max(1.5, barThick - 1), 'F');
            if (yKeys.length === 1) {
              doc.setTextColor(90);
              doc.text(short(v), x0 + bw + 4, by + barThick - 2);
            }
          } else {
            const bx = x0 + slot * ci + groupPad + barThick * si;
            const bh = Math.max(0, (v / max) * h);
            doc.rect(bx, y0 + h - bh, Math.max(1.5, barThick - 1), bh, 'F');
            if (yKeys.length === 1) {
              doc.setTextColor(90);
              doc.text(short(v), bx + barThick / 2, y0 + h - bh - 3, { align: 'center' });
            }
          }
        });
      });
    }

    // Category labels. Horizontal bars get the room for a real name, which is
    // why they are the better choice when the categories are people or beats.
    doc.setFont(fontFamily, 'normal'); doc.setFontSize(6.5); doc.setTextColor(90);
    cats.forEach((c, ci) => {
      if (horizontal) {
        doc.text(clip(catText(c[0]), padL - 10), margin, y0 + slot * (ci + 0.5) + 2);
      } else {
        doc.text(clip(catText(c[0]), slot - 2), x0 + slot * (ci + 0.5), y0 + h + 11, { align: 'center' });
      }
    });

    if (yKeys.length > 1) {
      let lx = x0;
      const ly = y0 + plotH - 2;
      doc.setFontSize(7);
      yKeys.forEach((k, si) => {
        const ink = INK[si % INK.length];
        doc.setFillColor(ink[0], ink[1], ink[2]);
        doc.rect(lx, ly - 5, 6, 6, 'F');
        doc.setTextColor(70);
        const txt = label(k);
        doc.text(txt, lx + 9, ly);
        lx += 9 + doc.getTextWidth(txt) + 14;
      });
    }

    cursorY = top + totalH;
  };

  /**
   * Shared by the leaderboard and the highlights panel: the categories ranked
   * by their first measure. Grouped from the report's own rows, so a ranking
   * can never disagree with the table it sits above.
   */
  const rankCategories = (xKey: string, yKeys: string[]) => {
    const by = new Map<string, number[]>();
    for (const r of model.rows) {
      const cat = String((r as any)[xKey] ?? '').trim();
      if (!cat) continue;
      const cur = by.get(cat) ?? yKeys.map(() => 0);
      yKeys.forEach((k, i) => { cur[i] += Number((r as any)[k] ?? 0) || 0; });
      by.set(cat, cur);
    }
    return Array.from(by.entries()).sort((a, b) => b[1][0] - a[1][0]);
  };

  const colFor = (k: string) => model.columns.find(c => c.key === k) ?? null;
  const labelFor = (k: string) => colFor(k)?.label ?? humanise(k);
  const valueText = (v: number, k: string) => {
    const c = colFor(k);
    return c ? String(fmtCell(v, c, brand, unicodeSafe, t.date_format) ?? v) : String(v);
  };

  /**
   * The leaderboard.
   *
   * A table sorted by revenue already ranks people, but it reads as data; a
   * board reads as a position, which is the point of putting it in front of
   * the team.
   */
  const drawLeaderboard = (blk: LayoutBlock) => {
    const xKey = blk.x ?? null;
    const yKeys = (blk.y ?? []).filter(Boolean).slice(0, 3);
    if (!xKey || yKeys.length === 0) return;
    const all = rankCategories(xKey, yKeys);
    if (!all.length) return;
    const rows = all.slice(0, Math.max(1, Number(blk.limit ?? 10)));

    const blockW = pageW - margin * 2;
    const lineH = spec.dense ? 15 : 17;
    const headH = 30;
    const totalH = headH + rows.length * lineH + 12;
    if (cursorY + totalH > pageH - margin - 20) { doc.addPage(); cursorY = margin; }

    const top = cursorY;
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(9); doc.setTextColor(40);
    doc.text(blk.title || `Leaderboard — ${labelFor(yKeys[0])}`, margin, top + 10);

    const colW = Math.min(110, (blockW - 160) / yKeys.length);
    const rightOf = (i: number) => pageW - margin - (yKeys.length - 1 - i) * colW;

    doc.setFont(fontFamily, 'normal'); doc.setFontSize(6.5); doc.setTextColor(150);
    yKeys.forEach((k, i) => doc.text(labelFor(k).toUpperCase(), rightOf(i), top + 22, { align: 'right' }));
    doc.setDrawColor(226); doc.setLineWidth(0.5);
    doc.line(margin, top + 26, pageW - margin, top + 26);

    rows.forEach((row, i) => {
      const y = top + headH + i * lineH + 4;
      const medal = i < 3;
      // The top three carry the accent; everyone else is plain, so the eye
      // lands on the podium without the rest shouting.
      if (medal) {
        doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
        doc.circle(margin + 6, y - 3, 6, 'F');
        doc.setTextColor(255); doc.setFont(fontFamily, 'bold'); doc.setFontSize(7);
        doc.text(String(i + 1), margin + 6, y - 1, { align: 'center' });
      } else {
        doc.setTextColor(150); doc.setFont(fontFamily, 'normal'); doc.setFontSize(7.5);
        doc.text(String(i + 1), margin + 6, y - 1, { align: 'center' });
      }
      doc.setFont(fontFamily, medal ? 'bold' : 'normal');
      doc.setFontSize(spec.dense ? 8 : 8.5); doc.setTextColor(medal ? 25 : 70);
      doc.text(String(row[0]).slice(0, 44), margin + 18, y);
      yKeys.forEach((k, ci) => {
        doc.setFont(fontFamily, ci === 0 ? 'bold' : 'normal');
        doc.setTextColor(ci === 0 ? 25 : 110);
        doc.text(valueText(row[1][ci], k), rightOf(ci), y, { align: 'right' });
      });
      doc.setDrawColor(240); doc.setLineWidth(0.3);
      doc.line(margin, y + 4, pageW - margin, y + 4);
    });

    cursorY = top + totalH;
  };

  /**
   * Highlights, and the other half of the story.
   *
   * Two panels side by side: who is carrying the period, and who the manager
   * should speak to. Both come from one ranking, and the bottom panel starts
   * below the top one, so nobody can appear on both sides.
   */
  const drawHighlights = (blk: LayoutBlock) => {
    const xKey = blk.x ?? null;
    const yKeys = (blk.y ?? []).filter(Boolean).slice(0, 1);
    if (!xKey || yKeys.length === 0) return;
    const all = rankCategories(xKey, yKeys);
    if (all.length < 2) return;
    const n = Math.max(1, Math.min(5, Number(blk.limit ?? 3)));
    const top3 = all.slice(0, n);
    const bottom3 = all.slice(Math.max(n, all.length - n)).reverse();

    const gap = 14;
    const panelW = (pageW - margin * 2 - gap) / 2;
    const lineH = 14;
    const rowsH = Math.max(top3.length, bottom3.length) * lineH;
    const totalH = 30 + rowsH + 16;
    if (cursorY + totalH > pageH - margin - 20) { doc.addPage(); cursorY = margin; }

    const top = cursorY;
    doc.setFont(fontFamily, 'bold'); doc.setFontSize(9); doc.setTextColor(40);
    doc.text(blk.title || `${labelFor(yKeys[0])} — who is ahead, who needs a word`, margin, top + 10);

    const panel = (x: number, heading: string, list: Array<[string, number[]]>, good: boolean) => {
      const py = top + 18;
      const h = rowsH + 22;
      const ink: [number, number, number] = good ? [22, 140, 90] : [190, 70, 70];
      if (spec.radius === 0) {
        doc.setDrawColor(ink[0], ink[1], ink[2]);
        doc.setLineWidth(1);
        doc.line(x, py, x + panelW, py);
        doc.setLineWidth(0.2);
      } else {
        doc.setDrawColor(230); doc.setFillColor(252, 252, 251);
        doc.roundedRect(x, py, panelW, h, spec.radius, spec.radius, 'FD');
        doc.setFillColor(ink[0], ink[1], ink[2]);
        doc.rect(x + 3, py + 3, 2.5, h - 6, 'F');
      }
      doc.setFont(fontFamily, 'bold'); doc.setFontSize(6.5);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(heading.toUpperCase(), x + 12, py + 13);
      list.forEach((row, i) => {
        const ly = py + 26 + i * lineH;
        doc.setFont(fontFamily, 'normal'); doc.setFontSize(8); doc.setTextColor(45);
        doc.text(String(row[0]).slice(0, 26), x + 12, ly);
        doc.setFont(fontFamily, 'bold'); doc.setTextColor(25);
        doc.text(valueText(row[1][0], yKeys[0]), x + panelW - 10, ly, { align: 'right' });
      });
    };

    panel(margin, blk.high_label || 'Highlights', top3, true);
    panel(margin + panelW + gap, blk.low_label || 'Needs attention', bottom3, false);
    cursorY = top + totalH;
  };

  // --- The body, drawn in the order the report asks for. ---
  const layout = (t.blocks && t.blocks.length ? t.blocks : DEFAULT_BLOCKS);
  layout.forEach((blk, i) => {
    if (!blk || blk.hidden) return;
    const startPage = (doc as any).internal.getNumberOfPages();
    const startY = cursorY;
    if (blk.type === 'kpis') drawKpis(blk);
    else if (blk.type === 'table') drawTable();
    else if (blk.type === 'ai_summary') drawSummary();
    else if (blk.type === 'chart') drawChart(blk);
    else if (blk.type === 'leaderboard') drawLeaderboard(blk);
    else if (blk.type === 'highlights') drawHighlights(blk);
    if (!onBlock) return;
    const endPage = (doc as any).internal.getNumberOfPages();
    // A block that broke across pages is reported on the page it STARTED on,
    // down to that page's bottom margin: that is where its handle belongs.
    const top = endPage > startPage ? margin : startY;
    const bottom = endPage > startPage ? pageH - margin : cursorY;
    onBlock({
      id: blk.id ?? `${blk.type}-${i}`,
      type: blk.type,
      page: startPage,
      x: margin,
      y: top,
      w: pageW - margin * 2,
      h: Math.max(0, bottom - top),
    });
  });

  // --- Footer on every page ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(fontFamily, 'normal'); doc.setFontSize(8); doc.setTextColor(120);
    doc.setDrawColor(220);
    doc.line(margin, pageH - margin + 4, pageW - margin, pageH - margin + 4);
    const leftFooter = t.footer_note || (brand.header_name ? `Generated by ${brand.header_name}` : '');
    if (leftFooter) doc.text(leftFooter, margin, pageH - margin + 16);
    if (t.include_page_numbers) {
      doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - margin + 16, { align: 'right' });
    }
    // Centred on every page, as well as once in the header: a page that is
    // printed, forwarded or read on its own still carries the link.
    drawPoweredBy(
      (pageW + doc.getTextWidth('Powered by QuickApp.ai')) / 2,
      pageH - margin + 16,
    );
  }

  const ab = doc.output('arraybuffer');
  return new Uint8Array(ab);
}

// Human-readable label from a snake_case / dotted key.
function humanize(key: string): string {
  return key
    .replace(/[._]/g, ' ')
    .replace(/\bid\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Map common grouping dimension keys to a friendly display label.
const DIMENSION_LABELS: Record<string, string> = {
  user: 'Team member',
  user_id: 'Team member',
  rep: 'Team member',
  rep_id: 'Team member',
  employee: 'Team member',
  manager: 'Manager',
  manager_id: 'Manager',
  beat: 'Beat',
  beat_id: 'Beat',
  retailer: 'Retailer',
  retailer_id: 'Retailer',
  distributor: 'Distributor',
  distributor_id: 'Distributor',
  product: 'Product',
  product_id: 'Product',
  category: 'Category',
  category_id: 'Category',
  date: 'Date',
  day: 'Date',
  week: 'Week',
  month: 'Month',
  territory: 'Territory',
  territory_id: 'Territory',
  region: 'Region',
  state: 'State',
  city: 'City',
  pincode: 'Pincode',
};

export function dimensionLabel(dimensionKey: string | null | undefined): string {
  if (!dimensionKey) return 'Group';
  const k = dimensionKey.toLowerCase();
  return DIMENSION_LABELS[k] ?? humanize(dimensionKey);
}

// Build a neutral model from raw RPC rows.
export function buildReportModel(params: {
  reportName: string;
  period: { key: string; label: string; date_from: string; date_to: string };
  rows: any[];
  recipientName?: string | null;
  scopeLabel?: string | null;
  filtersLabel?: string | null;
  aiSummary?: string | null;
  // Grouping dimension key from the report definition (e.g. 'user_id', 'beat', 'date').
  // Used to name the first (row-label) column instead of showing raw keys
  // like 'grp' or 'row_label'.
  rowDimensionKey?: string | null;
  /** measure key -> aggregate declared on reportable_datasets (sum|avg|count). */
  measureAggs?: Record<string, string> | null;
  /** measure key -> display format declared on reportable_datasets (currency|number). */
  measureFormats?: Record<string, string> | null;
  /** measure key -> the label the dataset declares. Beats humanising the key:
   *  'aov_vs_beat_pct' reads as "Aov Vs Beat Pct" and means nothing. */
  measureLabels?: Record<string, string> | null;
  /** measure key -> unit, e.g. quantity -> 'KG'. Shown on the KPI tile. */
  measureUnits?: Record<string, string> | null;
  /** measure key -> tone, e.g. 'vs100' for a percentage measured against par. */
  measureTones?: Record<string, string> | null;
  /** Measures carried only so a KPI tile can total them; never a table column. */
  hiddenKeys?: string[] | null;
}): ReportModel {
  const { reportName, period, rows } = params;
  const firstRow = rows[0] ?? {};
  const keys = Object.keys(firstRow);

  const rowLabelKeys = new Set(['grp', 'group', 'row', 'row_label', 'label', 'dimension']);
  const dimensionDisplay = dimensionLabel(params.rowDimensionKey);

  const columns: ReportColumn[] = keys.map((k, idx) => {
    let numeric = keys.length > 0 && rows.length > 0;
    for (const r of rows) {
      const v = r[k];
      if (v === null || v === undefined || v === '') continue;
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) { numeric = false; break; }
    }
    // Whether a column is money is declared on the dataset's measure, not
    // inferred from its name. The name match below is only a fallback for
    // columns the dataset says nothing about, and it deliberately does not
    // look for 'total' — that made "total_hours" print as "₹ 8.81".
    const percent = numeric && params.measureFormats?.[k] === 'percent';
    let currency = false;
    if (numeric) {
      const declared = params.measureFormats?.[k];
      if (declared) {
        currency = declared === 'currency';
      } else {
        const kl = k.toLowerCase();
        if (kl.includes('amount') || kl.includes('revenue') || kl.includes('price') ||
            kl.includes('rate') || kl.includes('sales')) currency = true;
      }
    }
    // Only a genuine row-label key gets the dimension caption. Using idx === 0
    // relabelled whatever the RPC happened to return first — e.g. a `uom`
    // column headed "Order Date" while a real order_date column sat further
    // right under the same heading.
    const isRowLabelCol = rowLabelKeys.has(k.toLowerCase());
    const label = isRowLabelCol && !numeric
      ? dimensionDisplay
      : (params.measureLabels?.[k] || humanize(k));
    // 'avg' (and any other non-additive aggregate) must not be totalled.
    const agg = params.measureAggs?.[k];
    const summable = !agg || agg === 'sum' || agg === 'count';
    const hidden = (params.hiddenKeys ?? []).includes(k);
    const unit = params.measureUnits?.[k] ?? null;
    const tone = params.measureTones?.[k] ?? null;
    return { key: k, label, numeric, currency, percent, summable, hidden, unit, tone };
  });

  let totals: Record<string, number> | null = null;
  // Only additive measures get a total. A column the dataset declares as an
  // average (e.g. rate = AVG(oi.rate)) has no meaningful sum across groups.
  const numericCols = columns.filter(c => c.numeric && c.summable !== false);
  if (numericCols.length > 0 && rows.length > 0) {
    totals = {};
    for (const c of numericCols) {
      let sum = 0;
      for (const r of rows) {
        const v = r[c.key];
        const n = typeof v === 'number' ? v : Number(v);
        if (Number.isFinite(n)) sum += n;
      }
      totals[c.key] = sum;
    }
  }

  return {
    title: reportName,
    period: { label: period.label, date_from: period.date_from, date_to: period.date_to },
    columns,
    rows,
    totals,
    meta: {
      generated_at: new Date(),
      recipient_name: params.recipientName ?? null,
      scope_label: params.scopeLabel ?? null,
      filters_label: params.filtersLabel ?? null,
      ai_summary: params.aiSummary ?? null,
    },
  };
}
