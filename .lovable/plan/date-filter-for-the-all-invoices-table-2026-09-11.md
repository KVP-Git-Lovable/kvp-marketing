# Date filter for the All Invoices table

Make the From Date / To Date pickers actually filter the invoice list, and move them (with the Export and Compress buttons) up into the "All Invoices" heading row, where the picture marks them.

## What changes

1. **Filters and buttons move into the heading row**
  - The separate card that currently sits above "All Invoices" goes away.
  - From Date, To Date, Export and Compress sit on the right of the "All Invoices" title row, as circled in the screenshot.
  - On narrow screens they wrap onto their own line underneath the title so nothing gets squeezed.
  - The short safety note, the export confirmation, the progress bars and the compression window all keep working exactly as today.
2. **The list follows the dates**
  - Changing either date reloads the list immediately for that period.
  - Both dates are included: everything from the start of the From date up to the end of the To date, in local time.
  - If the From date is later than the To date, the list shows an "adjust the dates" message instead of loading.
  - Empty period shows "No invoices found in the selected dates".
3. **Everything else stays the same**
  - Same columns, same "10 Sept 2026" date format, same Edit / Download / WhatsApp / link actions, same layout and styling.
  - Export and compression keep using the same shared dates they use now.
    &nbsp;
    4. EDGE CASES & FEEDBACK: - Re-fetch table data automatically whenever the date state changes. Display a subtle loading spinner inside the table body area while keeping the header and filters mounted. - If `fromDate > toDate`, display a clear inline message: "Please adjust the date range (From Date must be before To Date)". - If no invoice records exist for the selected range, display: "No invoices found in the selected dates".

## Technical notes

- `src/components/invoice/AllInvoicesList.tsx`
  - Lift `fromDate` / `toDate` state here (defaults unchanged: three months back → today) and pass them plus setters into `InvoiceStorageToolbar`, so one range drives the table, export and compression.
  - `fetchInvoices` takes the range and adds `.gte()` / `.lt()` on the same column the Date cell renders — `orders.created_at` — using local-midnight bounds (`toLocalISODate` style start-of-from-day, and start of the day after To) so the boundary days are fully inclusive without UTC drift. The 500-row cap and `retailers(name)` embed stay.
  - Re-run the fetch in a `useEffect` keyed on the two dates (debounced isn't needed — the pickers commit one date at a time).
  - Show the spinner in place of the table body area only, so the header/filters stay mounted while reloading.
- `src/components/invoice/InvoiceStorageToolbar.tsx`
  - Becomes a controlled component: accepts `fromDate`, `toDate`, `onFromDateChange`, `onToDateChange`; drops its internal date state. All export/compression logic, dialogs and progress UI stay as-is.
  - Rendered inline inside the `CardHeader` of All Invoices as a compact row (no wrapping `Card`), with the helper text kept below.
- Note on the date column: this table lists `orders` rows (each carrying `invoice_number`), and the Date column renders `orders.created_at`. The formal `invoices.invoice_date` column belongs to a different table that this list does not query, so the filter is applied to `created_at` — the exact value shown in the Date column — to keep filter and display consistent.