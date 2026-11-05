-- Regression tests for how dms_settle_van_day accounts for stock coming back
-- from a van: good, damaged, expired, a mix of all three, and stock still on
-- board.
--
-- HOW TO RUN
--
--   psql "$DATABASE_URL" -f supabase/tests/dms_settle_van_day_returns.sql
--
-- Results print as NOTICEs. The script exits 0 when every case passes and
-- non-zero when one does not, so it can be used as a check in CI.
--
-- In a SQL console that manages its own transaction (the Supabase editor, for
-- example), run only the DO block: the surrounding BEGIN/ROLLBACK will be
-- ignored or rejected there, and the DO block raises on failure, which rolls
-- its own work back regardless.
--
-- PREREQUISITES
--
--   * A role that may INSERT into distributors, warehouses, vans, van_stock,
--     van_stock_items, distributor_inventory and van_day_postings. Run it as
--     the owner or service role; an RLS-restricted role will not do.
--   * At least one row in auth.users (van_stock.user_id references a real user).
--   * At least one row in products.
--   * dms_settle_van_day and its dependencies installed.
--
-- The script checks each of these and stops with a plain message if one is
-- missing, rather than failing somewhere confusing further in.
--
-- NOTHING IS LEFT BEHIND. Every row it writes is created inside the
-- transaction and discarded by the ROLLBACK at the end. On failure the
-- exception aborts the transaction, which discards them too — so fixtures are
-- rolled back whether assertions pass, assertions fail, or the function throws.
--
-- WHAT IS BEING ASSERTED
--
-- Conservation: nothing may appear or disappear. For a day with no sales,
--
--     warehouse quantity + on-van quantity = what was there before
--
-- and of the warehouse figure, damaged_quantity and expired_quantity are the
-- unusable parts, so
--
--     available = quantity - damaged_quantity - expired_quantity
--
-- Before the `+ v_damaged` fix, cases 2 and 3 failed here: goods returned
-- damaged were added to damaged_quantity but never to quantity, so they were
-- subtracted from availability without ever being credited to it, and
-- conservation came up short by exactly the damaged amount.
--
-- Cases 5 and 6 cover the expired bucket, which has the same shape. Before
-- returned_expired_qty existed, expired goods had to be entered as damaged, so
-- case 5 could not be expressed at all: the available figure came out right
-- while the books attributed slow rotation to breakage. Case 6 then settles the
-- same day a second time and asserts nothing moves, which is what proves
-- expired_posted is tracked as a delta rather than re-added on every save.

BEGIN;

DO $test$
DECLARE
  fails int := 0;
  d_id uuid; w_id uuid; v_id uuid; day_id uuid; u_id uuid; prod uuid;
  q int; onv numeric; dmg int; expd int;
  q2 int; onv2 numeric; dmg2 int; expd2 int;
