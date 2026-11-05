# Fix the From / To date pickers in All Invoices

The two date buttons above the invoice table open a small calendar. Three fixes:

1. **Opens below the button** — the calendar always appears directly under the date button, left-aligned with it, never on top of it.
2. **Opens on the right month** — if the button shows "01 Jul 2026", the calendar opens on July 2026 with that day clearly highlighted. Re-opening after changing months always returns to the month of the chosen date.
3. **Smooth switching** — clicking any day updates the button text at once and closes the calendar; moving between months and years inside the calendar stays free.

Nothing else on the page changes: same layout, same Export and Compress buttons, same table.

## Technical notes

Only `src/components/invoice/InvoiceStorageToolbar.tsx`, inside `DatePickerField`:

- `PopoverContent`: add `side="bottom"` alongside the existing `align="start"`, keep `sideOffset` default and `w-auto p-0 bg-popover`.
- Add local `month` state initialised from `value`; sync it to `value` whenever the popover opens (`onOpenChange`) so the calendar lands on the active month.
- `Calendar`: pass `selected={value}`, `defaultMonth={value}`, `month={month}`, `onMonthChange={setMonth}`, and add `className="p-3 pointer-events-auto"` so day tiles stay clickable inside the popover.
- Selected-day highlight comes from the existing `bg-primary text-primary-foreground` day-selected variant in `src/components/ui/calendar.tsx`; verify it is present and only add the explicit modifier class if it is missing.
- No change to `AllInvoicesList.tsx` unless the shared date state needs no edit — it does not; the pickers stay controlled by the existing `fromDate` / `toDate` props.
