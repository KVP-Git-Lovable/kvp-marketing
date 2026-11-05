# Inventory batch / stock reconciliation audit

**Read-only.** Nothing in this document has been applied. It exists so the
conversions can be judged before anything is written.

Generated 26 Oct 2026 against the Dev/staging database
(`aoxdosjkwqyuvccuwhzc`).

---

## What started this

The DMS inventory screen warns when a product's batches disagree with its
stock figures. ADRAK 40G showed *"Batches total 50.25 kg, stock says
50.196 kg"* — a 54 g gap. Two separate problems were behind it.

### 1. The warning itself was overstating every gap (fixed)

The comparison was

```
batches  vs  available + reserved + on_van
```

but `available_quantity` is derived as `quantity − reserved − damaged −
expired`. Adding back only `reserved` leaves damaged and expired stock counted
in the batches and missing from the other side, so every row holding either one
reported a discrepancy exactly that size. ADRAK's 54 g was really 52 g.

Now compares against `available + reserved + damaged + expired + on_van`.

### 2. Batches and stock are genuinely in different units (NOT fixed)

`inventory_batches` has **no unit column**. A batch quantity is a bare number,
interpreted as the product's *current* base unit. When the UOM migration
converted stock to base units on 16 Oct, batches were left untouched — so any
batch written before that still holds whatever unit the person had in mind.

The correction transactions say so explicitly:

> `unit corrected to the configured base: 50 pcs recorded as pcs is 2000 GRAM`

That batch still reads `50`. The panel adds it to a gram total as 50 grams.

---

## Why these cannot be converted mechanically

The ratios between batch sums and stock look like pack sizes — 40, 100, 250 and
their reciprocals. **They are not configured conversions.** The only pack units
configured are:

| Base unit | Configured packs |
|---|---|
| PIECE | BOX = 100, CARTON = 1000 |
| GRAM | KG = 1000 |

A ratio of 40 for `KADAK PYALI BLUE 40G` matches the gram weight in the
*product name*, which exists nowhere in the UOM configuration. Of 21 mismatched
product/distributor pairs, **one** resolves against a configured factor. The
other 20 would require inferring a unit from a product-name string.

That is the reason this document stops at proposals.

---

## Three distinct classes

### Class A — batch predates its product's UOM correction

Unit is suspect. These are the ones the correction notes directly describe.

| Product | Distributor | Batch | Qty | Created | Batch sum | Stock owned |
|---|---|---|---|---|---|---|
| ADRAK 40G | KVP Business Solutions | WH-01-261015-Ada40-001 | 50 | 15 Oct | 50,250 | 50,198 |
| ADRAK 40G | BHARATH BEVERAGES | WH-01-261006-Ada40-001 | 8 | 06 Oct | 28 | 1,120 |
| ADRAK 40G | BHARATH BEVERAGES | WH-01-261014-Ada40-001 | 20 | 14 Oct | 28 | 1,120 |
| ADUKU 20G | KVP Business Solutions | WH-01-261015-Adu20-001 | 50 | 15 Oct | 60,050 | 59,000 |
| ADUKU 20G | BHARATH BEVERAGES | WH-01-261006-Adu20-001 | 10 | 06 Oct | 10 | 200 |
| BLUE 20G | KVP Business Solutions | WH-01-261015-Bl20-001 | 50 | 15 Oct | 80,050 | 81,000 |
| BLUE 20G | BHARATH BEVERAGES | WH-01-261006-Bl20-001 | 10 | 06 Oct | 10 | 200 |
| DAKSHIN 30G | BHARATH BEVERAGES | WH-01-261014-Dak30-001 | 10 | 14 Oct | 10 | 300 |
| DAKSHIN GOLD (HORECA) | BHARATH BEVERAGES | WH-01-261014-DGH5-001 | 10 | 14 Oct | 10 | 50,000 |
| GOLD 40G | BHARATH BEVERAGES | WH-01-261014-Gold40-001 | 10 | 14 Oct | 10 | 400 |
| RL JAR 250 | BHARATH BEVERAGES | WH-01-261014-Jar250-001 | 10 | 14 Oct | 10 | 2,500 |

**A caution that review needs to settle.** For ADRAK 40G / KVP, converting the
15 Oct batch from 50 pcs to 2,000 g raises the batch sum from 50,250 to 52,200
against stock of 50,198 — the gap grows from 52 g to 2,002 g. Either the
conversion is wrong, or a second cause is also at work on that product. It
should not be applied on the strength of the ratio alone.

### Class B — legacy April batches at a different scale

Round numbers far above the stock they claim to describe.

| Product | Distributor | Batch | Qty | Stock owned | Ratio |
|---|---|---|---|---|---|
| KADAK PYALI YELLOW 100G | Sri Tirumala | B004 | 250,000 | 2,500 | 100 |
| KADAK PYALI BLUE 40G | Sri Tirumala | B003 | 200,000 | 5,000 | 40 |
| KADAK PYALI ADARAK 250G | Sri Tirumala | B002 | 100,000 | 400 | 250 |
| KADAK GOLD | Sri Tirumala | B001 | 100,000 | 400 | 250 |
| KADAK PYALI YELLOW 100G | South Canara | LEGACY-MAIN-KPY-100G | 100 | 200 | 0.5 |
| KADAK PYALI BLUE 40G | South Canara | LEGACY-MAIN-KPB-40G | 18 | 20 | 0.9 |
| KADAK GOLD | South Canara | LEGACY-MAIN-KG-250G | 2 | 3 | 0.667 |

The `Sri Tirumala` rows look like base units recorded against stock held in
packs — the opposite direction to Class A. The `South Canara` LEGACY rows have
no clean ratio at all and look like ordinary drift.

### Class C — no UOM correction ever, yet still mismatched

These products were never touched by the UOM migration, so units are not the
explanation. This is drift: settlement, sales and receipts write
`distributor_inventory` but never `inventory_batches`.

| Product | Distributor | Batch sum | Stock owned | Gap |
|---|---|---|---|---|
| Amrutha Toothpaste 50g | VM Distributor | 200 | 120 | +80 |
| Big Cup Vanilla | VM Distributor | 150 | 100 | +50 |
| Chocobar | VM Distributor | 80 | 40 | +40 |
| Butterscotch 500ml | VM Distributor | 1 | 101 | −100 |

Class C cannot be fixed by a unit conversion. It needs either a recount or a
decision that batches are not expected to track every movement.

---

## The structural problem underneath all three

1. **`inventory_batches` has no `unit` column.** Nothing records what a batch
   quantity means. Adding one is the only change that stops this recurring —
   but it needs a value for all existing rows, which is the same judgement call
   this document is asking for.

2. **Van settlement never writes batches.** `dms_settle_van_day` updates
   `distributor_inventory` only. Every loadout, sale and return widens the gap
   a little, permanently. That is Class C, and it will keep happening to Class A
   and B products too, on top of their unit problems.

---

## Proposed order, for decision

1. Nothing is written until the tables above are reviewed per row.
2. Class C is a separate question from Class A and B and should be decided
   separately — it is about whether batches are meant to be a running record or
   a receipt log.
3. If batches are meant to track movements, settlement has to write them, and
   that is a design change, not a data fix.
4. `unit` on `inventory_batches` should be added **after** the existing rows
   are judged, not before, so the column is populated with reviewed values
   rather than guesses.