BEGIN
  ------------------------------------------------------------- prerequisites
  SELECT id INTO u_id FROM auth.users LIMIT 1;
  IF u_id IS NULL THEN
    RAISE EXCEPTION 'Prerequisite missing: auth.users is empty, and van_stock.user_id needs a real user.';
  END IF;

  SELECT id INTO prod FROM products LIMIT 1;
  IF prod IS NULL THEN
    RAISE EXCEPTION 'Prerequisite missing: products is empty.';
  END IF;

  IF to_regprocedure('public.dms_settle_van_day(uuid, boolean)') IS NULL THEN
    RAISE EXCEPTION 'Prerequisite missing: dms_settle_van_day(uuid, boolean) is not installed.';
  END IF;

  ----------------------------------------------------------------- fixtures
  INSERT INTO distributors (name, contact_person, phone)
  VALUES ('ZZ REGRESSION van returns', 'test', '0') RETURNING id INTO d_id;
  INSERT INTO warehouses (distributor_id, name, code, is_default)
  VALUES (d_id, 'ZZ regression WH', 'ZZRW', true) RETURNING id INTO w_id;
  INSERT INTO vans (registration_number, make_model, distributor_id, is_active)
  VALUES ('ZZ-REG-0001', 'test', d_id, true) RETURNING id INTO v_id;
  INSERT INTO distributor_inventory (distributor_id, product_id, product_name,
    quantity, reserved_quantity, damaged_quantity, expired_quantity, unit, warehouse_id)
  VALUES (d_id, prod, 'regression product', 10000, 0, 0, 0, 'GRAM', w_id);
  INSERT INTO van_stock (van_id, user_id, stock_date, warehouse_id, status)
  VALUES (v_id, u_id, CURRENT_DATE, w_id, 'morning_saved') RETURNING id INTO day_id;

  ---------------------------------------------------------------------------
  -- CASE 1: everything comes back good.
  -- 1000 out, 1000 good back, nothing on the van -> warehouse back to 10000.
  ---------------------------------------------------------------------------
  INSERT INTO van_stock_items (van_stock_id, product_id, product_name,
    start_qty, ordered_qty, returned_qty, left_qty, unit)
  VALUES (day_id, prod::text, 'regression product', 1000, 0, 0, 1000, 'GRAM');
  PERFORM dms_settle_van_day(day_id, false);
  UPDATE van_stock_items SET returned_good_qty = 1000, returned_damaged_qty = 0,
         counted_qty = 0, left_qty = 0 WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'closing_verified' WHERE id = day_id;
  PERFORM dms_settle_van_day(day_id, false);

  SELECT quantity, on_van_quantity, damaged_quantity INTO q, onv, dmg
    FROM distributor_inventory WHERE distributor_id = d_id AND product_id = prod;
  RAISE NOTICE 'case 1  all good back     qty %/10000  onvan %/0  damaged %/0  available %/10000  %',
    q, onv, dmg, q - dmg, CASE WHEN q=10000 AND onv=0 AND dmg=0 THEN 'PASS' ELSE 'FAIL' END;
  IF NOT (q=10000 AND onv=0 AND dmg=0) THEN fails := fails + 1; END IF;

  ---------------------------------------------------------------------------
  -- CASE 2: everything comes back damaged.
  -- 1000 out, 1000 damaged back. All physically returned and all unusable:
  -- quantity 10000, damaged 1000, available 9000. Nothing disappears.
  ---------------------------------------------------------------------------
  UPDATE distributor_inventory SET quantity = 10000, on_van_quantity = 0, damaged_quantity = 0
   WHERE distributor_id = d_id AND product_id = prod;
  DELETE FROM van_day_postings WHERE distributor_id = d_id;
  DELETE FROM van_stock_items WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'morning_saved' WHERE id = day_id;

  INSERT INTO van_stock_items (van_stock_id, product_id, product_name,
    start_qty, ordered_qty, returned_qty, left_qty, unit)
  VALUES (day_id, prod::text, 'regression product', 1000, 0, 0, 1000, 'GRAM');
  PERFORM dms_settle_van_day(day_id, false);
  UPDATE van_stock_items SET returned_good_qty = 0, returned_damaged_qty = 1000,
         counted_qty = 0, left_qty = 0 WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'closing_verified' WHERE id = day_id;
  PERFORM dms_settle_van_day(day_id, false);

  SELECT quantity, on_van_quantity, damaged_quantity INTO q, onv, dmg
    FROM distributor_inventory WHERE distributor_id = d_id AND product_id = prod;
  RAISE NOTICE 'case 2  all damaged back  qty %/10000  onvan %/0  damaged %/1000  available %/9000  %',
    q, onv, dmg, q - dmg, CASE WHEN q=10000 AND onv=0 AND dmg=1000 THEN 'PASS' ELSE 'FAIL' END;
  IF NOT (q=10000 AND onv=0 AND dmg=1000) THEN fails := fails + 1; END IF;

  ---------------------------------------------------------------------------
  -- CASE 3: a mix, with stock still on the van.
  -- 2000 out; 1500 good and 200 damaged back; 300 counted on the van.
  -- Warehouse holds 9700, of which 200 unusable -> 9500 available, and
  -- 9700 + 300 accounts for all 10000.
  ---------------------------------------------------------------------------
  UPDATE distributor_inventory SET quantity = 10000, on_van_quantity = 0, damaged_quantity = 0
   WHERE distributor_id = d_id AND product_id = prod;
  DELETE FROM van_day_postings WHERE distributor_id = d_id;
  DELETE FROM van_stock_items WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'morning_saved' WHERE id = day_id;

  INSERT INTO van_stock_items (van_stock_id, product_id, product_name,
    start_qty, ordered_qty, returned_qty, left_qty, unit)
  VALUES (day_id, prod::text, 'regression product', 2000, 0, 0, 2000, 'GRAM');
  PERFORM dms_settle_van_day(day_id, false);
  UPDATE van_stock_items SET returned_good_qty = 1500, returned_damaged_qty = 200,
         counted_qty = 300, left_qty = 300 WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'closing_verified' WHERE id = day_id;
  PERFORM dms_settle_van_day(day_id, false);

  SELECT quantity, on_van_quantity, damaged_quantity INTO q, onv, dmg
    FROM distributor_inventory WHERE distributor_id = d_id AND product_id = prod;
  RAISE NOTICE 'case 3  mixed + on van    qty %/9700   onvan %/300  damaged %/200   available %/9500  %',
    q, onv, dmg, q - dmg, CASE WHEN q=9700 AND onv=300 AND dmg=200 THEN 'PASS' ELSE 'FAIL' END;
  IF NOT (q=9700 AND onv=300 AND dmg=200) THEN fails := fails + 1; END IF;

  RAISE NOTICE 'conservation  warehouse % + on van % = % / 10000   %',
    q, onv, q + onv, CASE WHEN q + onv = 10000 THEN 'PASS' ELSE 'FAIL' END;
  IF q + onv <> 10000 THEN fails := fails + 1; END IF;

  ---------------------------------------------------------------------------
  -- CASE 4: nothing comes back; the van keeps it all.
  ---------------------------------------------------------------------------
  UPDATE distributor_inventory SET quantity = 10000, on_van_quantity = 0, damaged_quantity = 0
   WHERE distributor_id = d_id AND product_id = prod;
  DELETE FROM van_day_postings WHERE distributor_id = d_id;
  DELETE FROM van_stock_items WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'morning_saved' WHERE id = day_id;

  INSERT INTO van_stock_items (van_stock_id, product_id, product_name,
    start_qty, ordered_qty, returned_qty, left_qty, unit)
  VALUES (day_id, prod::text, 'regression product', 500, 0, 0, 500, 'GRAM');
  PERFORM dms_settle_van_day(day_id, false);
  UPDATE van_stock_items SET returned_good_qty = 0, returned_damaged_qty = 0,
         counted_qty = 500, left_qty = 500 WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'closing_verified' WHERE id = day_id;
  PERFORM dms_settle_van_day(day_id, false);

  SELECT quantity, on_van_quantity, damaged_quantity INTO q, onv, dmg
    FROM distributor_inventory WHERE distributor_id = d_id AND product_id = prod;
  RAISE NOTICE 'case 4  all stays on van  qty %/9500   onvan %/500  damaged %/0     available %/9500  %',
    q, onv, dmg, q - dmg, CASE WHEN q=9500 AND onv=500 AND dmg=0 THEN 'PASS' ELSE 'FAIL' END;
  IF NOT (q=9500 AND onv=500 AND dmg=0) THEN fails := fails + 1; END IF;

  ---------------------------------------------------------------------------
  -- CASE 5: the three-way split, the shape a real day has.
  -- 2000 loaded out and all 2000 sold; a retailer hands 1000 back onto the
  -- van, which the rep splits at close into 600 good, 300 damaged, 100 expired
  -- and returns all of it to the warehouse, so nothing stays on board.
  --
  -- Warehouse: 10000 - 2000 out + 1000 back = 9000, of which 300 damaged and
  -- 100 expired are unusable -> 8600 available. Net sold is 1000, which is the
  -- 10000 we started with less the 9000 still held.
  --
  -- The point of the case is the last two columns. Available comes out at 8600
  -- whether that 100 is called damaged or expired, so a test that only checked
  -- availability would have passed before this change too. What was wrong was
  -- the attribution, and that is what is asserted here.
  ---------------------------------------------------------------------------
  UPDATE distributor_inventory SET quantity = 10000, on_van_quantity = 0,
         damaged_quantity = 0, expired_quantity = 0
   WHERE distributor_id = d_id AND product_id = prod;
  DELETE FROM van_day_postings WHERE distributor_id = d_id;
  DELETE FROM van_stock_items WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'morning_saved' WHERE id = day_id;

  INSERT INTO van_stock_items (van_stock_id, product_id, product_name,
    start_qty, ordered_qty, returned_qty, left_qty, unit)
  VALUES (day_id, prod::text, 'regression product', 2000, 2000, 1000, 1000, 'GRAM');
  PERFORM dms_settle_van_day(day_id, false);
  UPDATE van_stock_items SET returned_good_qty = 600, returned_damaged_qty = 300,
         returned_expired_qty = 100, counted_qty = 0, left_qty = 0
   WHERE van_stock_id = day_id;
  UPDATE van_stock SET status = 'closing_verified' WHERE id = day_id;
  PERFORM dms_settle_van_day(day_id, false);

  SELECT quantity, on_van_quantity, damaged_quantity, expired_quantity
    INTO q, onv, dmg, expd
    FROM distributor_inventory WHERE distributor_id = d_id AND product_id = prod;
  RAISE NOTICE 'case 5  good+dmg+expired  qty %/9000   onvan %/0    damaged %/300   expired %/100  available %/8600  %',
    q, onv, dmg, expd, q - dmg - expd,
    CASE WHEN q=9000 AND onv=0 AND dmg=300 AND expd=100 THEN 'PASS' ELSE 'FAIL' END;
  IF NOT (q=9000 AND onv=0 AND dmg=300 AND expd=100) THEN fails := fails + 1; END IF;

  ---------------------------------------------------------------------------
  -- CASE 6: settling the same day again moves nothing.
  -- Picks up exactly where case 5 left off, so the expired bucket is non-zero
  -- going in. Every delta is the difference against van_day_postings, so a
  -- second settle of an unchanged day has nothing to write -- and a bucket that
  -- was posted but not recorded would be added a second time here.
  ---------------------------------------------------------------------------
  PERFORM dms_settle_van_day(day_id, false);
  PERFORM dms_settle_van_day(day_id, false);

  SELECT quantity, on_van_quantity, damaged_quantity, expired_quantity
    INTO q2, onv2, dmg2, expd2
    FROM distributor_inventory WHERE distributor_id = d_id AND product_id = prod;
  RAISE NOTICE 'case 6  settle twice more  qty %/%  onvan %/%  damaged %/%  expired %/%  %',
    q2, q, onv2, onv, dmg2, dmg, expd2, expd,
    CASE WHEN q2=q AND onv2=onv AND dmg2=dmg AND expd2=expd THEN 'PASS' ELSE 'FAIL' END;
  IF NOT (q2=q AND onv2=onv AND dmg2=dmg AND expd2=expd) THEN fails := fails + 1; END IF;

  IF fails > 0 THEN
    -- Aborts the transaction, which discards every fixture above.
    RAISE EXCEPTION '% van-return case(s) FAILED', fails;
  END IF;

  RAISE NOTICE 'ALL CASES PASS';
END
$test$;

-- Discards the fixtures on the passing path. On the failing path the exception
-- has already aborted the transaction and this is a no-op.
ROLLBACK;
