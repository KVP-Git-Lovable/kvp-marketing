# Why the DMS portal shows names the product master disagrees with

**Read-only.** Nothing in this document has been applied. No row was written
while producing it.

Generated 27 Oct 2026 against the Dev/staging database
(`aoxdosjkwqyuvccuwhzc`).

---

## What started this

Thirteen `distributor_inventory` rows display a `product_name` that no longer
matches `products.name`. Four of them display a name belonging to what is now
an entirely different product:

| DMS portal shows | `products.name` now says | SKU still says |
|---|---|---|
| Ball 80ml | GIRNAR LEAF TEA 50 | `Girn50` |
| Big Cup Chocolate | VAYU 50G | `Vay50` |
| Big Cup Mango | Amrutha Toothpaste 50g | `ZJBCMAN` |
| Ball 100ml | Egg Mayoneese 500mg | `ZJB100` |

An earlier guess that the product merge caused this was **wrong** — all four
`PRODUCT_MERGE` transactions concern VAYU 30G and are internally consistent.

## The actual cause: these product rows were renamed, repeatedly

`order_items` keeps a `product_name` snapshot per line, so order history
preserves every name each row has worn:

| product_id | Names over time (first use → last use) |
|---|---|
| `d45a0322` | **Ball 100ml** (12 Jun – 27 Aug) → **Ball 260** / **Ball 250** (21 Aug) → **Egg Mayoneese 500mg** (1 Sep) → **Ball 230** (1 Sep) |
| `91c48d58` | **Big Cup Chocolate** (11 Jun – 19 Aug) → **Amrutha Nail Polish (Small)** (27 Aug – 2 Sep) → **Bigcup256** (31 Aug – 2 Sep) → **VAYU 50G** (6 – 8 Oct) |
| `c220d351` | **Ball 80ml** (11 Jun – 27 Aug) → **Lekhya Soya Oil 400 mL** (1 Sep) → **GIRNAR LEAF TEA 50** (1 – 7 Oct) |
| `22e30f6a` | **Big Cup Mango** (11 Jun – 20 Aug) → **Amrutha Toothpaste 50g** (28 Aug – 2 Sep) |

The eras overlap — `Ball 250` and `Ball 260` were both in use on 21 August
while `Ball 100ml` was still being ordered — so the name was being changed
back and forth within single days. These rows have been used as scratch
fixtures.

All four products were inserted in one batch on 11 Jun 2026 at
`05:54:53.802152+00`, identical to the microsecond.

### The inventory copy froze in July

| | last `distributor_inventory` update |
|---|---|
| Ball 100ml (both distributors) | 13 Jul |
| Ball 80ml | 13 Jul |
| Big Cup Chocolate | 1 Jul / 13 Jul |
| Big Cup Mango | 13 Jul |

Every rename happened **after** those dates. `product_name` is a denormalised
copy written once at stock-movement time, and nothing refreshes it, so the
portal has been showing July's names ever since.

### The SKUs show two of the renames were left half-finished

`GIRNAR LEAF TEA 50` and `VAYU 50G` were given matching SKUs (`Girn50`,
`Vay50`) — those rows were deliberately repurposed. `Egg Mayoneese 500mg`
still carries `ZJB100` and `Amrutha Toothpaste 50g` still carries `ZJBCMAN`
— the name was edited and the SKU was not.

## Nothing recorded the renames

`product_audit_log` holds 6,399 rows from 25 Aug onwards, but for
`entity_type = 'product'` it tracks only three fields:

| field | rows |
|---|---|
| `rate` | 15 |
| `tax_master_id` | 12 |
| `gst_percentage` | 12 |

`name` and `sku` are **not audited**. A product rename leaves no trace
anywhere in the database. The four `updated_at` values are no help either —
two are exactly `2026-10-09 11:36:34.13243+00`, the same moment as 574
`order_items.net_weight_g` audit rows, i.e. the weight migration, not a
rename.

## The stale names are still spreading

On **22 Oct 2026 at 06:15:30** a reconciliation job wrote four new ledger rows
in `distributor_inventory_transactions`:

| product_name stamped | note |
|---|---|
| Ball 80ml | `Ledger reconciled to stock on hand 2026-10-22: ledger balance 203, quantity 153` |
| Big Cup Chocolate | `… ledger balance -10, quantity 40` |
| Big Cup Mango | `… ledger balance 182, quantity 120` |
| Ball 100ml | `… ledger balance 121, quantity 161` |

Records created last week were stamped with names abandoned in August, because
the job copies `distributor_inventory.product_name` rather than joining
`products`. The drift is self-propagating.

## It is not four products — it is at least nineteen

Products whose `order_items` history shows more than one name:

