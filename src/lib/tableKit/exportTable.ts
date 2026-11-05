import { toast } from 'sonner';
import { exportRowsToExcel } from '@/utils/exportRowsToExcel';
import { downloadPDF } from '@/utils/fileDownloader';
import { type TableColumn, cellText } from './types';

/**
 * Export whatever the table is currently showing.
 *
 * Both exports are built from the same column definitions the table renders
 * from, so a heading, an order or a formatted value can never say one thing
 * on screen and another in the file. What is exported is the filtered, sorted
 * view -- a user who has narrowed a list to the rows they care about expects
 * the download to contain those rows, not the whole table again.
 */

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportTableToExcel<T>(
  columns: TableColumn<T>[], rows: T[], fileBaseName: string, sheetName?: string,
) {
  if (rows.length === 0) { toast.error('Nothing to export — no rows match'); return; }
  const data = rows.map((r) => {
    const o: Record<string, string | number | null> = {};
    columns.forEach((c) => {
      const raw = c.value(r);
      // Numbers go through as numbers so the sheet can total a column; the
      // formatted string would arrive as text and refuse to add up.
      o[c.header] = c.type === 'number' && typeof raw === 'number' ? raw : cellText(c, r);
    });
    return o;
  });
  const ok = exportRowsToExcel(data, fileBaseName, sheetName ?? fileBaseName);
  if (ok) toast.success(`${rows.length} row${rows.length === 1 ? '' : 's'} exported to Excel`);
}

export async function exportTableToPdf<T>(
  columns: TableColumn<T>[], rows: T[], fileBaseName: string,
  opts: { title?: string; subtitle?: string } = {},
) {
  if (rows.length === 0) { toast.error('Nothing to export — no rows match'); return; }
  try {
    // Loaded on demand: jsPDF and autotable are large, and most visits to a
    // table never export one.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    // Landscape by default: these are wide operational tables, and portrait
    // squeezed the later columns into unreadable slivers.
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const margin = 10;
    let y = margin + 4;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(opts.title ?? fileBaseName, margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.setTextColor(110);
    const sub = [opts.subtitle, `${rows.length} row${rows.length === 1 ? '' : 's'}`,
                 new Date().toLocaleDateString('en-GB',
                   { day: '2-digit', month: 'short', year: 'numeric' })]
      .filter(Boolean).join('  ·  ');
    doc.text(sub, margin, y);
    doc.setTextColor(0);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [columns.map((c) => c.header)],
      body: rows.map((r) => columns.map((c) => cellText(c, r))),
      theme: 'striped',
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [31, 42, 74], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(columns.map((c, i) => [i, {
        halign: c.align ?? (c.type === 'number' ? 'right' : 'left'),
      }])),
      margin: { left: margin, right: margin, top: margin, bottom: 14 },
      didDrawPage: () => {
        const pg = (doc as any).internal.getCurrentPageInfo?.().pageNumber ?? 1;
        doc.setFontSize(7); doc.setTextColor(140);
        doc.text(`Page ${pg}`,
          doc.internal.pageSize.getWidth() - margin,
          doc.internal.pageSize.getHeight() - 6, { align: 'right' });
        doc.setTextColor(0);
      },
    });

    const safe = fileBaseName.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
    await downloadPDF(doc.output('blob'), `${safe}-${stamp()}.pdf`);
    toast.success(`${rows.length} row${rows.length === 1 ? '' : 's'} exported to PDF`);
  } catch (err: any) {
    console.error('PDF export failed', err);
    toast.error('Could not build the PDF: ' + (err?.message ?? 'unknown error'));
  }
}
