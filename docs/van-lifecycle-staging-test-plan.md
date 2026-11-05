# Van lifecycle — staging test plan

What has to pass before `dms_settle_van_day(..., false)` is wired into any
workflow. Until every phase below is green, settlement stays manual.

The plan is built around one idea: **stock is conserved**. Nothing a van does
should create or destroy units. At any point in a day,

```
warehouse quantity + on-van quantity + sold = what the warehouse started with
```

and of the warehouse figure, `damaged_quantity` is the unusable part, so

```
available = quantity - reserved_quantity - damaged_quantity - expired_quantity
```

Every phase ends by checking that identity. If it holds at every step, the
lifecycle is sound; if it breaks, the phase that broke it is the one to fix.

---

## A note on what is and is not automatic

Settlement is **not** connected to anything. Loading a van, placing an order and
closing a day do not post to DMS inventory on their own. So each phase has two
halves:

- **app steps** — done through the UI, exercising the van screens and the order
  sync that writes `van_stock_items`
- **settlement** — invoked by hand, at the moment the workflow would later
  invoke it

That separation is the point of the exercise. It lets us confirm the settlement
does the right thing at each moment *before* anything calls it automatically.

---

## Phase 0 — Preconditions

### 0.1 Confirm the schema is current

```sql
select
  (select position('v_good + v_damaged' in pg_get_functiondef(p.oid))>0
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='dms_settle_van_day')        as damaged_fix,
  (select position('IF NOT p_dry_run AND' in pg_get_functiondef(p.oid))=0
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='dms_settle_van_day')        as dry_run_fix,
  (select position('balance_qty)' in pg_get_functiondef(p.oid))>0
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='dms_settle_van_day')        as ledger_fix,
  (select position('is not linked to a distributor' in pg_get_functiondef(p.oid))>0
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='van_stock_capture_distributor') as van_guard;
```

All four must be `true`.

### 0.2 Confirm settlement is still unwired

```bash
grep -rn "dms_settle_van_day" src/ \
  | grep -v "integrations/supabase/types.ts" \
  | grep -v "^\s*//"
```

Expected: **no call sites**. Two matches are known and harmless —
`src/integrations/supabase/types.ts` (the generated RPC type) and a comment in
`DistributorInventory.tsx` explaining why `quantity` and `on_van_quantity` are
disjoint. Anything else means something is already invoking settlement and this
plan's assumptions no longer hold.

### 0.3 Run the SQL regression suite

```bash
psql "$DATABASE_URL" -f supabase/tests/dms_settle_van_day_returns.sql
```

Expected: `ALL CASES PASS`, exit 0. This is the floor — if it fails, stop.

### 0.4 Build isolated fixtures

Create a **dedicated test distributor**, warehouse, van and field-sales user.
Do not reuse a real distributor, and do not test against the existing van days.

| Fixture | Value |
|---|---|
| Distributor | `VAN LIFECYCLE TEST` |
| Warehouse | one, `is_default = true` |
| Van | linked to that distributor |
| Second van | **no** distributor, for the refusal test |
| Products | at least three, with different UOM shapes (see below) |

Product shapes needed:

- **P-WEIGHT** — base GRAM, with KG (×1000) configured
- **P-COUNT** — base PIECE, with a pack unit configured
- **P-THIN** — base GRAM, stocked deliberately low, for the shortfall test

Staging has these: 12 products are GRAM-based with KG configured, and a large
number are PIECE-based with a pack unit. The only pack units configured anywhere
are **BOX** and **CARTON** — there is no DOZEN, so do not write a case that
assumes one. Check the actual factor on whichever product you pick rather than
assuming ×24; the assertions below use ×24 purely as a worked example.

Seed opening stock through the **Opening Stock screen**, not by direct insert —
that exercises the UOM path on the way in.

### 0.5 Record the baseline

```sql
select product_id, quantity, coalesce(on_van_quantity,0) as on_van,
       damaged_quantity, reserved_quantity, unit
from distributor_inventory
where distributor_id = '<test distributor>'
order by product_name;
```

Keep this. Every later check is relative to it.

---

## Phase 1 — Van day creation

| # | Step | Expected |
|---|---|---|
| 1.1 | Open Van Stock Management, pick the linked van, save a morning sheet | Van day created; `van_stock.distributor_id` stamped from the van |
| 1.2 | Attempt a van day for the **unlinked** van | Refused, with a message naming the van. No row created |

```sql
select vs.id, vs.distributor_id, v.registration_number
from van_stock vs join vans v on v.id = vs.van_id
where vs.stock_date = current_date and v.registration_number like 'TEST%';
```

**Pass:** 1.1 has a non-null `distributor_id`; 1.2 produced no row.

---

## Phase 2 — Morning loading

### 2.1 Load in a non-base unit

Enter **2 KG** of P-WEIGHT and **5 BOX** of P-COUNT on the van sheet.

