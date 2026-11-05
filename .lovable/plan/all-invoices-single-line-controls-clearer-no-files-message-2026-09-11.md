# All Invoices: single-line controls + clearer "no files" message

## 1. One row of controls under the heading

- The From Date and To Date pickers, "Export Files" and "Compress" all sit on one horizontal line, directly under the "All Invoices" title and its subtitle.
- Order left to right: From Date, To Date, Export Files, Compress.
- On narrow screens the controls wrap onto a second line instead of shrinking.
- No right-floating or stacked block any more; the short safety note stays underneath the row, left-aligned. also make button color black for both export files and compress
- Progress bars, the export confirmation and the compression window keep working exactly as today. 

## 2. Clearer message when Export finds nothing

When Export Files finds no stored PDF files for the chosen dates:

- If there are also no invoices in those dates, keep today's message: "No invoice files found in the selected date range".
- If invoices do exist in those dates but no PDFs are stored, show: "Invoices exist for these dates, but physical PDF files are not stored in Supabase Storage for recent invoices. Physical files exist up to &nbsp;." — where the date is the newest stored invoice file found overall.
- If no stored file exists at all, the sentence ends without the "up to" part.

Nothing else about export, compression or the table changes.

## Technical notes

- `src/components/invoice/InvoiceStorageToolbar.tsx`
  - Replace the `flex-wrap items-end gap-3 lg:justify-end` wrapper with a single `flex flex-row flex-wrap items-center gap-2` row; drop the inner button `div` and the `lg:text-right` on the helper text. `DatePickerField` loses its stacked `Label` (label becomes the trigger's accessible name / placeholder-style prefix) so the pickers align vertically with the buttons.
  - New prop `invoiceCountInRange: number` supplied by the parent (the already-fetched `invoices.length` for the same range) — no extra query needed for the existence check.
  - In `handleScanForExport`, when `files.length === 0` and `invoiceCountInRange > 0`, call `listInvoiceFilesInRange('2000-01-01', toISO(new Date()))` once to find `max(created_at)` and emit the diagnostic toast (`toast.info`, longer duration); otherwise keep the current info toast.
- `src/components/invoice/AllInvoicesList.tsx`
  - Move `<InvoiceStorageToolbar>` out of the flex row in `CardHeader` to its own line below the title/subtitle block, and pass `invoiceCountInRange={invoices.length}`.
  - No change to `fetchInvoices`, columns, formatting or row actions.