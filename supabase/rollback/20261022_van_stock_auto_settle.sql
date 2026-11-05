-- Rolls back 20261022100000_van_stock_auto_settle.sql.
-- Removes the triggers and functions only. van_settlement_log is kept so the
-- history of refusals is not lost; drop it by hand if it is not wanted.
-- Postings already made stay posted (they are ordinary ledger rows).
--
-- Not a migration. Kept out of supabase/migrations so it is never replayed.

drop trigger if exists trg_van_items_settle_ins on public.van_stock_items;
drop trigger if exists trg_van_items_settle_upd on public.van_stock_items;
drop trigger if exists trg_van_items_settle_del on public.van_stock_items;
drop trigger if exists trg_van_stock_settle_upd on public.van_stock;
drop function if exists public.tg_van_items_auto_settle();
drop function if exists public.tg_van_stock_auto_settle();
drop function if exists public.dms_auto_settle_van_day(uuid);