```sql
select product_name, start_qty, unit, left_qty
from van_stock_items where van_stock_id = '<day>';
```

**Pass:** stored as **2000 GRAM** and **120 PIECE**. If it stored 2 and 5, the
UOM path is not being used.

### 2.2 Dry run before posting

```sql
select * from dms_settle_van_day('<day>', true);
```

**Pass:** one row per product, `applied = false`, `reason = dry_run`,
`available_delta` negative and equal to the loaded quantity, `on_van_delta`
positive and equal.

Then confirm it wrote nothing — re-run the Phase 0.5 baseline query and compare.
**Any difference is a failure.**

### 2.3 Post the loadout

```sql
select * from dms_settle_van_day('<day>', false);
```

**Pass:**

| Check | Expected |
|---|---|
| `reason` | `settled_open` |
| warehouse `quantity` | down by the loaded amount |
| `on_van_quantity` | up by the same amount |
| ledger row | `transaction_type = VAN_LOADOUT`, `balance_qty` **negative** |
| `running_balance` | equals the new warehouse `quantity` |
| conservation | warehouse + on-van = baseline |

### 2.4 Shortfall is refused in both modes

Load P-THIN with more than the warehouse holds.

**Pass:** `reason = insufficient_stock_in_warehouse` in **dry run as well as**
real run, `applied = false`, and that product's inventory completely untouched.
The other products on the same day still settle — one bad line must not block
the rest.

---

## Phase 3 — Order sync

This is the half that was most broken, so test it hardest.

### 3.1 An order in a packed unit

Place a field-sales order for **2 BOX** of P-COUNT against the van's user, dated
today.

```sql
select product_name, start_qty, ordered_qty, left_qty, unit
from van_stock_items where van_stock_id = '<day>';
```

**Pass:** `ordered_qty = 48` (2 × 24), **not 2**. `left_qty = 120 - 48 = 72`.

This is the exact case the old converter got wrong, so it is the single most
important assertion in the plan.

### 3.2 An order in a unit the product is not configured for

**Pass:** the van line is **unchanged**, and the problem is surfaced — not
written at face value. Check the browser console / the `vanStockUpdated` event
detail for the reported problem.

### 3.3 Re-sync is stable

Trigger the sync again (place another order, or use the van screen's
recalculate).

**Pass:** figures change only by the new order. Running it twice with no new
orders changes nothing.

### 3.4 Settle mid-day

```sql
select * from dms_settle_van_day('<day>', false);
```

**Pass:** `on_van_quantity` falls by what was sold; warehouse `quantity`
unchanged (goods went from van to customer, not back to the warehouse);
conservation holds with sold included.

---

## Phase 4 — Good returns

Record the full remaining van stock as returned good, close the day.

**Pass:** warehouse `quantity` rises by the returned amount, `on_van_quantity`
falls to the counted figure, `damaged_quantity` unchanged at 0, ledger row
`VAN_SETTLE` with **positive** `balance_qty`.

---

## Phase 5 — Damaged returns

Return everything remaining as **damaged**.

**Pass:**

| Figure | Expected |
|---|---|
| `quantity` | rises by the damaged amount — the goods are physically back |
| `damaged_quantity` | rises by the same amount |
| available | **does not** rise — `quantity − damaged` is flat |
| conservation | still holds |

This is the regression that lost 200 units on a 2,000-unit day. If `quantity`
does not move here, the damaged fix is not deployed.

---

## Phase 6 — Mixed returns with stock still on board

The realistic case: some sold, some good back, some damaged back, some still on
the van overnight.

Worked example, 2,000 out: 1,500 good back, 200 damaged back, 300 counted on the
van.

| Figure | Expected |
|---|---|
| `quantity` | 9,700 |
| `damaged_quantity` | 200 |
| available | 9,500 |
| `on_van_quantity` | 300 |
| warehouse + on van | **10,000** |

**Pass:** all five. The last line is the one that matters.

---

## Phase 7 — Day closure

### 7.1 Counted beats computed

Set `counted_qty` different from `left_qty`, close the day.

**Pass:** `on_van_quantity` follows **`counted_qty`**, not `left_qty`. The gap is
the variance and belongs in no bucket — confirm it is not silently absorbed into
`quantity` or `damaged_quantity`.

### 7.2 Variance is recorded

**Pass:** `van_stock.variance_reason` is captured when the counted figure differs.

### 7.3 Closed-day ledger type

**Pass:** `transaction_type = VAN_SETTLE` (not `VAN_LOADOUT`) once
`status = 'closing_verified'`.

---

## Phase 8 — Idempotent retries

### 8.1 Re-settle the same day

Run settlement three more times with nothing changed.

**Pass:** every row `reason = already_settled`, `applied = false`. Inventory
unchanged. **No new ledger rows** — count them before and after.