| Current name | Names seen | History |
|---|---|---|
| ADUKU 20G | 5 | ADUKU 20G → ADUKU 250G → ADUKU 100G (FREE) → SAMPLE ADUKU (FS) → ADUKU 100G |
| Egg Mayoneese 500mg | 5 | Ball 100ml → Ball 260 → Ball 250 → Egg Mayoneese 500mg → Ball 230 |
| ADRAK 40G | 4 | ADRAK 40G → ADARAK 250G → SAMPLE ADRAK (FS) → ADRAK 40G (FREE) |
| BLUE 20G | 4 | BLUE 250G → BLUE 500G → BLUE 100G → BLUE 20G |
| GOLD 40G | 4 | KADAK GOLD BLEND → GOLD 500G → GOLD 40G → Gold 250G |
| KADAK PYALI 400G | 4 | A01 Aruna Chicken Sukka Masala 200G → … (FREE) → Ponds Body Lotion 40 mL → KADAK PYALI 400G |
| VAYU 50G | 4 | Big Cup Chocolate → Amrutha Nail Polish (Small) → Bigcup256 → VAYU 50G |
| DAKSHIN 30G | 3 | DAKSHIN 250G → DAKSHIN SPL 250 → DAKSHIN 30G |
| GIRNAR LEAF TEA 50 | 3 | Ball 80ml → Lekhya Soya Oil 400 mL → GIRNAR LEAF TEA 50 |
| Nivea Derma Lotion 100 mL | 3 | A01 Aruna Red Chilli Packet 100G → … Dummy 100G → Nivea Derma Lotion 100 mL |
| TAJ MAHAL SPECIAL TEA 100 | 3 | A01 Aruna Garam Masala New Flavour 45G → Genji Hair Dye (Small) → TAJ MAHAL SPECIAL TEA 100 |
| KANAN DEVAN 20G | 2 | A01 Aruna Golden Turmeric Powder 50g → KANAN DEVAN 20G |
| RL JAR 250 | 2 | RL JAR 1KG → RL JAR 250 |
| ELAICHI 40G | 2 | ELAICHI 40G → ELACHI 250G |
| Amrutha Toothpaste 50g | 2 | Big Cup Mango → Amrutha Toothpaste 50g |
| 3 CEFF NOVO 1.5 INJECTION | 2 | trailing-space variant |
| Black Currant 500ml | 2 | (FREE) suffix |
| Paras Organic Darjeeling … 100gm | 2 | (FREE) suffix |
| RED LABEL | 2 | (FREE) suffix |

The last four are benign suffix edits. The rest are real repurposing, several
across unrelated categories.

**This list is a floor, not a total.** It only sees names that reached an
order line. A row renamed without being ordered under the old name does not
appear.

## A hypothesis this raises for the batch-unit audit

`ADRAK 40G`, `ADUKU 20G`, `BLUE 20G`, `GOLD 40G`, `DAKSHIN 30G` and
`RL JAR 250` all appear both in the rename list above and in Class A of
[inventory-batch-unit-audit.md](inventory-batch-unit-audit.md).

That audit noted the batch/stock ratios matched gram weights in the product
*name* — 40, 100, 250 — and not any configured UOM factor. The rename history
offers a different reading: a batch written while the row was called
`ADARAK 250G` or `BLUE 500G` may have been counted in that pack, and the row
was renamed afterwards. The ratio would then be a record of what the row used
to be, not of a unit mismatch.

**This is a hypothesis and has not been tested.** Testing it means comparing
each batch's `created_at` against the name era the row was in at that moment.
It should be settled before any conversion from that audit is applied.

## Separately resolved: BLUE 100G

The van line for `BLUE 100G` (3,000 g) carries
`product_id = dcaa1d6c-2b37-44ff-ac79-a13647655b3d`, which is **not** a
product — it is a row in `product_variants`, a variant of parent product
`f679f532` = `BLUE 20G`. So this is a variant, not a rename, despite
`BLUE 100G` also appearing in BLUE 20G's own rename history.

Verified:

* `distributor_inventory` rows carrying `variant_id = dcaa1d6c`: **0**
* `distributor_inventory` rows for parent `f679f532`: **2**, both with
  `variant_id IS NULL` (BHARATH BEVERAGES 200, KVP COMPANY 81,000)

`dms_settle_van_day` resolves a van line with

```sql
AND (di.variant_id::text = it.product_id
     OR (di.variant_id IS NULL AND di.product_id::text = it.product_id))
```

A van line holding a *variant* id can therefore only match an inventory row
whose `variant_id` equals it. None exists, and the second branch cannot fire
because `di.product_id` is the parent's id, not the variant's. That is the
`not_stocked_in_that_warehouse` refusal — the stock is real, it just sits on
the parent row.

This is a resolution key problem, not a naming problem, and not data
corruption. It remains unfixed by request.

## Integrity position

| check | result |
|---|---|
| `distributor_inventory.product_id` → `products` | 105 rows, 0 orphans |
| `inventory_batches.product_id` → `products` | 124 rows, 0 orphans |
| `van_stock_items.product_id` → products **or variants** | 52 rows, 0 orphans |
| `distributor_inventory` rows with stale `product_name` | **13** |

No foreign key enforces `product_id` on any of those three tables; only
`variant_id` is enforced. Nothing is currently orphaned, so the missing
constraints have not caused breakage — the damage is in the denormalised names
instead.

## For decision

1. **Nothing is written until these are reviewed.** The four headline rows
   carry real quantities (419, 947, 1050, 920 at KVP; 161, 153, 40, 120 at VM)
   and it is a business question whether they are live stock or leftover test
   fixtures.
2. **Deciding the display is cheap and safe.** Having the portal join
   `products.name` instead of reading the stored copy fixes all thirteen rows
   at once and writes nothing. It does mean historical documents and live
   screens would disagree, which may be the wrong trade for invoices.
3. **Backfilling the stored copy is not reversible** and should not be done
   from the current master name alone, because two of the four SKUs say the
   rename itself was incomplete.
4. **Auditing `products.name` and `products.sku`** would stop this becoming
   unanswerable next time. It is a trigger change, independent of any data
   decision.
5. **The reconciliation job should join `products`**, or the stale names will
   keep being copied into new ledger rows.
