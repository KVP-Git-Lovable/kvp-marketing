# Report Builder tab in Analytics

Add a new "Report Builder" tab on the Analytics page, next to "Sales Comparison". It opens a "Report Configurator" screen where people browse saved reports, run them, and (for admins) build new ones — modelled on the Quick Clinic App report builder but reworked for field-sales data (orders, order lines, retailers, beats, visits, users, products).

Nothing in Quick Clinic App is touched, and no existing feature in this project changes — the only edit to an existing screen is inserting one tab trigger plus its tab panel in Analytics.

## What the user sees

1. Analytics page gets a "Report Builder" tab after "Sales Comparison".
2. Inside it: a "Report Configurator" header with the subtitle "Build, save and manage custom reports", plus "New Folder" and "New Report" buttons (admin only).
3. Folder chips (All, plus any folders created, plus Unfiled) filter the report list.
4. Each saved report is a row showing its name, layout badge (Tabular / Bar chart / etc.), folder, description, the data it uses, column and filter counts, and last-updated date, with View / Pin / Edit / Delete actions. Non-admins see only View.
5. View runs the report against live data with a results table, totals, optional chart, sorting, and CSV export.
6. New/Edit opens a builder: pick a main record type, optionally a related record type, choose columns, add filters, choose grouping and summary rows, pick table or chart, save into a folder.

## Preconfigured reports (seeded, real data)

- Retailerwise order summary — retailer, beat, order count, total quantity, revenue, last order date.
- Beat + Order — beat with its orders: order count, revenue, active retailers.
- User - Beat - Order — team member -> beat -> orders, grouped by user then beat.
- Revenue by Product — order lines grouped by product and category with revenue and quantity.
- Userwise KG report — quantity converted to base kg per team member.
- Beatwise KG report — quantity converted to base kg per beat.

All six are built from the same definition format the builder saves, so they are fully editable by admins and never contain sample data — they read live rows.

## Access

- Everyone with existing Analytics access sees the tab and can view/run reports.
- Creating, editing, deleting reports and folders is restricted to admins (same admin check the app already uses).

## Technical notes

Database (one migration):

- `public.rb_report_folders` — id, name, description, created_by, timestamps.
- `public.rb_saved_reports` — id, name, description, folder_id (nullable FK), primary_object, related_object, columns jsonb, group_rows jsonb, group_columns jsonb, filters jsonb, chart_type, display_options jsonb, is_preset bool, created_by, timestamps.
- `public.rb_report_pins` — user_id, report_id, unique pair (for the pin action).
- Grants for both tables: SELECT/INSERT/UPDATE/DELETE to `authenticated`, ALL to `service_role`; no `anon` grant. RLS enabled: read for any authenticated user; write only when the caller is an admin (existing `has_role`/admin helper), except `rb_report_pins` which is scoped to `auth.uid()`.
- Seed the six preset rows in the same migration with `is_preset = true`.
- The existing `saved_reports` table belongs to Copilot and is left untouched, hence the `rb_` prefix.

Frontend (new files only, except the Analytics tab insert):

- `src/lib/fieldSalesReportObjects.ts` — object registry: `orders`, `order_items`, `retailers`, `beats`, `visits`, `profiles`/users, `products`, with fields and relations drawn from the real columns (e.g. orders.retailer_id -> retailers, orders.beat_id -> beats, orders.user_id -> profiles, order_items.order_id -> orders, order_items.product_id -> products, visits.retailer_id -> retailers). Includes derived fields where useful: month bucket, base-kg quantity (via `conversion_to_base`), team member name, count/sum/avg aggregates.
- `src/components/reports/*` — `ReportConfiguratorPanel`, `ReportList`, `ReportBuilder`, `ReportPreview`, `ReportViewer`, `ReportChart`, `FilterRow`, `SortableDataTable`, adapted from the clinic patterns: PostgREST select with embedded related table, server-side narrowing for simple filters, client-side evaluation for derived fields and OR logic, grouping/aggregation in JS.
- Currency formatting goes through the project's existing `useCurrency()` / money helpers rather than hardcoded symbols.
- `src/pages/Analytics.tsx` — add `showReportBuilderTab` (same gate as Sales Comparison), one `TabsTrigger value="report-builder"`, and one `TabsContent` rendering `ReportConfiguratorPanel`. No other logic changed.

Verification: run each of the six presets against the live database and confirm row counts and totals line up with the Orders/Analytics screens; confirm a non-admin session sees no create/edit/delete controls.  
  
  
**Points to be considered when you execute the above:**  
  
The most important architectural concern

This line is the one I'd challenge:

> “grouping/aggregation in JS”

For a report builder, that's okay for **small, already-filtered result sets**, but it shouldn't be the fundamental strategy.

For example:

**Retailerwise order summary**

If you query:

`orders → order_items → products`

and then aggregate in JavaScript, an order with 10 lines becomes 10 rows. If you subsequently count orders, you can accidentally count **10 orders instead of 1**.

Likewise, revenue can be double-counted depending on whether you're aggregating order totals or line totals.

I'd require every preset to have a **defined aggregation grain**:

- Order count = `COUNT(DISTINCT orders.id)`
- Order-line quantity = `SUM(order_items.quantity)`
- Order revenue = clearly defined as either `SUM(orders.total)` **or** line-level revenue, never both
- Active retailers = clearly defined predicate
- KG = explicit conversion formula

### I would also add a hard data-access rule

The report builder should **never allow the frontend to bypass existing business/data visibility rules**.

The new tables can control **which reports users can see**, but they must not become a way to query data that the user couldn't already access through the application's existing RLS policies.

In particular, verify:

> Authenticated user → report definition → underlying PostgREST query → existing table RLS → returned rows.

Not:

> Authenticated user → saved report → unrestricted/service-role query.

### Presets need more definition

The six presets are a good idea, but I'd require the implementation to define their exact semantics before coding.

For example:

**Userwise KG report**

```

```

```
user
→ order_items
→ quantity × conversion_to_base
→ SUM
```

But what happens if:

- `conversion_to_base` is null?  

-   
quantity is fractional?  

-   
product has a variant?  

-   
order is cancelled?  

-   
order is deleted?  

-   
order has multiple lines for the same product?  


Those decisions should be deterministic.

### One thing I really like

The scope firewall is excellent:

> **Only one existing screen change: Analytics tab trigger + panel.**

And:

> Quick Clinic untouched  
>
> existing features unchanged  
>
> `saved_reports` untouched  
>
> new `rb_` tables

That's exactly how I'd introduce this safely.

### Before implementation, I'd add these requirements

1. **Inspect the actual database schema first** — don't infer relationships or field names.  

2. **Inspect the existing Analytics queries/calculations** and make preset totals reconcile with them.  

3. **Inspect the exact existing admin/RLS helper** and reuse it byte-for-byte where appropriate.  

4.   
Define aggregation grain for every preset to prevent join multiplication.  

5.   
Define order status/cancellation inclusion rules.  

6.   
Define `conversion_to_base` behavior and null handling.  

7.   
Define preset lifecycle: admins can edit/delete them, or presets are protected.  

8.   
Ensure report queries remain subject to existing table RLS.  

9.   
Put reasonable limits on report result size/rows to prevent browser crashes.  

10.   
Test with deliberately duplicated order lines and multi-line orders to prove counts/revenue aren't inflated.  


### Verdict

**The feature itself should not break anything if implemented with these safeguards.** The plan's scope is actually quite good.