### 8.2 Settle after a change

Alter one return figure, settle again.

**Pass:** only the delta posts. The day does not re-post from zero.

### 8.3 Double submission on the write screens

On Stock Adjustments and both Returns screens, submit twice rapidly (and once
more after forcing a timeout, if you can).

**Pass:** stock moves **once**. The second attempt reports
"already recorded — stock left unchanged". Confirm exactly one ledger row per
movement.

---

## Phase 9 — Refusals

Each must refuse cleanly, change nothing, and say why.

| # | Condition | Expected `reason` |
|---|---|---|
| 9.1 | Van day with no distributor | `van_has_no_distributor` |
| 9.2 | Product not stocked at that warehouse | `not_stocked_in_that_warehouse` |
| 9.3 | Van line unit the product is not set up for | `unit_mismatch` |
| 9.4 | Same product in two warehouses, none specified | `warehouse_ambiguous` |
| 9.5 | Shortfall | `insufficient_stock_in_warehouse` |

**Pass for all:** `applied = false`, inventory untouched, and the *other* lines
on the same day still settle.

---

## Phase 10 — Reconciliation

### 10.1 Conservation across the whole day

```sql
select p.name,
       di.quantity, coalesce(di.on_van_quantity,0) as on_van, di.damaged_quantity,
       di.quantity - di.reserved_quantity - di.damaged_quantity - di.expired_quantity as available
from distributor_inventory di join products p on p.id = di.product_id
where di.distributor_id = '<test distributor>';
```

**Pass:** for every product, `quantity + on_van + sold` equals the Phase 0.5
baseline.

### 10.2 Ledger agrees with inventory

```sql
select distinct on (product_id) product_id, running_balance
from distributor_inventory_transactions
where distributor_id = '<test distributor>'
order by product_id, seq desc;
```

**Pass:** each `running_balance` equals that product's `quantity`.

### 10.3 Every movement is a number

**Pass:** no `VAN_LOADOUT` or `VAN_SETTLE` row has a null `balance_qty`.

### 10.4 The DMS inventory screen

Open Distributor Portal → Inventory.

**Pass:** the on-van column shows the stock that is out, and the available figure
excludes it. This is the thing the whole exercise was for — confirm it visually,
not only in SQL.

---

## Phase 11 — Rollback rehearsal

Before trusting this in a workflow, rehearse undoing it.

1. Apply `supabase/rollback/20261020_pre_apply_dms_settle_van_day.sql`
2. Confirm the function reverts (the Phase 0.1 checks flip to `false`)
3. Re-apply `supabase/migrations/20261020160000_dms_settle_van_day_authoritative.sql`
4. Confirm Phase 0.1 is green again

**Pass:** both directions work, and the regression suite passes after the
re-apply.

Note what rollback does **not** do: it does not unwind postings. If settlement
has run, `van_day_postings` and `distributor_inventory` have to be dealt with
separately. Rehearse that too if the plan is ever to roll back a day that posted.

---

## Exit criteria

Automatic settlement may be wired only when **all** of the following hold:

- [ ] Phases 1–10 pass against isolated fixtures
- [ ] Phase 5 confirms damaged returns raise `quantity` (the units-lost bug)
- [ ] Phase 3.1 confirms a packed unit converts (2 BOX → 48, not 2)
- [ ] Phase 8 confirms repeated settlement adds nothing
- [ ] Phase 10.1 conservation holds for every product
- [ ] Phase 11 rollback rehearsed successfully
- [ ] Test fixtures removed, and the real data verified untouched:
  - 10 historical van days still have null `distributor_id`
  - no `van_day_postings` rows for real van days
  - no unexplained `on_van_quantity` on real inventory

---

## Known blockers

These do not stop the plan, but they shape it.

**The 2026-10-15 van day cannot settle.** It claims 10,000 g of each of three
products against a distributor holding 2,200 / 1,000 / 1,000 g. The settlement
now says so honestly (`insufficient_stock_in_warehouse`) rather than reporting
`dry_run`, but the underlying data question is open: is that distributor test
data, or were the quantities entered against the wrong unit? **Do not use this
day as a test fixture, and do not settle it.**

**Ten historical van days have no distributor.** Dev test records, deliberately
left alone. They will always return `van_has_no_distributor`. That is correct
behaviour, not a failure — but it means they can never be used to test anything.

**The ledger carries historical drift.** 35 streams disagree with inventory from
before the Stage 1 trigger fix. Phase 10.2 should therefore be checked against
the **test distributor only**, whose ledger starts clean. Checking it
catalogue-wide will fail for reasons that predate this work.

**Orders attach to vans by user and date**, not by a van id — `orders` has no
`van_id`. Phase 3 is only valid when the test user has exactly one van day for
the date. If a user ever runs two vans in a day, order attribution is ambiguous
and that is a separate design question.
