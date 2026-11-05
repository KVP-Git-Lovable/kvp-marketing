SET LOCAL app.allow_destructive = 'on';
CREATE TABLE IF NOT EXISTS replay_log.errors2(id serial, file text, stmt text, err text, state text);
TRUNCATE replay_log.errors2;
DO $R$ BEGIN EXECUTE $Q1$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS sales_credit_user_id uuid$Q1$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260529113604_10bfb721-f16d-414d-a28e-8b65108969c9.sql', left($Q1$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS sales_credit_user_id uuid$Q1$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q2$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS collected_by_user_id uuid$Q2$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260529113604_10bfb721-f16d-414d-a28e-8b65108969c9.sql', left($Q2$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS collected_by_user_id uuid$Q2$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q3$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS operational_snapshot_user_id uuid$Q3$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260529113604_10bfb721-f16d-414d-a28e-8b65108969c9.sql', left($Q3$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS operational_snapshot_user_id uuid$Q3$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q4$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS owner_snapshot_user_id uuid$Q4$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260529113604_10bfb721-f16d-414d-a28e-8b65108969c9.sql', left($Q4$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS owner_snapshot_user_id uuid$Q4$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q5$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS unallocated_amount numeric(14,2) NOT NULL DEFAULT 0$Q5$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260529113604_10bfb721-f16d-414d-a28e-8b65108969c9.sql', left($Q5$-- Column additions
ALTER TABLE public.distributor_payments ADD COLUMN IF NOT EXISTS unallocated_amount numeric(14,2) NOT NULL DEFAULT 0$Q5$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q6$ALTER TABLE public.distributor_secondary_invoices ADD COLUMN IF NOT EXISTS owner_snapshot_user_id uuid$Q6$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260529113604_10bfb721-f16d-414d-a28e-8b65108969c9.sql', left($Q6$ALTER TABLE public.distributor_secondary_invoices ADD COLUMN IF NOT EXISTS owner_snapshot_user_id uuid$Q6$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q7$ALTER TABLE public.distributor_secondary_invoices ADD COLUMN IF NOT EXISTS operational_snapshot_user_id uuid$Q7$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260529113604_10bfb721-f16d-414d-a28e-8b65108969c9.sql', left($Q7$ALTER TABLE public.distributor_secondary_invoices ADD COLUMN IF NOT EXISTS operational_snapshot_user_id uuid$Q7$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q8$ALTER TABLE public.distributor_secondary_invoices ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'$Q8$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260529113604_10bfb721-f16d-414d-a28e-8b65108969c9.sql', left($Q8$ALTER TABLE public.distributor_secondary_invoices ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'$Q8$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q9$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS updated_by uuid$Q9$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260601084631_d87b450a-004b-4065-90df-97b29bc3ea5f.sql', left($Q9$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS updated_by uuid$Q9$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q10$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS deactivated_at timestamptz$Q10$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260601084631_d87b450a-004b-4065-90df-97b29bc3ea5f.sql', left($Q10$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS deactivated_at timestamptz$Q10$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q11$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS deactivated_by uuid$Q11$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260601084631_d87b450a-004b-4065-90df-97b29bc3ea5f.sql', left($Q11$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS deactivated_by uuid$Q11$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q12$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS reactivated_at timestamptz$Q12$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260601084631_d87b450a-004b-4065-90df-97b29bc3ea5f.sql', left($Q12$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS reactivated_at timestamptz$Q12$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q13$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS reactivated_by uuid$Q13$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260601084631_d87b450a-004b-4065-90df-97b29bc3ea5f.sql', left($Q13$-- 1a. beats lifecycle columns
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS reactivated_by uuid$Q13$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q14$-- ============================================================
-- SECTION 2: beats columns + backfill (skip user triggers)
-- ============================================================
ALTER TABLE beats ADD COLUMN IF NOT EXISTS transferred_at  TIMESTAMPTZ DEFAULT NULL$Q14$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260603084854_dd9280f5-30eb-4d52-9fcd-e87bc555ca2a.sql', left($Q14$-- ============================================================
-- SECTION 2: beats columns + backfill (skip user triggers)
-- ============================================================
ALTER TABLE beats ADD COLUMN IF NOT EXISTS transferred_at  TIMESTAMPTZ DEFAULT NULL$Q14$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q15$-- ============================================================
-- SECTION 2: beats columns + backfill (skip user triggers)
-- ============================================================
ALTER TABLE beats ADD COLUMN IF NOT EXISTS transferred_by  UUID        DEFAULT NULL$Q15$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260603084854_dd9280f5-30eb-4d52-9fcd-e87bc555ca2a.sql', left($Q15$-- ============================================================
-- SECTION 2: beats columns + backfill (skip user triggers)
-- ============================================================
ALTER TABLE beats ADD COLUMN IF NOT EXISTS transferred_by  UUID        DEFAULT NULL$Q15$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q16$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verified_by uuid$Q16$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610063902_56e8c7c2-b912-451e-bfe1-27b803d3fa4b.sql', left($Q16$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verified_by uuid$Q16$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q17$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verified_by_name text$Q17$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610063902_56e8c7c2-b912-451e-bfe1-27b803d3fa4b.sql', left($Q17$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verified_by_name text$Q17$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q18$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verified_at timestamptz$Q18$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610063902_56e8c7c2-b912-451e-bfe1-27b803d3fa4b.sql', left($Q18$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verified_at timestamptz$Q18$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q19$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verification_method text$Q19$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610063902_56e8c7c2-b912-451e-bfe1-27b803d3fa4b.sql', left($Q19$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verification_method text$Q19$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q20$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verification_notes text$Q20$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610063902_56e8c7c2-b912-451e-bfe1-27b803d3fa4b.sql', left($Q20$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verification_notes text$Q20$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q21$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS unverified_order_count integer NOT NULL DEFAULT 0$Q21$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610063902_56e8c7c2-b912-451e-bfe1-27b803d3fa4b.sql', left($Q21$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS unverified_order_count integer NOT NULL DEFAULT 0$Q21$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q22$INSERT INTO public.retailer_verification_policy (company_id, enabled, max_orders_unverified, block_after_limit, grace_days, require_verification_for_credit, auto_whatsapp_on_create)
SELECT NULL, false, 3, false, 0, false, true
WHERE NOT EXISTS (SELECT 1 FROM public.retailer_verification_policy WHERE company_id IS NULL)$Q22$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610063902_56e8c7c2-b912-451e-bfe1-27b803d3fa4b.sql', left($Q22$INSERT INTO public.retailer_verification_policy (company_id, enabled, max_orders_unverified, block_after_limit, grace_days, require_verification_for_credit, auto_whatsapp_on_create)
SELECT NULL, false, 3, false, 0, false, true
WHERE NOT EXISTS (SELECT 1 FROM public.retailer_verification_policy WHERE company_id IS NULL)$Q22$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q23$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verification_score integer NOT NULL DEFAULT 0$Q23$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q23$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verification_score integer NOT NULL DEFAULT 0$Q23$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q24$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'unverified'$Q24$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q24$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'unverified'$Q24$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q25$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS duplicate_risk_score integer NOT NULL DEFAULT 0$Q25$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q25$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS duplicate_risk_score integer NOT NULL DEFAULT 0$Q25$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q26$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.retailers(id) ON DELETE SET NULL$Q26$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q26$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.retailers(id) ON DELETE SET NULL$Q26$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q27$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS alternate_phone text$Q27$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q27$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS alternate_phone text$Q27$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q28$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS shop_front_visible boolean NOT NULL DEFAULT false$Q28$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q28$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS shop_front_visible boolean NOT NULL DEFAULT false$Q28$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q29$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS first_visit_completed boolean NOT NULL DEFAULT false$Q29$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q29$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS first_visit_completed boolean NOT NULL DEFAULT false$Q29$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q30$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS first_order_placed boolean NOT NULL DEFAULT false$Q30$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q30$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS first_order_placed boolean NOT NULL DEFAULT false$Q30$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q31$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS whatsapp_verified boolean NOT NULL DEFAULT false$Q31$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q31$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS whatsapp_verified boolean NOT NULL DEFAULT false$Q31$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q32$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS retailer_confirmed boolean NOT NULL DEFAULT false$Q32$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q32$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS retailer_confirmed boolean NOT NULL DEFAULT false$Q32$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q33$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS quality_last_calculated_at timestamptz$Q33$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085615_210ef9fb-021f-4ed7-ad07-0472bf64d2f8.sql', left($Q33$-- 1. Extend retailers
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS quality_last_calculated_at timestamptz$Q33$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q34$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_mobile boolean NOT NULL DEFAULT true$Q34$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q34$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_mobile boolean NOT NULL DEFAULT true$Q34$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q35$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_whatsapp boolean NOT NULL DEFAULT false$Q35$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q35$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_whatsapp boolean NOT NULL DEFAULT false$Q35$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q36$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_gps boolean NOT NULL DEFAULT true$Q36$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q36$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_gps boolean NOT NULL DEFAULT true$Q36$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q37$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_shop_photo boolean NOT NULL DEFAULT false$Q37$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q37$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_shop_photo boolean NOT NULL DEFAULT false$Q37$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q38$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_owner_name boolean NOT NULL DEFAULT false$Q38$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q38$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_owner_name boolean NOT NULL DEFAULT false$Q38$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q39$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_gst boolean NOT NULL DEFAULT false$Q39$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q39$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_gst boolean NOT NULL DEFAULT false$Q39$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q40$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_first_visit boolean NOT NULL DEFAULT false$Q40$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q40$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS req_first_visit boolean NOT NULL DEFAULT false$Q40$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q41$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Score engine points
  ADD COLUMN IF NOT EXISTS pts_mobile integer NOT NULL DEFAULT 20$Q41$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q41$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Score engine points
  ADD COLUMN IF NOT EXISTS pts_mobile integer NOT NULL DEFAULT 20$Q41$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q42$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_whatsapp integer NOT NULL DEFAULT 20$Q42$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q42$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_whatsapp integer NOT NULL DEFAULT 20$Q42$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q43$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_gps integer NOT NULL DEFAULT 10$Q43$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q43$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_gps integer NOT NULL DEFAULT 10$Q43$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q44$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_shop_photo integer NOT NULL DEFAULT 10$Q44$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q44$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_shop_photo integer NOT NULL DEFAULT 10$Q44$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q45$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_address integer NOT NULL DEFAULT 10$Q45$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q45$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_address integer NOT NULL DEFAULT 10$Q45$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q46$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_gst integer NOT NULL DEFAULT 10$Q46$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q46$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_gst integer NOT NULL DEFAULT 10$Q46$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q47$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_owner integer NOT NULL DEFAULT 5$Q47$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q47$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_owner integer NOT NULL DEFAULT 5$Q47$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q48$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_first_visit integer NOT NULL DEFAULT 5$Q48$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q48$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_first_visit integer NOT NULL DEFAULT 5$Q48$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q49$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_first_order integer NOT NULL DEFAULT 10$Q49$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q49$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS pts_first_order integer NOT NULL DEFAULT 10$Q49$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q50$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Status thresholds
  ADD COLUMN IF NOT EXISTS threshold_partial integer NOT NULL DEFAULT 40$Q50$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q50$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Status thresholds
  ADD COLUMN IF NOT EXISTS threshold_partial integer NOT NULL DEFAULT 40$Q50$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q51$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS threshold_verified integer NOT NULL DEFAULT 70$Q51$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q51$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS threshold_verified integer NOT NULL DEFAULT 70$Q51$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q52$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS threshold_gold integer NOT NULL DEFAULT 90$Q52$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q52$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS threshold_gold integer NOT NULL DEFAULT 90$Q52$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q53$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Duplicate detection
  ADD COLUMN IF NOT EXISTS dup_check_mobile boolean NOT NULL DEFAULT true$Q53$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q53$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Duplicate detection
  ADD COLUMN IF NOT EXISTS dup_check_mobile boolean NOT NULL DEFAULT true$Q53$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q54$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_check_gst boolean NOT NULL DEFAULT true$Q54$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q54$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_check_gst boolean NOT NULL DEFAULT true$Q54$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q55$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_check_name boolean NOT NULL DEFAULT true$Q55$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q55$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_check_name boolean NOT NULL DEFAULT true$Q55$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q56$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_check_address boolean NOT NULL DEFAULT false$Q56$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q56$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_check_address boolean NOT NULL DEFAULT false$Q56$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q57$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_check_gps boolean NOT NULL DEFAULT true$Q57$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q57$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_check_gps boolean NOT NULL DEFAULT true$Q57$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q58$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_action text NOT NULL DEFAULT 'require_approval'$Q58$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q58$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_action text NOT NULL DEFAULT 'require_approval'$Q58$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q59$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_risk_threshold integer NOT NULL DEFAULT 70$Q59$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q59$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS dup_risk_threshold integer NOT NULL DEFAULT 70$Q59$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q60$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Approval workflow
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false$Q60$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q60$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Approval workflow
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false$Q60$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q61$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS approval_level text NOT NULL DEFAULT 'manager'$Q61$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q61$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS approval_level text NOT NULL DEFAULT 'manager'$Q61$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q62$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS auto_approve_score integer NOT NULL DEFAULT 90$Q62$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q62$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS auto_approve_score integer NOT NULL DEFAULT 90$Q62$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q63$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS auto_reject_dup_risk integer NOT NULL DEFAULT 90$Q63$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q63$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS auto_reject_dup_risk integer NOT NULL DEFAULT 90$Q63$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q64$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS expire_pending_days integer NOT NULL DEFAULT 30$Q64$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q64$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS expire_pending_days integer NOT NULL DEFAULT 30$Q64$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q65$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Gamification points
  ADD COLUMN IF NOT EXISTS gp_created integer NOT NULL DEFAULT 10$Q65$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q65$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy -- Gamification points
  ADD COLUMN IF NOT EXISTS gp_created integer NOT NULL DEFAULT 10$Q65$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q66$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_mobile integer NOT NULL DEFAULT 20$Q66$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q66$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_mobile integer NOT NULL DEFAULT 20$Q66$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q67$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_whatsapp integer NOT NULL DEFAULT 20$Q67$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q67$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_whatsapp integer NOT NULL DEFAULT 20$Q67$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q68$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_gps integer NOT NULL DEFAULT 10$Q68$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q68$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_gps integer NOT NULL DEFAULT 10$Q68$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q69$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_photo integer NOT NULL DEFAULT 10$Q69$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q69$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_photo integer NOT NULL DEFAULT 10$Q69$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q70$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_first_visit integer NOT NULL DEFAULT 10$Q70$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q70$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_first_visit integer NOT NULL DEFAULT 10$Q70$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q71$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_first_order integer NOT NULL DEFAULT 20$Q71$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q71$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_first_order integer NOT NULL DEFAULT 20$Q71$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q72$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_revoke_on_fraud boolean NOT NULL DEFAULT true$Q72$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260610085944_457fb4a1-9d69-4bf7-b875-36742c3662b4.sql', left($Q72$-- Extend retailer_verification_policy with full governance configuration
ALTER TABLE public.retailer_verification_policy ADD COLUMN IF NOT EXISTS gp_revoke_on_fraud boolean NOT NULL DEFAULT true$Q72$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q73$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verification_score integer NOT NULL DEFAULT 0$Q73$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260612073108_c36bc4a2-bf8b-4db8-958e-a6bf5f8c6b10.sql', left($Q73$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS verification_score integer NOT NULL DEFAULT 0$Q73$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q74$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS retailer_confirmed boolean NOT NULL DEFAULT false$Q74$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260612073108_c36bc4a2-bf8b-4db8-958e-a6bf5f8c6b10.sql', left($Q74$ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS retailer_confirmed boolean NOT NULL DEFAULT false$Q74$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q75$-- Audit columns on product_variants for symmetry with products
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS created_by uuid$Q75$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260615113648_3cf7516c-7bbd-4602-b856-26b405e2986e.sql', left($Q75$-- Audit columns on product_variants for symmetry with products
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS created_by uuid$Q75$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q76$-- Audit columns on product_variants for symmetry with products
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS updated_by uuid$Q76$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260615113648_3cf7516c-7bbd-4602-b856-26b405e2986e.sql', left($Q76$-- Audit columns on product_variants for symmetry with products
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS updated_by uuid$Q76$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q77$-- 3. Extend feature_flag_audit with company_id
ALTER TABLE public.feature_flag_audit ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL$Q77$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260615125746_f87761b7-fd87-4791-a3cf-22cab7cf0441.sql', left($Q77$-- 3. Extend feature_flag_audit with company_id
ALTER TABLE public.feature_flag_audit ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL$Q77$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q78$-- 3. Extend feature_flag_audit with company_id
ALTER TABLE public.feature_flag_audit ADD COLUMN IF NOT EXISTS action text$Q78$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260615125746_f87761b7-fd87-4791-a3cf-22cab7cf0441.sql', left($Q78$-- 3. Extend feature_flag_audit with company_id
ALTER TABLE public.feature_flag_audit ADD COLUMN IF NOT EXISTS action text$Q78$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q79$-- =========================================
-- PART C: Audit log scope columns
-- =========================================
ALTER TABLE public.feature_flag_audit ADD COLUMN IF NOT EXISTS scope_type text$Q79$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260616043044_37c1d307-4143-40f4-941e-320460fdfdda.sql', left($Q79$-- =========================================
-- PART C: Audit log scope columns
-- =========================================
ALTER TABLE public.feature_flag_audit ADD COLUMN IF NOT EXISTS scope_type text$Q79$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q80$-- =========================================
-- PART C: Audit log scope columns
-- =========================================
ALTER TABLE public.feature_flag_audit ADD COLUMN IF NOT EXISTS scope_id uuid$Q80$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260616043044_37c1d307-4143-40f4-941e-320460fdfdda.sql', left($Q80$-- =========================================
-- PART C: Audit log scope columns
-- =========================================
ALTER TABLE public.feature_flag_audit ADD COLUMN IF NOT EXISTS scope_id uuid$Q80$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q81$ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS feature_key TEXT$Q81$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617055036_84135cf3-7f4d-473d-89bf-33162937ca50.sql', left($Q81$ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS feature_key TEXT$Q81$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q82$ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS feature_name TEXT$Q82$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617055036_84135cf3-7f4d-473d-89bf-33162937ca50.sql', left($Q82$ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS feature_name TEXT$Q82$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q83$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS payment_term TEXT$Q83$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q83$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS payment_term TEXT$Q83$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q84$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS payment_mode TEXT$Q84$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q84$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS payment_mode TEXT$Q84$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q85$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(14,2) DEFAULT 0$Q85$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q85$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(14,2) DEFAULT 0$Q85$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q86$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT$Q86$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q86$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT$Q86$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q87$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS credit_snapshot JSONB$Q87$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q87$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS credit_snapshot JSONB$Q87$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q88$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS cancelled_by UUID$Q88$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q88$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS cancelled_by UUID$Q88$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q89$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ$Q89$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q89$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ$Q89$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q90$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT$Q90$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q90$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT$Q90$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q91$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS edited_by UUID$Q91$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q91$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS edited_by UUID$Q91$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q92$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ$Q92$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617060609_cf97df3b-2f44-4957-9e47-368b3c3f75fa.sql', left($Q92$-- =========================================================
-- Phase 1.C — extend primary_orders
-- =========================================================
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ$Q92$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q93$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS visit_category text$Q93$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q93$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS visit_category text$Q93$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q94$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS activity_sub_type text$Q94$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q94$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS activity_sub_type text$Q94$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q95$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS beat_id text$Q95$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q95$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS beat_id text$Q95$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q96$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS beat_name text$Q96$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q96$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS beat_name text$Q96$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q97$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS subordinate_user_id uuid$Q97$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q97$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS subordinate_user_id uuid$Q97$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q98$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS joint_session_id uuid$Q98$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q98$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS joint_session_id uuid$Q98$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q99$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS distributor_id uuid$Q99$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q99$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS distributor_id uuid$Q99$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q100$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS distributor_name text$Q100$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q100$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS distributor_name text$Q100$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q101$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS visit_purpose text$Q101$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q101$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS visit_purpose text$Q101$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q102$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS check_in_time timestamptz$Q102$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q102$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS check_in_time timestamptz$Q102$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q103$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS check_out_time timestamptz$Q103$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q103$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS check_out_time timestamptz$Q103$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q104$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS check_in_latitude numeric$Q104$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q104$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS check_in_latitude numeric$Q104$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q105$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS check_in_longitude numeric$Q105$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q105$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS check_in_longitude numeric$Q105$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q106$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS duration_minutes integer$Q106$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q106$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS duration_minutes integer$Q106$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q107$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS shops_planned integer$Q107$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q107$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS shops_planned integer$Q107$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q108$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS shops_visited integer$Q108$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q108$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS shops_visited integer$Q108$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q109$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS km_travelled numeric$Q109$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q109$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS km_travelled numeric$Q109$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q110$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS outcome text$Q110$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q110$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS outcome text$Q110$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q111$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS contact_person text$Q111$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q111$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS contact_person text$Q111$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q112$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS follow_up_date date$Q112$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q112$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS follow_up_date date$Q112$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q113$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS actual_footfall integer$Q113$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q113$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS actual_footfall integer$Q113$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q114$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS sales_achieved numeric$Q114$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q114$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS sales_achieved numeric$Q114$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q115$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS topic text$Q115$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q115$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS topic text$Q115$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q116$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS attendee_count integer$Q116$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q116$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS attendee_count integer$Q116$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q117$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_product_knowledge integer$Q117$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q117$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_product_knowledge integer$Q117$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q118$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_retailer_relationship integer$Q118$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q118$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_retailer_relationship integer$Q118$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q119$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_scheme_communication integer$Q119$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q119$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_scheme_communication integer$Q119$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q120$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_branding integer$Q120$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q120$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_branding integer$Q120$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q121$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_market_intel integer$Q121$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q121$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_rating_market_intel integer$Q121$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q122$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_overall_outcome text$Q122$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q122$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_overall_outcome text$Q122$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q123$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_strengths text$Q123$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q123$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_strengths text$Q123$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q124$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_improvement_areas text$Q124$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q124$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_improvement_areas text$Q124$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q125$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_action_items text$Q125$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q125$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_action_items text$Q125$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q126$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_followup_date date$Q126$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q126$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS rep_followup_date date$Q126$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q127$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_total_shops integer$Q127$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q127$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_total_shops integer$Q127$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q128$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_our_stock_shops integer$Q128$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q128$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_our_stock_shops integer$Q128$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q129$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_target_shops integer$Q129$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q129$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_target_shops integer$Q129$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q130$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_competitor_count integer$Q130$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q130$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_competitor_count integer$Q130$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q131$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_estimated_monthly_value numeric$Q131$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q131$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_estimated_monthly_value numeric$Q131$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q132$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_market_type text$Q132$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q132$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_market_type text$Q132$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q133$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_priority text$Q133$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q133$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_priority text$Q133$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q134$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_suggested_beat_count integer$Q134$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q134$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_suggested_beat_count integer$Q134$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q135$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_shops_per_beat integer$Q135$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q135$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_shops_per_beat integer$Q135$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q136$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_proposed_beat_names text[]$Q136$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q136$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_proposed_beat_names text[]$Q136$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q137$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_competition_brands text$Q137$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q137$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_competition_brands text$Q137$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q138$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_observations text$Q138$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q138$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_observations text$Q138$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q139$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_recommendation text$Q139$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617062604_c6aec099-cd28-4f1e-9483-916c32f1cd27.sql', left($Q139$ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS survey_recommendation text$Q139$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q140$-- 2. Snapshot RPC (safe defaults if related tables missing/empty)
CREATE OR REPLACE FUNCTION public.get_distributor_financial_snapshot(p_distributor_id uuid)
RETURNS TABLE(
  credit_limit numeric,
  outstanding numeric,
  available_credit numeric,
  credit_utilization_pct numeric,
  last_payment_date timestamptz,
  overdue_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_limit numeric := 0;
  v_outstanding numeric := 0;
  v_last_payment timestamptz;
  v_overdue numeric := 0;
BEGIN
  SELECT COALESCE(dpc.credit_limit, 0) INTO v_credit_limit
  FROM public.distributor_payment_config dpc
  WHERE dpc.distributor_id = p_distributor_id;

  v_credit_limit := COALESCE(v_credit_limit, 0);

  RETURN QUERY SELECT
    v_credit_limit,
    v_outstanding,
    GREATEST(v_credit_limit - v_outstanding, 0),
    CASE WHEN v_credit_limit > 0 THEN ROUND((v_outstanding / v_credit_limit) * 100, 2) ELSE 0 END,
    v_last_payment,
    v_overdue;
END;
$$$Q140$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260617104743_fbff7078-e059-4761-8609-731b220591ad.sql', left($Q140$-- 2. Snapshot RPC (safe defaults if related tables missing/empty)
CREATE OR REPLACE FUNCTION public.get_distributor_financial_snapshot(p_distributor_id uuid)
RETURNS TABLE(
  credit_limit numeric,
  outstanding numeric,
  available_credit numeric,
  credit_utilization_pct numeric,
  last_payment_date timestamptz,
  overdue_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_limit numeric := 0;
  v_outstanding numeric := 0;
  v_last_payment timestamptz;
  v_overdue numeric := 0;
BEGIN
  SELECT COALESCE(dpc.credit_limit, 0) INTO v_credit_limit
  FROM public.distributor_payment_config dpc
  WHERE dpc.distributor_id = p_distributor_id;

  v_credit_limit := COALESCE(v_credit_limit, 0);

  RETURN QUERY SELECT
    v_credit_limit,
    v_outstanding,
    GREATEST(v_credit_limit - v_outstanding, 0),
    CASE WHEN v_credit_limit > 0 THEN ROUND((v_outstanding / v_credit_limit) * 100, 2) ELSE 0 END,
    v_last_payment,
    v_overdue;
END;
$$$Q140$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q141$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS address_line1 text$Q141$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q141$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS address_line1 text$Q141$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q142$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS address_line2 text$Q142$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q142$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS address_line2 text$Q142$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q143$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS city text$Q143$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q143$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS city text$Q143$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q144$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS state text$Q144$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q144$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS state text$Q144$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q145$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS pincode text$Q145$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q145$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS pincode text$Q145$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q146$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS country text DEFAULT 'India'$Q146$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q146$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS country text DEFAULT 'India'$Q146$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q147$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS landmark text$Q147$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q147$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS landmark text$Q147$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q148$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS contact_person text$Q148$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q148$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS contact_person text$Q148$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q149$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS contact_phone text$Q149$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q149$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS contact_phone text$Q149$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q150$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS latitude numeric(10,7)$Q150$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q150$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS latitude numeric(10,7)$Q150$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q151$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS longitude numeric(10,7)$Q151$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q151$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS longitude numeric(10,7)$Q151$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q152$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS formatted_address text$Q152$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q152$-- 1a. Extend warehouses with address & geo
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS formatted_address text$Q152$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q153$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_address_source text$Q153$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q153$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_address_source text$Q153$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q154$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL$Q154$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q154$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL$Q154$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q155$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_saved_address_id uuid REFERENCES public.distributor_saved_addresses(id) ON DELETE SET NULL$Q155$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q155$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_saved_address_id uuid REFERENCES public.distributor_saved_addresses(id) ON DELETE SET NULL$Q155$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q156$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_latitude numeric(10,7)$Q156$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q156$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_latitude numeric(10,7)$Q156$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q157$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_longitude numeric(10,7)$Q157$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q157$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_longitude numeric(10,7)$Q157$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q158$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_contact_person text$Q158$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q158$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_contact_person text$Q158$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q159$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_contact_phone text$Q159$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260618071418_ae661fbd-1aac-447a-8309-32b23ef7aed3.sql', left($Q159$-- 1c. Extend primary_orders with snapshot fields
ALTER TABLE public.primary_orders ADD COLUMN IF NOT EXISTS shipping_contact_phone text$Q159$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q160$ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false$Q160$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622061152_ad9a79fd-7c4f-440d-8974-c5aa03a8e18d.sql', left($Q160$ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false$Q160$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q161$ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS edited_at timestamptz$Q161$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622061152_ad9a79fd-7c4f-440d-8974-c5aa03a8e18d.sql', left($Q161$ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS edited_at timestamptz$Q161$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q162$ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0$Q162$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622061152_ad9a79fd-7c4f-440d-8974-c5aa03a8e18d.sql', left($Q162$ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0$Q162$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q163$ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS superseded_by_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL$Q163$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622094010_32552519-2fbc-4f7b-9a92-19af1cc83b4c.sql', left($Q163$ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS superseded_by_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL$Q163$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q164$ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS revises_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL$Q164$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622094010_32552519-2fbc-4f7b-9a92-19af1cc83b4c.sql', left($Q164$ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS revises_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL$Q164$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q165$ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cancelled_at timestamptz$Q165$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622094010_32552519-2fbc-4f7b-9a92-19af1cc83b4c.sql', left($Q165$ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cancelled_at timestamptz$Q165$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q166$ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cancellation_reason text$Q166$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622094010_32552519-2fbc-4f7b-9a92-19af1cc83b4c.sql', left($Q166$ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cancellation_reason text$Q166$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q167$-- 2) Linkage columns on orders (idempotent)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS replaces_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL$Q167$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622100755_ad416d4b-0a2c-41d2-88f4-7cc771f052aa.sql', left($Q167$-- 2) Linkage columns on orders (idempotent)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS replaces_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL$Q167$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q168$-- 2) Linkage columns on orders (idempotent)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS replaced_by_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL$Q168$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622100755_ad416d4b-0a2c-41d2-88f4-7cc771f052aa.sql', left($Q168$-- 2) Linkage columns on orders (idempotent)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS replaced_by_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL$Q168$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q169$-- Schema additions
ALTER TABLE public.packing_list_item_batches ADD COLUMN IF NOT EXISTS delivered_qty numeric NOT NULL DEFAULT 0$Q169$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q169$-- Schema additions
ALTER TABLE public.packing_list_item_batches ADD COLUMN IF NOT EXISTS delivered_qty numeric NOT NULL DEFAULT 0$Q169$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q170$-- Schema additions
ALTER TABLE public.packing_list_item_batches ADD COLUMN IF NOT EXISTS short_delivery_reason text$Q170$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q170$-- Schema additions
ALTER TABLE public.packing_list_item_batches ADD COLUMN IF NOT EXISTS short_delivery_reason text$Q170$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q171$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS transporter_name    text$Q171$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q171$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS transporter_name    text$Q171$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q172$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS lr_gr_number        text$Q172$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q172$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS lr_gr_number        text$Q172$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q173$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS vehicle_type        text$Q173$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q173$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS vehicle_type        text$Q173$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q174$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS dispatch_mode       text$Q174$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q174$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS dispatch_mode       text$Q174$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q175$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS total_packages      integer$Q175$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q175$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS total_packages      integer$Q175$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q176$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS total_weight_kg     numeric$Q176$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q176$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS total_weight_kg     numeric$Q176$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q177$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS dispatch_date       date$Q177$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q177$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS dispatch_date       date$Q177$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q178$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS dispatch_destination text$Q178$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q178$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS dispatch_destination text$Q178$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q179$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS dispatch_notes      text$Q179$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260622123457_8bf2ce44-4074-423d-a659-ee3c22d72232.sql', left($Q179$ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS dispatch_notes      text$Q179$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q180$-- Dispatch agent assignment foundation
ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS assigned_agent_id uuid$Q180$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260623054924_9ce3c674-996b-490a-a64b-3c874e46f900.sql', left($Q180$-- Dispatch agent assignment foundation
ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS assigned_agent_id uuid$Q180$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q181$-- Dispatch agent assignment foundation
ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS assigned_delivery_user_id uuid REFERENCES public.distributor_users(id) ON DELETE SET NULL$Q181$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260623054924_9ce3c674-996b-490a-a64b-3c874e46f900.sql', left($Q181$-- Dispatch agent assignment foundation
ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS assigned_delivery_user_id uuid REFERENCES public.distributor_users(id) ON DELETE SET NULL$Q181$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q182$-- Dispatch agent assignment foundation
ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS driver_phone text$Q182$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260623054924_9ce3c674-996b-490a-a64b-3c874e46f900.sql', left($Q182$-- Dispatch agent assignment foundation
ALTER TABLE public.packing_lists ADD COLUMN IF NOT EXISTS driver_phone text$Q182$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q183$ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS original_snapshot jsonb$Q183$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260625085153_43637fb4-507d-48c9-b4a8-5739d614f917.sql', left($Q183$ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS original_snapshot jsonb$Q183$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q184$ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS replacement_snapshot jsonb$Q184$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260625085153_43637fb4-507d-48c9-b4a8-5739d614f917.sql', left($Q184$ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS replacement_snapshot jsonb$Q184$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q185$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id)$Q185$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q185$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id)$Q185$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q186$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS brand text$Q186$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q186$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS brand text$Q186$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q187$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS gst_percentage numeric$Q187$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q187$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS gst_percentage numeric$Q187$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q188$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS tax_master_id uuid REFERENCES public.tax_masters(id)$Q188$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q188$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS tax_master_id uuid REFERENCES public.tax_masters(id)$Q188$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q189$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS default_sales_uom_id uuid REFERENCES public.uom_master(id)$Q189$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q189$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS default_sales_uom_id uuid REFERENCES public.uom_master(id)$Q189$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q190$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price_basis_uom_id uuid REFERENCES public.uom_master(id)$Q190$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q190$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price_basis_uom_id uuid REFERENCES public.uom_master(id)$Q190$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q191$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS base_unit text$Q191$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q191$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS base_unit text$Q191$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q192$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS base_unit_category text$Q192$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q192$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS base_unit_category text$Q192$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q193$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS net_weight_g numeric$Q193$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q193$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS net_weight_g numeric$Q193$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q194$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS net_volume_ml numeric$Q194$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q194$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS net_volume_ml numeric$Q194$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q195$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS description text$Q195$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q195$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS description text$Q195$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q196$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS product_type text$Q196$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q196$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS product_type text$Q196$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q197$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS manufacturer text$Q197$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q197$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS manufacturer text$Q197$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q198$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS country_of_origin text$Q198$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q198$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS country_of_origin text$Q198$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q199$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS sku_image_url text$Q199$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q199$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS sku_image_url text$Q199$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q200$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS reorder_level numeric$Q200$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q200$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS reorder_level numeric$Q200$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q201$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS reorder_quantity numeric$Q201$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q201$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS reorder_quantity numeric$Q201$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q202$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS standard_cost numeric$Q202$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260629121111_27d857f8-f75e-447b-b1ff-a2351a4d3358.sql', left($Q202$-- Phase 2: Variant hybrid schema — nullable override columns + variant tax sync

-- 1) Add nullable override columns
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS standard_cost numeric$Q202$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q203$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required'$Q203$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260630092556_40134cc3-35bc-4dc9-a54c-b7470fcfb228.sql', left($Q203$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required'$Q203$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q204$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS approved_by uuid$Q204$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260630092556_40134cc3-35bc-4dc9-a54c-b7470fcfb228.sql', left($Q204$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS approved_by uuid$Q204$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q205$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS approved_at timestamptz$Q205$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260630092556_40134cc3-35bc-4dc9-a54c-b7470fcfb228.sql', left($Q205$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS approved_at timestamptz$Q205$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q206$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS posted_to_ledger boolean NOT NULL DEFAULT false$Q206$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260630092556_40134cc3-35bc-4dc9-a54c-b7470fcfb228.sql', left($Q206$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS posted_to_ledger boolean NOT NULL DEFAULT false$Q206$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q207$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS original_order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT$Q207$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260630092556_40134cc3-35bc-4dc9-a54c-b7470fcfb228.sql', left($Q207$-- 3) credit_notes additions
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS original_order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT$Q207$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q208$alter table public.activity_types add column if not exists parent_id uuid references public.activity_types(id) on delete restrict$Q208$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260701093639_02e21d48-2f88-4f43-a4cd-ef41108aeb57.sql', left($Q208$alter table public.activity_types add column if not exists parent_id uuid references public.activity_types(id) on delete restrict$Q208$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q209$alter table public.activity_types add column if not exists is_category boolean not null default false$Q209$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260701093639_02e21d48-2f88-4f43-a4cd-ef41108aeb57.sql', left($Q209$alter table public.activity_types add column if not exists is_category boolean not null default false$Q209$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q210$alter table public.activity_types add column if not exists photo_required boolean not null default false$Q210$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260701093639_02e21d48-2f88-4f43-a4cd-ef41108aeb57.sql', left($Q210$alter table public.activity_types add column if not exists photo_required boolean not null default false$Q210$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q211$alter table public.activity_types add column if not exists location_required boolean not null default false$Q211$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260701093639_02e21d48-2f88-4f43-a4cd-ef41108aeb57.sql', left($Q211$alter table public.activity_types add column if not exists location_required boolean not null default false$Q211$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q212$alter table public.activity_types add column if not exists show_in_picker boolean not null default true$Q212$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260701093639_02e21d48-2f88-4f43-a4cd-ef41108aeb57.sql', left($Q212$alter table public.activity_types add column if not exists show_in_picker boolean not null default true$Q212$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q213$alter table public.activity_events add column if not exists completion_summary text$Q213$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260702060205_45432244-a815-4bb6-a34b-6ac5cfbe3d00.sql', left($Q213$alter table public.activity_events add column if not exists completion_summary text$Q213$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q214$alter table public.activity_events add column if not exists voice_note_url text$Q214$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260702060205_45432244-a815-4bb6-a34b-6ac5cfbe3d00.sql', left($Q214$alter table public.activity_events add column if not exists voice_note_url text$Q214$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q215$alter table public.activity_events add column if not exists assigned_by uuid$Q215$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260702093845_1f0fe85e-9011-44f2-96d3-078224b2d402.sql', left($Q215$alter table public.activity_events add column if not exists assigned_by uuid$Q215$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q216$alter table public.activity_events add column if not exists assignment_note text$Q216$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260702093845_1f0fe85e-9011-44f2-96d3-078224b2d402.sql', left($Q216$alter table public.activity_events add column if not exists assignment_note text$Q216$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q217$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS placed_by_user_id uuid$Q217$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260703072249_1921ddac-b382-4c36-a65f-36f7d062d1a8.sql', left($Q217$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS placed_by_user_id uuid$Q217$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q218$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_backdated boolean NOT NULL DEFAULT false$Q218$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260703072249_1921ddac-b382-4c36-a65f-36f7d062d1a8.sql', left($Q218$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_backdated boolean NOT NULL DEFAULT false$Q218$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q219$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS backdate_reason text$Q219$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260703072249_1921ddac-b382-4c36-a65f-36f7d062d1a8.sql', left($Q219$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS backdate_reason text$Q219$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q220$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_out_of_beat boolean NOT NULL DEFAULT false$Q220$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260703072249_1921ddac-b382-4c36-a65f-36f7d062d1a8.sql', left($Q220$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_out_of_beat boolean NOT NULL DEFAULT false$Q220$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q221$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS out_of_beat_reason text$Q221$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260703072249_1921ddac-b382-4c36-a65f-36f7d062d1a8.sql', left($Q221$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS out_of_beat_reason text$Q221$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q222$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_planned_beat boolean$Q222$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260703072249_1921ddac-b382-4c36-a65f-36f7d062d1a8.sql', left($Q222$-- 2. orders new columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_planned_beat boolean$Q222$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q223$-- 2) Extend existing order_edit_log with the new audit fields (additive; keeps existing snapshot columns)
ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS order_id  uuid$Q223$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706043958_33e3496a-c894-4b0d-9c3b-90c6054251f9.sql', left($Q223$-- 2) Extend existing order_edit_log with the new audit fields (additive; keeps existing snapshot columns)
ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS order_id  uuid$Q223$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q224$-- 2) Extend existing order_edit_log with the new audit fields (additive; keeps existing snapshot columns)
ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS old_total numeric$Q224$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706043958_33e3496a-c894-4b0d-9c3b-90c6054251f9.sql', left($Q224$-- 2) Extend existing order_edit_log with the new audit fields (additive; keeps existing snapshot columns)
ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS old_total numeric$Q224$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q225$-- 2) Extend existing order_edit_log with the new audit fields (additive; keeps existing snapshot columns)
ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS new_total numeric$Q225$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706043958_33e3496a-c894-4b0d-9c3b-90c6054251f9.sql', left($Q225$-- 2) Extend existing order_edit_log with the new audit fields (additive; keeps existing snapshot columns)
ALTER TABLE public.order_edit_log ADD COLUMN IF NOT EXISTS new_total numeric$Q225$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q226$-- 1. operations_config new columns
ALTER TABLE public.operations_config ADD COLUMN IF NOT EXISTS auto_cancel_enabled boolean NOT NULL DEFAULT false$Q226$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706070342_d20c3b1f-0b3b-403c-aa14-452235a5edf4.sql', left($Q226$-- 1. operations_config new columns
ALTER TABLE public.operations_config ADD COLUMN IF NOT EXISTS auto_cancel_enabled boolean NOT NULL DEFAULT false$Q226$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q227$-- 1. operations_config new columns
ALTER TABLE public.operations_config ADD COLUMN IF NOT EXISTS eod_cutoff_time time NOT NULL DEFAULT '20:00:00'$Q227$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706070342_d20c3b1f-0b3b-403c-aa14-452235a5edf4.sql', left($Q227$-- 1. operations_config new columns
ALTER TABLE public.operations_config ADD COLUMN IF NOT EXISTS eod_cutoff_time time NOT NULL DEFAULT '20:00:00'$Q227$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q228$-- 1. operations_config new columns
ALTER TABLE public.operations_config ADD COLUMN IF NOT EXISTS eod_timezone text NOT NULL DEFAULT 'Asia/Kolkata'$Q228$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706070342_d20c3b1f-0b3b-403c-aa14-452235a5edf4.sql', left($Q228$-- 1. operations_config new columns
ALTER TABLE public.operations_config ADD COLUMN IF NOT EXISTS eod_timezone text NOT NULL DEFAULT 'Asia/Kolkata'$Q228$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q229$-- 1. operations_config new columns
ALTER TABLE public.operations_config ADD COLUMN IF NOT EXISTS carry_forward_enabled boolean NOT NULL DEFAULT true$Q229$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706070342_d20c3b1f-0b3b-403c-aa14-452235a5edf4.sql', left($Q229$-- 1. operations_config new columns
ALTER TABLE public.operations_config ADD COLUMN IF NOT EXISTS carry_forward_enabled boolean NOT NULL DEFAULT true$Q229$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q230$ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS is_carry_forward boolean NOT NULL DEFAULT false$Q230$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706071408_8514de28-2f20-48cc-9f6d-432e09d4edc8.sql', left($Q230$ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS is_carry_forward boolean NOT NULL DEFAULT false$Q230$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q231$ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS carried_from_date date$Q231$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706071408_8514de28-2f20-48cc-9f6d-432e09d4edc8.sql', left($Q231$ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS carried_from_date date$Q231$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q232$-- 1. Alter visits
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS is_rescheduled boolean NOT NULL DEFAULT false$Q232$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706072720_67d1ff43-4e4d-4487-964c-4674e15fe21d.sql', left($Q232$-- 1. Alter visits
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS is_rescheduled boolean NOT NULL DEFAULT false$Q232$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q233$-- 1. Alter visits
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS rescheduled_from_date date$Q233$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260706072720_67d1ff43-4e4d-4487-964c-4674e15fe21d.sql', left($Q233$-- 1. Alter visits
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS rescheduled_from_date date$Q233$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q234$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS consumer_name text$Q234$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260718094229_31f0241c-6e8a-44b4-b760-cdcd40fdb9e7.sql', left($Q234$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS consumer_name text$Q234$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q235$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS consumer_phone text$Q235$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260718094229_31f0241c-6e8a-44b4-b760-cdcd40fdb9e7.sql', left($Q235$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS consumer_phone text$Q235$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q236$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS consumer_address text$Q236$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260718094229_31f0241c-6e8a-44b4-b760-cdcd40fdb9e7.sql', left($Q236$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS consumer_address text$Q236$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q237$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS interested_products jsonb NOT NULL DEFAULT '[]'::jsonb$Q237$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260718094229_31f0241c-6e8a-44b4-b760-cdcd40fdb9e7.sql', left($Q237$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS interested_products jsonb NOT NULL DEFAULT '[]'::jsonb$Q237$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q238$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS tagged_retailer_id uuid$Q238$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260718094229_31f0241c-6e8a-44b4-b760-cdcd40fdb9e7.sql', left($Q238$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS tagged_retailer_id uuid$Q238$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q239$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS voice_transcript text$Q239$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260718094229_31f0241c-6e8a-44b4-b760-cdcd40fdb9e7.sql', left($Q239$ALTER TABLE public.influencer_referrals ADD COLUMN IF NOT EXISTS voice_transcript text$Q239$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q240$-- Enable market intelligence portal on employees
ALTER TABLE public.employee_directory ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT false$Q240$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260718165954_ba1cdff4-f9a5-417a-a73e-9fe4547a0d0d.sql', left($Q240$-- Enable market intelligence portal on employees
ALTER TABLE public.employee_directory ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT false$Q240$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q241$-- Enable market intelligence portal on employees
ALTER TABLE public.employee_directory ADD COLUMN IF NOT EXISTS portal_pin text$Q241$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260718165954_ba1cdff4-f9a5-417a-a73e-9fe4547a0d0d.sql', left($Q241$-- Enable market intelligence portal on employees
ALTER TABLE public.employee_directory ADD COLUMN IF NOT EXISTS portal_pin text$Q241$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q242$ALTER TABLE public.employee_market_visits ADD COLUMN IF NOT EXISTS joint_visit_partner_id uuid$Q242$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260721015857_2f69790c-063f-4fe9-aa58-e12cd6edd21c.sql', left($Q242$ALTER TABLE public.employee_market_visits ADD COLUMN IF NOT EXISTS joint_visit_partner_id uuid$Q242$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q243$ALTER TABLE public.employee_market_visits ADD COLUMN IF NOT EXISTS joint_visit_partner_name text$Q243$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260721015857_2f69790c-063f-4fe9-aa58-e12cd6edd21c.sql', left($Q243$ALTER TABLE public.employee_market_visits ADD COLUMN IF NOT EXISTS joint_visit_partner_name text$Q243$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q244$ALTER TABLE public.employee_market_visits ADD COLUMN IF NOT EXISTS joint_sales_feedback jsonb NOT NULL DEFAULT '{}'::jsonb$Q244$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260721015857_2f69790c-063f-4fe9-aa58-e12cd6edd21c.sql', left($Q244$ALTER TABLE public.employee_market_visits ADD COLUMN IF NOT EXISTS joint_sales_feedback jsonb NOT NULL DEFAULT '{}'::jsonb$Q244$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q245$-- Update emit_notification_event to pass the rule's timezone
CREATE OR REPLACE FUNCTION public.emit_notification_event(p_event_code text, p_source_table text, p_record_id text, p_actor_user_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD; v_receiver_id uuid; v_title text; v_message text;
  v_actor_name text; v_module_name text; v_record_uuid uuid;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_period_type text; v_top3 jsonb; v_notif_type text; v_is_leaderboard boolean;
  v_tz text;
BEGIN
  BEGIN v_record_uuid := p_record_id::uuid; EXCEPTION WHEN others THEN v_record_uuid := NULL; END;
  v_is_leaderboard := p_event_code IN ('WEEKLY_LEADERBOARD','MONTHLY_LEADERBOARD');
  IF v_is_leaderboard THEN
    v_period_type := CASE WHEN p_event_code='WEEKLY_LEADERBOARD' THEN 'weekly' ELSE 'monthly' END;
    SELECT jsonb_agg(jsonb_build_object('rank',s.rank,'user_id',s.user_id,'full_name',s.full_name,'profile_picture_url',s.profile_picture_url,'total_points',s.total_points,'period_label',s.period_label) ORDER BY s.rank)
    INTO v_top3 FROM (SELECT * FROM leaderboard_snapshots WHERE period_type=v_period_type AND captured_at >= now()-interval '10 minutes' ORDER BY captured_at DESC, rank ASC LIMIT 3) s;
    v_metadata := v_metadata || jsonb_build_object('top3', COALESCE(v_top3,'[]'::jsonb));
  END IF;
  INSERT INTO notification_event_log (event_code, source_table, record_id, actor_user_id, metadata)
  VALUES (p_event_code, p_source_table, p_record_id, p_actor_user_id, v_metadata);
  SELECT COALESCE(full_name, username, 'System') INTO v_actor_name FROM profiles WHERE id = p_actor_user_id;
  v_module_name := INITCAP(REPLACE(p_source_table,'_',' '));
  v_notif_type := CASE WHEN v_is_leaderboard THEN 'leaderboard_banner' ELSE p_event_code END;

  IF v_is_leaderboard THEN
    SELECT * INTO v_rule FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LIMIT 1;
    v_title := COALESCE(v_rule.title_template,'🏆 Top performers');
    v_message := COALESCE(v_rule.message_template,'The leaderboard results are in.');
    v_title := REPLACE(v_title,'{record_name}', COALESCE(v_metadata->>'period_label',''));
    v_message := REPLACE(v_message,'{record_name}', COALESCE(v_metadata->>'period_label',''));
    INSERT INTO notifications (user_id, title, message, type, related_table, related_id, metadata)
    SELECT DISTINCT up.user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata
    FROM user_profiles up WHERE up.user_id IS NOT NULL;
    RETURN;
  END IF;

  FOR v_rule IN SELECT * FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LOOP
    v_tz := COALESCE(v_rule.timezone,'Asia/Kolkata');
    v_title := public.notif_fill(v_rule.title_template, v_actor_name, v_module_name, v_metadata, v_tz);
    v_message := public.notif_fill(v_rule.message_template, v_actor_name, v_module_name, v_metadata, v_tz);
    CASE v_rule.receiver_type
      WHEN 'employee' THEN
        INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
        VALUES (p_actor_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
      WHEN 'manager' THEN
        SELECT manager_id INTO v_receiver_id FROM employees WHERE user_id=p_actor_user_id;
        IF v_receiver_id IS NOT NULL THEN
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        END IF;
      WHEN 'hierarchy' THEN
        FOR v_receiver_id IN SELECT public.notif_managers_up_chain(p_actor_user_id) LOOP
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        END LOOP;
      WHEN 'admin' THEN
        FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name='System Administrator' LOOP
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        END LOOP;
      WHEN 'specific_user' THEN
        IF v_rule.receiver_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (v_rule.receiver_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        END IF;
      WHEN 'role' THEN
        IF v_rule.receiver_role IS NOT NULL THEN
          FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name=v_rule.receiver_role LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END LOOP;
        END IF;
      ELSE NULL;
    END CASE;
  END LOOP;
END $function$$Q245$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260722075234_27d94e0f-12ec-4ebb-879b-3379e5082f1e.sql', left($Q245$-- Update emit_notification_event to pass the rule's timezone
CREATE OR REPLACE FUNCTION public.emit_notification_event(p_event_code text, p_source_table text, p_record_id text, p_actor_user_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD; v_receiver_id uuid; v_title text; v_message text;
  v_actor_name text; v_module_name text; v_record_uuid uuid;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_period_type text; v_top3 jsonb; v_notif_type text; v_is_leaderboard boolean;
  v_tz text;
BEGIN
  BEGIN v_record_uuid := p_record_id::uuid; EXCEPTION WHEN others THEN v_record_uuid := NULL; END;
  v_is_leaderboard := p_event_code IN ('WEEKLY_LEADERBOARD','MONTHLY_LEADERBOARD');
  IF v_is_leaderboard THEN
    v_period_type := CASE WHEN p_event_code='WEEKLY_LEADERBOARD' THEN 'weekly' ELSE 'monthly' END;
    SELECT jsonb_agg(jsonb_build_object('rank',s.rank,'user_id',s.user_id,'full_name',s.full_name,'profile_picture_url',s.profile_picture_url,'total_points',s.total_points,'period_label',s.period_label) ORDER BY s.rank)
    INTO v_top3 FROM (SELECT * FROM leaderboard_snapshots WHERE period_type=v_period_type AND captured_at >= now()-interval '10 minutes' ORDER BY captured_at DESC, rank ASC LIMIT 3) s;
    v_metadata := v_metadata || jsonb_build_object('top3', COALESCE(v_top3,'[]'::jsonb));
  END IF;
  INSERT INTO notification_event_log (event_code, source_table, record_id, actor_user_id, metadata)
  VALUES (p_event_code, p_source_table, p_record_id, p_actor_user_id, v_metadata);
  SELECT COALESCE(full_name, username, 'System') INTO v_actor_name FROM profiles WHERE id = p_actor_user_id;
  v_module_name := INITCAP(REPLACE(p_source_table,'_',' '));
  v_notif_type := CASE WHEN v_is_leaderboard THEN 'leaderboard_banner' ELSE p_event_code END;

  IF v_is_leaderboard THEN
    SELECT * INTO v_rule FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LIMIT 1;
    v_title := COALESCE(v_rule.title_template,'🏆 Top performers');
    v_message := COALESCE(v_rule.message_template,'The leaderboard results are in.');
    v_title := REPLACE(v_title,'{record_name}', COALESCE(v_metadata->>'period_label',''));
    v_message := REPLACE(v_message,'{record_name}', COALESCE(v_metadata->>'period_label',''));
    INSERT INTO notifications (user_id, title, message, type, related_table, related_id, metadata)
    SELECT DISTINCT up.user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata
    FROM user_profiles up WHERE up.user_id IS NOT NULL;
    RETURN;
  END IF;

  FOR v_rule IN SELECT * FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LOOP
    v_tz := COALESCE(v_rule.timezone,'Asia/Kolkata');
    v_title := public.notif_fill(v_rule.title_template, v_actor_name, v_module_name, v_metadata, v_tz);
    v_message := public.notif_fill(v_rule.message_template, v_actor_name, v_module_name, v_metadata, v_tz);
    CASE v_rule.receiver_type
      WHEN 'employee' THEN
        INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
        VALUES (p_actor_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
      WHEN 'manager' THEN
        SELECT manager_id INTO v_receiver_id FROM employees WHERE user_id=p_actor_user_id;
        IF v_receiver_id IS NOT NULL THEN
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        END IF;
      WHEN 'hierarchy' THEN
        FOR v_receiver_id IN SELECT public.notif_managers_up_chain(p_actor_user_id) LOOP
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        END LOOP;
      WHEN 'admin' THEN
        FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name='System Administrator' LOOP
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        END LOOP;
      WHEN 'specific_user' THEN
        IF v_rule.receiver_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (v_rule.receiver_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        END IF;
      WHEN 'role' THEN
        IF v_rule.receiver_role IS NOT NULL THEN
          FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name=v_rule.receiver_role LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END LOOP;
        END IF;
      ELSE NULL;
    END CASE;
  END LOOP;
END $function$$Q245$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q246$ALTER TABLE public.report_delivery_log ALTER COLUMN trigger_type SET NOT NULL$Q246$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260724052032_47896836-5886-4d9a-8759-27efc8aa91e0.sql', left($Q246$ALTER TABLE public.report_delivery_log ALTER COLUMN trigger_type SET NOT NULL$Q246$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q247$ALTER TABLE public.report_delivery_log ADD CONSTRAINT report_delivery_log_trigger_type_chk
    CHECK (trigger_type IN ('scheduled','manual'))$Q247$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260724052032_47896836-5886-4d9a-8759-27efc8aa91e0.sql', left($Q247$ALTER TABLE public.report_delivery_log ADD CONSTRAINT report_delivery_log_trigger_type_chk
    CHECK (trigger_type IN ('scheduled','manual'))$Q247$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q248$-- 4) Scheduled-idempotency columns on subscriptions.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS last_scheduled_fire_at timestamptz$Q248$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260724052032_47896836-5886-4d9a-8759-27efc8aa91e0.sql', left($Q248$-- 4) Scheduled-idempotency columns on subscriptions.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS last_scheduled_fire_at timestamptz$Q248$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q249$-- 4) Scheduled-idempotency columns on subscriptions.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS last_scheduled_period_key text$Q249$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260724052032_47896836-5886-4d9a-8759-27efc8aa91e0.sql', left($Q249$-- 4) Scheduled-idempotency columns on subscriptions.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS last_scheduled_period_key text$Q249$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q250$ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale TEXT$Q250$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260724115258_241d64a2-d56b-4d2a-8c72-9fc60ee67782.sql', left($Q250$ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locale TEXT$Q250$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q251$ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT$Q251$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260724115258_241d64a2-d56b-4d2a-8c72-9fc60ee67782.sql', left($Q251$ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT$Q251$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q252$ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT$Q252$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260724115258_241d64a2-d56b-4d2a-8c72-9fc60ee67782.sql', left($Q252$ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT$Q252$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q253$ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz$Q253$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730050348_972f4266-68cb-43fe-8c7c-4c8ca01937da.sql', left($Q253$ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz$Q253$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q254$ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_dismissed boolean NOT NULL DEFAULT false$Q254$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730050348_972f4266-68cb-43fe-8c7c-4c8ca01937da.sql', left($Q254$ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_dismissed boolean NOT NULL DEFAULT false$Q254$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q255$ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz$Q255$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730050348_972f4266-68cb-43fe-8c7c-4c8ca01937da.sql', left($Q255$ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz$Q255$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q256$ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'delivered'$Q256$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730050348_972f4266-68cb-43fe-8c7c-4c8ca01937da.sql', left($Q256$ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'delivered'$Q256$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q257$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS conditions_json jsonb NOT NULL DEFAULT '[]'::jsonb$Q257$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q257$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS conditions_json jsonb NOT NULL DEFAULT '[]'::jsonb$Q257$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q258$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS expiry_type text NOT NULL DEFAULT 'fy_end'$Q258$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q258$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS expiry_type text NOT NULL DEFAULT 'fy_end'$Q258$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q259$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS expiry_days integer$Q259$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q259$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS expiry_days integer$Q259$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q260$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS validity_from date$Q260$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q260$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS validity_from date$Q260$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q261$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS validity_to date$Q261$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q261$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS validity_to date$Q261$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q262$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS cap_scope text NOT NULL DEFAULT 'none'$Q262$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q262$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS cap_scope text NOT NULL DEFAULT 'none'$Q262$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q263$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS cap_value integer$Q263$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q263$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS cap_value integer$Q263$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q264$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS redemption_min integer$Q264$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q264$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS redemption_min integer$Q264$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q265$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS award_mode text NOT NULL DEFAULT 'auto'$Q265$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q265$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS award_mode text NOT NULL DEFAULT 'auto'$Q265$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q266$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS leaderboard boolean NOT NULL DEFAULT true$Q266$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q266$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS leaderboard boolean NOT NULL DEFAULT true$Q266$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q267$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS eligibility_mode text NOT NULL DEFAULT 'all'$Q267$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q267$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS eligibility_mode text NOT NULL DEFAULT 'all'$Q267$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q268$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS eligibility_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]$Q268$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q268$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS eligibility_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]$Q268$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q269$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS is_tiered boolean NOT NULL DEFAULT false$Q269$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q269$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS is_tiered boolean NOT NULL DEFAULT false$Q269$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q270$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS kpi_id uuid$Q270$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q270$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS kpi_id uuid$Q270$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q271$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS target_period text$Q271$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q271$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS target_period text$Q271$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q272$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS tier_mode text NOT NULL DEFAULT 'highest'$Q272$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q272$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS tier_mode text NOT NULL DEFAULT 'highest'$Q272$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q273$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false$Q273$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q273$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false$Q273$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q274$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS description text$Q274$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q274$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS description text$Q274$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q275$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS trigger_type text$Q275$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q275$-- Phase 0: extend gamification tables (additive only)

ALTER TABLE public.gamification_actions ADD COLUMN IF NOT EXISTS trigger_type text$Q275$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q276$ALTER TABLE public.gamification_actions DROP CONSTRAINT IF EXISTS gamification_actions_expiry_type_check$Q276$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q276$ALTER TABLE public.gamification_actions DROP CONSTRAINT IF EXISTS gamification_actions_expiry_type_check$Q276$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q277$ALTER TABLE public.gamification_actions DROP CONSTRAINT IF EXISTS gamification_actions_cap_scope_check$Q277$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q277$ALTER TABLE public.gamification_actions DROP CONSTRAINT IF EXISTS gamification_actions_cap_scope_check$Q277$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q278$ALTER TABLE public.gamification_actions DROP CONSTRAINT IF EXISTS gamification_actions_eligibility_mode_check$Q278$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q278$ALTER TABLE public.gamification_actions DROP CONSTRAINT IF EXISTS gamification_actions_eligibility_mode_check$Q278$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q279$ALTER TABLE public.gamification_actions ADD CONSTRAINT gamification_actions_expiry_type_check CHECK (expiry_type IN ('days','never','fy_end'))$Q279$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q279$ALTER TABLE public.gamification_actions ADD CONSTRAINT gamification_actions_expiry_type_check CHECK (expiry_type IN ('days','never','fy_end'))$Q279$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q280$ALTER TABLE public.gamification_actions ADD CONSTRAINT gamification_actions_cap_scope_check CHECK (cap_scope IN ('none','user_day','user_month','retailer'))$Q280$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q280$ALTER TABLE public.gamification_actions ADD CONSTRAINT gamification_actions_cap_scope_check CHECK (cap_scope IN ('none','user_day','user_month','retailer'))$Q280$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q281$ALTER TABLE public.gamification_actions ADD CONSTRAINT gamification_actions_eligibility_mode_check CHECK (eligibility_mode IN ('all','manager','territory','users'))$Q281$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q281$ALTER TABLE public.gamification_actions ADD CONSTRAINT gamification_actions_eligibility_mode_check CHECK (eligibility_mode IN ('all','manager','territory','users'))$Q281$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q282$ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS expires_at timestamptz$Q282$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q282$ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS expires_at timestamptz$Q282$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q283$ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'$Q283$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q283$ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'$Q283$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q284$ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS period_key text$Q284$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q284$ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS period_key text$Q284$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q285$ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS retailer_id uuid$Q285$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q285$ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS retailer_id uuid$Q285$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q286$ALTER TABLE public.gamification_games ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'orders'$Q286$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q286$ALTER TABLE public.gamification_games ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'orders'$Q286$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q287$ALTER TABLE public.gamification_games ADD COLUMN IF NOT EXISTS icon text$Q287$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q287$ALTER TABLE public.gamification_games ADD COLUMN IF NOT EXISTS icon text$Q287$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q288$ALTER TABLE public.gamification_games ADD COLUMN IF NOT EXISTS color text$Q288$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q288$ALTER TABLE public.gamification_games ADD COLUMN IF NOT EXISTS color text$Q288$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q289$ALTER TABLE public.gamification_daily_tracking ADD COLUMN IF NOT EXISTS period_key text$Q289$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q289$ALTER TABLE public.gamification_daily_tracking ADD COLUMN IF NOT EXISTS period_key text$Q289$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q290$ALTER TABLE public.gamification_daily_tracking ADD COLUMN IF NOT EXISTS retailer_id uuid$Q290$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260730052426_c415c7a6-fccb-49c6-b9c7-7a936c727f5b.sql', left($Q290$ALTER TABLE public.gamification_daily_tracking ADD COLUMN IF NOT EXISTS retailer_id uuid$Q290$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q291$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS email             text$Q291$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q291$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS email             text$Q291$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q292$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS city              text$Q292$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q292$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS city              text$Q292$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q293$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS pincode           text$Q293$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q293$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS pincode           text$Q293$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q294$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS pan_no            text$Q294$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q294$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS pan_no            text$Q294$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q295$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS legal_name        text$Q295$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q295$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS legal_name        text$Q295$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q296$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS country           text DEFAULT 'India'$Q296$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q296$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS country           text DEFAULT 'India'$Q296$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q297$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS zoho_contact_id   text$Q297$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q297$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS zoho_contact_id   text$Q297$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q298$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS zoho_synced_at    timestamptz$Q298$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q298$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS zoho_synced_at    timestamptz$Q298$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q299$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS zoho_sync_status  text DEFAULT 'pending'$Q299$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q299$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS zoho_sync_status  text DEFAULT 'pending'$Q299$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q300$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS zoho_sync_error   text$Q300$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803130728_zoho_customer_sync_schema.sql', left($Q300$-- Zoho Books customer sync: additive schema only. Nothing dropped or overwritten.

ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS zoho_sync_error   text$Q300$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q301$CREATE OR REPLACE VIEW public.zoho_sync_readiness
WITH (security_invoker = on) AS
WITH dup AS (
  SELECT lower(btrim(name)) AS k FROM public.retailers
  GROUP BY 1 HAVING count(*) > 1)
SELECT r.id, r.name, r.state, r.city, r.pincode, r.phone, r.email,
       r.gst_number, r.currency, r.zoho_contact_id, r.zoho_sync_status,
       CASE
         WHEN r.name IS NULL OR btrim(r.name)='' THEN 'missing name'
         WHEN r.state IS NULL OR btrim(r.state)='' THEN 'missing state / place_of_supply'
         WHEN d.k IS NOT NULL THEN 'duplicate contact name'
         WHEN r.gst_number IS NOT NULL AND btrim(r.gst_number) <> ''
              AND length(btrim(r.gst_number)) <> 15 THEN 'invalid GST format'
         ELSE NULL
       END AS blocker,
       (CASE
         WHEN r.name IS NULL OR btrim(r.name)='' THEN false
         WHEN r.state IS NULL OR btrim(r.state)='' THEN false
         WHEN d.k IS NOT NULL THEN false
         WHEN r.gst_number IS NOT NULL AND btrim(r.gst_number) <> ''
              AND length(btrim(r.gst_number)) <> 15 THEN false
         ELSE true END) AS is_ready,
       CASE WHEN r.gst_number IS NOT NULL AND length(btrim(r.gst_number))=15
            THEN 'business_gst' ELSE 'consumer' END AS gst_treatment,
       COALESCE(r.currency,'INR') AS currency_code
FROM public.retailers r
LEFT JOIN dup d ON d.k = lower(btrim(r.name))$Q301$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803165243_zoho_sync_readiness_view.sql', left($Q301$CREATE OR REPLACE VIEW public.zoho_sync_readiness
WITH (security_invoker = on) AS
WITH dup AS (
  SELECT lower(btrim(name)) AS k FROM public.retailers
  GROUP BY 1 HAVING count(*) > 1)
SELECT r.id, r.name, r.state, r.city, r.pincode, r.phone, r.email,
       r.gst_number, r.currency, r.zoho_contact_id, r.zoho_sync_status,
       CASE
         WHEN r.name IS NULL OR btrim(r.name)='' THEN 'missing name'
         WHEN r.state IS NULL OR btrim(r.state)='' THEN 'missing state / place_of_supply'
         WHEN d.k IS NOT NULL THEN 'duplicate contact name'
         WHEN r.gst_number IS NOT NULL AND btrim(r.gst_number) <> ''
              AND length(btrim(r.gst_number)) <> 15 THEN 'invalid GST format'
         ELSE NULL
       END AS blocker,
       (CASE
         WHEN r.name IS NULL OR btrim(r.name)='' THEN false
         WHEN r.state IS NULL OR btrim(r.state)='' THEN false
         WHEN d.k IS NOT NULL THEN false
         WHEN r.gst_number IS NOT NULL AND btrim(r.gst_number) <> ''
              AND length(btrim(r.gst_number)) <> 15 THEN false
         ELSE true END) AS is_ready,
       CASE WHEN r.gst_number IS NOT NULL AND length(btrim(r.gst_number))=15
            THEN 'business_gst' ELSE 'consumer' END AS gst_treatment,
       COALESCE(r.currency,'INR') AS currency_code
FROM public.retailers r
LEFT JOIN dup d ON d.k = lower(btrim(r.name))$Q301$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q302$GRANT SELECT ON public.zoho_sync_readiness TO authenticated$Q302$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260803165243_zoho_sync_readiness_view.sql', left($Q302$GRANT SELECT ON public.zoho_sync_readiness TO authenticated$Q302$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q303$CREATE VIEW public.zoho_sync_readiness
WITH (security_invoker = on) AS
WITH dup AS (
  SELECT lower(btrim(name)) AS k FROM public.retailers
  GROUP BY 1 HAVING count(*) > 1)
SELECT r.id, r.name, r.state, r.city, r.pincode, r.phone, r.email,
       r.gst_number, r.currency, r.zoho_contact_id, r.zoho_sync_status,
       CASE
         WHEN NOT r.zoho_sync_enabled THEN 'not enabled for sync (pilot gate)'
         WHEN r.name IS NULL OR btrim(r.name)='' THEN 'missing name'
         WHEN r.state IS NULL OR btrim(r.state)='' THEN 'missing state / place_of_supply'
         WHEN d.k IS NOT NULL THEN 'duplicate contact name'
         WHEN r.gst_number IS NOT NULL AND btrim(r.gst_number) <> ''
              AND length(btrim(r.gst_number)) <> 15 THEN 'invalid GST format'
         ELSE NULL
       END AS blocker,
       (r.zoho_sync_enabled
        AND r.name IS NOT NULL AND btrim(r.name) <> ''
        AND r.state IS NOT NULL AND btrim(r.state) <> ''
        AND d.k IS NULL
        AND (r.gst_number IS NULL OR btrim(r.gst_number) = ''
             OR length(btrim(r.gst_number)) = 15)) AS is_ready,
       CASE WHEN r.gst_number IS NOT NULL AND length(btrim(r.gst_number))=15
            THEN 'business_gst' ELSE 'consumer' END AS gst_treatment,
       COALESCE(r.currency,'INR') AS currency_code,
       r.zoho_sync_enabled
FROM public.retailers r
LEFT JOIN dup d ON d.k = lower(btrim(r.name))$Q303$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260804101106_zoho_pilot_gate_v2.sql', left($Q303$CREATE VIEW public.zoho_sync_readiness
WITH (security_invoker = on) AS
WITH dup AS (
  SELECT lower(btrim(name)) AS k FROM public.retailers
  GROUP BY 1 HAVING count(*) > 1)
SELECT r.id, r.name, r.state, r.city, r.pincode, r.phone, r.email,
       r.gst_number, r.currency, r.zoho_contact_id, r.zoho_sync_status,
       CASE
         WHEN NOT r.zoho_sync_enabled THEN 'not enabled for sync (pilot gate)'
         WHEN r.name IS NULL OR btrim(r.name)='' THEN 'missing name'
         WHEN r.state IS NULL OR btrim(r.state)='' THEN 'missing state / place_of_supply'
         WHEN d.k IS NOT NULL THEN 'duplicate contact name'
         WHEN r.gst_number IS NOT NULL AND btrim(r.gst_number) <> ''
              AND length(btrim(r.gst_number)) <> 15 THEN 'invalid GST format'
         ELSE NULL
       END AS blocker,
       (r.zoho_sync_enabled
        AND r.name IS NOT NULL AND btrim(r.name) <> ''
        AND r.state IS NOT NULL AND btrim(r.state) <> ''
        AND d.k IS NULL
        AND (r.gst_number IS NULL OR btrim(r.gst_number) = ''
             OR length(btrim(r.gst_number)) = 15)) AS is_ready,
       CASE WHEN r.gst_number IS NOT NULL AND length(btrim(r.gst_number))=15
            THEN 'business_gst' ELSE 'consumer' END AS gst_treatment,
       COALESCE(r.currency,'INR') AS currency_code,
       r.zoho_sync_enabled
FROM public.retailers r
LEFT JOIN dup d ON d.k = lower(btrim(r.name))$Q303$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q304$GRANT SELECT ON public.zoho_sync_readiness TO authenticated$Q304$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260804101106_zoho_pilot_gate_v2.sql', left($Q304$GRANT SELECT ON public.zoho_sync_readiness TO authenticated$Q304$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q305$-- All 8 notification trigger wrappers (orders, visits, attendance,
-- leave_applications, approval_requests, regularization, activity_events,
-- pm_tasks) funnel through emit_notification_event. It is called from
-- UNGUARDED AFTER triggers, so any error it raises aborts the entire INSERT.
--
-- That is exactly what happened on 30 Jul: notification_rules was dropped, the
-- SELECT inside this function raised, and every order and visit write in
-- staging failed for five days.
--
-- Body is unchanged. It is only wrapped so a notification problem degrades to
-- a WARNING in the Postgres log instead of losing the user's order.

CREATE OR REPLACE FUNCTION public.emit_notification_event(
  p_event_code text,
  p_source_table text,
  p_record_id text,
  p_actor_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD; v_receiver_id uuid; v_title text; v_message text;
  v_actor_name text; v_module_name text; v_record_uuid uuid;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_period_type text; v_top3 jsonb; v_notif_type text; v_is_leaderboard boolean;
  v_tz text;
BEGIN
  -- ===== outer guard: never propagate to the calling business write =====
  BEGIN
    BEGIN v_record_uuid := p_record_id::uuid; EXCEPTION WHEN others THEN v_record_uuid := NULL; END;
    v_is_leaderboard := p_event_code IN ('WEEKLY_LEADERBOARD','MONTHLY_LEADERBOARD');
    IF v_is_leaderboard THEN
      v_period_type := CASE WHEN p_event_code='WEEKLY_LEADERBOARD' THEN 'weekly' ELSE 'monthly' END;
      SELECT jsonb_agg(jsonb_build_object('rank',s.rank,'user_id',s.user_id,'full_name',s.full_name,'profile_picture_url',s.profile_picture_url,'total_points',s.total_points,'period_label',s.period_label) ORDER BY s.rank)
      INTO v_top3 FROM (SELECT * FROM leaderboard_snapshots WHERE period_type=v_period_type AND captured_at >= now()-interval '10 minutes' ORDER BY captured_at DESC, rank ASC LIMIT 3) s;
      v_metadata := v_metadata || jsonb_build_object('top3', COALESCE(v_top3,'[]'::jsonb));
    END IF;
    INSERT INTO notification_event_log (event_code, source_table, record_id, actor_user_id, metadata)
    VALUES (p_event_code, p_source_table, p_record_id, p_actor_user_id, v_metadata);
    SELECT COALESCE(full_name, username, 'System') INTO v_actor_name FROM profiles WHERE id = p_actor_user_id;
    v_module_name := INITCAP(REPLACE(p_source_table,'_',' '));
    v_notif_type := CASE WHEN v_is_leaderboard THEN 'leaderboard_banner' ELSE p_event_code END;

    IF v_is_leaderboard THEN
      SELECT * INTO v_rule FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LIMIT 1;
      v_title := COALESCE(v_rule.title_template,'🏆 Top performers');
      v_message := COALESCE(v_rule.message_template,'The leaderboard results are in.');
      v_title := REPLACE(v_title,'{record_name}', COALESCE(v_metadata->>'period_label',''));
      v_message := REPLACE(v_message,'{record_name}', COALESCE(v_metadata->>'period_label',''));
      INSERT INTO notifications (user_id, title, message, type, related_table, related_id, metadata)
      SELECT DISTINCT up.user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata
      FROM user_profiles up WHERE up.user_id IS NOT NULL;
      RETURN;
    END IF;

    FOR v_rule IN SELECT * FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LOOP
      v_tz := COALESCE(v_rule.timezone,'Asia/Kolkata');
      v_title := public.notif_fill(v_rule.title_template, v_actor_name, v_module_name, v_metadata, v_tz);
      v_message := public.notif_fill(v_rule.message_template, v_actor_name, v_module_name, v_metadata, v_tz);
      CASE v_rule.receiver_type
        WHEN 'employee' THEN
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (p_actor_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        WHEN 'manager' THEN
          SELECT manager_id INTO v_receiver_id FROM employees WHERE user_id=p_actor_user_id;
          IF v_receiver_id IS NOT NULL THEN
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END IF;
        WHEN 'hierarchy' THEN
          FOR v_receiver_id IN SELECT public.notif_managers_up_chain(p_actor_user_id) LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END LOOP;
        WHEN 'admin' THEN
          FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name='System Administrator' LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END LOOP;
        WHEN 'specific_user' THEN
          IF v_rule.receiver_user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_rule.receiver_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END IF;
        WHEN 'role' THEN
          IF v_rule.receiver_role IS NOT NULL THEN
            FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name=v_rule.receiver_role LOOP
              INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
              VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
            END LOOP;
          END IF;
        ELSE NULL;
      END CASE;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'emit_notification_event(%,%) suppressed: % [%] — business write preserved',
      p_event_code, p_source_table, SQLERRM, SQLSTATE;
  END;
END $function$$Q305$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260805105900_guard_notification_emit_never_aborts_writes.sql', left($Q305$-- All 8 notification trigger wrappers (orders, visits, attendance,
-- leave_applications, approval_requests, regularization, activity_events,
-- pm_tasks) funnel through emit_notification_event. It is called from
-- UNGUARDED AFTER triggers, so any error it raises aborts the entire INSERT.
--
-- That is exactly what happened on 30 Jul: notification_rules was dropped, the
-- SELECT inside this function raised, and every order and visit write in
-- staging failed for five days.
--
-- Body is unchanged. It is only wrapped so a notification problem degrades to
-- a WARNING in the Postgres log instead of losing the user's order.

CREATE OR REPLACE FUNCTION public.emit_notification_event(
  p_event_code text,
  p_source_table text,
  p_record_id text,
  p_actor_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD; v_receiver_id uuid; v_title text; v_message text;
  v_actor_name text; v_module_name text; v_record_uuid uuid;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_period_type text; v_top3 jsonb; v_notif_type text; v_is_leaderboard boolean;
  v_tz text;
BEGIN
  -- ===== outer guard: never propagate to the calling business write =====
  BEGIN
    BEGIN v_record_uuid := p_record_id::uuid; EXCEPTION WHEN others THEN v_record_uuid := NULL; END;
    v_is_leaderboard := p_event_code IN ('WEEKLY_LEADERBOARD','MONTHLY_LEADERBOARD');
    IF v_is_leaderboard THEN
      v_period_type := CASE WHEN p_event_code='WEEKLY_LEADERBOARD' THEN 'weekly' ELSE 'monthly' END;
      SELECT jsonb_agg(jsonb_build_object('rank',s.rank,'user_id',s.user_id,'full_name',s.full_name,'profile_picture_url',s.profile_picture_url,'total_points',s.total_points,'period_label',s.period_label) ORDER BY s.rank)
      INTO v_top3 FROM (SELECT * FROM leaderboard_snapshots WHERE period_type=v_period_type AND captured_at >= now()-interval '10 minutes' ORDER BY captured_at DESC, rank ASC LIMIT 3) s;
      v_metadata := v_metadata || jsonb_build_object('top3', COALESCE(v_top3,'[]'::jsonb));
    END IF;
    INSERT INTO notification_event_log (event_code, source_table, record_id, actor_user_id, metadata)
    VALUES (p_event_code, p_source_table, p_record_id, p_actor_user_id, v_metadata);
    SELECT COALESCE(full_name, username, 'System') INTO v_actor_name FROM profiles WHERE id = p_actor_user_id;
    v_module_name := INITCAP(REPLACE(p_source_table,'_',' '));
    v_notif_type := CASE WHEN v_is_leaderboard THEN 'leaderboard_banner' ELSE p_event_code END;

    IF v_is_leaderboard THEN
      SELECT * INTO v_rule FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LIMIT 1;
      v_title := COALESCE(v_rule.title_template,'🏆 Top performers');
      v_message := COALESCE(v_rule.message_template,'The leaderboard results are in.');
      v_title := REPLACE(v_title,'{record_name}', COALESCE(v_metadata->>'period_label',''));
      v_message := REPLACE(v_message,'{record_name}', COALESCE(v_metadata->>'period_label',''));
      INSERT INTO notifications (user_id, title, message, type, related_table, related_id, metadata)
      SELECT DISTINCT up.user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata
      FROM user_profiles up WHERE up.user_id IS NOT NULL;
      RETURN;
    END IF;

    FOR v_rule IN SELECT * FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LOOP
      v_tz := COALESCE(v_rule.timezone,'Asia/Kolkata');
      v_title := public.notif_fill(v_rule.title_template, v_actor_name, v_module_name, v_metadata, v_tz);
      v_message := public.notif_fill(v_rule.message_template, v_actor_name, v_module_name, v_metadata, v_tz);
      CASE v_rule.receiver_type
        WHEN 'employee' THEN
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (p_actor_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
        WHEN 'manager' THEN
          SELECT manager_id INTO v_receiver_id FROM employees WHERE user_id=p_actor_user_id;
          IF v_receiver_id IS NOT NULL THEN
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END IF;
        WHEN 'hierarchy' THEN
          FOR v_receiver_id IN SELECT public.notif_managers_up_chain(p_actor_user_id) LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END LOOP;
        WHEN 'admin' THEN
          FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name='System Administrator' LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END LOOP;
        WHEN 'specific_user' THEN
          IF v_rule.receiver_user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_rule.receiver_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
          END IF;
        WHEN 'role' THEN
          IF v_rule.receiver_role IS NOT NULL THEN
            FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name=v_rule.receiver_role LOOP
              INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
              VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata);
            END LOOP;
          END IF;
        ELSE NULL;
      END CASE;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'emit_notification_event(%,%) suppressed: % [%] — business write preserved',
      p_event_code, p_source_table, SQLERRM, SQLSTATE;
  END;
END $function$$Q305$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q306$-- When true (the default), generate-report builds each recipient's file from
-- that recipient's own slice of the employees.manager_id tree: themselves plus
-- everyone beneath them, never anyone above or beside them. System admins
-- bypass it and continue to receive the org-wide file.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS respect_hierarchy boolean NOT NULL DEFAULT true$Q306$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260805121323_report_subscriptions_respect_hierarchy.sql', left($Q306$-- When true (the default), generate-report builds each recipient's file from
-- that recipient's own slice of the employees.manager_id tree: themselves plus
-- everyone beneath them, never anyone above or beside them. System admins
-- bypass it and continue to receive the org-wide file.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS respect_hierarchy boolean NOT NULL DEFAULT true$Q306$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q307$-- Auto-sync retailer to Zoho Books whenever Zoho-relevant fields are edited.
-- Mirrors the existing INSERT trigger (trg_zoho_auto_sync_retailer), reusing the
-- same trigger function. Scoped to "OF <columns>" so it does NOT fire on every
-- update (e.g. visit counters, credit scores) and does NOT loop when the sync
-- function itself writes back zoho_contact_id / zoho_synced_at / zoho_sync_status.
CREATE TRIGGER trg_zoho_auto_sync_retailer_on_update
AFTER UPDATE OF name, legal_name, phone, email, address, city, state, pincode,
  country, gst_number, pan_no, currency
ON public.retailers
FOR EACH ROW
EXECUTE FUNCTION public.trg_zoho_auto_sync_retailer()$Q307$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806043608_add_zoho_auto_sync_on_retailer_update.sql', left($Q307$-- Auto-sync retailer to Zoho Books whenever Zoho-relevant fields are edited.
-- Mirrors the existing INSERT trigger (trg_zoho_auto_sync_retailer), reusing the
-- same trigger function. Scoped to "OF <columns>" so it does NOT fire on every
-- update (e.g. visit counters, credit scores) and does NOT loop when the sync
-- function itself writes back zoho_contact_id / zoho_synced_at / zoho_sync_status.
CREATE TRIGGER trg_zoho_auto_sync_retailer_on_update
AFTER UPDATE OF name, legal_name, phone, email, address, city, state, pincode,
  country, gst_number, pan_no, currency
ON public.retailers
FOR EACH ROW
EXECUTE FUNCTION public.trg_zoho_auto_sync_retailer()$Q307$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q308$-- Previously "missing state" hard-blocked sync, on the assumption Zoho needs
-- place_of_supply (GST). But this Zoho org has GST disabled, so the sync
-- function never actually sends place_of_supply/gst_treatment to Zoho at all
-- (see buildContactPayload's `if (gstEnabled)` guard) — the block was
-- unnecessary. Removing it so retailers with no state/city/pincode can still
-- sync. If GST is ever enabled on the org later and Zoho starts requiring
-- place_of_supply, missing-state contacts will surface as a real "failed"
-- sync (visible + actionable) instead of just failing at Zoho's end silently.
CREATE OR REPLACE VIEW public.zoho_sync_readiness AS
WITH dup AS (
  SELECT lower(btrim(retailers.name)) AS k
  FROM retailers
  GROUP BY lower(btrim(retailers.name))
  HAVING count(*) > 1
)
SELECT
  r.id,
  r.name,
  r.state,
  r.city,
  r.pincode,
  r.phone,
  r.email,
  r.gst_number,
  r.currency,
  r.zoho_contact_id,
  r.zoho_sync_status,
  CASE
    WHEN NOT r.zoho_sync_enabled THEN 'not enabled for sync (pilot gate)'
    WHEN r.name IS NULL OR btrim(r.name) = '' THEN 'missing name'
    WHEN d.k IS NOT NULL THEN 'duplicate contact name'
    WHEN r.gst_number IS NOT NULL AND btrim(r.gst_number) <> '' AND length(btrim(r.gst_number)) <> 15 THEN 'invalid GST format'
    ELSE NULL
  END AS blocker,
  (
    r.zoho_sync_enabled
    AND r.name IS NOT NULL AND btrim(r.name) <> ''
    AND d.k IS NULL
    AND (r.gst_number IS NULL OR btrim(r.gst_number) = '' OR length(btrim(r.gst_number)) = 15)
  ) AS is_ready,
  CASE
    WHEN r.gst_number IS NOT NULL AND length(btrim(r.gst_number)) = 15 THEN 'business_gst'
    ELSE 'consumer'
  END AS gst_treatment,
  COALESCE(r.currency, 'INR') AS currency_code,
  r.zoho_sync_enabled
FROM retailers r
LEFT JOIN dup d ON d.k = lower(btrim(r.name))$Q308$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806044013_relax_zoho_readiness_state_requirement.sql', left($Q308$-- Previously "missing state" hard-blocked sync, on the assumption Zoho needs
-- place_of_supply (GST). But this Zoho org has GST disabled, so the sync
-- function never actually sends place_of_supply/gst_treatment to Zoho at all
-- (see buildContactPayload's `if (gstEnabled)` guard) — the block was
-- unnecessary. Removing it so retailers with no state/city/pincode can still
-- sync. If GST is ever enabled on the org later and Zoho starts requiring
-- place_of_supply, missing-state contacts will surface as a real "failed"
-- sync (visible + actionable) instead of just failing at Zoho's end silently.
CREATE OR REPLACE VIEW public.zoho_sync_readiness AS
WITH dup AS (
  SELECT lower(btrim(retailers.name)) AS k
  FROM retailers
  GROUP BY lower(btrim(retailers.name))
  HAVING count(*) > 1
)
SELECT
  r.id,
  r.name,
  r.state,
  r.city,
  r.pincode,
  r.phone,
  r.email,
  r.gst_number,
  r.currency,
  r.zoho_contact_id,
  r.zoho_sync_status,
  CASE
    WHEN NOT r.zoho_sync_enabled THEN 'not enabled for sync (pilot gate)'
    WHEN r.name IS NULL OR btrim(r.name) = '' THEN 'missing name'
    WHEN d.k IS NOT NULL THEN 'duplicate contact name'
    WHEN r.gst_number IS NOT NULL AND btrim(r.gst_number) <> '' AND length(btrim(r.gst_number)) <> 15 THEN 'invalid GST format'
    ELSE NULL
  END AS blocker,
  (
    r.zoho_sync_enabled
    AND r.name IS NOT NULL AND btrim(r.name) <> ''
    AND d.k IS NULL
    AND (r.gst_number IS NULL OR btrim(r.gst_number) = '' OR length(btrim(r.gst_number)) = 15)
  ) AS is_ready,
  CASE
    WHEN r.gst_number IS NOT NULL AND length(btrim(r.gst_number)) = 15 THEN 'business_gst'
    ELSE 'consumer'
  END AS gst_treatment,
  COALESCE(r.currency, 'INR') AS currency_code,
  r.zoho_sync_enabled
FROM retailers r
LEFT JOIN dup d ON d.k = lower(btrim(r.name))$Q308$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q309$-- Both grouped branches ordered by the grouping columns alone, so the
-- full-roster rows (no beat, no orders) interleaved alphabetically with the
-- people who actually sold -- Abhishek KP with 0 orders sorted above Dharmesh
-- with 5. Two changes, applied by surgical text patch so nothing else moves:
--
--   1. Default order is now "sold first, then the rest", each block still
--      ordered by its grouping dimensions.
--   2. p_filters.sort_key / p_filters.sort_dir override that with an explicit
--      column sort. Carried in the existing jsonb filters rather than a new
--      parameter, so the RPC signature -- and therefore PostgREST's overload
--      resolution -- is untouched. sort_key is whitelisted against the report's
--      own dimension aliases plus the known measures; anything else is ignored.
DO $migration$
DECLARE
  v_def   text;
  v_fixed text;

  a_decl    CONSTANT text := 'v_i int; v_by_day boolean; v_by_beat boolean; v_universe boolean;';
  a_calc    CONSTANT text := 'AND (v_dims <@ ARRAY[''team_member'',''order_date'',''date'',''beat'']::text[]);';
  a_uorder  CONSTANT text := 'GROUP BY %6$s ORDER BY %6$s LIMIT 2000 ) t';
  a_uargs   CONSTANT text := E'\n      v_dim_sql, v_group_sql);';
  a_gargs   CONSTANT text := '$SQL$, v_dim_sql, v_group_sql, v_group_sql);';

  n_decl   CONSTANT text := a_decl || E'\n  v_sort_key text; v_sort_dir text; v_ordinals text;'
                                   || ' v_order_sql text; v_order_plain text; v_sortable text[];';
  n_uorder CONSTANT text := 'GROUP BY %6$s ORDER BY %7$s LIMIT 2000 ) t';
  n_uargs  CONSTANT text := E'\n      v_dim_sql, v_group_sql, v_order_sql);';
  n_gargs  CONSTANT text := '$SQL$, v_dim_sql, v_group_sql, v_order_plain);';

  n_calc CONSTANT text := a_calc || E'\n'
    || E'\n  -- Ordering. Default puts rows that actually sold ahead of the rest, so the'
    || E'\n  -- full-roster zero rows collect at the end instead of interleaving by name.'
    || E'\n  -- An explicit sort_key/sort_dir in the filters replaces that entirely.'
    || E'\n  v_ordinals := (SELECT string_agg(i::text, '','') FROM generate_series(1, array_length(v_dims,1)) i);'
    || E'\n  v_sort_key := NULLIF(p_filters->>''sort_key'','''');'
    || E'\n  v_sort_dir := CASE WHEN lower(COALESCE(p_filters->>''sort_dir'',''desc'')) = ''asc'' THEN ''ASC'' ELSE ''DESC'' END;'
    || E'\n  v_sortable := v_aliases || ARRAY[''quantity'',''rate'',''revenue'',''orders'',''new_retailers'',''productive'',''unproductive'',''pending'']::text[];'
    || E'\n  IF v_sort_key IS NOT NULL AND v_sort_key = ANY(v_sortable) THEN'
    || E'\n    v_order_sql   := format(''%I %s NULLS LAST, %s'', v_sort_key, v_sort_dir, v_ordinals);'
    || E'\n    v_order_plain := v_order_sql;'
    || E'\n  ELSE'
    || E'\n    v_order_sql   := ''CASE WHEN COALESCE(SUM(ord.orders),0) > 0 THEN 0 ELSE 1 END, '' || v_ordinals;'
    || E'\n    v_order_plain := v_ordinals;'
    || E'\n  END IF;';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_sales_report';

  IF v_def IS NULL THEN RAISE EXCEPTION 'get_sales_report not found'; END IF;
  IF position(a_decl   IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_decl missing';   END IF;
  IF position(a_calc   IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_calc missing';   END IF;
  IF position(a_uorder IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_uorder missing'; END IF;
  IF position(a_uargs  IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_uargs missing';  END IF;
  IF position(a_gargs  IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_gargs missing';  END IF;

  v_fixed := replace(v_def,   a_decl,   n_decl);
  v_fixed := replace(v_fixed, a_calc,   n_calc);
  v_fixed := replace(v_fixed, a_uorder, n_uorder);
  v_fixed := replace(v_fixed, a_uargs,  n_uargs);
  v_fixed := replace(v_fixed, a_gargs,  n_gargs);

  EXECUTE v_fixed;
END
$migration$$Q309$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806045410_sales_report_order_active_rows_first_and_column_sort.sql', left($Q309$-- Both grouped branches ordered by the grouping columns alone, so the
-- full-roster rows (no beat, no orders) interleaved alphabetically with the
-- people who actually sold -- Abhishek KP with 0 orders sorted above Dharmesh
-- with 5. Two changes, applied by surgical text patch so nothing else moves:
--
--   1. Default order is now "sold first, then the rest", each block still
--      ordered by its grouping dimensions.
--   2. p_filters.sort_key / p_filters.sort_dir override that with an explicit
--      column sort. Carried in the existing jsonb filters rather than a new
--      parameter, so the RPC signature -- and therefore PostgREST's overload
--      resolution -- is untouched. sort_key is whitelisted against the report's
--      own dimension aliases plus the known measures; anything else is ignored.
DO $migration$
DECLARE
  v_def   text;
  v_fixed text;

  a_decl    CONSTANT text := 'v_i int; v_by_day boolean; v_by_beat boolean; v_universe boolean;';
  a_calc    CONSTANT text := 'AND (v_dims <@ ARRAY[''team_member'',''order_date'',''date'',''beat'']::text[]);';
  a_uorder  CONSTANT text := 'GROUP BY %6$s ORDER BY %6$s LIMIT 2000 ) t';
  a_uargs   CONSTANT text := E'\n      v_dim_sql, v_group_sql);';
  a_gargs   CONSTANT text := '$SQL$, v_dim_sql, v_group_sql, v_group_sql);';

  n_decl   CONSTANT text := a_decl || E'\n  v_sort_key text; v_sort_dir text; v_ordinals text;'
                                   || ' v_order_sql text; v_order_plain text; v_sortable text[];';
  n_uorder CONSTANT text := 'GROUP BY %6$s ORDER BY %7$s LIMIT 2000 ) t';
  n_uargs  CONSTANT text := E'\n      v_dim_sql, v_group_sql, v_order_sql);';
  n_gargs  CONSTANT text := '$SQL$, v_dim_sql, v_group_sql, v_order_plain);';

  n_calc CONSTANT text := a_calc || E'\n'
    || E'\n  -- Ordering. Default puts rows that actually sold ahead of the rest, so the'
    || E'\n  -- full-roster zero rows collect at the end instead of interleaving by name.'
    || E'\n  -- An explicit sort_key/sort_dir in the filters replaces that entirely.'
    || E'\n  v_ordinals := (SELECT string_agg(i::text, '','') FROM generate_series(1, array_length(v_dims,1)) i);'
    || E'\n  v_sort_key := NULLIF(p_filters->>''sort_key'','''');'
    || E'\n  v_sort_dir := CASE WHEN lower(COALESCE(p_filters->>''sort_dir'',''desc'')) = ''asc'' THEN ''ASC'' ELSE ''DESC'' END;'
    || E'\n  v_sortable := v_aliases || ARRAY[''quantity'',''rate'',''revenue'',''orders'',''new_retailers'',''productive'',''unproductive'',''pending'']::text[];'
    || E'\n  IF v_sort_key IS NOT NULL AND v_sort_key = ANY(v_sortable) THEN'
    || E'\n    v_order_sql   := format(''%I %s NULLS LAST, %s'', v_sort_key, v_sort_dir, v_ordinals);'
    || E'\n    v_order_plain := v_order_sql;'
    || E'\n  ELSE'
    || E'\n    v_order_sql   := ''CASE WHEN COALESCE(SUM(ord.orders),0) > 0 THEN 0 ELSE 1 END, '' || v_ordinals;'
    || E'\n    v_order_plain := v_ordinals;'
    || E'\n  END IF;';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_sales_report';

  IF v_def IS NULL THEN RAISE EXCEPTION 'get_sales_report not found'; END IF;
  IF position(a_decl   IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_decl missing';   END IF;
  IF position(a_calc   IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_calc missing';   END IF;
  IF position(a_uorder IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_uorder missing'; END IF;
  IF position(a_uargs  IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_uargs missing';  END IF;
  IF position(a_gargs  IN v_def) = 0 THEN RAISE EXCEPTION 'anchor a_gargs missing';  END IF;

  v_fixed := replace(v_def,   a_decl,   n_decl);
  v_fixed := replace(v_fixed, a_calc,   n_calc);
  v_fixed := replace(v_fixed, a_uorder, n_uorder);
  v_fixed := replace(v_fixed, a_uargs,  n_uargs);
  v_fixed := replace(v_fixed, a_gargs,  n_gargs);

  EXECUTE v_fixed;
END
$migration$$Q309$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q310$ALTER TABLE public.retailers ALTER COLUMN latitude TYPE numeric$Q310$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806045909_widen_retailer_gps_columns_v3.sql', left($Q310$ALTER TABLE public.retailers ALTER COLUMN latitude TYPE numeric$Q310$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q311$ALTER TABLE public.retailers ALTER COLUMN longitude TYPE numeric$Q311$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806045909_widen_retailer_gps_columns_v3.sql', left($Q311$ALTER TABLE public.retailers ALTER COLUMN longitude TYPE numeric$Q311$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q312$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_tax_id text$Q312$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q312$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_tax_id text$Q312$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q313$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_sync_status text NOT NULL DEFAULT 'not_synced'$Q313$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q313$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_sync_status text NOT NULL DEFAULT 'not_synced'$Q313$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q314$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_sync_error text$Q314$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q314$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_sync_error text$Q314$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q315$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_synced_at timestamptz$Q315$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q315$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_synced_at timestamptz$Q315$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q316$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_sync_enabled boolean NOT NULL DEFAULT true$Q316$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q316$-- Purely additive: new nullable columns with safe defaults on products,
-- tax_masters, price_books. Mirrors the retailers.zoho_* pattern. Nothing
-- existing is altered, dropped, or renamed, so no existing workflow is
-- affected by this migration on its own.

ALTER TABLE public.tax_masters ADD COLUMN IF NOT EXISTS zoho_sync_enabled boolean NOT NULL DEFAULT true$Q316$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q317$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_item_id text$Q317$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q317$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_item_id text$Q317$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q318$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_sync_status text NOT NULL DEFAULT 'not_synced'$Q318$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q318$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_sync_status text NOT NULL DEFAULT 'not_synced'$Q318$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q319$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_sync_error text$Q319$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q319$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_sync_error text$Q319$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q320$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_synced_at timestamptz$Q320$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q320$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_synced_at timestamptz$Q320$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q321$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_sync_enabled boolean NOT NULL DEFAULT true$Q321$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q321$ALTER TABLE public.products ADD COLUMN IF NOT EXISTS zoho_sync_enabled boolean NOT NULL DEFAULT true$Q321$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q322$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_pricebook_id text$Q322$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q322$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_pricebook_id text$Q322$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q323$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_sync_status text NOT NULL DEFAULT 'not_synced'$Q323$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q323$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_sync_status text NOT NULL DEFAULT 'not_synced'$Q323$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q324$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_sync_error text$Q324$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q324$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_sync_error text$Q324$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q325$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_synced_at timestamptz$Q325$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q325$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_synced_at timestamptz$Q325$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q326$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_sync_enabled boolean NOT NULL DEFAULT true$Q326$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q326$ALTER TABLE public.price_books ADD COLUMN IF NOT EXISTS zoho_sync_enabled boolean NOT NULL DEFAULT true$Q326$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q327$-- zoho_sync_log currently only has retailer_id. Add a generic nullable
-- record_id so tax/item/pricebook sync attempts can be logged the same way
-- without touching the existing retailer_id column or any existing rows.
ALTER TABLE public.zoho_sync_log ADD COLUMN IF NOT EXISTS record_id uuid$Q327$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094235_add_zoho_sync_columns_products_tax_pricebooks.sql', left($Q327$-- zoho_sync_log currently only has retailer_id. Add a generic nullable
-- record_id so tax/item/pricebook sync attempts can be logged the same way
-- without touching the existing retailer_id column or any existing rows.
ALTER TABLE public.zoho_sync_log ADD COLUMN IF NOT EXISTS record_id uuid$Q327$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q328$CREATE OR REPLACE VIEW public.zoho_tax_sync_readiness AS
SELECT
  t.id, t.name, t.total_rate, t.zoho_tax_id, t.zoho_sync_status,
  CASE
    WHEN NOT t.zoho_sync_enabled THEN 'not enabled for sync'
    WHEN NOT t.is_active THEN 'inactive tax'
    WHEN t.name IS NULL OR btrim(t.name) = '' THEN 'missing name'
    WHEN t.total_rate IS NULL OR t.total_rate < 0 THEN 'missing/invalid total_rate'
    ELSE NULL
  END AS blocker,
  (
    t.zoho_sync_enabled AND t.is_active
    AND t.name IS NOT NULL AND btrim(t.name) <> ''
    AND t.total_rate IS NOT NULL AND t.total_rate >= 0
  ) AS is_ready
FROM public.tax_masters t$Q328$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094251_create_zoho_readiness_views_tax_item_pricelist.sql', left($Q328$CREATE OR REPLACE VIEW public.zoho_tax_sync_readiness AS
SELECT
  t.id, t.name, t.total_rate, t.zoho_tax_id, t.zoho_sync_status,
  CASE
    WHEN NOT t.zoho_sync_enabled THEN 'not enabled for sync'
    WHEN NOT t.is_active THEN 'inactive tax'
    WHEN t.name IS NULL OR btrim(t.name) = '' THEN 'missing name'
    WHEN t.total_rate IS NULL OR t.total_rate < 0 THEN 'missing/invalid total_rate'
    ELSE NULL
  END AS blocker,
  (
    t.zoho_sync_enabled AND t.is_active
    AND t.name IS NOT NULL AND btrim(t.name) <> ''
    AND t.total_rate IS NOT NULL AND t.total_rate >= 0
  ) AS is_ready
FROM public.tax_masters t$Q328$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q329$CREATE OR REPLACE VIEW public.zoho_item_sync_readiness AS
SELECT
  p.id, p.name, p.sku, p.rate, p.zoho_item_id, p.zoho_sync_status,
  CASE
    WHEN NOT p.zoho_sync_enabled THEN 'not enabled for sync'
    WHEN NOT p.is_active THEN 'inactive product'
    WHEN p.name IS NULL OR btrim(p.name) = '' THEN 'missing name'
    WHEN p.rate IS NULL OR p.rate < 0 THEN 'missing/invalid rate'
    ELSE NULL
  END AS blocker,
  (
    p.zoho_sync_enabled AND p.is_active
    AND p.name IS NOT NULL AND btrim(p.name) <> ''
    AND p.rate IS NOT NULL AND p.rate >= 0
  ) AS is_ready
FROM public.products p$Q329$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094251_create_zoho_readiness_views_tax_item_pricelist.sql', left($Q329$CREATE OR REPLACE VIEW public.zoho_item_sync_readiness AS
SELECT
  p.id, p.name, p.sku, p.rate, p.zoho_item_id, p.zoho_sync_status,
  CASE
    WHEN NOT p.zoho_sync_enabled THEN 'not enabled for sync'
    WHEN NOT p.is_active THEN 'inactive product'
    WHEN p.name IS NULL OR btrim(p.name) = '' THEN 'missing name'
    WHEN p.rate IS NULL OR p.rate < 0 THEN 'missing/invalid rate'
    ELSE NULL
  END AS blocker,
  (
    p.zoho_sync_enabled AND p.is_active
    AND p.name IS NOT NULL AND btrim(p.name) <> ''
    AND p.rate IS NOT NULL AND p.rate >= 0
  ) AS is_ready
FROM public.products p$Q329$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q330$CREATE OR REPLACE VIEW public.zoho_pricelist_sync_readiness AS
SELECT
  pb.id, pb.name, pb.zoho_pricebook_id, pb.zoho_sync_status,
  (SELECT count(*) FROM public.price_book_entries pbe
     JOIN public.products pr ON pr.id = pbe.product_id
     WHERE pbe.price_book_id = pb.id AND pbe.is_active AND pr.zoho_item_id IS NOT NULL) AS synced_item_entries,
  CASE
    WHEN NOT pb.zoho_sync_enabled THEN 'not enabled for sync'
    WHEN NOT pb.is_active THEN 'inactive price book'
    WHEN pb.name IS NULL OR btrim(pb.name) = '' THEN 'missing name'
    WHEN NOT EXISTS (
      SELECT 1 FROM public.price_book_entries pbe
      JOIN public.products pr ON pr.id = pbe.product_id
      WHERE pbe.price_book_id = pb.id AND pbe.is_active AND pr.zoho_item_id IS NOT NULL
    ) THEN 'no entries with a Zoho-synced product yet'
    ELSE NULL
  END AS blocker,
  (
    pb.zoho_sync_enabled AND pb.is_active
    AND pb.name IS NOT NULL AND btrim(pb.name) <> ''
    AND EXISTS (
      SELECT 1 FROM public.price_book_entries pbe
      JOIN public.products pr ON pr.id = pbe.product_id
      WHERE pbe.price_book_id = pb.id AND pbe.is_active AND pr.zoho_item_id IS NOT NULL
    )
  ) AS is_ready
FROM public.price_books pb$Q330$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260806094251_create_zoho_readiness_views_tax_item_pricelist.sql', left($Q330$CREATE OR REPLACE VIEW public.zoho_pricelist_sync_readiness AS
SELECT
  pb.id, pb.name, pb.zoho_pricebook_id, pb.zoho_sync_status,
  (SELECT count(*) FROM public.price_book_entries pbe
     JOIN public.products pr ON pr.id = pbe.product_id
     WHERE pbe.price_book_id = pb.id AND pbe.is_active AND pr.zoho_item_id IS NOT NULL) AS synced_item_entries,
  CASE
    WHEN NOT pb.zoho_sync_enabled THEN 'not enabled for sync'
    WHEN NOT pb.is_active THEN 'inactive price book'
    WHEN pb.name IS NULL OR btrim(pb.name) = '' THEN 'missing name'
    WHEN NOT EXISTS (
      SELECT 1 FROM public.price_book_entries pbe
      JOIN public.products pr ON pr.id = pbe.product_id
      WHERE pbe.price_book_id = pb.id AND pbe.is_active AND pr.zoho_item_id IS NOT NULL
    ) THEN 'no entries with a Zoho-synced product yet'
    ELSE NULL
  END AS blocker,
  (
    pb.zoho_sync_enabled AND pb.is_active
    AND pb.name IS NOT NULL AND btrim(pb.name) <> ''
    AND EXISTS (
      SELECT 1 FROM public.price_book_entries pbe
      JOIN public.products pr ON pr.id = pbe.product_id
      WHERE pbe.price_book_id = pb.id AND pbe.is_active AND pr.zoho_item_id IS NOT NULL
    )
  ) AS is_ready
FROM public.price_books pb$Q330$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q331$-- Edited orders leave the superseded original as status='replaced'.
-- Reporting functions were written before that status existed and filter only
-- 'cancelled'/'rejected', so an edited order is counted twice: once as the
-- superseded original and once as its replacement.
--
-- Rewrites the status predicate in place via pg_get_functiondef so the rest of
-- each body is preserved byte-for-byte. No schema change, no data change.
DO $mig$
DECLARE r RECORD; v_new text; v_cnt int := 0; v_done text := '';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_sales_report','get_today_sales_summary',
                        'get_sales_quantity_report','get_sales_quantity_summary',
                        'get_field_activity_report')
  LOOP
    v_new := r.def;
    v_new := replace(v_new, 'NOT IN (''cancelled'', ''rejected'')',
                            'NOT IN (''cancelled'', ''rejected'', ''replaced'')');
    v_new := replace(v_new, 'NOT IN (''cancelled'',''rejected'')',
                            'NOT IN (''cancelled'',''rejected'',''replaced'')');
    v_new := replace(v_new, 'status <> ''cancelled''',
                            'status NOT IN (''cancelled'',''replaced'')');

    IF v_new <> r.def THEN
      EXECUTE v_new;
      v_cnt := v_cnt + 1;
      v_done := v_done || r.proname || ' ';
    ELSE
      RAISE WARNING 'no status predicate matched in %, left unchanged', r.proname;
    END IF;
  END LOOP;

  IF v_cnt <> 5 THEN
    RAISE EXCEPTION 'expected 5 functions rewritten, got % (%)', v_cnt, v_done;
  END IF;
  RAISE NOTICE 'rewritten: %', v_done;
END $mig$$Q331$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260807120844_reports_exclude_replaced_orders.sql', left($Q331$-- Edited orders leave the superseded original as status='replaced'.
-- Reporting functions were written before that status existed and filter only
-- 'cancelled'/'rejected', so an edited order is counted twice: once as the
-- superseded original and once as its replacement.
--
-- Rewrites the status predicate in place via pg_get_functiondef so the rest of
-- each body is preserved byte-for-byte. No schema change, no data change.
DO $mig$
DECLARE r RECORD; v_new text; v_cnt int := 0; v_done text := '';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_sales_report','get_today_sales_summary',
                        'get_sales_quantity_report','get_sales_quantity_summary',
                        'get_field_activity_report')
  LOOP
    v_new := r.def;
    v_new := replace(v_new, 'NOT IN (''cancelled'', ''rejected'')',
                            'NOT IN (''cancelled'', ''rejected'', ''replaced'')');
    v_new := replace(v_new, 'NOT IN (''cancelled'',''rejected'')',
                            'NOT IN (''cancelled'',''rejected'',''replaced'')');
    v_new := replace(v_new, 'status <> ''cancelled''',
                            'status NOT IN (''cancelled'',''replaced'')');

    IF v_new <> r.def THEN
      EXECUTE v_new;
      v_cnt := v_cnt + 1;
      v_done := v_done || r.proname || ' ';
    ELSE
      RAISE WARNING 'no status predicate matched in %, left unchanged', r.proname;
    END IF;
  END LOOP;

  IF v_cnt <> 5 THEN
    RAISE EXCEPTION 'expected 5 functions rewritten, got % (%)', v_cnt, v_done;
  END IF;
  RAISE NOTICE 'rewritten: %', v_done;
END $mig$$Q331$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q332$ALTER TABLE public.db_health_snapshots ENABLE ROW LEVEL SECURITY$Q332$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260808132646_db_health_module_tables_and_capture.sql', left($Q332$ALTER TABLE public.db_health_snapshots ENABLE ROW LEVEL SECURITY$Q332$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q333$ALTER TABLE public.db_health_objects ENABLE ROW LEVEL SECURITY$Q333$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260808132646_db_health_module_tables_and_capture.sql', left($Q333$ALTER TABLE public.db_health_objects ENABLE ROW LEVEL SECURITY$Q333$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q334$-- Tax treatment for a scheme's discount, for the Manual Per-Unit scheme.
--
--   'exclusive' (DEFAULT, = today's behaviour exactly):
--       the entered per-unit discount is a PRE-TAX amount. The taxable base is
--       reduced by it and GST is charged on the remainder, so what the retailer
--       actually saves is discount * (1 + gst%).
--
--   'inclusive':
--       the entered per-unit discount is the amount off the FINAL, tax-paid
--       price. The taxable base must therefore be reduced by
--       discount / (1 + gst/100) so that the invoice total falls by exactly the
--       amount entered.
--
-- Additive only, and the default preserves current behaviour for every existing
-- scheme — no invoice already raised changes, and no scheme starts computing
-- differently until it is explicitly switched to 'inclusive'.
ALTER TABLE public.product_schemes ADD COLUMN IF NOT EXISTS discount_tax_treatment text NOT NULL DEFAULT 'exclusive'$Q334$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260809074451_scheme_discount_tax_treatment.sql', left($Q334$-- Tax treatment for a scheme's discount, for the Manual Per-Unit scheme.
--
--   'exclusive' (DEFAULT, = today's behaviour exactly):
--       the entered per-unit discount is a PRE-TAX amount. The taxable base is
--       reduced by it and GST is charged on the remainder, so what the retailer
--       actually saves is discount * (1 + gst%).
--
--   'inclusive':
--       the entered per-unit discount is the amount off the FINAL, tax-paid
--       price. The taxable base must therefore be reduced by
--       discount / (1 + gst/100) so that the invoice total falls by exactly the
--       amount entered.
--
-- Additive only, and the default preserves current behaviour for every existing
-- scheme — no invoice already raised changes, and no scheme starts computing
-- differently until it is explicitly switched to 'inclusive'.
ALTER TABLE public.product_schemes ADD COLUMN IF NOT EXISTS discount_tax_treatment text NOT NULL DEFAULT 'exclusive'$Q334$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q335$DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_schemes_discount_tax_treatment_check'
  ) THEN
    ALTER TABLE public.product_schemes
      ADD CONSTRAINT product_schemes_discount_tax_treatment_check
      CHECK (discount_tax_treatment IN ('inclusive','exclusive'));
  END IF;
END $$$Q335$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260809074451_scheme_discount_tax_treatment.sql', left($Q335$DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_schemes_discount_tax_treatment_check'
  ) THEN
    ALTER TABLE public.product_schemes
      ADD CONSTRAINT product_schemes_discount_tax_treatment_check
      CHECK (discount_tax_treatment IN ('inclusive','exclusive'));
  END IF;
END $$$Q335$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q336$COMMENT ON COLUMN public.product_schemes.discount_tax_treatment IS
  'exclusive (default) = entered discount is pre-tax, GST charged on the reduced base. inclusive = entered discount is off the tax-paid price, so the taxable base is reduced by discount/(1+gst/100). Only meaningful for discount-bearing schemes such as manual_per_unit_discount.'$Q336$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260809074451_scheme_discount_tax_treatment.sql', left($Q336$COMMENT ON COLUMN public.product_schemes.discount_tax_treatment IS
  'exclusive (default) = entered discount is pre-tax, GST charged on the reduced base. inclusive = entered discount is off the tax-paid price, so the taxable base is reduced by discount/(1+gst/100). Only meaningful for discount-bearing schemes such as manual_per_unit_discount.'$Q336$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q337$-- Report promotion 00/08 — the subscription and delivery-log columns.
--
-- Numbered 00 and timestamped ahead of the rest: these are the base columns the
-- others build on, and generate-report selects every one of them. Nothing in
-- files 01–08 depends on them, so strict ordering is not required for
-- correctness — but running them first keeps the set self-contained rather than
-- relying on someone replaying staging's older migration history.
--
-- Consolidates three staging migrations:
--   20260723085111  period_basis + delivery-log FK loosening
--   20260724052032  trigger_type + scheduled-idempotency columns
--   20260724103511  pdf_template
--
-- ─────────────────────────────────────────────────────────────────────────────
-- TWO DELIBERATE OMISSIONS from the originals. Both matter.
--
-- 1. `DELETE FROM report_delivery_log WHERE in_app_status = 'skipped_empty'`
--    NOT included. In staging that was defensive: the old generate-report read
--    the delivery log to build an `alreadyProcessed` set, and a skipped_empty
--    row would suppress a later retry for that period. The current function
--    never reads the log and never writes that status, so the DELETE buys
--    nothing — while on production it would destroy 11 of 19 delivery records,
--    58% of its history. Leaving them is inert.
--
-- 2. `DROP INDEX idx_report_delivery_dedupe` NOT included.
--    It lives in file 07 instead, which is explicitly ordered AFTER the
--    generate-report deploy. Dropping it here would break the currently
--    deployed function, whose upsert requires it — every delivery would fail
--    with "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification". Keeping the split means every statement in THIS file is
--    safe to run against a database still serving the old function.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── report_subscriptions ────────────────────────────────────────────────────

-- Which window a scheduled run covers: the period in progress, or the one just
-- closed. Daily cadences want 'current' so a 18:00 fire reports that day.
-- The CHECK is inline, exactly as the original migration wrote it, so Postgres
-- auto-names it `report_subscriptions_period_basis_check` — matching staging.
-- Naming it explicitly here would have added a SECOND, redundant constraint on
-- databases that already carry the auto-named one. Where the column exists,
-- ADD COLUMN IF NOT EXISTS skips the constraint too, which is the correct no-op.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS period_basis text NOT NULL DEFAULT 'current'
  CHECK (period_basis IN ('current','previous'))$Q337$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q337$-- Report promotion 00/08 — the subscription and delivery-log columns.
--
-- Numbered 00 and timestamped ahead of the rest: these are the base columns the
-- others build on, and generate-report selects every one of them. Nothing in
-- files 01–08 depends on them, so strict ordering is not required for
-- correctness — but running them first keeps the set self-contained rather than
-- relying on someone replaying staging's older migration history.
--
-- Consolidates three staging migrations:
--   20260723085111  period_basis + delivery-log FK loosening
--   20260724052032  trigger_type + scheduled-idempotency columns
--   20260724103511  pdf_template
--
-- ─────────────────────────────────────────────────────────────────────────────
-- TWO DELIBERATE OMISSIONS from the originals. Both matter.
--
-- 1. `DELETE FROM report_delivery_log WHERE in_app_status = 'skipped_empty'`
--    NOT included. In staging that was defensive: the old generate-report read
--    the delivery log to build an `alreadyProcessed` set, and a skipped_empty
--    row would suppress a later retry for that period. The current function
--    never reads the log and never writes that status, so the DELETE buys
--    nothing — while on production it would destroy 11 of 19 delivery records,
--    58% of its history. Leaving them is inert.
--
-- 2. `DROP INDEX idx_report_delivery_dedupe` NOT included.
--    It lives in file 07 instead, which is explicitly ordered AFTER the
--    generate-report deploy. Dropping it here would break the currently
--    deployed function, whose upsert requires it — every delivery would fail
--    with "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification". Keeping the split means every statement in THIS file is
--    safe to run against a database still serving the old function.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── report_subscriptions ────────────────────────────────────────────────────

-- Which window a scheduled run covers: the period in progress, or the one just
-- closed. Daily cadences want 'current' so a 18:00 fire reports that day.
-- The CHECK is inline, exactly as the original migration wrote it, so Postgres
-- auto-names it `report_subscriptions_period_basis_check` — matching staging.
-- Naming it explicitly here would have added a SECOND, redundant constraint on
-- databases that already carry the auto-named one. Where the column exists,
-- ADD COLUMN IF NOT EXISTS skips the constraint too, which is the correct no-op.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS period_basis text NOT NULL DEFAULT 'current'
  CHECK (period_basis IN ('current','previous'))$Q337$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q338$-- NOTE: the original migration followed the ADD COLUMN with a backfill that set
-- period_basis = 'previous' for every daily/weekday/today subscription on a
-- sales dataset. That is deliberately NOT reproduced here.
--
-- It was a one-time backfill for subscriptions that already existed when the
-- column was introduced, preserving the "yesterday's sales" behaviour they had
-- before. It is not idempotent in any useful sense: re-running it silently
-- overwrites a deliberate 'current' choice back to 'previous'. I hit exactly
-- that while validating this file — it reset a staging subscription that had
-- been set to 'current' on purpose, which also explains an earlier reversion we
-- could not account for.
--
-- On production it would be a no-op regardless: both subscriptions there are on
-- the attendance dataset, so the LIKE '%sales%' predicate matches nothing. New
-- rows take the 'current' default, which is the behaviour daily reports want.

-- Scheduled idempotency. last_scheduled_period_key stores the OCCURRENCE key
-- (local date + fire_time), never the reporting-period key, so changing
-- fire_time yields a new key and permits another same-day run.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS last_scheduled_fire_at timestamptz$Q338$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q338$-- NOTE: the original migration followed the ADD COLUMN with a backfill that set
-- period_basis = 'previous' for every daily/weekday/today subscription on a
-- sales dataset. That is deliberately NOT reproduced here.
--
-- It was a one-time backfill for subscriptions that already existed when the
-- column was introduced, preserving the "yesterday's sales" behaviour they had
-- before. It is not idempotent in any useful sense: re-running it silently
-- overwrites a deliberate 'current' choice back to 'previous'. I hit exactly
-- that while validating this file — it reset a staging subscription that had
-- been set to 'current' on purpose, which also explains an earlier reversion we
-- could not account for.
--
-- On production it would be a no-op regardless: both subscriptions there are on
-- the attendance dataset, so the LIKE '%sales%' predicate matches nothing. New
-- rows take the 'current' default, which is the behaviour daily reports want.

-- Scheduled idempotency. last_scheduled_period_key stores the OCCURRENCE key
-- (local date + fire_time), never the reporting-period key, so changing
-- fire_time yields a new key and permits another same-day run.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS last_scheduled_fire_at timestamptz$Q338$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q339$-- NOTE: the original migration followed the ADD COLUMN with a backfill that set
-- period_basis = 'previous' for every daily/weekday/today subscription on a
-- sales dataset. That is deliberately NOT reproduced here.
--
-- It was a one-time backfill for subscriptions that already existed when the
-- column was introduced, preserving the "yesterday's sales" behaviour they had
-- before. It is not idempotent in any useful sense: re-running it silently
-- overwrites a deliberate 'current' choice back to 'previous'. I hit exactly
-- that while validating this file — it reset a staging subscription that had
-- been set to 'current' on purpose, which also explains an earlier reversion we
-- could not account for.
--
-- On production it would be a no-op regardless: both subscriptions there are on
-- the attendance dataset, so the LIKE '%sales%' predicate matches nothing. New
-- rows take the 'current' default, which is the behaviour daily reports want.

-- Scheduled idempotency. last_scheduled_period_key stores the OCCURRENCE key
-- (local date + fire_time), never the reporting-period key, so changing
-- fire_time yields a new key and permits another same-day run.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS last_scheduled_period_key text$Q339$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q339$-- NOTE: the original migration followed the ADD COLUMN with a backfill that set
-- period_basis = 'previous' for every daily/weekday/today subscription on a
-- sales dataset. That is deliberately NOT reproduced here.
--
-- It was a one-time backfill for subscriptions that already existed when the
-- column was introduced, preserving the "yesterday's sales" behaviour they had
-- before. It is not idempotent in any useful sense: re-running it silently
-- overwrites a deliberate 'current' choice back to 'previous'. I hit exactly
-- that while validating this file — it reset a staging subscription that had
-- been set to 'current' on purpose, which also explains an earlier reversion we
-- could not account for.
--
-- On production it would be a no-op regardless: both subscriptions there are on
-- the attendance dataset, so the LIKE '%sales%' predicate matches nothing. New
-- rows take the 'current' default, which is the behaviour daily reports want.

-- Scheduled idempotency. last_scheduled_period_key stores the OCCURRENCE key
-- (local date + fire_time), never the reporting-period key, so changing
-- fire_time yields a new key and permits another same-day run.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS last_scheduled_period_key text$Q339$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q340$-- PDF presentation: header style, title override, theme, orientation, footer,
-- branding mode. Empty object means "use the renderer's defaults", so adding
-- this is inert until a template is actually configured.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS pdf_template jsonb NOT NULL DEFAULT '{}'::jsonb$Q340$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q340$-- PDF presentation: header style, title override, theme, orientation, footer,
-- branding mode. Empty object means "use the renderer's defaults", so adding
-- this is inert until a template is actually configured.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS pdf_template jsonb NOT NULL DEFAULT '{}'::jsonb$Q340$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q341$-- ── report_delivery_log ─────────────────────────────────────────────────────

-- Append-only history needs to record HOW a run was triggered. Backfilled as
-- 'scheduled' because every pre-existing row came from the cron dispatcher.
ALTER TABLE public.report_delivery_log ADD COLUMN IF NOT EXISTS trigger_type text$Q341$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q341$-- ── report_delivery_log ─────────────────────────────────────────────────────

-- Append-only history needs to record HOW a run was triggered. Backfilled as
-- 'scheduled' because every pre-existing row came from the cron dispatcher.
ALTER TABLE public.report_delivery_log ADD COLUMN IF NOT EXISTS trigger_type text$Q341$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q342$ALTER TABLE public.report_delivery_log ALTER COLUMN trigger_type SET NOT NULL$Q342$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q342$ALTER TABLE public.report_delivery_log ALTER COLUMN trigger_type SET NOT NULL$Q342$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q343$DO $$
BEGIN
  ALTER TABLE public.report_delivery_log
    ADD CONSTRAINT report_delivery_log_trigger_type_chk
    CHECK (trigger_type IN ('scheduled','manual'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$$Q343$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q343$DO $$
BEGIN
  ALTER TABLE public.report_delivery_log
    ADD CONSTRAINT report_delivery_log_trigger_type_chk
    CHECK (trigger_type IN ('scheduled','manual'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$$Q343$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q344$-- Preserve delivery history when a subscription is deleted: cascade would take
-- the log rows with it, orphaning the notifications that reference them.
-- Switching to SET NULL keeps the record and requires the column to be nullable.
ALTER TABLE public.report_delivery_log ALTER COLUMN subscription_id DROP NOT NULL$Q344$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q344$-- Preserve delivery history when a subscription is deleted: cascade would take
-- the log rows with it, orphaning the notifications that reference them.
-- Switching to SET NULL keeps the record and requires the column to be nullable.
ALTER TABLE public.report_delivery_log ALTER COLUMN subscription_id DROP NOT NULL$Q344$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q345$ALTER TABLE public.report_delivery_log DROP CONSTRAINT IF EXISTS report_delivery_log_subscription_id_fkey$Q345$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q345$ALTER TABLE public.report_delivery_log DROP CONSTRAINT IF EXISTS report_delivery_log_subscription_id_fkey$Q345$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q346$ALTER TABLE public.report_delivery_log ADD CONSTRAINT report_delivery_log_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES public.report_subscriptions(id)
  ON DELETE SET NULL$Q346$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811055900_report_promo_00_subscription_columns.sql', left($Q346$ALTER TABLE public.report_delivery_log ADD CONSTRAINT report_delivery_log_subscription_id_fkey
  FOREIGN KEY (subscription_id) REFERENCES public.report_subscriptions(id)
  ON DELETE SET NULL$Q346$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q347$-- Report promotion 02/06 — per-subscription hierarchy switch.
--
-- Consolidated from the staging migration `report_subscriptions_respect_hierarchy`
-- (20260805121323).
--
-- When true (the default), generate-report builds each recipient's file from
-- that recipient's own slice of the employees.manager_id tree: themselves plus
-- everyone beneath them, never anyone above or beside them. System admins
-- bypass it and continue to receive the org-wide file.
--
-- Existing rows are backfilled to true by the column default, so hierarchy
-- scoping becomes active for every current subscription on deploy. Turn it off
-- per subscription for a deliberately organisation-wide report.

ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS respect_hierarchy boolean NOT NULL DEFAULT true$Q347$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260811060100_report_promo_02_subscription_respect_hierarchy.sql', left($Q347$-- Report promotion 02/06 — per-subscription hierarchy switch.
--
-- Consolidated from the staging migration `report_subscriptions_respect_hierarchy`
-- (20260805121323).
--
-- When true (the default), generate-report builds each recipient's file from
-- that recipient's own slice of the employees.manager_id tree: themselves plus
-- everyone beneath them, never anyone above or beside them. System admins
-- bypass it and continue to receive the org-wide file.
--
-- Existing rows are backfilled to true by the column default, so hierarchy
-- scoping becomes active for every current subscription on deploy. Turn it off
-- per subscription for a deliberately organisation-wide report.

ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS respect_hierarchy boolean NOT NULL DEFAULT true$Q347$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q348$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_enabled       boolean NOT NULL DEFAULT false$Q348$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q348$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_enabled       boolean NOT NULL DEFAULT false$Q348$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q349$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_dataset_key   text     REFERENCES public.reportable_datasets(key) ON UPDATE CASCADE ON DELETE SET NULL$Q349$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q349$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_dataset_key   text     REFERENCES public.reportable_datasets(key) ON UPDATE CASCADE ON DELETE SET NULL$Q349$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q350$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_prompt        text$Q350$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q350$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_prompt        text$Q350$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q351$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_lookback_days integer NOT NULL DEFAULT 7$Q351$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q351$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_lookback_days integer NOT NULL DEFAULT 7$Q351$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q352$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_scope         text    NOT NULL DEFAULT 'actor'$Q352$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q352$-- AI summary add-on for the Notification Center.
-- Additive only: new columns default OFF, so every existing rule behaves exactly as before.
--
-- Applied to staging via MCP on 2026-08-12 and recorded in
-- supabase_migrations.schema_migrations as 20260812171210. This file exists so the
-- repository and the database timeline agree — without it a rebuild from source
-- would not know the feature exists. Idempotent: safe to re-run.

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS ai_scope         text    NOT NULL DEFAULT 'actor'$Q352$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q353$DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_rules_ai_lookback_chk') THEN
    ALTER TABLE public.notification_rules
      ADD CONSTRAINT notification_rules_ai_lookback_chk CHECK (ai_lookback_days BETWEEN 1 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_rules_ai_scope_chk') THEN
    ALTER TABLE public.notification_rules
      ADD CONSTRAINT notification_rules_ai_scope_chk CHECK (ai_scope IN ('actor','hierarchy','all'));
  END IF;
  -- A rule may only claim to be AI-enabled if it actually has a dataset and a prompt.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_rules_ai_complete_chk') THEN
    ALTER TABLE public.notification_rules
      ADD CONSTRAINT notification_rules_ai_complete_chk
      CHECK (ai_enabled = false OR (ai_dataset_key IS NOT NULL AND btrim(coalesce(ai_prompt,'')) <> ''));
  END IF;
END $$$Q353$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q353$DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_rules_ai_lookback_chk') THEN
    ALTER TABLE public.notification_rules
      ADD CONSTRAINT notification_rules_ai_lookback_chk CHECK (ai_lookback_days BETWEEN 1 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_rules_ai_scope_chk') THEN
    ALTER TABLE public.notification_rules
      ADD CONSTRAINT notification_rules_ai_scope_chk CHECK (ai_scope IN ('actor','hierarchy','all'));
  END IF;
  -- A rule may only claim to be AI-enabled if it actually has a dataset and a prompt.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_rules_ai_complete_chk') THEN
    ALTER TABLE public.notification_rules
      ADD CONSTRAINT notification_rules_ai_complete_chk
      CHECK (ai_enabled = false OR (ai_dataset_key IS NOT NULL AND btrim(coalesce(ai_prompt,'')) <> ''));
  END IF;
END $$$Q353$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q354$COMMENT ON COLUMN public.notification_rules.ai_enabled IS
  'When true, an AI summary paragraph is appended to the notification message asynchronously. The deterministic template text is never replaced.'$Q354$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q354$COMMENT ON COLUMN public.notification_rules.ai_enabled IS
  'When true, an AI summary paragraph is appended to the notification message asynchronously. The deterministic template text is never replaced.'$Q354$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q355$COMMENT ON COLUMN public.notification_rules.ai_scope IS
  'actor = only the acting user''s rows; hierarchy = the recipient''s reporting tree; all = org-wide (admins only).'$Q355$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q355$COMMENT ON COLUMN public.notification_rules.ai_scope IS
  'actor = only the acting user''s rows; hierarchy = the recipient''s reporting tree; all = org-wide (admins only).'$Q355$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q356$ALTER TABLE public.notification_ai_log ENABLE ROW LEVEL SECURITY$Q356$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171210_notification_ai_summary_schema.sql', left($Q356$ALTER TABLE public.notification_ai_log ENABLE ROW LEVEL SECURITY$Q356$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q357$-- emit_notification_event: unchanged behaviour, except that when a matched rule has
-- ai_enabled it stamps ai_pending/ai_rule_id/ai_actor_id into that notification's metadata.
-- Every existing receiver branch, the leaderboard path, the outer guard and the void
-- return type are preserved verbatim.
--
-- Applied to staging via MCP on 2026-08-12, recorded as 20260812171257. Idempotent.
--
-- NOTE FOR ANY FUTURE PROD PORT: production's copy of this function differs
-- deliberately (it returns uuid, and its CASE has 'self' / 'reporting_chain'
-- aliases that live prod rules depend on). Do not copy this file to production
-- as-is; port only the v_meta_out addition.

CREATE OR REPLACE FUNCTION public.emit_notification_event(
  p_event_code text, p_source_table text, p_record_id text,
  p_actor_user_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD; v_receiver_id uuid; v_title text; v_message text;
  v_actor_name text; v_module_name text; v_record_uuid uuid;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_period_type text; v_top3 jsonb; v_notif_type text; v_is_leaderboard boolean;
  v_tz text;
  v_meta_out jsonb;
BEGIN
  -- ===== outer guard: never propagate to the calling business write =====
  BEGIN
    BEGIN v_record_uuid := p_record_id::uuid; EXCEPTION WHEN others THEN v_record_uuid := NULL; END;
    v_is_leaderboard := p_event_code IN ('WEEKLY_LEADERBOARD','MONTHLY_LEADERBOARD');
    IF v_is_leaderboard THEN
      v_period_type := CASE WHEN p_event_code='WEEKLY_LEADERBOARD' THEN 'weekly' ELSE 'monthly' END;
      SELECT jsonb_agg(jsonb_build_object('rank',s.rank,'user_id',s.user_id,'full_name',s.full_name,'profile_picture_url',s.profile_picture_url,'total_points',s.total_points,'period_label',s.period_label) ORDER BY s.rank)
      INTO v_top3 FROM (SELECT * FROM leaderboard_snapshots WHERE period_type=v_period_type AND captured_at >= now()-interval '10 minutes' ORDER BY captured_at DESC, rank ASC LIMIT 3) s;
      v_metadata := v_metadata || jsonb_build_object('top3', COALESCE(v_top3,'[]'::jsonb));
    END IF;
    INSERT INTO notification_event_log (event_code, source_table, record_id, actor_user_id, metadata)
    VALUES (p_event_code, p_source_table, p_record_id, p_actor_user_id, v_metadata);
    SELECT COALESCE(full_name, username, 'System') INTO v_actor_name FROM profiles WHERE id = p_actor_user_id;
    v_module_name := INITCAP(REPLACE(p_source_table,'_',' '));
    v_notif_type := CASE WHEN v_is_leaderboard THEN 'leaderboard_banner' ELSE p_event_code END;

    IF v_is_leaderboard THEN
      SELECT * INTO v_rule FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LIMIT 1;
      v_title := COALESCE(v_rule.title_template,'🏆 Top performers');
      v_message := COALESCE(v_rule.message_template,'The leaderboard results are in.');
      v_title := REPLACE(v_title,'{record_name}', COALESCE(v_metadata->>'period_label',''));
      v_message := REPLACE(v_message,'{record_name}', COALESCE(v_metadata->>'period_label',''));
      INSERT INTO notifications (user_id, title, message, type, related_table, related_id, metadata)
      SELECT DISTINCT up.user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata
      FROM user_profiles up WHERE up.user_id IS NOT NULL;
      RETURN;
    END IF;

    FOR v_rule IN SELECT * FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LOOP
      v_tz := COALESCE(v_rule.timezone,'Asia/Kolkata');
      v_title := public.notif_fill(v_rule.title_template, v_actor_name, v_module_name, v_metadata, v_tz);
      v_message := public.notif_fill(v_rule.message_template, v_actor_name, v_module_name, v_metadata, v_tz);

      -- AI add-on: flag this notification for asynchronous enrichment. The message
      -- inserted below is already final and correct on its own; the AI paragraph is
      -- appended later by the notification-ai-summary edge function, or never, if
      -- that call fails.
      IF COALESCE(v_rule.ai_enabled,false) AND v_rule.ai_dataset_key IS NOT NULL THEN
        v_meta_out := v_metadata || jsonb_build_object(
          'ai_pending', true,
          'ai_rule_id', v_rule.id,
          'ai_actor_id', p_actor_user_id
        );
      ELSE
        v_meta_out := v_metadata;
      END IF;

      CASE v_rule.receiver_type
        WHEN 'employee' THEN
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (p_actor_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
        WHEN 'manager' THEN
          SELECT manager_id INTO v_receiver_id FROM employees WHERE user_id=p_actor_user_id;
          IF v_receiver_id IS NOT NULL THEN
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
          END IF;
        WHEN 'hierarchy' THEN
          FOR v_receiver_id IN SELECT public.notif_managers_up_chain(p_actor_user_id) LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
          END LOOP;
        WHEN 'admin' THEN
          FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name='System Administrator' LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
          END LOOP;
        WHEN 'specific_user' THEN
          IF v_rule.receiver_user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_rule.receiver_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
          END IF;
        WHEN 'role' THEN
          IF v_rule.receiver_role IS NOT NULL THEN
            FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name=v_rule.receiver_role LOOP
              INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
              VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
            END LOOP;
          END IF;
        ELSE NULL;
      END CASE;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'emit_notification_event(%,%) suppressed: % [%] — business write preserved',
      p_event_code, p_source_table, SQLERRM, SQLSTATE;
  END;
END $function$$Q357$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812171257_notification_ai_emit_stamp_metadata.sql', left($Q357$-- emit_notification_event: unchanged behaviour, except that when a matched rule has
-- ai_enabled it stamps ai_pending/ai_rule_id/ai_actor_id into that notification's metadata.
-- Every existing receiver branch, the leaderboard path, the outer guard and the void
-- return type are preserved verbatim.
--
-- Applied to staging via MCP on 2026-08-12, recorded as 20260812171257. Idempotent.
--
-- NOTE FOR ANY FUTURE PROD PORT: production's copy of this function differs
-- deliberately (it returns uuid, and its CASE has 'self' / 'reporting_chain'
-- aliases that live prod rules depend on). Do not copy this file to production
-- as-is; port only the v_meta_out addition.

CREATE OR REPLACE FUNCTION public.emit_notification_event(
  p_event_code text, p_source_table text, p_record_id text,
  p_actor_user_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD; v_receiver_id uuid; v_title text; v_message text;
  v_actor_name text; v_module_name text; v_record_uuid uuid;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_period_type text; v_top3 jsonb; v_notif_type text; v_is_leaderboard boolean;
  v_tz text;
  v_meta_out jsonb;
BEGIN
  -- ===== outer guard: never propagate to the calling business write =====
  BEGIN
    BEGIN v_record_uuid := p_record_id::uuid; EXCEPTION WHEN others THEN v_record_uuid := NULL; END;
    v_is_leaderboard := p_event_code IN ('WEEKLY_LEADERBOARD','MONTHLY_LEADERBOARD');
    IF v_is_leaderboard THEN
      v_period_type := CASE WHEN p_event_code='WEEKLY_LEADERBOARD' THEN 'weekly' ELSE 'monthly' END;
      SELECT jsonb_agg(jsonb_build_object('rank',s.rank,'user_id',s.user_id,'full_name',s.full_name,'profile_picture_url',s.profile_picture_url,'total_points',s.total_points,'period_label',s.period_label) ORDER BY s.rank)
      INTO v_top3 FROM (SELECT * FROM leaderboard_snapshots WHERE period_type=v_period_type AND captured_at >= now()-interval '10 minutes' ORDER BY captured_at DESC, rank ASC LIMIT 3) s;
      v_metadata := v_metadata || jsonb_build_object('top3', COALESCE(v_top3,'[]'::jsonb));
    END IF;
    INSERT INTO notification_event_log (event_code, source_table, record_id, actor_user_id, metadata)
    VALUES (p_event_code, p_source_table, p_record_id, p_actor_user_id, v_metadata);
    SELECT COALESCE(full_name, username, 'System') INTO v_actor_name FROM profiles WHERE id = p_actor_user_id;
    v_module_name := INITCAP(REPLACE(p_source_table,'_',' '));
    v_notif_type := CASE WHEN v_is_leaderboard THEN 'leaderboard_banner' ELSE p_event_code END;

    IF v_is_leaderboard THEN
      SELECT * INTO v_rule FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LIMIT 1;
      v_title := COALESCE(v_rule.title_template,'🏆 Top performers');
      v_message := COALESCE(v_rule.message_template,'The leaderboard results are in.');
      v_title := REPLACE(v_title,'{record_name}', COALESCE(v_metadata->>'period_label',''));
      v_message := REPLACE(v_message,'{record_name}', COALESCE(v_metadata->>'period_label',''));
      INSERT INTO notifications (user_id, title, message, type, related_table, related_id, metadata)
      SELECT DISTINCT up.user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_metadata
      FROM user_profiles up WHERE up.user_id IS NOT NULL;
      RETURN;
    END IF;

    FOR v_rule IN SELECT * FROM notification_rules WHERE event_code=p_event_code AND source_table=p_source_table AND is_active=true LOOP
      v_tz := COALESCE(v_rule.timezone,'Asia/Kolkata');
      v_title := public.notif_fill(v_rule.title_template, v_actor_name, v_module_name, v_metadata, v_tz);
      v_message := public.notif_fill(v_rule.message_template, v_actor_name, v_module_name, v_metadata, v_tz);

      -- AI add-on: flag this notification for asynchronous enrichment. The message
      -- inserted below is already final and correct on its own; the AI paragraph is
      -- appended later by the notification-ai-summary edge function, or never, if
      -- that call fails.
      IF COALESCE(v_rule.ai_enabled,false) AND v_rule.ai_dataset_key IS NOT NULL THEN
        v_meta_out := v_metadata || jsonb_build_object(
          'ai_pending', true,
          'ai_rule_id', v_rule.id,
          'ai_actor_id', p_actor_user_id
        );
      ELSE
        v_meta_out := v_metadata;
      END IF;

      CASE v_rule.receiver_type
        WHEN 'employee' THEN
          INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
          VALUES (p_actor_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
        WHEN 'manager' THEN
          SELECT manager_id INTO v_receiver_id FROM employees WHERE user_id=p_actor_user_id;
          IF v_receiver_id IS NOT NULL THEN
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
          END IF;
        WHEN 'hierarchy' THEN
          FOR v_receiver_id IN SELECT public.notif_managers_up_chain(p_actor_user_id) LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
          END LOOP;
        WHEN 'admin' THEN
          FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name='System Administrator' LOOP
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
          END LOOP;
        WHEN 'specific_user' THEN
          IF v_rule.receiver_user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
            VALUES (v_rule.receiver_user_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
          END IF;
        WHEN 'role' THEN
          IF v_rule.receiver_role IS NOT NULL THEN
            FOR v_receiver_id IN SELECT up.user_id FROM user_profiles up JOIN security_profiles sp ON sp.id=up.profile_id WHERE sp.name=v_rule.receiver_role LOOP
              INSERT INTO notifications (user_id,title,message,type,related_table,related_id,metadata)
              VALUES (v_receiver_id, v_title, v_message, v_notif_type, p_source_table, v_record_uuid, v_meta_out);
            END LOOP;
          END IF;
        ELSE NULL;
      END CASE;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'emit_notification_event(%,%) suppressed: % [%] — business write preserved',
      p_event_code, p_source_table, SQLERRM, SQLSTATE;
  END;
END $function$$Q357$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q358$-- AI summary for report subscriptions. The report already fetches exactly the right
-- rows for exactly the right period and recipient scope, so the AI works on that same
-- data -- no second query, no separate configuration of "which data".
--
-- Applied to staging via MCP on 2026-08-12, recorded as 20260812172509. This file
-- keeps the repository in step with the database timeline. Idempotent.

ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false$Q358$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812172509_report_subscriptions_ai_summary.sql', left($Q358$-- AI summary for report subscriptions. The report already fetches exactly the right
-- rows for exactly the right period and recipient scope, so the AI works on that same
-- data -- no second query, no separate configuration of "which data".
--
-- Applied to staging via MCP on 2026-08-12, recorded as 20260812172509. This file
-- keeps the repository in step with the database timeline. Idempotent.

ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false$Q358$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q359$-- AI summary for report subscriptions. The report already fetches exactly the right
-- rows for exactly the right period and recipient scope, so the AI works on that same
-- data -- no second query, no separate configuration of "which data".
--
-- Applied to staging via MCP on 2026-08-12, recorded as 20260812172509. This file
-- keeps the repository in step with the database timeline. Idempotent.

ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS ai_prompt  text$Q359$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260812172509_report_subscriptions_ai_summary.sql', left($Q359$-- AI summary for report subscriptions. The report already fetches exactly the right
-- rows for exactly the right period and recipient scope, so the AI works on that same
-- data -- no second query, no separate configuration of "which data".
--
-- Applied to staging via MCP on 2026-08-12, recorded as 20260812172509. This file
-- keeps the repository in step with the database timeline. Idempotent.

ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS ai_prompt  text$Q359$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q360$-- Let the report author decide what a System Administrator receives when
-- "Respect reporting hierarchy" is on.
--
-- Until now admins were unconditionally exempt: they always got the
-- organisation-wide file. That is right for an oversight report and wrong for a
-- "how is MY team doing" report, where an admin who also runs a team wants their
-- own subtree like everybody else.
--
--   global        -> admin receives the organisation-wide report (previous behaviour)
--   own_hierarchy -> admin is scoped to their own reporting tree, same as anyone else
--
-- Defaults to 'global' so every existing subscription behaves exactly as before.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS admin_scope text NOT NULL DEFAULT 'global'$Q360$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260813045110_report_subscriptions_admin_scope.sql', left($Q360$-- Let the report author decide what a System Administrator receives when
-- "Respect reporting hierarchy" is on.
--
-- Until now admins were unconditionally exempt: they always got the
-- organisation-wide file. That is right for an oversight report and wrong for a
-- "how is MY team doing" report, where an admin who also runs a team wants their
-- own subtree like everybody else.
--
--   global        -> admin receives the organisation-wide report (previous behaviour)
--   own_hierarchy -> admin is scoped to their own reporting tree, same as anyone else
--
-- Defaults to 'global' so every existing subscription behaves exactly as before.
ALTER TABLE public.report_subscriptions ADD COLUMN IF NOT EXISTS admin_scope text NOT NULL DEFAULT 'global'$Q360$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q361$ALTER TABLE public.report_delivery_claims ENABLE ROW LEVEL SECURITY$Q361$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260813052000_report_delivery_claim_dedupe.sql', left($Q361$ALTER TABLE public.report_delivery_claims ENABLE ROW LEVEL SECURITY$Q361$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q362$-- Record WHO creates, changes and deactivates a scheme.
--
-- On 12 Aug 2026 a global 50% scheme ("ADDUKU FREE approved in meeting") went
-- live in production for ~4 hours and halved two real orders. It was impossible
-- to answer "who added this": product_schemes has no created_by, and
-- ai_scheme_suggestions.reviewed_by was left NULL on approval. The only evidence
-- was session activity, which narrows a suspect but does not name one.

ALTER TABLE public.product_schemes ADD COLUMN IF NOT EXISTS created_by uuid$Q362$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260813054601_product_schemes_authorship_and_audit.sql', left($Q362$-- Record WHO creates, changes and deactivates a scheme.
--
-- On 12 Aug 2026 a global 50% scheme ("ADDUKU FREE approved in meeting") went
-- live in production for ~4 hours and halved two real orders. It was impossible
-- to answer "who added this": product_schemes has no created_by, and
-- ai_scheme_suggestions.reviewed_by was left NULL on approval. The only evidence
-- was session activity, which narrows a suspect but does not name one.

ALTER TABLE public.product_schemes ADD COLUMN IF NOT EXISTS created_by uuid$Q362$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q363$-- Record WHO creates, changes and deactivates a scheme.
--
-- On 12 Aug 2026 a global 50% scheme ("ADDUKU FREE approved in meeting") went
-- live in production for ~4 hours and halved two real orders. It was impossible
-- to answer "who added this": product_schemes has no created_by, and
-- ai_scheme_suggestions.reviewed_by was left NULL on approval. The only evidence
-- was session activity, which narrows a suspect but does not name one.

ALTER TABLE public.product_schemes ADD COLUMN IF NOT EXISTS updated_by uuid$Q363$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260813054601_product_schemes_authorship_and_audit.sql', left($Q363$-- Record WHO creates, changes and deactivates a scheme.
--
-- On 12 Aug 2026 a global 50% scheme ("ADDUKU FREE approved in meeting") went
-- live in production for ~4 hours and halved two real orders. It was impossible
-- to answer "who added this": product_schemes has no created_by, and
-- ai_scheme_suggestions.reviewed_by was left NULL on approval. The only evidence
-- was session activity, which narrows a suspect but does not name one.

ALTER TABLE public.product_schemes ADD COLUMN IF NOT EXISTS updated_by uuid$Q363$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q364$COMMENT ON COLUMN public.product_schemes.created_by IS
  'Stamped automatically from auth.uid() on insert. NULL for rows predating 2026-08-13 or written by a service-role job, where auth.uid() is null.'$Q364$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260813054601_product_schemes_authorship_and_audit.sql', left($Q364$COMMENT ON COLUMN public.product_schemes.created_by IS
  'Stamped automatically from auth.uid() on insert. NULL for rows predating 2026-08-13 or written by a service-role job, where auth.uid() is null.'$Q364$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q365$ALTER TABLE public.product_scheme_audit ENABLE ROW LEVEL SECURITY$Q365$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260813054601_product_schemes_authorship_and_audit.sql', left($Q365$ALTER TABLE public.product_scheme_audit ENABLE ROW LEVEL SECURITY$Q365$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q366$-- Persist the UOM chosen when recording event stock, so saved rows display
-- the unit the quantities were entered in (PIECE vs BOX etc.).
ALTER TABLE public.event_stock_items ADD COLUMN IF NOT EXISTS unit text$Q366$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260813113000_event_stock_items_add_unit.sql', left($Q366$-- Persist the UOM chosen when recording event stock, so saved rows display
-- the unit the quantities were entered in (PIECE vs BOX etc.).
ALTER TABLE public.event_stock_items ADD COLUMN IF NOT EXISTS unit text$Q366$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q367$-- Event stock auto-sync hardening.
--
-- Submitted event orders update event_stock_items.sold_qty through an
-- AFTER INSERT trigger on order_items (the client-side RPC
-- apply_event_stock_for_order stays as a fallback and skips when the
-- trigger already recorded the order in event_stock_audit). This
-- migration captures that trigger in the repo and fixes two gaps:
--
-- 1. Auto-created stock rows now carry the order line's unit, so the
--    tracker shows which unit the sold quantity is counted in.
-- 2. Order quantities are converted into the stock row's unit via the
--    UOM master before being added (an order for 2 BOX no longer adds
--    "2" to a row tracked in PIECE). Unmapped/legacy units fall back
--    to 1:1.

ALTER TABLE public.event_stock_audit ADD COLUMN IF NOT EXISTS order_item_id uuid$Q367$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260814120000_event_stock_auto_sold_sync.sql', left($Q367$-- Event stock auto-sync hardening.
--
-- Submitted event orders update event_stock_items.sold_qty through an
-- AFTER INSERT trigger on order_items (the client-side RPC
-- apply_event_stock_for_order stays as a fallback and skips when the
-- trigger already recorded the order in event_stock_audit). This
-- migration captures that trigger in the repo and fixes two gaps:
--
-- 1. Auto-created stock rows now carry the order line's unit, so the
--    tracker shows which unit the sold quantity is counted in.
-- 2. Order quantities are converted into the stock row's unit via the
--    UOM master before being added (an order for 2 BOX no longer adds
--    "2" to a row tracked in PIECE). Unmapped/legacy units fall back
--    to 1:1.

ALTER TABLE public.event_stock_audit ADD COLUMN IF NOT EXISTS order_item_id uuid$Q367$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q368$-- Live team view for Event Stock Tracking.
--
-- EventStockTracker subscribes to postgres_changes on event_stock_items,
-- but the table was never added to the supabase_realtime publication, so
-- the subscription received nothing. The rep making a change saw their
-- own screen update (local state); every other team member's tracker
-- stayed frozen until a manual reload. RLS already scopes rows to the
-- event team, so publishing the tables only delivers rows members can
-- read anyway.

ALTER TABLE public.event_stock_items REPLICA IDENTITY FULL$Q368$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260814140000_event_stock_realtime.sql', left($Q368$-- Live team view for Event Stock Tracking.
--
-- EventStockTracker subscribes to postgres_changes on event_stock_items,
-- but the table was never added to the supabase_realtime publication, so
-- the subscription received nothing. The rep making a change saw their
-- own screen update (local state); every other team member's tracker
-- stayed frozen until a manual reload. RLS already scopes rows to the
-- event team, so publishing the tables only delivers rows members can
-- read anyway.

ALTER TABLE public.event_stock_items REPLICA IDENTITY FULL$Q368$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q369$ALTER TABLE public.event_stock_days REPLICA IDENTITY FULL$Q369$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260814140000_event_stock_realtime.sql', left($Q369$ALTER TABLE public.event_stock_days REPLICA IDENTITY FULL$Q369$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q370$ALTER TABLE public.ai_workflows ENABLE ROW LEVEL SECURITY$Q370$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260818090000_ai_custom_workflows.sql', left($Q370$ALTER TABLE public.ai_workflows ENABLE ROW LEVEL SECURITY$Q370$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q371$-- Executions can now belong to either a seed agent or a custom workflow.
-- Deliberately NOT "ON DELETE CASCADE": execution history is audit data —
-- workflows are deactivated (is_active = false), never deleted.
ALTER TABLE public.workflow_executions ALTER COLUMN agent_id DROP NOT NULL$Q371$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260818090000_ai_custom_workflows.sql', left($Q371$-- Executions can now belong to either a seed agent or a custom workflow.
-- Deliberately NOT "ON DELETE CASCADE": execution history is audit data —
-- workflows are deactivated (is_active = false), never deleted.
ALTER TABLE public.workflow_executions ALTER COLUMN agent_id DROP NOT NULL$Q371$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q372$ALTER TABLE public.workflow_executions ADD COLUMN workflow_id uuid REFERENCES public.ai_workflows(id)$Q372$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260818090000_ai_custom_workflows.sql', left($Q372$ALTER TABLE public.workflow_executions ADD COLUMN workflow_id uuid REFERENCES public.ai_workflows(id)$Q372$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q373$ALTER TABLE public.workflow_executions ADD CONSTRAINT chk_workflow_executions_one_target
    CHECK (num_nonnulls(agent_id, workflow_id) = 1)$Q373$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260818090000_ai_custom_workflows.sql', left($Q373$ALTER TABLE public.workflow_executions ADD CONSTRAINT chk_workflow_executions_one_target
    CHECK (num_nonnulls(agent_id, workflow_id) = 1)$Q373$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q374$CREATE INDEX idx_workflow_executions_workflow_started
  ON public.workflow_executions (workflow_id, started_at DESC)$Q374$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260818090000_ai_custom_workflows.sql', left($Q374$CREATE INDEX idx_workflow_executions_workflow_started
  ON public.workflow_executions (workflow_id, started_at DESC)$Q374$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q375$-- Visits is a selectable target metric alongside Quantity and Revenue, and the
-- annual plan already carries a visits figure, but the monthly rows had nowhere
-- to put one — so a plan tracking visits could not be broken down by month.
--
-- Additive and defaulted, so every existing row reads as zero visits.

ALTER TABLE public.user_business_plan_months ADD COLUMN IF NOT EXISTS visits_target numeric NOT NULL DEFAULT 0$Q375$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260819160000_add_visits_target_to_plan_months.sql', left($Q375$-- Visits is a selectable target metric alongside Quantity and Revenue, and the
-- annual plan already carries a visits figure, but the monthly rows had nowhere
-- to put one — so a plan tracking visits could not be broken down by month.
--
-- Additive and defaulted, so every existing row reads as zero visits.

ALTER TABLE public.user_business_plan_months ADD COLUMN IF NOT EXISTS visits_target numeric NOT NULL DEFAULT 0$Q375$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q376$-- The annual plan tracks a quantity and a revenue target but never a visits
-- one, even though Productive Visits is a selectable target metric. Without it
-- there is no annual figure for the monthly visits rows to be a share of.

ALTER TABLE public.user_business_plans ADD COLUMN IF NOT EXISTS visits_target numeric NOT NULL DEFAULT 0$Q376$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260819160000_add_visits_target_to_plan_months.sql', left($Q376$-- The annual plan tracks a quantity and a revenue target but never a visits
-- one, even though Productive Visits is a selectable target metric. Without it
-- there is no annual figure for the monthly visits rows to be a share of.

ALTER TABLE public.user_business_plans ADD COLUMN IF NOT EXISTS visits_target numeric NOT NULL DEFAULT 0$Q376$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q377$-- Lets the annual figure for Quantity, Revenue, and Visits be "decide later"
-- instead of required upfront. 'direct' = typed at plan level (today's only
-- behaviour); 'derived' = follows whatever is assigned to people so far;
-- 'unset' = nothing chosen yet, same display as 'derived' with nothing to sum.
alter table public.fy_target_config add column quantity_basis text not null default 'direct'
    check (quantity_basis in ('direct', 'derived', 'unset'))$Q377$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260824153000_add_target_basis_columns.sql', left($Q377$-- Lets the annual figure for Quantity, Revenue, and Visits be "decide later"
-- instead of required upfront. 'direct' = typed at plan level (today's only
-- behaviour); 'derived' = follows whatever is assigned to people so far;
-- 'unset' = nothing chosen yet, same display as 'derived' with nothing to sum.
alter table public.fy_target_config add column quantity_basis text not null default 'direct'
    check (quantity_basis in ('direct', 'derived', 'unset'))$Q377$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q378$-- Lets the annual figure for Quantity, Revenue, and Visits be "decide later"
-- instead of required upfront. 'direct' = typed at plan level (today's only
-- behaviour); 'derived' = follows whatever is assigned to people so far;
-- 'unset' = nothing chosen yet, same display as 'derived' with nothing to sum.
alter table public.fy_target_config add column revenue_basis text not null default 'direct'
    check (revenue_basis in ('direct', 'derived', 'unset'))$Q378$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260824153000_add_target_basis_columns.sql', left($Q378$-- Lets the annual figure for Quantity, Revenue, and Visits be "decide later"
-- instead of required upfront. 'direct' = typed at plan level (today's only
-- behaviour); 'derived' = follows whatever is assigned to people so far;
-- 'unset' = nothing chosen yet, same display as 'derived' with nothing to sum.
alter table public.fy_target_config add column revenue_basis text not null default 'direct'
    check (revenue_basis in ('direct', 'derived', 'unset'))$Q378$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q379$-- Lets the annual figure for Quantity, Revenue, and Visits be "decide later"
-- instead of required upfront. 'direct' = typed at plan level (today's only
-- behaviour); 'derived' = follows whatever is assigned to people so far;
-- 'unset' = nothing chosen yet, same display as 'derived' with nothing to sum.
alter table public.fy_target_config add column visits_basis text not null default 'direct'
    check (visits_basis in ('direct', 'derived', 'unset'))$Q379$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260824153000_add_target_basis_columns.sql', left($Q379$-- Lets the annual figure for Quantity, Revenue, and Visits be "decide later"
-- instead of required upfront. 'direct' = typed at plan level (today's only
-- behaviour); 'derived' = follows whatever is assigned to people so far;
-- 'unset' = nothing chosen yet, same display as 'derived' with nothing to sum.
alter table public.fy_target_config add column visits_basis text not null default 'direct'
    check (visits_basis in ('direct', 'derived', 'unset'))$Q379$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q380$-- Restore foreign keys to uom_master that were silently skipped when the
-- columns were added via "ADD COLUMN IF NOT EXISTS ... REFERENCES" on
-- databases where the column already existed (the REFERENCES clause of a
-- skipped ADD COLUMN never runs). PostgREST needs these FKs to resolve the
-- customer-portal catalog embeds:
--   products:      uom_master!products_default_sales_uom_id_fkey
--   enabled_units: uom_master!enabled_units_uom_id_fkey
-- Without them the catalog products query fails and the portal shows
-- "No product found." for every retailer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_default_sales_uom_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_default_sales_uom_id_fkey
      FOREIGN KEY (default_sales_uom_id) REFERENCES public.uom_master(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enabled_units_uom_id_fkey'
      AND conrelid = 'public.enabled_units'::regclass
  ) THEN
    ALTER TABLE public.enabled_units
      ADD CONSTRAINT enabled_units_uom_id_fkey
      FOREIGN KEY (uom_id) REFERENCES public.uom_master(id);
  END IF;
END $$$Q380$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260826090000_restore_uom_foreign_keys.sql', left($Q380$-- Restore foreign keys to uom_master that were silently skipped when the
-- columns were added via "ADD COLUMN IF NOT EXISTS ... REFERENCES" on
-- databases where the column already existed (the REFERENCES clause of a
-- skipped ADD COLUMN never runs). PostgREST needs these FKs to resolve the
-- customer-portal catalog embeds:
--   products:      uom_master!products_default_sales_uom_id_fkey
--   enabled_units: uom_master!enabled_units_uom_id_fkey
-- Without them the catalog products query fails and the portal shows
-- "No product found." for every retailer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_default_sales_uom_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_default_sales_uom_id_fkey
      FOREIGN KEY (default_sales_uom_id) REFERENCES public.uom_master(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'enabled_units_uom_id_fkey'
      AND conrelid = 'public.enabled_units'::regclass
  ) THEN
    ALTER TABLE public.enabled_units
      ADD CONSTRAINT enabled_units_uom_id_fkey
      FOREIGN KEY (uom_id) REFERENCES public.uom_master(id);
  END IF;
END $$$Q380$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q381$-- ---------------------------------------------------------------------------
-- 3. Bridge: user_business_plans/_months  →  user_period_targets.
--    FY is April–March and user_business_plans.year is the FY *end* year
--    (see getFYYear in src/hooks/useUserTargetProgress.ts), so
--    month_number 1 = April of (year - 1) … month_number 10 = January of year.
--    Rows for these two KPIs are owned exclusively by this bridge: stale months
--    (plan deactivated, target zeroed) are deleted so revoked targets can't award.
-- ---------------------------------------------------------------------------
-- Month-level target set derived from the FY business plans. Kept as its own
-- STABLE function (rather than a temp table) because this project's
-- guard_destructive_ddl event trigger blocks DROP TABLE, temp tables included.
CREATE OR REPLACE FUNCTION public.bp_month_targets()
RETURNS TABLE(user_id uuid, period_start date, period_end date, quantity_target numeric, revenue_target numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT ON (p.user_id, ps.period_start)
         p.user_id,
         ps.period_start,
         (ps.period_start + interval '1 month' - interval '1 day')::date AS period_end,
         COALESCE(m.quantity_target, 0) AS quantity_target,
         COALESCE(m.revenue_target, 0)  AS revenue_target
  FROM public.user_business_plans p
  JOIN public.user_business_plan_months m ON m.business_plan_id = p.id
  CROSS JOIN LATERAL (
    SELECT make_date(
             CASE WHEN m.month_number <= 9 THEN p.year - 1 ELSE p.year END,
             CASE WHEN m.month_number <= 9 THEN m.month_number + 3 ELSE m.month_number - 9 END,
             1) AS period_start
  ) ps
  WHERE COALESCE(p.has_no_target, false) = false
    AND COALESCE(m.is_active, true)
    AND m.month_number BETWEEN 1 AND 12
  ORDER BY p.user_id, ps.period_start, p.updated_at DESC, m.updated_at DESC;
$$$Q381$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260901070000_fix_quantity_target_gamification.sql', left($Q381$-- ---------------------------------------------------------------------------
-- 3. Bridge: user_business_plans/_months  →  user_period_targets.
--    FY is April–March and user_business_plans.year is the FY *end* year
--    (see getFYYear in src/hooks/useUserTargetProgress.ts), so
--    month_number 1 = April of (year - 1) … month_number 10 = January of year.
--    Rows for these two KPIs are owned exclusively by this bridge: stale months
--    (plan deactivated, target zeroed) are deleted so revoked targets can't award.
-- ---------------------------------------------------------------------------
-- Month-level target set derived from the FY business plans. Kept as its own
-- STABLE function (rather than a temp table) because this project's
-- guard_destructive_ddl event trigger blocks DROP TABLE, temp tables included.
CREATE OR REPLACE FUNCTION public.bp_month_targets()
RETURNS TABLE(user_id uuid, period_start date, period_end date, quantity_target numeric, revenue_target numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT ON (p.user_id, ps.period_start)
         p.user_id,
         ps.period_start,
         (ps.period_start + interval '1 month' - interval '1 day')::date AS period_end,
         COALESCE(m.quantity_target, 0) AS quantity_target,
         COALESCE(m.revenue_target, 0)  AS revenue_target
  FROM public.user_business_plans p
  JOIN public.user_business_plan_months m ON m.business_plan_id = p.id
  CROSS JOIN LATERAL (
    SELECT make_date(
             CASE WHEN m.month_number <= 9 THEN p.year - 1 ELSE p.year END,
             CASE WHEN m.month_number <= 9 THEN m.month_number + 3 ELSE m.month_number - 9 END,
             1) AS period_start
  ) ps
  WHERE COALESCE(p.has_no_target, false) = false
    AND COALESCE(m.is_active, true)
    AND m.month_number BETWEEN 1 AND 12
  ORDER BY p.user_id, ps.period_start, p.updated_at DESC, m.updated_at DESC;
$$$Q381$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q382$-- 'all_time' snapshots were never storable under the old CHECK either; allow them
-- so a manual all-time refresh doesn't blow up.
ALTER TABLE public.leaderboard_snapshots DROP CONSTRAINT IF EXISTS leaderboard_snapshots_period_type_check$Q382$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260901073000_fix_gam_leaderboard_snapshot_period_type.sql', left($Q382$-- 'all_time' snapshots were never storable under the old CHECK either; allow them
-- so a manual all-time refresh doesn't blow up.
ALTER TABLE public.leaderboard_snapshots DROP CONSTRAINT IF EXISTS leaderboard_snapshots_period_type_check$Q382$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q383$ALTER TABLE public.leaderboard_snapshots ADD CONSTRAINT leaderboard_snapshots_period_type_check
  CHECK (period_type = ANY (ARRAY['weekly'::text, 'monthly'::text, 'all_time'::text]))$Q383$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260901073000_fix_gam_leaderboard_snapshot_period_type.sql', left($Q383$ALTER TABLE public.leaderboard_snapshots ADD CONSTRAINT leaderboard_snapshots_period_type_check
  CHECK (period_type = ANY (ARRAY['weekly'::text, 'monthly'::text, 'all_time'::text]))$Q383$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q384$-- The Scheme Master "Free Product (Y)" picker offers base products AND product
-- variants from one combined list. Selecting a variant saved the variant's id
-- into product_schemes.free_product_id (FK -> products.id), so every such save
-- failed with product_schemes_free_product_id_fkey. Store the variant properly:
-- free_product_id keeps the parent product, free_variant_id pins the variant.
ALTER TABLE public.product_schemes ADD COLUMN IF NOT EXISTS free_variant_id uuid REFERENCES public.product_variants(id)$Q384$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260902060000_scheme_free_variant_id.sql', left($Q384$-- The Scheme Master "Free Product (Y)" picker offers base products AND product
-- variants from one combined list. Selecting a variant saved the variant's id
-- into product_schemes.free_product_id (FK -> products.id), so every such save
-- failed with product_schemes_free_product_id_fkey. Store the variant properly:
-- free_product_id keeps the parent product, free_variant_id pins the variant.
ALTER TABLE public.product_schemes ADD COLUMN IF NOT EXISTS free_variant_id uuid REFERENCES public.product_variants(id)$Q384$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q385$COMMENT ON COLUMN public.product_schemes.free_variant_id IS
  'When the free item (Y) is a product variant: the variant id. free_product_id then holds its parent product.'$Q385$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260902060000_scheme_free_variant_id.sql', left($Q385$COMMENT ON COLUMN public.product_schemes.free_variant_id IS
  'When the free item (Y) is a product variant: the variant id. free_product_id then holds its parent product.'$Q385$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q386$ALTER TABLE public.rb_report_folders ENABLE ROW LEVEL SECURITY$Q386$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260909052217_c8384e5e-69f1-48bf-8413-114d30cb63c3.sql', left($Q386$ALTER TABLE public.rb_report_folders ENABLE ROW LEVEL SECURITY$Q386$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q387$ALTER TABLE public.rb_saved_reports ENABLE ROW LEVEL SECURITY$Q387$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260909052217_c8384e5e-69f1-48bf-8413-114d30cb63c3.sql', left($Q387$ALTER TABLE public.rb_saved_reports ENABLE ROW LEVEL SECURITY$Q387$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q388$ALTER TABLE public.rb_report_pins ENABLE ROW LEVEL SECURITY$Q388$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260909052217_c8384e5e-69f1-48bf-8413-114d30cb63c3.sql', left($Q388$ALTER TABLE public.rb_report_pins ENABLE ROW LEVEL SECURITY$Q388$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q389$ALTER TABLE public.invoice_compression_logs ENABLE ROW LEVEL SECURITY$Q389$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260910123059_78a8d49b-4ff4-410b-8174-4f0b9f36fbdb.sql', left($Q389$ALTER TABLE public.invoice_compression_logs ENABLE ROW LEVEL SECURITY$Q389$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q390$ALTER TABLE public.invoice_compression_lock ENABLE ROW LEVEL SECURITY$Q390$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260910123618_61512c98-0e5f-4f1f-ac16-f1a056e6682d.sql', left($Q390$ALTER TABLE public.invoice_compression_lock ENABLE ROW LEVEL SECURITY$Q390$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q391$-- Correct the two balances the tier bug overpaid.
--
-- Until 20260921120000, both award functions ignored tier_mode and paid every
-- rung at or below the achievement. Two people reached 100% of a six-rung
-- target and were paid all six — 1,800 where the top rung is worth 375.
--
--   Abhishek KP   period 2026-08   paid 1,800   owed 375   over by 1,425
--   Ashwitha      period 2026-09   paid 1,800   owed 375   over by 1,425
--
-- Vindya reached only the 10% rung, was paid 150, and is already correct.
--
-- Nothing is deleted. Two ledger rows carry the correction, dated to the same
-- instant as the awards they offset so they land in the same period, and
-- carrying the same expiry so they cannot outlive what they correct. The
-- drill-down shows them as records, which is the point: a balance that changed
-- should say why rather than quietly differ from what someone was told.
--
-- After this the engine agrees: gam_award_tiers_for_target sums what the period
-- has already paid (375) against what the top rung owes (375) and awards
-- nothing further.
--
-- Written to be safe to run twice — the guard is the correction row itself.
insert into public.gamification_points
  (user_id, game_id, action_id, points, reference_type,
   earned_at, expires_at, status, period_key, metadata)
select v.user_id, v.game_id, v.action_id, v.points, 'target_tier',
       v.earned_at, v.expires_at, 'active', v.period_key,
       jsonb_build_object(
         'correction', true,
         'reason', 'tier_mode=highest was not honoured: every rung was paid instead of only the highest reached',
         'paid_before', 1800,
         'owed', 375,
         'fixed_by', '20260921120000_gam_tier_mode_highest')
from (values
  ('cadd4c26-bc9c-4d71-8a05-35d3169d2206'::uuid,   -- Ashwitha
   'd53035c7-f15f-47b5-8ad5-de3decc047cc'::uuid,
   '9bcf55ec-4442-42b7-bf16-e46d3526a5f3'::uuid,
   -1425::numeric, '2026-09'::text,
   '2026-09-01 11:47:36.942505+00'::timestamptz,
   '2027-03-31 23:59:59+00'::timestamptz),
  ('6be7e2ff-0447-44a0-a3b5-64993b9db54d'::uuid,   -- Abhishek KP
   'd53035c7-f15f-47b5-8ad5-de3decc047cc'::uuid,
   '9bcf55ec-4442-42b7-bf16-e46d3526a5f3'::uuid,
   -1425::numeric, '2026-08'::text,
   '2026-09-01 10:07:06.076649+00'::timestamptz,
   '2027-03-31 23:59:59+00'::timestamptz)
) as v(user_id, game_id, action_id, points, period_key, earned_at, expires_at)
where not exists (
  select 1 from public.gamification_points gp
  where gp.user_id = v.user_id
    and gp.action_id = v.action_id
    and gp.period_key = v.period_key
    and gp.reference_type = 'target_tier'
    and coalesce((gp.metadata->>'correction')::boolean, false)
)$Q391$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260921140000_gam_tier_overpayment_correction.sql', left($Q391$-- Correct the two balances the tier bug overpaid.
--
-- Until 20260921120000, both award functions ignored tier_mode and paid every
-- rung at or below the achievement. Two people reached 100% of a six-rung
-- target and were paid all six — 1,800 where the top rung is worth 375.
--
--   Abhishek KP   period 2026-08   paid 1,800   owed 375   over by 1,425
--   Ashwitha      period 2026-09   paid 1,800   owed 375   over by 1,425
--
-- Vindya reached only the 10% rung, was paid 150, and is already correct.
--
-- Nothing is deleted. Two ledger rows carry the correction, dated to the same
-- instant as the awards they offset so they land in the same period, and
-- carrying the same expiry so they cannot outlive what they correct. The
-- drill-down shows them as records, which is the point: a balance that changed
-- should say why rather than quietly differ from what someone was told.
--
-- After this the engine agrees: gam_award_tiers_for_target sums what the period
-- has already paid (375) against what the top rung owes (375) and awards
-- nothing further.
--
-- Written to be safe to run twice — the guard is the correction row itself.
insert into public.gamification_points
  (user_id, game_id, action_id, points, reference_type,
   earned_at, expires_at, status, period_key, metadata)
select v.user_id, v.game_id, v.action_id, v.points, 'target_tier',
       v.earned_at, v.expires_at, 'active', v.period_key,
       jsonb_build_object(
         'correction', true,
         'reason', 'tier_mode=highest was not honoured: every rung was paid instead of only the highest reached',
         'paid_before', 1800,
         'owed', 375,
         'fixed_by', '20260921120000_gam_tier_mode_highest')
from (values
  ('cadd4c26-bc9c-4d71-8a05-35d3169d2206'::uuid,   -- Ashwitha
   'd53035c7-f15f-47b5-8ad5-de3decc047cc'::uuid,
   '9bcf55ec-4442-42b7-bf16-e46d3526a5f3'::uuid,
   -1425::numeric, '2026-09'::text,
   '2026-09-01 11:47:36.942505+00'::timestamptz,
   '2027-03-31 23:59:59+00'::timestamptz),
  ('6be7e2ff-0447-44a0-a3b5-64993b9db54d'::uuid,   -- Abhishek KP
   'd53035c7-f15f-47b5-8ad5-de3decc047cc'::uuid,
   '9bcf55ec-4442-42b7-bf16-e46d3526a5f3'::uuid,
   -1425::numeric, '2026-08'::text,
   '2026-09-01 10:07:06.076649+00'::timestamptz,
   '2027-03-31 23:59:59+00'::timestamptz)
) as v(user_id, game_id, action_id, points, period_key, earned_at, expires_at)
where not exists (
  select 1 from public.gamification_points gp
  where gp.user_id = v.user_id
    and gp.action_id = v.action_id
    and gp.period_key = v.period_key
    and gp.reference_type = 'target_tier'
    and coalesce((gp.metadata->>'correction')::boolean, false)
)$Q391$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q392$-- The set of people one scope covers, for the signed-in caller. Takes no user
-- parameter on purpose: the caller is always auth.uid(), so this cannot be
-- used to enumerate somebody else's reporting line.
create or replace function public.gam_scope_users(
  p_scope text default 'hierarchy',
  p_selected uuid[] default null
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with me as (select auth.uid() as uid),
  -- Everyone above me, to the root. Walked in full; inactive links are
  -- traversed rather than stopped at.
  chain as (
    with recursive up as (
      select e.manager_id as uid
      from public.employees e, me
      where e.user_id = me.uid and e.manager_id is not null
      union
      select e.manager_id
      from public.employees e join up on e.user_id = up.uid
      where e.manager_id is not null
    )
    select uid from up
  ),
  -- Everyone reporting to my manager, which includes me.
  peers as (
    select sib.user_id as uid
    from public.employees mine, me
    join public.employees sib on sib.manager_id = mine.manager_id
    where mine.user_id = me.uid and mine.manager_id is not null
  ),
  reports as (
    select s.subordinate_user_id as uid
    from me, public.get_all_subordinates(me.uid) s
    where s.level > 0
  ),
  candidate as (
    select uid from (
      select uid from chain where p_scope = 'hierarchy'
      union select uid from peers where p_scope = 'hierarchy'
      union select uid from reports where p_scope in ('hierarchy', 'mine')
      -- You are always on your own board; a leaderboard you cannot find
      -- yourself on is not a leaderboard.
      union select uid from me where p_scope in ('hierarchy', 'mine')
      union select unnest(coalesce(p_selected, '{}'::uuid[])) where p_scope = 'selected'
    ) s where uid is not null
  )
  select c.uid
  from candidate c
  where public.gam_is_active_user(c.uid);
$function$$Q392$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260923100000_gam_rankings_scope.sql', left($Q392$-- The set of people one scope covers, for the signed-in caller. Takes no user
-- parameter on purpose: the caller is always auth.uid(), so this cannot be
-- used to enumerate somebody else's reporting line.
create or replace function public.gam_scope_users(
  p_scope text default 'hierarchy',
  p_selected uuid[] default null
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with me as (select auth.uid() as uid),
  -- Everyone above me, to the root. Walked in full; inactive links are
  -- traversed rather than stopped at.
  chain as (
    with recursive up as (
      select e.manager_id as uid
      from public.employees e, me
      where e.user_id = me.uid and e.manager_id is not null
      union
      select e.manager_id
      from public.employees e join up on e.user_id = up.uid
      where e.manager_id is not null
    )
    select uid from up
  ),
  -- Everyone reporting to my manager, which includes me.
  peers as (
    select sib.user_id as uid
    from public.employees mine, me
    join public.employees sib on sib.manager_id = mine.manager_id
    where mine.user_id = me.uid and mine.manager_id is not null
  ),
  reports as (
    select s.subordinate_user_id as uid
    from me, public.get_all_subordinates(me.uid) s
    where s.level > 0
  ),
  candidate as (
    select uid from (
      select uid from chain where p_scope = 'hierarchy'
      union select uid from peers where p_scope = 'hierarchy'
      union select uid from reports where p_scope in ('hierarchy', 'mine')
      -- You are always on your own board; a leaderboard you cannot find
      -- yourself on is not a leaderboard.
      union select uid from me where p_scope in ('hierarchy', 'mine')
      union select unnest(coalesce(p_selected, '{}'::uuid[])) where p_scope = 'selected'
    ) s where uid is not null
  )
  select c.uid
  from candidate c
  where public.gam_is_active_user(c.uid);
$function$$Q392$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q393$revoke all on function public.gam_scope_users(text, uuid[]) from public$Q393$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260923100000_gam_rankings_scope.sql', left($Q393$revoke all on function public.gam_scope_users(text, uuid[]) from public$Q393$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q394$grant execute on function public.gam_scope_users(text, uuid[]) to authenticated$Q394$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260923100000_gam_rankings_scope.sql', left($Q394$grant execute on function public.gam_scope_users(text, uuid[]) to authenticated$Q394$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q395$create function public.gam_rankings(
  p_from timestamptz,
  p_to timestamptz,
  p_scope text default 'hierarchy',
  p_user_ids uuid[] default null
)
returns table (
  user_id uuid,
  full_name text,
  profile_picture_url text,
  points numeric,
  awards bigint,
  programs bigint,
  rank bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (
    select s.user_id as uid from public.gam_scope_users(p_scope, p_user_ids) s
  ),
  agg as (
    select e.user_id,
           sum(e.points) as points,
           count(*) as awards,
           count(distinct e.game_id) as programs
    from public.gam_eligible_points(p_from, p_to) e
    join scope sc on sc.uid = e.user_id
    where e.user_id is not null
    group by e.user_id
  ),
  rows as (
    select sc.uid as user_id,
           coalesce(a.points, 0) as points,
           coalesce(a.awards, 0) as awards,
           coalesce(a.programs, 0) as programs
    from scope sc
    left join agg a on a.user_id = sc.uid
    -- Zeros are kept only for an explicit selection.
    where a.user_id is not null or p_scope = 'selected'
  )
  select r.user_id,
         coalesce(p.full_name, p.username, 'Unknown') as full_name,
         p.profile_picture_url,
         r.points, r.awards, r.programs,
         rank() over (order by r.points desc) as rank
  from rows r
  join public.profiles p on p.id = r.user_id
  order by r.points desc, full_name;
$function$$Q395$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260923100000_gam_rankings_scope.sql', left($Q395$create function public.gam_rankings(
  p_from timestamptz,
  p_to timestamptz,
  p_scope text default 'hierarchy',
  p_user_ids uuid[] default null
)
returns table (
  user_id uuid,
  full_name text,
  profile_picture_url text,
  points numeric,
  awards bigint,
  programs bigint,
  rank bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with scope as (
    select s.user_id as uid from public.gam_scope_users(p_scope, p_user_ids) s
  ),
  agg as (
    select e.user_id,
           sum(e.points) as points,
           count(*) as awards,
           count(distinct e.game_id) as programs
    from public.gam_eligible_points(p_from, p_to) e
    join scope sc on sc.uid = e.user_id
    where e.user_id is not null
    group by e.user_id
  ),
  rows as (
    select sc.uid as user_id,
           coalesce(a.points, 0) as points,
           coalesce(a.awards, 0) as awards,
           coalesce(a.programs, 0) as programs
    from scope sc
    left join agg a on a.user_id = sc.uid
    -- Zeros are kept only for an explicit selection.
    where a.user_id is not null or p_scope = 'selected'
  )
  select r.user_id,
         coalesce(p.full_name, p.username, 'Unknown') as full_name,
         p.profile_picture_url,
         r.points, r.awards, r.programs,
         rank() over (order by r.points desc) as rank
  from rows r
  join public.profiles p on p.id = r.user_id
  order by r.points desc, full_name;
$function$$Q395$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q396$revoke all on function public.gam_rankings(timestamptz, timestamptz, text, uuid[]) from public$Q396$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260923100000_gam_rankings_scope.sql', left($Q396$revoke all on function public.gam_rankings(timestamptz, timestamptz, text, uuid[]) from public$Q396$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q397$grant execute on function public.gam_rankings(timestamptz, timestamptz, text, uuid[]) to authenticated$Q397$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260923100000_gam_rankings_scope.sql', left($Q397$grant execute on function public.gam_rankings(timestamptz, timestamptz, text, uuid[]) to authenticated$Q397$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q398$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_min_points        numeric not null default 0$Q398$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q398$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_min_points        numeric not null default 0$Q398$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q399$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_multiple_of       numeric$Q399$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q399$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_multiple_of       numeric$Q399$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q400$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_max_per_request   numeric$Q400$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q400$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_max_per_request   numeric$Q400$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q401$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_cooldown_days     integer not null default 0$Q401$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q401$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_cooldown_days     integer not null default 0$Q401$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q402$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_requires_approval boolean not null default true$Q402$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q402$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists redeem_requires_approval boolean not null default true$Q402$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q403$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists reset_cadence            text    not null default 'never'$Q403$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q403$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists reset_cadence            text    not null default 'never'$Q403$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q404$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists reset_mode               text    not null default 'expire'$Q404$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q404$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists reset_mode               text    not null default 'expire'$Q404$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q405$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists reset_grace_days         integer not null default 0$Q405$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q405$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists reset_grace_days         integer not null default 0$Q405$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q406$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists reset_lifetime_visible   boolean not null default true$Q406$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q406$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists reset_lifetime_visible   boolean not null default true$Q406$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q407$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists last_reset_period        text$Q407$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q407$-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings add column if not exists last_reset_period        text$Q407$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q408$-- policy_snapshot records the rules AS THEY STOOD when the request was raised,
-- so tightening the policy later cannot retroactively invalidate a request
-- somebody is already waiting on.
alter table public.gamification_redemptions add column if not exists period_key          text$Q408$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q408$-- policy_snapshot records the rules AS THEY STOOD when the request was raised,
-- so tightening the policy later cannot retroactively invalidate a request
-- somebody is already waiting on.
alter table public.gamification_redemptions add column if not exists period_key          text$Q408$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q409$-- policy_snapshot records the rules AS THEY STOOD when the request was raised,
-- so tightening the policy later cannot retroactively invalidate a request
-- somebody is already waiting on.
alter table public.gamification_redemptions add column if not exists policy_snapshot     jsonb$Q409$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q409$-- policy_snapshot records the rules AS THEY STOOD when the request was raised,
-- so tightening the policy later cannot retroactively invalidate a request
-- somebody is already waiting on.
alter table public.gamification_redemptions add column if not exists policy_snapshot     jsonb$Q409$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q410$-- policy_snapshot records the rules AS THEY STOOD when the request was raised,
-- so tightening the policy later cannot retroactively invalidate a request
-- somebody is already waiting on.
alter table public.gamification_redemptions add column if not exists approval_request_id uuid$Q410$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q410$-- policy_snapshot records the rules AS THEY STOOD when the request was raised,
-- so tightening the policy later cannot retroactively invalidate a request
-- somebody is already waiting on.
alter table public.gamification_redemptions add column if not exists approval_request_id uuid$Q410$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q411$-- Unanimous routing: every level must approve, in order. Off by default, so
-- leave, expenses, regularisation, credit notes and order edits keep the
-- first-response behaviour they have today.
alter table public.approval_config add column if not exists require_all_levels boolean not null default false$Q411$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q411$-- Unanimous routing: every level must approve, in order. Off by default, so
-- leave, expenses, regularisation, credit notes and order edits keep the
-- first-response behaviour they have today.
alter table public.approval_config add column if not exists require_all_levels boolean not null default false$Q411$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q412$-- Redemptions ride the shared approval engine. One row, keyed by entity_type,
-- exactly like every other approvable thing.
insert into public.approval_config
  (entity_type, use_full_hierarchy, max_levels, skip_levels, approval_mode, require_all_levels)
select 'gamification_redemption', false, 1, false, 'manager', false
where not exists (
  select 1 from public.approval_config where entity_type = 'gamification_redemption'
)$Q412$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q412$-- Redemptions ride the shared approval engine. One row, keyed by entity_type,
-- exactly like every other approvable thing.
insert into public.approval_config
  (entity_type, use_full_hierarchy, max_levels, skip_levels, approval_mode, require_all_levels)
select 'gamification_redemption', false, 1, false, 'manager', false
where not exists (
  select 1 from public.approval_config where entity_type = 'gamification_redemption'
)$Q412$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q413$-- ------------------------------------------------------- P4: reserved status

-- Points backing an open request are neither spendable nor spent.
alter table public.gamification_points drop constraint if exists gamification_points_status_check$Q413$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q413$-- ------------------------------------------------------- P4: reserved status

-- Points backing an open request are neither spendable nor spent.
alter table public.gamification_points drop constraint if exists gamification_points_status_check$Q413$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q414$alter table public.gamification_points add constraint gamification_points_status_check
  check (status = any (array['active'::text, 'expired'::text, 'redeemed'::text, 'reserved'::text]))$Q414$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q414$alter table public.gamification_points add constraint gamification_points_status_check
  check (status = any (array['active'::text, 'expired'::text, 'redeemed'::text, 'reserved'::text]))$Q414$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q415$alter table public.gamification_points_history enable row level security$Q415$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924090000_gam_policy_recovered_from_staging.sql', left($Q415$alter table public.gamification_points_history enable row level security$Q415$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q416$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists approved_by        uuid references auth.users(id)$Q416$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q416$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists approved_by        uuid references auth.users(id)$Q416$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q417$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists approved_at        timestamptz$Q417$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q417$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists approved_at        timestamptz$Q417$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q418$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists paid_by            uuid references auth.users(id)$Q418$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q418$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists paid_by            uuid references auth.users(id)$Q418$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q419$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists paid_at            timestamptz$Q419$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q419$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists paid_at            timestamptz$Q419$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q420$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists payment_mode       text$Q420$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q420$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists payment_mode       text$Q420$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q421$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists payment_reference  text$Q421$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q421$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists payment_reference  text$Q421$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q422$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists payment_note       text$Q422$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q422$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists payment_note       text$Q422$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q423$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists cancelled_at       timestamptz$Q423$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q423$-- The redemption status model, pinned down.
--
-- status was free text with a default of 'pending' and no constraint, so a typo
-- was a valid state and nothing described the lifecycle. Approval and payment
-- were also the same event: there was one processed_at and one processed_by,
-- which cannot record "a manager said yes on Tuesday and the money went out on
-- Friday" -- the distinction this workflow exists to make.
--
-- Five states, and no 'processing'. It sits between approved and paid in the
-- written spec, but it is only worth a click if payment takes long enough for
-- "approved" to go stale; adding it later is one CHECK and one label, while
-- shipping it now means a state every manager must learn and nobody can
-- explain. Deliberately omitted, not overlooked.
--
--   pending    the rep has asked. Points are committed but not burned.
--   approved   a manager said yes. STILL not burned -- no money has moved.
--   paid       the reward actually went out. This is the only state that burns.
--   rejected   refused, with a reason the rep reads.
--   cancelled  withdrawn by the rep while still pending.
--
-- Existing rows are already 'pending' and 'rejected', so the constraint is
-- satisfiable as written and no backfill is needed.

alter table public.gamification_redemptions add column if not exists cancelled_at       timestamptz$Q423$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q424$comment on column public.gamification_redemptions.approved_at is
  'When a manager approved. NOT when the reward was given -- see paid_at.'$Q424$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q424$comment on column public.gamification_redemptions.approved_at is
  'When a manager approved. NOT when the reward was given -- see paid_at.'$Q424$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q425$comment on column public.gamification_redemptions.paid_at is
  'When the reward actually reached the rep. Only this step burns points.'$Q425$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q425$comment on column public.gamification_redemptions.paid_at is
  'When the reward actually reached the rep. Only this step burns points.'$Q425$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q426$comment on column public.gamification_redemptions.payment_reference is
  'UTR, voucher code or payroll run that the rep can be pointed at.'$Q426$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q426$comment on column public.gamification_redemptions.payment_reference is
  'UTR, voucher code or payroll run that the rep can be pointed at.'$Q426$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q427$-- Drop first so the migration is re-runnable against a half-applied database.
alter table public.gamification_redemptions drop constraint if exists gamification_redemptions_status_check$Q427$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q427$-- Drop first so the migration is re-runnable against a half-applied database.
alter table public.gamification_redemptions drop constraint if exists gamification_redemptions_status_check$Q427$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q428$alter table public.gamification_redemptions add constraint gamification_redemptions_status_check
  check (status in ('pending', 'approved', 'paid', 'rejected', 'cancelled'))$Q428$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q428$alter table public.gamification_redemptions add constraint gamification_redemptions_status_check
  check (status in ('pending', 'approved', 'paid', 'rejected', 'cancelled'))$Q428$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q429$-- A request for nothing, or for a negative amount, is not a request. The client
-- checked this and the server did not, so a direct REST call could post any
-- number at all.
alter table public.gamification_redemptions drop constraint if exists gamification_redemptions_amount_check$Q429$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q429$-- A request for nothing, or for a negative amount, is not a request. The client
-- checked this and the server did not, so a direct REST call could post any
-- number at all.
alter table public.gamification_redemptions drop constraint if exists gamification_redemptions_amount_check$Q429$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q430$alter table public.gamification_redemptions add constraint gamification_redemptions_amount_check
  check (points_redeemed > 0 and voucher_amount >= 0)$Q430$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924100000_gam_redemption_status_model.sql', left($Q430$alter table public.gamification_redemptions add constraint gamification_redemptions_amount_check
  check (points_redeemed > 0 and voucher_amount >= 0)$Q430$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q431$-- The manager's queue.
--
-- Returns only requests this caller may act on, with the requester's balance
-- beside the amount -- approving without it is approving blind, which is how a
-- request got raised against points the tier bug had inflated.
create or replace function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id)
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_action_redemption(r.user_id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$$Q431$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924120000_gam_redemption_workflow.sql', left($Q431$-- The manager's queue.
--
-- Returns only requests this caller may act on, with the requester's balance
-- beside the amount -- approving without it is approving blind, which is how a
-- request got raised against points the tier bug had inflated.
create or replace function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id)
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_action_redemption(r.user_id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$$Q431$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q432$revoke all on function public.gam_redemption_queue(text[]) from public$Q432$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924120000_gam_redemption_workflow.sql', left($Q432$revoke all on function public.gam_redemption_queue(text[]) from public$Q432$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q433$grant execute on function public.gam_redemption_queue(text[]) to authenticated$Q433$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924120000_gam_redemption_workflow.sql', left($Q433$grant execute on function public.gam_redemption_queue(text[]) to authenticated$Q433$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q434$-- The rep's own list, with the names behind each step so the timeline can say
-- "approved by Dharmesh" rather than "approved".
create or replace function public.gam_my_redemptions()
returns table (
  id uuid,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  rejection_reason text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.rejection_reason
  from public.gamification_redemptions r
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where r.user_id = auth.uid()
  order by r.requested_at desc;
$function$$Q434$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924120000_gam_redemption_workflow.sql', left($Q434$-- The rep's own list, with the names behind each step so the timeline can say
-- "approved by Dharmesh" rather than "approved".
create or replace function public.gam_my_redemptions()
returns table (
  id uuid,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  rejection_reason text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.rejection_reason
  from public.gamification_redemptions r
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where r.user_id = auth.uid()
  order by r.requested_at desc;
$function$$Q434$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q435$revoke all on function public.gam_my_redemptions() from public$Q435$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924120000_gam_redemption_workflow.sql', left($Q435$revoke all on function public.gam_my_redemptions() from public$Q435$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q436$grant execute on function public.gam_my_redemptions() to authenticated$Q436$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924120000_gam_redemption_workflow.sql', left($Q436$grant execute on function public.gam_my_redemptions() to authenticated$Q436$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q437$-- Who may act on a redemption.
--
-- Takes the redemption, not the requester, because entitlement now depends on
-- the approval request the engine raised for it. Three ways in -- an admin, the
-- engine's designated approver, or a manager above the requester (which covers
-- rows raised before the engine existed, and the payment step after the
-- approval request has closed).
--
-- The self-check is first and beats all three. An admin approving their own
-- payout is the one thing this must never allow, and two of the three system
-- admins here are also earners.
create or replace function public.gam_can_settle_redemption(p_redemption uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and exists (
       select 1
       from public.gamification_redemptions r
       where r.id = p_redemption
         and r.user_id <> auth.uid()
         and (
           coalesce(public.is_admin_or_manager(), false)
           or (r.approval_request_id is not null
               and coalesce(public.is_approver_for_request(r.approval_request_id, auth.uid()), false))
           or exists (
             select 1 from public.get_all_subordinates(auth.uid()) s
             where s.subordinate_user_id = r.user_id and s.level > 0
           )
         )
     );
$function$$Q437$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924140000_gam_redemption_reconcile_approval_and_payment.sql', left($Q437$-- Who may act on a redemption.
--
-- Takes the redemption, not the requester, because entitlement now depends on
-- the approval request the engine raised for it. Three ways in -- an admin, the
-- engine's designated approver, or a manager above the requester (which covers
-- rows raised before the engine existed, and the payment step after the
-- approval request has closed).
--
-- The self-check is first and beats all three. An admin approving their own
-- payout is the one thing this must never allow, and two of the three system
-- admins here are also earners.
create or replace function public.gam_can_settle_redemption(p_redemption uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and exists (
       select 1
       from public.gamification_redemptions r
       where r.id = p_redemption
         and r.user_id <> auth.uid()
         and (
           coalesce(public.is_admin_or_manager(), false)
           or (r.approval_request_id is not null
               and coalesce(public.is_approver_for_request(r.approval_request_id, auth.uid()), false))
           or exists (
             select 1 from public.get_all_subordinates(auth.uid()) s
             where s.subordinate_user_id = r.user_id and s.level > 0
           )
         )
     );
$function$$Q437$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q438$revoke all on function public.gam_can_settle_redemption(uuid) from public$Q438$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924140000_gam_redemption_reconcile_approval_and_payment.sql', left($Q438$revoke all on function public.gam_can_settle_redemption(uuid) from public$Q438$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q439$grant execute on function public.gam_can_settle_redemption(uuid) to authenticated$Q439$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924140000_gam_redemption_reconcile_approval_and_payment.sql', left($Q439$grant execute on function public.gam_can_settle_redemption(uuid) to authenticated$Q439$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q440$create function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric,
  approval_request_id uuid,
  my_turn boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id),
         r.approval_request_id,
         -- An admin can always act; an engine approver only when a step of
         -- theirs is actually pending, so a unanimous route does not offer
         -- Approve to somebody whose turn has not come.
         (coalesce(public.is_admin_or_manager(), false)
          or r.approval_request_id is null
          or exists (select 1 from public.approval_steps s
                      where s.approval_request_id = r.approval_request_id
                        and s.approver_id = auth.uid() and s.status = 'pending'))
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_settle_redemption(r.id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$$Q440$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924140000_gam_redemption_reconcile_approval_and_payment.sql', left($Q440$create function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric,
  approval_request_id uuid,
  my_turn boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id),
         r.approval_request_id,
         -- An admin can always act; an engine approver only when a step of
         -- theirs is actually pending, so a unanimous route does not offer
         -- Approve to somebody whose turn has not come.
         (coalesce(public.is_admin_or_manager(), false)
          or r.approval_request_id is null
          or exists (select 1 from public.approval_steps s
                      where s.approval_request_id = r.approval_request_id
                        and s.approver_id = auth.uid() and s.status = 'pending'))
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_settle_redemption(r.id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$$Q440$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q441$revoke all on function public.gam_redemption_queue(text[]) from public$Q441$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924140000_gam_redemption_reconcile_approval_and_payment.sql', left($Q441$revoke all on function public.gam_redemption_queue(text[]) from public$Q441$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q442$grant execute on function public.gam_redemption_queue(text[]) to authenticated$Q442$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924140000_gam_redemption_reconcile_approval_and_payment.sql', left($Q442$grant execute on function public.gam_redemption_queue(text[]) to authenticated$Q442$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q443$-- Configurable approval routing: manager, admin, named people, or a role.
--
-- The engine could route two ways: up the reporting chain, or to ONE named
-- person (specific_approver_id, singular). Redemptions need more than that --
-- "send these to the admins", "send these to Abhishek and Rahul", "send these
-- to whoever holds the Sales Manager role" -- and the point of putting it in
-- configuration is that changing the answer later must not mean changing code.
--
-- Three new modes, all resolving to a single level with several pending steps,
-- so ANY one of the people named can approve and the first response settles it.
-- That is how the manager route already behaves when a chain has several
-- levels and require_all_levels is off.
--
-- "Role" here means security_profiles -- what the app calls Security Roles and
-- shows in SecurityRolesDisplay: Sales Manager, Field Sales Executive, Product
-- Manager, System Administrator, Data Viewer. The role_definitions table sounds
-- like the right home for this and is empty; user_profiles.profile_id is what
-- actually links a person to one of these.
--
-- create_approval_request is SHARED with leave, expenses, regularisation,
-- credit notes, order backdates and order edits. The new modes are added as a
-- branch ahead of the existing ones, and the manager and specific paths below
-- are untouched, so every entity type that uses them routes exactly as before.

alter table public.approval_config add column if not exists approver_user_ids uuid[]$Q443$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q443$-- Configurable approval routing: manager, admin, named people, or a role.
--
-- The engine could route two ways: up the reporting chain, or to ONE named
-- person (specific_approver_id, singular). Redemptions need more than that --
-- "send these to the admins", "send these to Abhishek and Rahul", "send these
-- to whoever holds the Sales Manager role" -- and the point of putting it in
-- configuration is that changing the answer later must not mean changing code.
--
-- Three new modes, all resolving to a single level with several pending steps,
-- so ANY one of the people named can approve and the first response settles it.
-- That is how the manager route already behaves when a chain has several
-- levels and require_all_levels is off.
--
-- "Role" here means security_profiles -- what the app calls Security Roles and
-- shows in SecurityRolesDisplay: Sales Manager, Field Sales Executive, Product
-- Manager, System Administrator, Data Viewer. The role_definitions table sounds
-- like the right home for this and is empty; user_profiles.profile_id is what
-- actually links a person to one of these.
--
-- create_approval_request is SHARED with leave, expenses, regularisation,
-- credit notes, order backdates and order edits. The new modes are added as a
-- branch ahead of the existing ones, and the manager and specific paths below
-- are untouched, so every entity type that uses them routes exactly as before.

alter table public.approval_config add column if not exists approver_user_ids uuid[]$Q443$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q444$-- Configurable approval routing: manager, admin, named people, or a role.
--
-- The engine could route two ways: up the reporting chain, or to ONE named
-- person (specific_approver_id, singular). Redemptions need more than that --
-- "send these to the admins", "send these to Abhishek and Rahul", "send these
-- to whoever holds the Sales Manager role" -- and the point of putting it in
-- configuration is that changing the answer later must not mean changing code.
--
-- Three new modes, all resolving to a single level with several pending steps,
-- so ANY one of the people named can approve and the first response settles it.
-- That is how the manager route already behaves when a chain has several
-- levels and require_all_levels is off.
--
-- "Role" here means security_profiles -- what the app calls Security Roles and
-- shows in SecurityRolesDisplay: Sales Manager, Field Sales Executive, Product
-- Manager, System Administrator, Data Viewer. The role_definitions table sounds
-- like the right home for this and is empty; user_profiles.profile_id is what
-- actually links a person to one of these.
--
-- create_approval_request is SHARED with leave, expenses, regularisation,
-- credit notes, order backdates and order edits. The new modes are added as a
-- branch ahead of the existing ones, and the manager and specific paths below
-- are untouched, so every entity type that uses them routes exactly as before.

alter table public.approval_config add column if not exists approver_role_ids uuid[]$Q444$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q444$-- Configurable approval routing: manager, admin, named people, or a role.
--
-- The engine could route two ways: up the reporting chain, or to ONE named
-- person (specific_approver_id, singular). Redemptions need more than that --
-- "send these to the admins", "send these to Abhishek and Rahul", "send these
-- to whoever holds the Sales Manager role" -- and the point of putting it in
-- configuration is that changing the answer later must not mean changing code.
--
-- Three new modes, all resolving to a single level with several pending steps,
-- so ANY one of the people named can approve and the first response settles it.
-- That is how the manager route already behaves when a chain has several
-- levels and require_all_levels is off.
--
-- "Role" here means security_profiles -- what the app calls Security Roles and
-- shows in SecurityRolesDisplay: Sales Manager, Field Sales Executive, Product
-- Manager, System Administrator, Data Viewer. The role_definitions table sounds
-- like the right home for this and is empty; user_profiles.profile_id is what
-- actually links a person to one of these.
--
-- create_approval_request is SHARED with leave, expenses, regularisation,
-- credit notes, order backdates and order edits. The new modes are added as a
-- branch ahead of the existing ones, and the manager and specific paths below
-- are untouched, so every entity type that uses them routes exactly as before.

alter table public.approval_config add column if not exists approver_role_ids uuid[]$Q444$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q445$comment on column public.approval_config.approver_user_ids is
  'approval_mode = users: the people who may approve. Any one of them settles it.'$Q445$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q445$comment on column public.approval_config.approver_user_ids is
  'approval_mode = users: the people who may approve. Any one of them settles it.'$Q445$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q446$comment on column public.approval_config.approver_role_ids is
  'approval_mode = roles: security_profiles ids. Every active holder may approve.'$Q446$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q446$comment on column public.approval_config.approver_role_ids is
  'approval_mode = roles: security_profiles ids. Every active holder may approve.'$Q446$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q447$-- Free text until now, so a typo in the mode silently fell through to the
-- manager branch and routed somewhere nobody chose.
alter table public.approval_config drop constraint if exists approval_config_approval_mode_check$Q447$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q447$-- Free text until now, so a typo in the mode silently fell through to the
-- manager branch and routed somewhere nobody chose.
alter table public.approval_config drop constraint if exists approval_config_approval_mode_check$Q447$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q448$alter table public.approval_config add constraint approval_config_approval_mode_check
  check (approval_mode in ('manager', 'specific', 'admin', 'users', 'roles'))$Q448$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q448$alter table public.approval_config add constraint approval_config_approval_mode_check
  check (approval_mode in ('manager', 'specific', 'admin', 'users', 'roles'))$Q448$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q449$create function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric,
  approval_request_id uuid,
  my_turn boolean,
  routed_to text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id),
         r.approval_request_id,
         (coalesce(public.is_admin_or_manager(), false)
          or r.approval_request_id is null
          or exists (select 1 from public.approval_steps s
                      where s.approval_request_id = r.approval_request_id
                        and s.approver_id = auth.uid() and s.status = 'pending')),
         (select string_agg(coalesce(m.full_name, m.username), ', ' order by s.level, m.full_name)
            from public.approval_steps s
            join public.profiles m on m.id = s.approver_id
           where s.approval_request_id = r.approval_request_id
             and s.status = 'pending')::text
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_settle_redemption(r.id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$$Q449$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q449$create function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric,
  approval_request_id uuid,
  my_turn boolean,
  routed_to text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id),
         r.approval_request_id,
         (coalesce(public.is_admin_or_manager(), false)
          or r.approval_request_id is null
          or exists (select 1 from public.approval_steps s
                      where s.approval_request_id = r.approval_request_id
                        and s.approver_id = auth.uid() and s.status = 'pending')),
         (select string_agg(coalesce(m.full_name, m.username), ', ' order by s.level, m.full_name)
            from public.approval_steps s
            join public.profiles m on m.id = s.approver_id
           where s.approval_request_id = r.approval_request_id
             and s.status = 'pending')::text
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_settle_redemption(r.id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$$Q449$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q450$revoke all on function public.gam_redemption_queue(text[]) from public$Q450$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q450$revoke all on function public.gam_redemption_queue(text[]) from public$Q450$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q451$grant execute on function public.gam_redemption_queue(text[]) to authenticated$Q451$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924160000_approval_routing_admin_users_roles.sql', left($Q451$grant execute on function public.gam_redemption_queue(text[]) to authenticated$Q451$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q452$-- Route to SEVERAL kinds of approver at once.
--
-- The process was one choice: admins, or the manager, or named people, or a
-- role. Real routing is often a union of those -- "the manager and the admins",
-- "these two people and anyone in Sales Manager" -- so the setting becomes a
-- multi-select and the approvers are everyone the selected modes resolve to.
--
-- approval_mode (singular) is left exactly as it is, because leave, expenses,
-- regularisation, credit notes, order backdates and order edits all read it.
-- approval_modes (plural) is additive: when it holds anything, it wins; when it
-- is null or empty, the old column decides and nothing about those six changes.
--
-- LEVELS. Manager routing is a ladder -- level 1 is your manager, level 2 is
-- theirs -- and that ladder is what "every level must approve, in order" acts
-- on. The other modes are not a ladder; they are alternatives. So:
--
--   manager alone           the ladder, unchanged, unanimous still meaningful
--   anything else, or a mix everyone on level 1, first response decides
--
-- Mixing a ladder with a flat set has no honest ordering -- there is no answer
-- to whether an admin outranks the rep's second-line manager -- so the mix
-- flattens rather than inventing a hierarchy nobody configured.

alter table public.approval_config add column if not exists approval_modes text[]$Q452$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924170000_approval_routing_multi_select.sql', left($Q452$-- Route to SEVERAL kinds of approver at once.
--
-- The process was one choice: admins, or the manager, or named people, or a
-- role. Real routing is often a union of those -- "the manager and the admins",
-- "these two people and anyone in Sales Manager" -- so the setting becomes a
-- multi-select and the approvers are everyone the selected modes resolve to.
--
-- approval_mode (singular) is left exactly as it is, because leave, expenses,
-- regularisation, credit notes, order backdates and order edits all read it.
-- approval_modes (plural) is additive: when it holds anything, it wins; when it
-- is null or empty, the old column decides and nothing about those six changes.
--
-- LEVELS. Manager routing is a ladder -- level 1 is your manager, level 2 is
-- theirs -- and that ladder is what "every level must approve, in order" acts
-- on. The other modes are not a ladder; they are alternatives. So:
--
--   manager alone           the ladder, unchanged, unanimous still meaningful
--   anything else, or a mix everyone on level 1, first response decides
--
-- Mixing a ladder with a flat set has no honest ordering -- there is no answer
-- to whether an admin outranks the rep's second-line manager -- so the mix
-- flattens rather than inventing a hierarchy nobody configured.

alter table public.approval_config add column if not exists approval_modes text[]$Q452$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q453$comment on column public.approval_config.approval_modes is
  'Several routes at once; approvers are the union. Null/empty falls back to approval_mode.'$Q453$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924170000_approval_routing_multi_select.sql', left($Q453$comment on column public.approval_config.approval_modes is
  'Several routes at once; approvers are the union. Null/empty falls back to approval_mode.'$Q453$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q454$alter table public.approval_config drop constraint if exists approval_config_approval_modes_check$Q454$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924170000_approval_routing_multi_select.sql', left($Q454$alter table public.approval_config drop constraint if exists approval_config_approval_modes_check$Q454$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q455$alter table public.approval_config add constraint approval_config_approval_modes_check
  check (
    approval_modes is null
    or approval_modes <@ array['manager','specific','admin','users','roles']::text[]
  )$Q455$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924170000_approval_routing_multi_select.sql', left($Q455$alter table public.approval_config add constraint approval_config_approval_modes_check
  check (
    approval_modes is null
    or approval_modes <@ array['manager','specific','admin','users','roles']::text[]
  )$Q455$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q456$-- Seed the plural column from the singular one so nothing reads as unset.
update public.approval_config
   set approval_modes = array[approval_mode]
 where approval_modes is null$Q456$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924170000_approval_routing_multi_select.sql', left($Q456$-- Seed the plural column from the singular one so nothing reads as unset.
update public.approval_config
   set approval_modes = array[approval_mode]
 where approval_modes is null$Q456$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q457$-- Redemptions always settle on the first response.
--
-- The "Decision rule" control is gone from Redemption Configuration. It chose
-- between first-response and unanimous, but unanimous only means anything for a
-- ladder -- levels of the reporting chain, approving in turn -- and redemptions
-- route to a flat set of alternatives in every mode except Manager on its own.
-- With the approval process now a multi-select, the question it asked is
-- already answered by which routes are ticked, and a control that is disabled
-- in most configurations and meaningless in the rest is worth removing rather
-- than explaining.
--
-- Removing the control is not enough on its own: a value left at true would be
-- stuck true, silently making approvals sequential with nothing in the UI able
-- to change it back. So it is pinned false for this entity type.
--
-- require_all_levels itself stays. It is a column on the SHARED approval_config
-- and leave, expenses, regularisation, credit notes, order backdates and order
-- edits all read it through process_approval_step; only the redemption row is
-- touched here.
update public.approval_config
   set require_all_levels = false,
       updated_at = now()
 where entity_type = 'gamification_redemption'
   and require_all_levels is distinct from false$Q457$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260924180000_gam_redemption_first_response_decides.sql', left($Q457$-- Redemptions always settle on the first response.
--
-- The "Decision rule" control is gone from Redemption Configuration. It chose
-- between first-response and unanimous, but unanimous only means anything for a
-- ladder -- levels of the reporting chain, approving in turn -- and redemptions
-- route to a flat set of alternatives in every mode except Manager on its own.
-- With the approval process now a multi-select, the question it asked is
-- already answered by which routes are ticked, and a control that is disabled
-- in most configurations and meaningless in the rest is worth removing rather
-- than explaining.
--
-- Removing the control is not enough on its own: a value left at true would be
-- stuck true, silently making approvals sequential with nothing in the UI able
-- to change it back. So it is pinned false for this entity type.
--
-- require_all_levels itself stays. It is a column on the SHARED approval_config
-- and leave, expenses, regularisation, credit notes, order backdates and order
-- edits all read it through process_approval_step; only the redemption row is
-- touched here.
update public.approval_config
   set require_all_levels = false,
       updated_at = now()
 where entity_type = 'gamification_redemption'
   and require_all_levels is distinct from false$Q457$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q458$-- "Available to redeem" must also hold back requests that were never reserved.
--
-- Reservation moves the points backing a request out of 'active', so
-- gam_user_balance already excludes them and available is simply the balance.
-- That is true only for requests raised through gam_redeem_request. Rows that
-- predate reservation hold nothing: their points are still spendable while the
-- request sits open, so the balance overstates what the rep may ask for.
--
-- Dharmesh is the live case -- 110 approved and unpaid since June, no
-- reservation behind it, and 1,243 shown as available. It fails closed today
-- rather than over-paying, because gam_burn_points refuses when the inventory
-- is short: he could redeem the lot and the 110 would then fail to pay. That
-- is a stuck payment and a confusing one, so the amount is held back instead.
--
-- Subtracting the SHORTFALL rather than the whole request is what makes this
-- correct for both kinds of row at once: a fully reserved request has a
-- shortfall of zero and is already accounted for in the balance, a legacy one
-- has a shortfall equal to its full amount, and a partially reserved one --
-- which should not exist, but would otherwise be counted twice or not at all --
-- is held back by exactly the part nothing is holding.
create or replace function public.gam_available_to_redeem(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(
    0,
    public.gam_user_balance(p_user)
      - coalesce((
          select sum(
                   greatest(
                     0,
                     r.points_redeemed - coalesce((
                       select sum(gp.points)
                       from public.gamification_points gp
                       where gp.redemption_id = r.id
                         and gp.status = 'reserved'
                     ), 0)
                   )
                 )
          from public.gamification_redemptions r
          where r.user_id = p_user
            and r.status in ('pending', 'approved')
        ), 0)
  );
$function$$Q458$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20260928110000_gam_available_counts_unreserved_requests.sql', left($Q458$-- "Available to redeem" must also hold back requests that were never reserved.
--
-- Reservation moves the points backing a request out of 'active', so
-- gam_user_balance already excludes them and available is simply the balance.
-- That is true only for requests raised through gam_redeem_request. Rows that
-- predate reservation hold nothing: their points are still spendable while the
-- request sits open, so the balance overstates what the rep may ask for.
--
-- Dharmesh is the live case -- 110 approved and unpaid since June, no
-- reservation behind it, and 1,243 shown as available. It fails closed today
-- rather than over-paying, because gam_burn_points refuses when the inventory
-- is short: he could redeem the lot and the 110 would then fail to pay. That
-- is a stuck payment and a confusing one, so the amount is held back instead.
--
-- Subtracting the SHORTFALL rather than the whole request is what makes this
-- correct for both kinds of row at once: a fully reserved request has a
-- shortfall of zero and is already accounted for in the balance, a legacy one
-- has a shortfall equal to its full amount, and a partially reserved one --
-- which should not exist, but would otherwise be counted twice or not at all --
-- is held back by exactly the part nothing is holding.
create or replace function public.gam_available_to_redeem(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(
    0,
    public.gam_user_balance(p_user)
      - coalesce((
          select sum(
                   greatest(
                     0,
                     r.points_redeemed - coalesce((
                       select sum(gp.points)
                       from public.gamification_points gp
                       where gp.redemption_id = r.id
                         and gp.status = 'reserved'
                     ), 0)
                   )
                 )
          from public.gamification_redemptions r
          where r.user_id = p_user
            and r.status in ('pending', 'approved')
        ), 0)
  );
$function$$Q458$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q459$-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers add column if not exists order_ordinal integer$Q459$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q459$-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers add column if not exists order_ordinal integer$Q459$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q460$-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers add column if not exists basis text$Q460$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q460$-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers add column if not exists basis text$Q460$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q461$-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers add column if not exists operator text$Q461$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q461$-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers add column if not exists operator text$Q461$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q462$-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers add column if not exists threshold numeric$Q462$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q462$-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers add column if not exists threshold numeric$Q462$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q463$comment on column public.activity_tiers.order_ordinal is
  'Order milestones only: which order in the retailer''s sequence this rung judges (1 = first). Null on target/visit rungs.'$Q463$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q463$comment on column public.activity_tiers.order_ordinal is
  'Order milestones only: which order in the retailer''s sequence this rung judges (1 = first). Null on target/visit rungs.'$Q463$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q464$comment on column public.activity_tiers.basis is
  'Order milestones only: order_value or order_quantity.'$Q464$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q464$comment on column public.activity_tiers.basis is
  'Order milestones only: order_value or order_quantity.'$Q464$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q465$comment on column public.activity_tiers.operator is
  'Order milestones only: >=, >, <=, < or =. Defaults to >= when absent.'$Q465$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q465$comment on column public.activity_tiers.operator is
  'Order milestones only: >=, >, <=, < or =. Defaults to >= when absent.'$Q465$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q466$comment on column public.activity_tiers.threshold is
  'Order milestones only: an ABSOLUTE threshold (rupees or units), as opposed to threshold_pct which is a percentage of a target.'$Q466$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q466$comment on column public.activity_tiers.threshold is
  'Order milestones only: an ABSOLUTE threshold (rupees or units), as opposed to threshold_pct which is a percentage of a target.'$Q466$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q467$do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activity_tiers_basis_check'
  ) then
    alter table public.activity_tiers
      add constraint activity_tiers_basis_check
      check (basis is null or basis in ('order_value', 'order_quantity'));
  end if;
end $$$Q467$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008100000_gam_order_milestones.sql', left($Q467$do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activity_tiers_basis_check'
  ) then
    alter table public.activity_tiers
      add constraint activity_tiers_basis_check
      check (basis is null or basis in ('order_value', 'order_quantity'));
  end if;
end $$$Q467$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q468$-- Seed the activation activity into Retailer growth.
--
-- Created DISABLED with a worked-example ladder (1st order >= 5000 -> 100,
-- then 2nd >= 3000 -> 150, sequential). The business sets its own thresholds
-- and switches it on; until then nothing can pay, and the ladder is visible on
-- the activity card so the configuration can be reviewed before it goes live.
--
-- Guarded so re-running never produces a second copy.
do $$
declare
  v_game uuid;
  v_action uuid;
begin
  select id into v_game from public.gamification_games where name = 'Retailer growth' limit 1;
  if v_game is null then return; end if;

  select id into v_action from public.gamification_actions
  where game_id = v_game and coalesce(trigger_type, action_type) = 'new_retailer_activation'
  limit 1;

  if v_action is not null then return; end if;

  insert into public.gamification_actions
    (game_id, action_type, trigger_type, action_name, description, points,
     is_enabled, is_tiered, tier_mode, award_mode, leaderboard,
     expiry_type, cap_scope, conditions_json, metadata)
  values
    (v_game, 'new_retailer_activation', 'new_retailer_activation',
     'New retailer activation',
     'Rewards a ladder of order milestones after a retailer is created.',
     -- Points live on the rungs, not on the activity, so this stays zero.
     0, false, true, 'sequential', 'auto', true,
     'fy_end', 'none', '[]'::jsonb, '{}'::jsonb)
  returning id into v_action;

  -- threshold_pct is unused by order milestones but kept populated, since the
  -- column predates them and target rungs rely on it.
  insert into public.activity_tiers
    (action_id, threshold_pct, points, sort, order_ordinal, basis, operator, threshold)
  values
    (v_action, 0, 100, 1, 1, 'order_value', '>=', 5000),
    (v_action, 0, 150, 2, 2, 'order_value', '>=', 3000);
end $$$Q468$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008110000_gam_seed_new_retailer_activation.sql', left($Q468$-- Seed the activation activity into Retailer growth.
--
-- Created DISABLED with a worked-example ladder (1st order >= 5000 -> 100,
-- then 2nd >= 3000 -> 150, sequential). The business sets its own thresholds
-- and switches it on; until then nothing can pay, and the ladder is visible on
-- the activity card so the configuration can be reviewed before it goes live.
--
-- Guarded so re-running never produces a second copy.
do $$
declare
  v_game uuid;
  v_action uuid;
begin
  select id into v_game from public.gamification_games where name = 'Retailer growth' limit 1;
  if v_game is null then return; end if;

  select id into v_action from public.gamification_actions
  where game_id = v_game and coalesce(trigger_type, action_type) = 'new_retailer_activation'
  limit 1;

  if v_action is not null then return; end if;

  insert into public.gamification_actions
    (game_id, action_type, trigger_type, action_name, description, points,
     is_enabled, is_tiered, tier_mode, award_mode, leaderboard,
     expiry_type, cap_scope, conditions_json, metadata)
  values
    (v_game, 'new_retailer_activation', 'new_retailer_activation',
     'New retailer activation',
     'Rewards a ladder of order milestones after a retailer is created.',
     -- Points live on the rungs, not on the activity, so this stays zero.
     0, false, true, 'sequential', 'auto', true,
     'fy_end', 'none', '[]'::jsonb, '{}'::jsonb)
  returning id into v_action;

  -- threshold_pct is unused by order milestones but kept populated, since the
  -- column predates them and target rungs rely on it.
  insert into public.activity_tiers
    (action_id, threshold_pct, points, sort, order_ordinal, basis, operator, threshold)
  values
    (v_action, 0, 100, 1, 1, 'order_value', '>=', 5000),
    (v_action, 0, 150, 2, 2, 'order_value', '>=', 3000);
end $$$Q468$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q469$-- Milestone basis is order value only.
--
-- A quantity basis was offered alongside it, summing order_items.quantity --
-- but quantities carry a unit, and 106 of 769 orders mix units within a single
-- order (PIECE, KG, GRAM, ML, plus casing variants of each). Summing them
-- produces "3 KG + 2 PIECE + 500 Grams = 505" and compares that to a
-- threshold, which means nothing.
--
-- Doing it properly means converting through the UoM master and its conversion
-- rules, which is a deeper piece of logic that this feature has no business
-- reaching into. Rupees add up correctly, so order value stays and quantity is
-- withdrawn until it can be designed around those rules.
--
-- No rung used it: of 17 activity_tiers rows, 4 are order_value and 13 are the
-- target/visit ladders with a null basis. Tightening the constraint is
-- therefore a no-op on data and makes the rule enforceable rather than relying
-- on the dropdown not offering it.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'activity_tiers_basis_check') then
    alter table public.activity_tiers drop constraint activity_tiers_basis_check;
  end if;

  alter table public.activity_tiers
    add constraint activity_tiers_basis_check
    check (basis is null or basis = 'order_value');
end $$$Q469$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008140000_gam_milestone_basis_value_only.sql', left($Q469$-- Milestone basis is order value only.
--
-- A quantity basis was offered alongside it, summing order_items.quantity --
-- but quantities carry a unit, and 106 of 769 orders mix units within a single
-- order (PIECE, KG, GRAM, ML, plus casing variants of each). Summing them
-- produces "3 KG + 2 PIECE + 500 Grams = 505" and compares that to a
-- threshold, which means nothing.
--
-- Doing it properly means converting through the UoM master and its conversion
-- rules, which is a deeper piece of logic that this feature has no business
-- reaching into. Rupees add up correctly, so order value stays and quantity is
-- withdrawn until it can be designed around those rules.
--
-- No rung used it: of 17 activity_tiers rows, 4 are order_value and 13 are the
-- target/visit ladders with a null basis. Tightening the constraint is
-- therefore a no-op on data and makes the rule enforceable rather than relying
-- on the dropdown not offering it.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'activity_tiers_basis_check') then
    alter table public.activity_tiers drop constraint activity_tiers_basis_check;
  end if;

  alter table public.activity_tiers
    add constraint activity_tiers_basis_check
    check (basis is null or basis = 'order_value');
end $$$Q469$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q470$comment on column public.activity_tiers.basis is
  'Order milestones only: order_value. A quantity basis is deliberately not supported — quantities carry units that would have to be converted through the UoM master first.'$Q470$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008140000_gam_milestone_basis_value_only.sql', left($Q470$comment on column public.activity_tiers.basis is
  'Order milestones only: order_value. A quantity basis is deliberately not supported — quantities carry units that would have to be converted through the UoM master first.'$Q470$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q471$-- Milestone rungs compare with "is at least", not "equals".
--
-- Two rungs were saved with operator '=', so a ₹500 threshold meant exactly
-- ₹500.00 — ₹501 failed, and so did ₹499. For a milestone threshold that is
-- never the intent.
--
-- Scoped to tier rungs only. Two exact-match rules elsewhere are deliberate
-- and are left alone:
--   "Every cash order"      payment_mode = cash   (a string equality; enabled)
--   "20 visits completed"   visit_count  = 20     (a condition, disabled)
--
-- Only rungs are touched, and only those still on '='.
update public.activity_tiers
set operator = '>='
where order_ordinal is not null
  and operator = '='$Q471$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261008160000_gam_milestone_operators_at_least.sql', left($Q471$-- Milestone rungs compare with "is at least", not "equals".
--
-- Two rungs were saved with operator '=', so a ₹500 threshold meant exactly
-- ₹500.00 — ₹501 failed, and so did ₹499. For a milestone threshold that is
-- never the intent.
--
-- Scoped to tier rungs only. Two exact-match rules elsewhere are deliberate
-- and are left alone:
--   "Every cash order"      payment_mode = cash   (a string equality; enabled)
--   "20 visits completed"   visit_count  = 20     (a condition, disabled)
--
-- Only rungs are touched, and only those still on '='.
update public.activity_tiers
set operator = '>='
where order_ordinal is not null
  and operator = '='$Q471$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q472$-- Allow a milestone to be judged on the quantity the order was taken for.
--
-- gam_milestone_met already reads order_quantity, and
-- gam_retailer_purchase_events already returns it as the SUM of the event's
-- line quantities. The only thing stopping a quantity ladder was this check,
-- which I added when I withdrew the option.
--
-- WHAT THE NUMBER MEANS. It is the plain sum of order_items.quantity for the
-- purchase event, in whatever units the lines were entered. It is NOT
-- normalised through the UoM master, and deliberately so -- the master is not
-- the place this is decided, and 1,056 of 1,439 live lines (73.4%) carry no
-- conversion_to_base to normalise with.
--
-- So the figure is exactly "how many units were ordered", which is what a rep
-- and an admin both mean by quantity. Where an event mixes units -- 81 of 386
-- events (21%) mix base-unit categories -- it adds 1 KG to 1 PIECE and gets 2.
-- That is a rough measure, not a wrong one, and it is the measure the admin
-- chose; the award panel shows the per-unit breakdown so nobody has to guess
-- what was summed.
--
-- Order value remains the default and is unaffected.
alter table public.activity_tiers drop constraint if exists activity_tiers_basis_check$Q472$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009130000_gam_milestone_basis_allow_quantity.sql', left($Q472$-- Allow a milestone to be judged on the quantity the order was taken for.
--
-- gam_milestone_met already reads order_quantity, and
-- gam_retailer_purchase_events already returns it as the SUM of the event's
-- line quantities. The only thing stopping a quantity ladder was this check,
-- which I added when I withdrew the option.
--
-- WHAT THE NUMBER MEANS. It is the plain sum of order_items.quantity for the
-- purchase event, in whatever units the lines were entered. It is NOT
-- normalised through the UoM master, and deliberately so -- the master is not
-- the place this is decided, and 1,056 of 1,439 live lines (73.4%) carry no
-- conversion_to_base to normalise with.
--
-- So the figure is exactly "how many units were ordered", which is what a rep
-- and an admin both mean by quantity. Where an event mixes units -- 81 of 386
-- events (21%) mix base-unit categories -- it adds 1 KG to 1 PIECE and gets 2.
-- That is a rough measure, not a wrong one, and it is the measure the admin
-- chose; the award panel shows the per-unit breakdown so nobody has to guess
-- what was summed.
--
-- Order value remains the default and is unaffected.
alter table public.activity_tiers drop constraint if exists activity_tiers_basis_check$Q472$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q473$alter table public.activity_tiers add constraint activity_tiers_basis_check
  check (basis is null or basis in ('order_value', 'order_quantity'))$Q473$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009130000_gam_milestone_basis_allow_quantity.sql', left($Q473$alter table public.activity_tiers add constraint activity_tiers_basis_check
  check (basis is null or basis in ('order_value', 'order_quantity'))$Q473$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q474$-- Net weight, captured on the order line at the moment the order is written.
--
-- products.net_weight_g already exists, so this adds no new product attribute
-- and touches no UoM conversion: not uom_master, not conversion_to_base, not
-- base_unit, not conversion_factor. Net weight is read as its own thing.
--
-- Snapshotted rather than joined at read time because a milestone that has
-- already been judged must not silently re-judge itself when somebody edits a
-- product's weight months later. The trigger fills it from the variant first,
-- then the product, so every order-writing path gets it -- cart, van sales,
-- counter sale -- without any of them having to know about it.
alter table public.order_items add column if not exists net_weight_g numeric$Q474$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009150000_order_items_net_weight_snapshot.sql', left($Q474$-- Net weight, captured on the order line at the moment the order is written.
--
-- products.net_weight_g already exists, so this adds no new product attribute
-- and touches no UoM conversion: not uom_master, not conversion_to_base, not
-- base_unit, not conversion_factor. Net weight is read as its own thing.
--
-- Snapshotted rather than joined at read time because a milestone that has
-- already been judged must not silently re-judge itself when somebody edits a
-- product's weight months later. The trigger fills it from the variant first,
-- then the product, so every order-writing path gets it -- cart, van sales,
-- counter sale -- without any of them having to know about it.
alter table public.order_items add column if not exists net_weight_g numeric$Q474$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q475$comment on column public.order_items.net_weight_g is
  'Net weight in grams of ONE selling unit, snapshotted from the variant or product when the line was written. Line weight = quantity * net_weight_g. Null means the product has no net weight configured, so the line cannot be weighed.'$Q475$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009150000_order_items_net_weight_snapshot.sql', left($Q475$comment on column public.order_items.net_weight_g is
  'Net weight in grams of ONE selling unit, snapshotted from the variant or product when the line was written. Line weight = quantity * net_weight_g. Null means the product has no net weight configured, so the line cannot be weighed.'$Q475$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q476$-- Backfill what the master can answer for today. Lines whose product has no
-- net weight stay null and are reported as unweighable rather than counted
-- as zero.
update public.order_items oi
set net_weight_g = w.g
from (
  select oi2.id,
         coalesce(nullif(pv.net_weight_g, 0), nullif(p.net_weight_g, 0)) as g
  from public.order_items oi2
  left join public.products p on p.id = oi2.product_id
  left join public.product_variants pv on pv.id = oi2.variant_id
) w
where w.id = oi.id and oi.net_weight_g is null and w.g is not null$Q476$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009150000_order_items_net_weight_snapshot.sql', left($Q476$-- Backfill what the master can answer for today. Lines whose product has no
-- net weight stay null and are reported as unweighable rather than counted
-- as zero.
update public.order_items oi
set net_weight_g = w.g
from (
  select oi2.id,
         coalesce(nullif(pv.net_weight_g, 0), nullif(p.net_weight_g, 0)) as g
  from public.order_items oi2
  left join public.products p on p.id = oi2.product_id
  left join public.product_variants pv on pv.id = oi2.variant_id
) w
where w.id = oi.id and oi.net_weight_g is null and w.g is not null$Q476$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q477$create function public.gam_retailer_purchase_events(p_retailer uuid)
returns table (
  ordinal integer,
  event_key text,
  first_at timestamptz,
  order_value numeric,
  order_quantity numeric,
  order_weight_kg numeric,
  unweighed_lines integer,
  weighed_lines integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with o as (
    select ord.id,
           coalesce(ord.visit_id::text, 'day:' || ord.order_date::text) as event_key,
           ord.order_date,
           ord.created_at,
           coalesce(ord.total_amount, 0)::numeric as val
    from public.orders ord
    where ord.retailer_id = p_retailer
      and coalesce(ord.status, '') not in ('cancelled', 'replaced')
      -- The remainder of a purchase already counted, not a new one.
      and coalesce(ord.is_backorder, false) = false
  ),
  li as (
    select o.event_key,
           coalesce(sum(oi.quantity), 0)::numeric as qty,
           coalesce(sum(oi.quantity * oi.net_weight_g) filter (where oi.net_weight_g is not null), 0)::numeric / 1000 as kg,
           count(*) filter (where oi.net_weight_g is null)::integer as unweighed,
           count(*) filter (where oi.net_weight_g is not null)::integer as weighed
    from o join public.order_items oi on oi.order_id = o.id
    group by o.event_key
  ),
  ev as (
    select o.event_key,
           min(o.order_date) as d,
           min(o.created_at) as first_at,
           sum(o.val) as order_value
    from o group by o.event_key
  )
  select (row_number() over (order by ev.d, ev.first_at, ev.event_key))::integer,
         ev.event_key, ev.first_at, ev.order_value,
         coalesce(li.qty, 0), coalesce(li.kg, 0),
         coalesce(li.unweighed, 0), coalesce(li.weighed, 0)
  from ev left join li on li.event_key = ev.event_key;
$function$$Q477$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009160000_gam_milestone_basis_order_weight.sql', left($Q477$create function public.gam_retailer_purchase_events(p_retailer uuid)
returns table (
  ordinal integer,
  event_key text,
  first_at timestamptz,
  order_value numeric,
  order_quantity numeric,
  order_weight_kg numeric,
  unweighed_lines integer,
  weighed_lines integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with o as (
    select ord.id,
           coalesce(ord.visit_id::text, 'day:' || ord.order_date::text) as event_key,
           ord.order_date,
           ord.created_at,
           coalesce(ord.total_amount, 0)::numeric as val
    from public.orders ord
    where ord.retailer_id = p_retailer
      and coalesce(ord.status, '') not in ('cancelled', 'replaced')
      -- The remainder of a purchase already counted, not a new one.
      and coalesce(ord.is_backorder, false) = false
  ),
  li as (
    select o.event_key,
           coalesce(sum(oi.quantity), 0)::numeric as qty,
           coalesce(sum(oi.quantity * oi.net_weight_g) filter (where oi.net_weight_g is not null), 0)::numeric / 1000 as kg,
           count(*) filter (where oi.net_weight_g is null)::integer as unweighed,
           count(*) filter (where oi.net_weight_g is not null)::integer as weighed
    from o join public.order_items oi on oi.order_id = o.id
    group by o.event_key
  ),
  ev as (
    select o.event_key,
           min(o.order_date) as d,
           min(o.created_at) as first_at,
           sum(o.val) as order_value
    from o group by o.event_key
  )
  select (row_number() over (order by ev.d, ev.first_at, ev.event_key))::integer,
         ev.event_key, ev.first_at, ev.order_value,
         coalesce(li.qty, 0), coalesce(li.kg, 0),
         coalesce(li.unweighed, 0), coalesce(li.weighed, 0)
  from ev left join li on li.event_key = ev.event_key;
$function$$Q477$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q478$revoke all on function public.gam_retailer_purchase_events(uuid) from public$Q478$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009160000_gam_milestone_basis_order_weight.sql', left($Q478$revoke all on function public.gam_retailer_purchase_events(uuid) from public$Q478$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q479$grant execute on function public.gam_retailer_purchase_events(uuid) to authenticated$Q479$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009160000_gam_milestone_basis_order_weight.sql', left($Q479$grant execute on function public.gam_retailer_purchase_events(uuid) to authenticated$Q479$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q480$-- Judge a rung on value, raw quantity, or weight in kilograms.
create or replace function public.gam_milestone_met(
  p_retailer uuid, p_ordinal integer, p_basis text, p_operator text, p_threshold numeric
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select case coalesce(p_operator, '>=')
             when '>='  then actual >= p_threshold
             when '>'   then actual >  p_threshold
             when '<='  then actual <= p_threshold
             when '<'   then actual <  p_threshold
             when '='   then actual =  p_threshold
             else false
           end
    from (
      select case coalesce(p_basis, 'order_value')
               when 'order_quantity' then e.order_quantity
               when 'order_weight'   then e.order_weight_kg
               else e.order_value
             end as actual
      from public.gam_retailer_purchase_events(p_retailer) e
      where e.ordinal = p_ordinal
    ) hit
  ), false);
$function$$Q480$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009160000_gam_milestone_basis_order_weight.sql', left($Q480$-- Judge a rung on value, raw quantity, or weight in kilograms.
create or replace function public.gam_milestone_met(
  p_retailer uuid, p_ordinal integer, p_basis text, p_operator text, p_threshold numeric
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select case coalesce(p_operator, '>=')
             when '>='  then actual >= p_threshold
             when '>'   then actual >  p_threshold
             when '<='  then actual <= p_threshold
             when '<'   then actual <  p_threshold
             when '='   then actual =  p_threshold
             else false
           end
    from (
      select case coalesce(p_basis, 'order_value')
               when 'order_quantity' then e.order_quantity
               when 'order_weight'   then e.order_weight_kg
               else e.order_value
             end as actual
      from public.gam_retailer_purchase_events(p_retailer) e
      where e.ordinal = p_ordinal
    ) hit
  ), false);
$function$$Q480$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q481$alter table public.activity_tiers drop constraint if exists activity_tiers_basis_check$Q481$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009160000_gam_milestone_basis_order_weight.sql', left($Q481$alter table public.activity_tiers drop constraint if exists activity_tiers_basis_check$Q481$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q482$alter table public.activity_tiers add constraint activity_tiers_basis_check
  check (basis is null or basis in ('order_value', 'order_quantity', 'order_weight'))$Q482$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261009160000_gam_milestone_basis_order_weight.sql', left($Q482$alter table public.activity_tiers add constraint activity_tiers_basis_check
  check (basis is null or basis in ('order_value', 'order_quantity', 'order_weight'))$Q482$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q483$-- Phase 1 of wiring van stock into the DMS: the columns the rest depends on.
-- Nothing posts yet. This migration only makes the facts recordable.
--
-- WHY distributor_id IS SNAPSHOTTED, NOT JOINED.
-- A van can be reassigned between distributors. If settling resolved the
-- distributor through vans.distributor_id at posting time, reassigning a van
-- would silently re-attribute every historical day to the new owner. The day
-- carries the distributor it belonged to when it was opened.
alter table public.van_stock add column if not exists distributor_id uuid references public.distributors(id)$Q483$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q483$-- Phase 1 of wiring van stock into the DMS: the columns the rest depends on.
-- Nothing posts yet. This migration only makes the facts recordable.
--
-- WHY distributor_id IS SNAPSHOTTED, NOT JOINED.
-- A van can be reassigned between distributors. If settling resolved the
-- distributor through vans.distributor_id at posting time, reassigning a van
-- would silently re-attribute every historical day to the new owner. The day
-- carries the distributor it belonged to when it was opened.
alter table public.van_stock add column if not exists distributor_id uuid references public.distributors(id)$Q483$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q484$comment on column public.van_stock.distributor_id is
  'The distributor whose books this van-day posts to, snapshotted from vans.distributor_id when the day was opened. Never re-derived, so reassigning a van does not rewrite history.'$Q484$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q484$comment on column public.van_stock.distributor_id is
  'The distributor whose books this van-day posts to, snapshotted from vans.distributor_id when the day was opened. Never re-derived, so reassigning a van does not rewrite history.'$Q484$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q485$update public.van_stock vs
set distributor_id = v.distributor_id
from public.vans v
where v.id = vs.van_id and vs.distributor_id is null and v.distributor_id is not null$Q485$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q485$update public.van_stock vs
set distributor_id = v.distributor_id
from public.vans v
where v.id = vs.van_id and vs.distributor_id is null and v.distributor_id is not null$Q485$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q486$-- The return split. returned_qty stays the total and remains the figure the
-- existing left_qty arithmetic uses, so nothing in the app changes meaning.
-- The two new columns say how that total divides, because good stock goes back
-- to the godown and damaged stock does not.
alter table public.van_stock_items add column if not exists returned_good_qty numeric$Q486$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q486$-- The return split. returned_qty stays the total and remains the figure the
-- existing left_qty arithmetic uses, so nothing in the app changes meaning.
-- The two new columns say how that total divides, because good stock goes back
-- to the godown and damaged stock does not.
alter table public.van_stock_items add column if not exists returned_good_qty numeric$Q486$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q487$-- The return split. returned_qty stays the total and remains the figure the
-- existing left_qty arithmetic uses, so nothing in the app changes meaning.
-- The two new columns say how that total divides, because good stock goes back
-- to the godown and damaged stock does not.
alter table public.van_stock_items add column if not exists returned_damaged_qty numeric$Q487$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q487$-- The return split. returned_qty stays the total and remains the figure the
-- existing left_qty arithmetic uses, so nothing in the app changes meaning.
-- The two new columns say how that total divides, because good stock goes back
-- to the godown and damaged stock does not.
alter table public.van_stock_items add column if not exists returned_damaged_qty numeric$Q487$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q488$comment on column public.van_stock_items.returned_good_qty is
  'Part of returned_qty that came back saleable. Null means not yet split; treat the whole of returned_qty as good.'$Q488$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q488$comment on column public.van_stock_items.returned_good_qty is
  'Part of returned_qty that came back saleable. Null means not yet split; treat the whole of returned_qty as good.'$Q488$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q489$comment on column public.van_stock_items.returned_damaged_qty is
  'Part of returned_qty that came back damaged. Null means none.'$Q489$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q489$comment on column public.van_stock_items.returned_damaged_qty is
  'Part of returned_qty that came back damaged. Null means none.'$Q489$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q490$-- The physical count at close.
--
-- left_qty is DERIVED (start - ordered + returned) and is never typed, so the
-- numbers balance by construction and shrinkage cannot appear. counted_qty is
-- what the rep actually finds on the van. The difference between the two is the
-- variance, and it is the only reason any of this is worth building.
alter table public.van_stock_items add column if not exists counted_qty numeric$Q490$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q490$-- The physical count at close.
--
-- left_qty is DERIVED (start - ordered + returned) and is never typed, so the
-- numbers balance by construction and shrinkage cannot appear. counted_qty is
-- what the rep actually finds on the van. The difference between the two is the
-- variance, and it is the only reason any of this is worth building.
alter table public.van_stock_items add column if not exists counted_qty numeric$Q490$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q491$comment on column public.van_stock_items.counted_qty is
  'Physically counted quantity at day close. Kept separate from the derived left_qty so the variance between expected and actual stays visible.'$Q491$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q491$comment on column public.van_stock_items.counted_qty is
  'Physically counted quantity at day close. Kept separate from the derived left_qty so the variance between expected and actual stays visible.'$Q491$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q492$alter table public.van_stock add column if not exists variance_reason text$Q492$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q492$alter table public.van_stock add column if not exists variance_reason text$Q492$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q493$comment on column public.van_stock.variance_reason is
  'Why the counted stock differs from the expected stock. Required before a day with a non-zero variance can be verified.'$Q493$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q493$comment on column public.van_stock.variance_reason is
  'Why the counted stock differs from the expected stock. Required before a day with a non-zero variance can be verified.'$Q493$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q494$-- The DMS side: one bucket, in the same spirit as reserved/damaged/expired.
--
--   owned = quantity + reserved_quantity + on_van_quantity
--         + damaged_quantity + expired_quantity
--
-- Stock on a van is still the distributor's. Loading it moves it between
-- buckets and must leave the total alone.
alter table public.distributor_inventory add column if not exists on_van_quantity numeric not null default 0$Q494$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q494$-- The DMS side: one bucket, in the same spirit as reserved/damaged/expired.
--
--   owned = quantity + reserved_quantity + on_van_quantity
--         + damaged_quantity + expired_quantity
--
-- Stock on a van is still the distributor's. Loading it moves it between
-- buckets and must leave the total alone.
alter table public.distributor_inventory add column if not exists on_van_quantity numeric not null default 0$Q494$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q495$comment on column public.distributor_inventory.on_van_quantity is
  'Stock issued to a van and not yet sold, returned or written off. Owned stock, not sellable from the godown. Maintained only by dms_settle_van_day.'$Q495$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013100000_van_dms_phase1_schema.sql', left($Q495$comment on column public.distributor_inventory.on_van_quantity is
  'Stock issued to a van and not yet sold, returned or written off. Owned stock, not sellable from the godown. Maintained only by dms_settle_van_day.'$Q495$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q496$alter table public.van_day_postings enable row level security$Q496$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013110000_van_dms_phase2_settle.sql', left($Q496$alter table public.van_day_postings enable row level security$Q496$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q497$-- Van reconciliation for the distributor portal.
--
-- A SECURITY DEFINER function rather than a view, because van_stock is not
-- readable by a distributor user: its policies cover admins, managers and the
-- rep who owns the day. The distributor needs to see the days that affect
-- THEIR books without being handed the whole van module, so the authorisation
-- here mirrors the one on distributor_inventory exactly -- an active row in
-- distributor_users, an admin, or a parent distributor.
--
-- The parent case is deliberate and matches the existing "Parent distributors
-- can view child inventory" policy; a parent that can already see the child's
-- stock would gain nothing from being blind to how it moved.
--
-- This is the screen that makes Option B2 safe to run. The van and the DMS are
-- two systems holding one truth, so they can disagree; somebody has to be shown
-- when they do, and which days have not posted at all.
create or replace function public.dms_van_reconciliation(
  p_distributor uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  van_stock_id uuid,
  stock_date date,
  van_id uuid,
  van_registration text,
  rep_name text,
  status text,
  loaded numeric,
  sold numeric,
  returned_good numeric,
  returned_damaged numeric,
  counted numeric,
  expected numeric,
  variance numeric,
  variance_reason text,
  lines integer,
  lines_counted integer,
  settled_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    vs.id,
    vs.stock_date,
    vs.van_id,
    v.registration_number,
    p.full_name,
    vs.status,
    coalesce(sum(i.start_qty), 0),
    coalesce(sum(i.ordered_qty), 0),
    coalesce(sum(coalesce(i.returned_good_qty, i.returned_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_damaged_qty, 0)), 0),
    sum(i.counted_qty),
    coalesce(sum(coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)), 0),
    -- Only lines that were actually counted contribute a variance. A day with
    -- no counts shows null rather than a confident zero, because "nobody
    -- looked" and "it balanced" are not the same thing.
    sum(i.counted_qty - (coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)))
      filter (where i.counted_qty is not null),
    vs.variance_reason,
    count(i.id)::integer,
    count(i.counted_qty)::integer,
    max(dp.last_settled_at)
  from public.van_stock vs
  join public.vans v on v.id = vs.van_id
  left join public.profiles p on p.id = vs.user_id
  left join public.van_stock_items i on i.van_stock_id = vs.id
  left join public.van_day_postings dp on dp.van_stock_id = vs.id
  where vs.distributor_id = p_distributor
    and (p_from is null or vs.stock_date >= p_from)
    and (p_to   is null or vs.stock_date <= p_to)
    and (
      exists (
        select 1 from public.distributor_users du
        where du.auth_user_id = auth.uid()
          and du.distributor_id = p_distributor
          and du.is_active = true
      )
      or public.has_role(auth.uid(), 'admin'::app_role)
      or public.is_system_admin(auth.uid())
      or public.can_view_distributor(p_distributor)
    )
  group by vs.id, vs.stock_date, vs.van_id, v.registration_number, p.full_name,
           vs.status, vs.variance_reason
  order by vs.stock_date desc, v.registration_number;
$function$$Q497$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013120000_dms_van_reconciliation.sql', left($Q497$-- Van reconciliation for the distributor portal.
--
-- A SECURITY DEFINER function rather than a view, because van_stock is not
-- readable by a distributor user: its policies cover admins, managers and the
-- rep who owns the day. The distributor needs to see the days that affect
-- THEIR books without being handed the whole van module, so the authorisation
-- here mirrors the one on distributor_inventory exactly -- an active row in
-- distributor_users, an admin, or a parent distributor.
--
-- The parent case is deliberate and matches the existing "Parent distributors
-- can view child inventory" policy; a parent that can already see the child's
-- stock would gain nothing from being blind to how it moved.
--
-- This is the screen that makes Option B2 safe to run. The van and the DMS are
-- two systems holding one truth, so they can disagree; somebody has to be shown
-- when they do, and which days have not posted at all.
create or replace function public.dms_van_reconciliation(
  p_distributor uuid,
  p_from date default null,
  p_to date default null
)
returns table (
  van_stock_id uuid,
  stock_date date,
  van_id uuid,
  van_registration text,
  rep_name text,
  status text,
  loaded numeric,
  sold numeric,
  returned_good numeric,
  returned_damaged numeric,
  counted numeric,
  expected numeric,
  variance numeric,
  variance_reason text,
  lines integer,
  lines_counted integer,
  settled_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    vs.id,
    vs.stock_date,
    vs.van_id,
    v.registration_number,
    p.full_name,
    vs.status,
    coalesce(sum(i.start_qty), 0),
    coalesce(sum(i.ordered_qty), 0),
    coalesce(sum(coalesce(i.returned_good_qty, i.returned_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_damaged_qty, 0)), 0),
    sum(i.counted_qty),
    coalesce(sum(coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)), 0),
    -- Only lines that were actually counted contribute a variance. A day with
    -- no counts shows null rather than a confident zero, because "nobody
    -- looked" and "it balanced" are not the same thing.
    sum(i.counted_qty - (coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)))
      filter (where i.counted_qty is not null),
    vs.variance_reason,
    count(i.id)::integer,
    count(i.counted_qty)::integer,
    max(dp.last_settled_at)
  from public.van_stock vs
  join public.vans v on v.id = vs.van_id
  left join public.profiles p on p.id = vs.user_id
  left join public.van_stock_items i on i.van_stock_id = vs.id
  left join public.van_day_postings dp on dp.van_stock_id = vs.id
  where vs.distributor_id = p_distributor
    and (p_from is null or vs.stock_date >= p_from)
    and (p_to   is null or vs.stock_date <= p_to)
    and (
      exists (
        select 1 from public.distributor_users du
        where du.auth_user_id = auth.uid()
          and du.distributor_id = p_distributor
          and du.is_active = true
      )
      or public.has_role(auth.uid(), 'admin'::app_role)
      or public.is_system_admin(auth.uid())
      or public.can_view_distributor(p_distributor)
    )
  group by vs.id, vs.stock_date, vs.van_id, v.registration_number, p.full_name,
           vs.status, vs.variance_reason
  order by vs.stock_date desc, v.registration_number;
$function$$Q497$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q498$revoke all on function public.dms_van_reconciliation(uuid, date, date) from public$Q498$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013120000_dms_van_reconciliation.sql', left($Q498$revoke all on function public.dms_van_reconciliation(uuid, date, date) from public$Q498$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q499$grant execute on function public.dms_van_reconciliation(uuid, date, date) to authenticated$Q499$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013120000_dms_van_reconciliation.sql', left($Q499$grant execute on function public.dms_van_reconciliation(uuid, date, date) to authenticated$Q499$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q500$-- Which warehouse a van loaded from.
--
-- Without this, settling found the inventory row by distributor and product and
-- took LIMIT 1. That is unambiguous only while no product sits in two
-- warehouses -- true today, but one distributor already has two warehouses, so
-- it was a matter of time before stock was deducted from an arbitrary one.
--
-- Snapshotted on the day like distributor_id, for the same reason: a warehouse
-- renamed or a van reassigned later must not move where yesterday's stock came
-- from.
alter table public.van_stock add column if not exists warehouse_id uuid references public.warehouses(id)$Q500$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013130000_van_stock_source_warehouse.sql', left($Q500$-- Which warehouse a van loaded from.
--
-- Without this, settling found the inventory row by distributor and product and
-- took LIMIT 1. That is unambiguous only while no product sits in two
-- warehouses -- true today, but one distributor already has two warehouses, so
-- it was a matter of time before stock was deducted from an arbitrary one.
--
-- Snapshotted on the day like distributor_id, for the same reason: a warehouse
-- renamed or a van reassigned later must not move where yesterday's stock came
-- from.
alter table public.van_stock add column if not exists warehouse_id uuid references public.warehouses(id)$Q500$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q501$comment on column public.van_stock.warehouse_id is
  'The warehouse this van loaded from. Settling deducts from this warehouse specifically; when null it falls back to the distributor''s default warehouse.'$Q501$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261013130000_van_stock_source_warehouse.sql', left($Q501$comment on column public.van_stock.warehouse_id is
  'The warehouse this van loaded from. Settling deducts from this warehouse specifically; when null it falls back to the distributor''s default warehouse.'$Q501$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q502$-- vans.distributor_id had no foreign key.
--
-- Two consequences, one of which was reported from the field: PostgREST can
-- only embed a related row across a foreign key, so selecting
-- distributors(id, name) from vans failed outright, and the screen concluded a
-- van had no distributor when it plainly did. The other is the ordinary one --
-- nothing stopped the column holding an id no distributor has.
--
-- van_stock.distributor_id, added days ago, does have this constraint. The
-- column it is copied from did not, which is the sort of asymmetry that only
-- shows up when something tries to follow the relationship.
--
-- ON DELETE RESTRICT rather than CASCADE or SET NULL: a distributor with vans
-- attached should not be deletable in passing, and silently orphaning a van
-- from its distributor would detach every future day from the books it belongs
-- to.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vans'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%distributors%'
  ) then
    -- Any value that does not point at a real distributor is cleared first,
    -- so the constraint can be added without rejecting existing rows.
    update public.vans v
    set distributor_id = null
    where v.distributor_id is not null
      and not exists (select 1 from public.distributors d where d.id = v.distributor_id);

    alter table public.vans
      add constraint vans_distributor_id_fkey
      foreign key (distributor_id) references public.distributors(id)
      on delete restrict;
  end if;
end $$$Q502$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261014100000_vans_distributor_foreign_key.sql', left($Q502$-- vans.distributor_id had no foreign key.
--
-- Two consequences, one of which was reported from the field: PostgREST can
-- only embed a related row across a foreign key, so selecting
-- distributors(id, name) from vans failed outright, and the screen concluded a
-- van had no distributor when it plainly did. The other is the ordinary one --
-- nothing stopped the column holding an id no distributor has.
--
-- van_stock.distributor_id, added days ago, does have this constraint. The
-- column it is copied from did not, which is the sort of asymmetry that only
-- shows up when something tries to follow the relationship.
--
-- ON DELETE RESTRICT rather than CASCADE or SET NULL: a distributor with vans
-- attached should not be deletable in passing, and silently orphaning a van
-- from its distributor would detach every future day from the books it belongs
-- to.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vans'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%distributors%'
  ) then
    -- Any value that does not point at a real distributor is cleared first,
    -- so the constraint can be added without rejecting existing rows.
    update public.vans v
    set distributor_id = null
    where v.distributor_id is not null
      and not exists (select 1 from public.distributors d where d.id = v.distributor_id);

    alter table public.vans
      add constraint vans_distributor_id_fkey
      foreign key (distributor_id) references public.distributors(id)
      on delete restrict;
  end if;
end $$$Q502$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q503$-- Archiving: the answer to "delete it completely, but keep the history".
--
-- A distributor cannot actually be deleted once it has traded. 38 foreign keys
-- point at it — 16 that refuse the delete and 22 that would destroy inventory,
-- ledgers, payments and warehouses to allow it. The row itself is a name and a
-- few contact fields; it is the only thing making all of that history readable,
-- and removing it would cost far more than it saves.
--
-- So the row stays and stops being visible. Archived distributors drop out of
-- every list, count and picker, and every record naming them still makes sense.
-- Reversible, because nothing was destroyed.

alter table public.distributors add column if not exists archived_at timestamptz$Q503$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261015130000_archive_distributors.sql', left($Q503$-- Archiving: the answer to "delete it completely, but keep the history".
--
-- A distributor cannot actually be deleted once it has traded. 38 foreign keys
-- point at it — 16 that refuse the delete and 22 that would destroy inventory,
-- ledgers, payments and warehouses to allow it. The row itself is a name and a
-- few contact fields; it is the only thing making all of that history readable,
-- and removing it would cost far more than it saves.
--
-- So the row stays and stops being visible. Archived distributors drop out of
-- every list, count and picker, and every record naming them still makes sense.
-- Reversible, because nothing was destroyed.

alter table public.distributors add column if not exists archived_at timestamptz$Q503$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q504$alter table public.distributors add column if not exists archived_by uuid$Q504$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261015130000_archive_distributors.sql', left($Q504$alter table public.distributors add column if not exists archived_by uuid$Q504$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q505$comment on column public.distributors.archived_at is
  'When this distributor was archived. Non-null means it is hidden from every list, count and picker, while all of its history stays intact and attributable. Not a delete: see archive_distributor().'$Q505$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261015130000_archive_distributors.sql', left($Q505$comment on column public.distributors.archived_at is
  'When this distributor was archived. Non-null means it is hidden from every list, count and picker, while all of its history stays intact and attributable. Not a delete: see archive_distributor().'$Q505$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q506$-- Archived rows are the exception, so the index covers the common case of
-- "everything still live".
create index if not exists distributors_live_idx on public.distributors (id) where archived_at is null$Q506$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261015130000_archive_distributors.sql', left($Q506$-- Archived rows are the exception, so the index covers the common case of
-- "everything still live".
create index if not exists distributors_live_idx on public.distributors (id) where archived_at is null$Q506$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q507$-- An archived company is not the company.
--
-- get_oem_distributor_id() took the oldest OEM, which was fine while there was
-- one. There are now two: a live "KVP Business Solutions COMPANY" and an
-- archived "KVP Business Solutions Pvt. Ltd." created earlier — so the function
-- was returning the archived one, and anything routed "to the company" would
-- have gone to a record deliberately taken out of the network.
--
-- My own omission: archiving was added without teaching this to ignore it.
--
-- Archived rows are skipped outright rather than merely ranked last. If every
-- OEM is archived the answer is nothing, which a caller can check, instead of a
-- confident pointer at a record nobody meant to use.
create or replace function public.get_oem_distributor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $function$
  select d.id
  from public.distributors d
  join public.distributor_types t on t.id = d.type_id
  where t.code = 'OEM'
    and d.archived_at is null
  order by d.created_at
  limit 1;
$function$$Q507$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261015150000_oem_lookup_skips_archived.sql', left($Q507$-- An archived company is not the company.
--
-- get_oem_distributor_id() took the oldest OEM, which was fine while there was
-- one. There are now two: a live "KVP Business Solutions COMPANY" and an
-- archived "KVP Business Solutions Pvt. Ltd." created earlier — so the function
-- was returning the archived one, and anything routed "to the company" would
-- have gone to a record deliberately taken out of the network.
--
-- My own omission: archiving was added without teaching this to ignore it.
--
-- Archived rows are skipped outright rather than merely ranked last. If every
-- OEM is archived the answer is nothing, which a caller can check, instead of a
-- confident pointer at a record nobody meant to use.
create or replace function public.get_oem_distributor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $function$
  select d.id
  from public.distributors d
  join public.distributor_types t on t.id = d.type_id
  where t.code = 'OEM'
    and d.archived_at is null
  order by d.created_at
  limit 1;
$function$$Q507$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q508$update public.distributor_inventory
   set quantity          = quantity * 30,
       reserved_quantity = coalesce(reserved_quantity, 0) * 30,
       damaged_quantity  = coalesce(damaged_quantity, 0) * 30,
       expired_quantity  = coalesce(expired_quantity, 0) * 30,
       on_van_quantity   = coalesce(on_van_quantity, 0) * 30,
       unit = 'GRAM',
       updated_at = now()
 where product_id = '3edadb83-fea6-4650-b110-2a99ee407661'
   and upper(trim(unit)) = 'PIECE'$Q508$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261016065750_fix_vayu_30g_merge_unit_direction.sql', left($Q508$update public.distributor_inventory
   set quantity          = quantity * 30,
       reserved_quantity = coalesce(reserved_quantity, 0) * 30,
       damaged_quantity  = coalesce(damaged_quantity, 0) * 30,
       expired_quantity  = coalesce(expired_quantity, 0) * 30,
       on_van_quantity   = coalesce(on_van_quantity, 0) * 30,
       unit = 'GRAM',
       updated_at = now()
 where product_id = '3edadb83-fea6-4650-b110-2a99ee407661'
   and upper(trim(unit)) = 'PIECE'$Q508$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q509$-- Stage 1 of the running_balance repair: stop new rows being computed wrongly.
-- No historical balance is rewritten here.
--
-- Of 104 ledger streams, 35 disagreed with actual stock and 31 had gone
-- negative. calc_transaction_balance had three separate faults:
--
--   1. Its inward list was ('GRN','OPENING_STOCK','RETURN','ADJUSTMENT_IN',
--      'RELEASE'). The data also contains 'inward' (the GRN path writes
--      lowercase), 'UOM_CORRECTION', 'PRODUCT_MERGE' and NULL — 52 rows, all
--      inward in reality, every one of them subtracted. That alone explains
--      the 13 streams sitting at exactly minus their true quantity.
--
--   2. RESERVE, RELEASE, MARK_DAMAGED and MARK_EXPIRED move stock between
--      buckets; the total does not change. They were added or subtracted
--      anyway, so every reservation permanently skewed the balance.
--
--   3. "Previous row" was found with `order by created_at desc, id desc`.
--      Rows written in one transaction share a timestamp to the microsecond,
--      so the tiebreak fell to a random uuid. Four movements inserted in a
--      known order came back out of order in testing.
--
-- Fault 3 cannot be fixed by ordering alone — there was nothing stable to
-- order by — so this adds a sequence. Column defaults are evaluated before
-- BEFORE INSERT triggers fire, so NEW.seq is already populated when the
-- trigger reads it.
--
-- Deriving the balance from distributor_inventory instead would be tidier,
-- but dispatch_batch_stock and dispatch_packing_list_atomic write ledger rows
-- without updating distributor_inventory at all, so that figure cannot be
-- trusted as the post-movement total for every writer.

alter table public.distributor_inventory_transactions add column if not exists seq bigserial$Q509$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261020110000_ledger_running_balance_stage1.sql', left($Q509$-- Stage 1 of the running_balance repair: stop new rows being computed wrongly.
-- No historical balance is rewritten here.
--
-- Of 104 ledger streams, 35 disagreed with actual stock and 31 had gone
-- negative. calc_transaction_balance had three separate faults:
--
--   1. Its inward list was ('GRN','OPENING_STOCK','RETURN','ADJUSTMENT_IN',
--      'RELEASE'). The data also contains 'inward' (the GRN path writes
--      lowercase), 'UOM_CORRECTION', 'PRODUCT_MERGE' and NULL — 52 rows, all
--      inward in reality, every one of them subtracted. That alone explains
--      the 13 streams sitting at exactly minus their true quantity.
--
--   2. RESERVE, RELEASE, MARK_DAMAGED and MARK_EXPIRED move stock between
--      buckets; the total does not change. They were added or subtracted
--      anyway, so every reservation permanently skewed the balance.
--
--   3. "Previous row" was found with `order by created_at desc, id desc`.
--      Rows written in one transaction share a timestamp to the microsecond,
--      so the tiebreak fell to a random uuid. Four movements inserted in a
--      known order came back out of order in testing.
--
-- Fault 3 cannot be fixed by ordering alone — there was nothing stable to
-- order by — so this adds a sequence. Column defaults are evaluated before
-- BEFORE INSERT triggers fire, so NEW.seq is already populated when the
-- trigger reads it.
--
-- Deriving the balance from distributor_inventory instead would be tidier,
-- but dispatch_batch_stock and dispatch_packing_list_atomic write ledger rows
-- without updating distributor_inventory at all, so that figure cannot be
-- trusted as the post-movement total for every writer.

alter table public.distributor_inventory_transactions add column if not exists seq bigserial$Q509$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q510$create index if not exists idx_dit_stream_seq
  on public.distributor_inventory_transactions (distributor_id, product_id, warehouse_id, seq)$Q510$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261020110000_ledger_running_balance_stage1.sql', left($Q510$create index if not exists idx_dit_stream_seq
  on public.distributor_inventory_transactions (distributor_id, product_id, warehouse_id, seq)$Q510$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q511$-- Retrying a stock movement applied it again. The in-flight button guard stops
-- a double click, but not a retry after a timeout, a refresh mid-request, or an
-- offline replay — and a return verified twice credited the stock twice.
--
-- A caller now passes a key that identifies the movement rather than the
-- attempt. The same key twice moves stock once.
--
-- Note on the unique index: an earlier reading of mine said two existing
-- duplicate groups blocked this. They block an index over
-- (reference_type, reference_id, product_id); they do not block a dedicated
-- key column, because Postgres permits unlimited NULLs in a unique index and
-- every existing row has none.

alter table public.distributor_inventory_transactions add column if not exists idempotency_key text$Q511$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261020120000_inventory_movement_idempotency.sql', left($Q511$-- Retrying a stock movement applied it again. The in-flight button guard stops
-- a double click, but not a retry after a timeout, a refresh mid-request, or an
-- offline replay — and a return verified twice credited the stock twice.
--
-- A caller now passes a key that identifies the movement rather than the
-- attempt. The same key twice moves stock once.
--
-- Note on the unique index: an earlier reading of mine said two existing
-- duplicate groups blocked this. They block an index over
-- (reference_type, reference_id, product_id); they do not block a dedicated
-- key column, because Postgres permits unlimited NULLs in a unique index and
-- every existing row has none.

alter table public.distributor_inventory_transactions add column if not exists idempotency_key text$Q511$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q512$create unique index if not exists idx_dit_idempotency_key
  on public.distributor_inventory_transactions (idempotency_key)
  where idempotency_key is not null$Q512$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261020120000_inventory_movement_idempotency.sql', left($Q512$create unique index if not exists idx_dit_idempotency_key
  on public.distributor_inventory_transactions (idempotency_key)
  where idempotency_key is not null$Q512$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q513$ALTER TABLE public.ai_pitch_feedback ENABLE ROW LEVEL SECURITY$Q513$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261022044324_f7c6f337-1668-4a50-99cc-9303386abe6e.sql', left($Q513$ALTER TABLE public.ai_pitch_feedback ENABLE ROW LEVEL SECURITY$Q513$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q514$alter table public.van_settlement_log enable row level security$Q514$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261022100000_van_stock_auto_settle.sql', left($Q514$alter table public.van_settlement_log enable row level security$Q514$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q515$-- Rebuild: replay every stream in seq order.
with replay as (
  select id,
         sum(public.ledger_movement(transaction_type, balance_qty, notes))
           over (partition by distributor_id, product_id, coalesce(warehouse_id::text, '')
                 order by seq) as rb
  from public.distributor_inventory_transactions
)
update public.distributor_inventory_transactions t
set running_balance = r.rb
from replay r
where r.id = t.id
  and t.running_balance is distinct from r.rb$Q515$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261022110000_ledger_running_balance_rebuild.sql', left($Q515$-- Rebuild: replay every stream in seq order.
with replay as (
  select id,
         sum(public.ledger_movement(transaction_type, balance_qty, notes))
           over (partition by distributor_id, product_id, coalesce(warehouse_id::text, '')
                 order by seq) as rb
  from public.distributor_inventory_transactions
)
update public.distributor_inventory_transactions t
set running_balance = r.rb
from replay r
where r.id = t.id
  and t.running_balance is distinct from r.rb$Q515$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q516$ALTER TABLE public.ai_pitch_feedback ADD COLUMN IF NOT EXISTS reason text$Q516$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261023114328_6ad72528-8ec8-4507-b0c8-a07dacc928ee.sql', left($Q516$ALTER TABLE public.ai_pitch_feedback ADD COLUMN IF NOT EXISTS reason text$Q516$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q517$-- Expiry survives the journey from a retailer's counter to the warehouse books.
--
-- A rep records a return in Order Entry and picks a reason: Damaged, Expired,
-- Wrong Product, Quality Issue, Excess Stock, Customer Return, Other. At close
-- of day the goods physically on the van are split between what is sellable
-- and what is not, and van_stock_items had only two buckets for that split:
-- returned_good_qty and returned_damaged_qty. An expired return had nowhere to
-- go, so the rep had to enter it as damaged, and distributor_inventory's
-- expired_quantity column was never written by a van at all. The totals still
-- came out right -- available stock was correct either way -- but the books
-- said breakage where the truth was slow rotation, and those two facts lead to
-- different conversations with different people.
--
-- Three columns, one per place the figure has to survive:
--
--   van_stock_items.returned_expired_qty  what the rep counted as expired
--   van_day_postings.expired_posted       what settlement has already posted,
--                                         so it stays delta-based and settling
--                                         the same day twice writes nothing
--   van_settlement_log.expired_delta      so a refusal that is only about
--                                         expired stock still records a figure
--
-- Every existing row reads 0, which is the truthful value rather than a
-- convenient one: nothing has ever been posted to expired_quantity by a van.
-- So the first settlement of a day that is still open posts the full amount,
-- and a day already closed has a delta of zero and does not move. Nothing is
-- backfilled and no historical figure is rewritten.
--
-- The two quantity columns are NOT NULL DEFAULT 0 rather than nullable like
-- their older siblings. Settlement coalesces either way, but a bucket that
-- cannot be null is one fewer thing to reason about at every read site.
-- van_settlement_log.expired_delta stays nullable to match its own siblings,
-- which are left null on refusals that have no figure to report.

alter table public.van_stock_items add column if not exists returned_expired_qty numeric not null default 0$Q517$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100000_van_stock_expired_bucket.sql', left($Q517$-- Expiry survives the journey from a retailer's counter to the warehouse books.
--
-- A rep records a return in Order Entry and picks a reason: Damaged, Expired,
-- Wrong Product, Quality Issue, Excess Stock, Customer Return, Other. At close
-- of day the goods physically on the van are split between what is sellable
-- and what is not, and van_stock_items had only two buckets for that split:
-- returned_good_qty and returned_damaged_qty. An expired return had nowhere to
-- go, so the rep had to enter it as damaged, and distributor_inventory's
-- expired_quantity column was never written by a van at all. The totals still
-- came out right -- available stock was correct either way -- but the books
-- said breakage where the truth was slow rotation, and those two facts lead to
-- different conversations with different people.
--
-- Three columns, one per place the figure has to survive:
--
--   van_stock_items.returned_expired_qty  what the rep counted as expired
--   van_day_postings.expired_posted       what settlement has already posted,
--                                         so it stays delta-based and settling
--                                         the same day twice writes nothing
--   van_settlement_log.expired_delta      so a refusal that is only about
--                                         expired stock still records a figure
--
-- Every existing row reads 0, which is the truthful value rather than a
-- convenient one: nothing has ever been posted to expired_quantity by a van.
-- So the first settlement of a day that is still open posts the full amount,
-- and a day already closed has a delta of zero and does not move. Nothing is
-- backfilled and no historical figure is rewritten.
--
-- The two quantity columns are NOT NULL DEFAULT 0 rather than nullable like
-- their older siblings. Settlement coalesces either way, but a bucket that
-- cannot be null is one fewer thing to reason about at every read site.
-- van_settlement_log.expired_delta stays nullable to match its own siblings,
-- which are left null on refusals that have no figure to report.

alter table public.van_stock_items add column if not exists returned_expired_qty numeric not null default 0$Q517$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q518$alter table public.van_day_postings add column if not exists expired_posted numeric not null default 0$Q518$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100000_van_stock_expired_bucket.sql', left($Q518$alter table public.van_day_postings add column if not exists expired_posted numeric not null default 0$Q518$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q519$alter table public.van_settlement_log add column if not exists expired_delta numeric$Q519$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100000_van_stock_expired_bucket.sql', left($Q519$alter table public.van_settlement_log add column if not exists expired_delta numeric$Q519$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q520$comment on column public.van_stock_items.returned_expired_qty is
  'Of the goods physically on the van at close, how much is past its expiry date. Counted by the rep, pre-filled from the day''s credit note reasons. Settles to distributor_inventory.expired_quantity.'$Q520$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100000_van_stock_expired_bucket.sql', left($Q520$comment on column public.van_stock_items.returned_expired_qty is
  'Of the goods physically on the van at close, how much is past its expiry date. Counted by the rep, pre-filled from the day''s credit note reasons. Settles to distributor_inventory.expired_quantity.'$Q520$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q521$comment on column public.van_day_postings.expired_posted is
  'What dms_settle_van_day has already posted to distributor_inventory.expired_quantity for this van day and product. The difference between this and the day''s current figure is what the next settle writes.'$Q521$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100000_van_stock_expired_bucket.sql', left($Q521$comment on column public.van_day_postings.expired_posted is
  'What dms_settle_van_day has already posted to distributor_inventory.expired_quantity for this van day and product. The difference between this and the day''s current figure is what the next settle writes.'$Q521$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q522$-- A return line remembers why it came back.
--
-- The return form in Order Entry collects a reason per line -- Damaged,
-- Expired, Wrong Product, Quality Issue, Excess Stock, Customer Return, Other
-- -- because one retailer can hand back two things for two different reasons in
-- the same visit. None of that detail survived the trip to the database.
-- finalize_credit_note takes a single p_reason for the whole note, so the
-- client collapsed the lines to a dominant value before calling it, and when
-- the lines disagreed it sent the literal string 'Mixed', which is not in the
-- client's reason map and therefore arrived as plain 'other'. The real reasons
-- survived only inside reason_notes, as a human sentence nothing reads.
--
-- The cost showed up at close of day. The rep had already told the system that
-- 300 g was damaged and 100 g expired; hours later the Closing GRN asked for
-- that same split again, from memory, with nothing to check it against.
--
-- Two changes, both additive:
--
--   credit_note_items.reason   the per-line reason, nullable
--   finalize_credit_note       writes each line's own reason, falling back to
--                              p_reason when a caller does not send one
--
-- The header's p_reason and credit_notes.reason are untouched. They still mean
-- what they meant, every existing caller keeps working, and a caller that sends
-- no per-line reason behaves exactly as it does today -- which is what makes
-- this safe to deploy before the client that uses it.
--
-- Existing credit_note_items rows get reason NULL. They are not backfilled:
-- the per-line reasons they were created with were never recorded, so any value
-- written now would be a guess dressed as a fact. A null reason is read as
-- 'good' by the closing pre-fill, which is exactly how those notes behave
-- today.
--
-- van_return_grn_items.return_reason already existed and was already per-line
-- in shape -- it was simply handed the header value for every row. It now gets
-- the line's own reason, and disposition is derived from that same per-line
-- value rather than from the note's dominant one. So a visit returning good
-- stock and damaged stock together no longer scraps both or restocks both.
--
-- CREATE OR REPLACE, not DROP: the signature is unchanged, so the function's
-- grants survive untouched (execute to PUBLIC, as it was).

alter table public.credit_note_items add column if not exists reason text$Q522$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100200_credit_note_line_reason.sql', left($Q522$-- A return line remembers why it came back.
--
-- The return form in Order Entry collects a reason per line -- Damaged,
-- Expired, Wrong Product, Quality Issue, Excess Stock, Customer Return, Other
-- -- because one retailer can hand back two things for two different reasons in
-- the same visit. None of that detail survived the trip to the database.
-- finalize_credit_note takes a single p_reason for the whole note, so the
-- client collapsed the lines to a dominant value before calling it, and when
-- the lines disagreed it sent the literal string 'Mixed', which is not in the
-- client's reason map and therefore arrived as plain 'other'. The real reasons
-- survived only inside reason_notes, as a human sentence nothing reads.
--
-- The cost showed up at close of day. The rep had already told the system that
-- 300 g was damaged and 100 g expired; hours later the Closing GRN asked for
-- that same split again, from memory, with nothing to check it against.
--
-- Two changes, both additive:
--
--   credit_note_items.reason   the per-line reason, nullable
--   finalize_credit_note       writes each line's own reason, falling back to
--                              p_reason when a caller does not send one
--
-- The header's p_reason and credit_notes.reason are untouched. They still mean
-- what they meant, every existing caller keeps working, and a caller that sends
-- no per-line reason behaves exactly as it does today -- which is what makes
-- this safe to deploy before the client that uses it.
--
-- Existing credit_note_items rows get reason NULL. They are not backfilled:
-- the per-line reasons they were created with were never recorded, so any value
-- written now would be a guess dressed as a fact. A null reason is read as
-- 'good' by the closing pre-fill, which is exactly how those notes behave
-- today.
--
-- van_return_grn_items.return_reason already existed and was already per-line
-- in shape -- it was simply handed the header value for every row. It now gets
-- the line's own reason, and disposition is derived from that same per-line
-- value rather than from the note's dominant one. So a visit returning good
-- stock and damaged stock together no longer scraps both or restocks both.
--
-- CREATE OR REPLACE, not DROP: the signature is unchanged, so the function's
-- grants survive untouched (execute to PUBLIC, as it was).

alter table public.credit_note_items add column if not exists reason text$Q522$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q523$comment on column public.credit_note_items.reason is
  'Why this line was returned: damaged, expired, quality_issue, unsold_stock or other. Null on notes created before the column existed. The note''s own credit_notes.reason stays the header-level summary.'$Q523$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100200_credit_note_line_reason.sql', left($Q523$comment on column public.credit_note_items.reason is
  'Why this line was returned: damaged, expired, quality_issue, unsold_stock or other. Null on notes created before the column existed. The note''s own credit_notes.reason stays the header-level summary.'$Q523$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q524$create or replace function public.dms_van_reconciliation(
  p_distributor uuid,
  p_from date default null::date,
  p_to date default null::date
)
returns table(
  van_stock_id uuid,
  stock_date date,
  van_id uuid,
  van_registration text,
  rep_name text,
  status text,
  loaded numeric,
  sold numeric,
  returned_good numeric,
  returned_damaged numeric,
  returned_expired numeric,
  counted numeric,
  expected numeric,
  variance numeric,
  variance_reason text,
  lines integer,
  lines_counted integer,
  settled_at timestamp with time zone
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    vs.id,
    vs.stock_date,
    vs.van_id,
    v.registration_number,
    p.full_name,
    vs.status,
    coalesce(sum(i.start_qty), 0),
    coalesce(sum(i.ordered_qty), 0),
    -- Falls back to returned_qty so a day recorded before the closing split
    -- existed still shows what came back. Display only; see the variance below.
    coalesce(sum(coalesce(i.returned_good_qty, i.returned_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_damaged_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_expired_qty, 0)), 0),
    sum(i.counted_qty),
    coalesce(sum(coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)), 0),
    -- expected = counted + good + damaged + expired + variance.
    --
    -- No fallback to returned_qty on the three buckets here, unlike the display
    -- column above: returned_qty is goods arriving ON the van and is already
    -- inside expected, so adding it again would manufacture a variance. With no
    -- split recorded all three are zero and this is counted - expected, which
    -- is what it has always been for those days.
    --
    -- Only lines that were actually counted contribute a variance. A day with
    -- no counts shows null rather than a confident zero, because "nobody
    -- looked" and "it balanced" are not the same thing.
    sum(coalesce(i.counted_qty, 0)
        + coalesce(i.returned_good_qty, 0)
        + coalesce(i.returned_damaged_qty, 0)
        + coalesce(i.returned_expired_qty, 0)
        - (coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)))
      filter (where i.counted_qty is not null),
    vs.variance_reason,
    count(i.id)::integer,
    count(i.counted_qty)::integer,
    max(dp.last_settled_at)
  from public.van_stock vs
  join public.vans v on v.id = vs.van_id
  left join public.profiles p on p.id = vs.user_id
  left join public.van_stock_items i on i.van_stock_id = vs.id
  left join public.van_day_postings dp on dp.van_stock_id = vs.id
  where vs.distributor_id = p_distributor
    and (p_from is null or vs.stock_date >= p_from)
    and (p_to   is null or vs.stock_date <= p_to)
    and (
      exists (
        select 1 from public.distributor_users du
        where du.auth_user_id = auth.uid()
          and du.distributor_id = p_distributor
          and du.is_active = true
      )
      or public.has_role(auth.uid(), 'admin'::app_role)
      or public.is_system_admin(auth.uid())
      or public.can_view_distributor(p_distributor)
    )
  group by vs.id, vs.stock_date, vs.van_id, v.registration_number, p.full_name,
           vs.status, vs.variance_reason
  order by vs.stock_date desc, v.registration_number;
$function$$Q524$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100300_van_reconciliation_counts_the_returns.sql', left($Q524$create or replace function public.dms_van_reconciliation(
  p_distributor uuid,
  p_from date default null::date,
  p_to date default null::date
)
returns table(
  van_stock_id uuid,
  stock_date date,
  van_id uuid,
  van_registration text,
  rep_name text,
  status text,
  loaded numeric,
  sold numeric,
  returned_good numeric,
  returned_damaged numeric,
  returned_expired numeric,
  counted numeric,
  expected numeric,
  variance numeric,
  variance_reason text,
  lines integer,
  lines_counted integer,
  settled_at timestamp with time zone
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    vs.id,
    vs.stock_date,
    vs.van_id,
    v.registration_number,
    p.full_name,
    vs.status,
    coalesce(sum(i.start_qty), 0),
    coalesce(sum(i.ordered_qty), 0),
    -- Falls back to returned_qty so a day recorded before the closing split
    -- existed still shows what came back. Display only; see the variance below.
    coalesce(sum(coalesce(i.returned_good_qty, i.returned_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_damaged_qty, 0)), 0),
    coalesce(sum(coalesce(i.returned_expired_qty, 0)), 0),
    sum(i.counted_qty),
    coalesce(sum(coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)), 0),
    -- expected = counted + good + damaged + expired + variance.
    --
    -- No fallback to returned_qty on the three buckets here, unlike the display
    -- column above: returned_qty is goods arriving ON the van and is already
    -- inside expected, so adding it again would manufacture a variance. With no
    -- split recorded all three are zero and this is counted - expected, which
    -- is what it has always been for those days.
    --
    -- Only lines that were actually counted contribute a variance. A day with
    -- no counts shows null rather than a confident zero, because "nobody
    -- looked" and "it balanced" are not the same thing.
    sum(coalesce(i.counted_qty, 0)
        + coalesce(i.returned_good_qty, 0)
        + coalesce(i.returned_damaged_qty, 0)
        + coalesce(i.returned_expired_qty, 0)
        - (coalesce(i.start_qty,0) - coalesce(i.ordered_qty,0) + coalesce(i.returned_qty,0)))
      filter (where i.counted_qty is not null),
    vs.variance_reason,
    count(i.id)::integer,
    count(i.counted_qty)::integer,
    max(dp.last_settled_at)
  from public.van_stock vs
  join public.vans v on v.id = vs.van_id
  left join public.profiles p on p.id = vs.user_id
  left join public.van_stock_items i on i.van_stock_id = vs.id
  left join public.van_day_postings dp on dp.van_stock_id = vs.id
  where vs.distributor_id = p_distributor
    and (p_from is null or vs.stock_date >= p_from)
    and (p_to   is null or vs.stock_date <= p_to)
    and (
      exists (
        select 1 from public.distributor_users du
        where du.auth_user_id = auth.uid()
          and du.distributor_id = p_distributor
          and du.is_active = true
      )
      or public.has_role(auth.uid(), 'admin'::app_role)
      or public.is_system_admin(auth.uid())
      or public.can_view_distributor(p_distributor)
    )
  group by vs.id, vs.stock_date, vs.van_id, v.registration_number, p.full_name,
           vs.status, vs.variance_reason
  order by vs.stock_date desc, v.registration_number;
$function$$Q524$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q525$revoke all on function public.dms_van_reconciliation(uuid, date, date) from public$Q525$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100300_van_reconciliation_counts_the_returns.sql', left($Q525$revoke all on function public.dms_van_reconciliation(uuid, date, date) from public$Q525$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q526$grant execute on function public.dms_van_reconciliation(uuid, date, date) to authenticated$Q526$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261026100300_van_reconciliation_counts_the_returns.sql', left($Q526$grant execute on function public.dms_van_reconciliation(uuid, date, date) to authenticated$Q526$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q527$-- The opening stock run of 28 Oct 2026 was entered in kilograms.
--
-- Twelve BHARATH BEVERAGES products took "50" from the bulk-apply field. The
-- dialog resolved that against each product's base unit, so for these twelve --
-- all based in GRAM -- it stored 50 grams. The intent was 50 kilograms. The
-- previous migration corrected the unit label; this corrects the number it
-- labels.
--
-- 50 kg is 50,000 g by definition, not by configuration, so the factor is a
-- literal 1000 rather than a lookup: a product whose KG mapping said anything
-- else would be wrong about grams, not about this stock.
--
-- Three things carry the figure and all three move together, because leaving
-- any one behind is how the batch-vs-stock gaps in
-- docs/inventory-batch-unit-audit.md were made:
--
--   distributor_inventory.quantity          50 -> 50000
--   inventory_batches.quantity/available    50 -> 50000
--   a UOM_CORRECTION ledger row             +49950, so the running balance
--                                           arrives at 50000 honestly
--
-- The ledger row is an addition, not an edit. The original OPENING_STOCK entry
-- still says 50: it records what was actually entered, and the correction sits
-- after it saying what it should have been. calc_transaction_balance derives
-- the delta for a UOM_CORRECTION by reading the old figure out of the note, so
-- the note's shape is load-bearing and matches the rows the 16 Oct migration
-- left behind.
--
-- Scope is deliberately narrow: only rows still untouched since that run. If
-- any of this stock has since been reserved, damaged, expired, loaded onto a
-- van or settled, the correction stops rather than multiply a figure other
-- records have already been derived from.

DO $$
DECLARE
  v_expected CONSTANT integer := 12;
  v_factor   CONSTANT integer := 1000;
  v_found integer;
  v_inv integer;
  v_batches integer;
  v_ledger integer;
BEGIN
  CREATE TEMP TABLE _kg_fix ON COMMIT DROP AS
  SELECT di.id AS inventory_id,
         di.distributor_id,
         di.product_id,
         di.warehouse_id,
         di.product_name,
         di.unit,
         di.quantity AS old_qty,
         di.quantity * v_factor AS new_qty
  FROM public.distributor_inventory di
  JOIN public.distributors d ON d.id = di.distributor_id
  WHERE d.name = 'BHARATH BEVERAGES'
    AND di.created_at::date = DATE '2026-10-28'
    AND public.normalise_unit(di.unit) = 'gram'
    AND di.quantity = 50
    AND COALESCE(di.reserved_quantity, 0) = 0
    AND COALESCE(di.damaged_quantity, 0) = 0
    AND COALESCE(di.expired_quantity, 0) = 0
    AND COALESCE(di.on_van_quantity, 0) = 0
    -- Still exactly as that run left it: one ledger entry, nothing since.
    AND (SELECT count(*) FROM public.distributor_inventory_transactions t
          WHERE t.distributor_id = di.distributor_id
            AND t.product_id = di.product_id) = 1;

  SELECT count(*) INTO v_found FROM _kg_fix;

  IF v_found = 0 THEN
    RAISE NOTICE 'Nothing to correct: already applied, or the stock has moved since.';
    RETURN;
  END IF;

  IF v_found <> v_expected THEN
    RAISE EXCEPTION
      'Expected exactly % rows to correct, found %. Refusing: this is a stock movement, not a relabel.',
      v_expected, v_found;
  END IF;

  UPDATE public.distributor_inventory di
     SET quantity = f.new_qty,
         updated_at = now()
    FROM _kg_fix f
   WHERE di.id = f.inventory_id;
  GET DIAGNOSTICS v_inv = ROW_COUNT;

  UPDATE public.inventory_batches b
     SET quantity = b.quantity * v_factor,
         available_qty = b.available_qty * v_factor
    FROM _kg_fix f
   WHERE b.distributor_id = f.distributor_id
     AND b.product_id = f.product_id
     AND b.warehouse_id = f.warehouse_id
     AND b.quantity = f.old_qty
     AND COALESCE(b.reserved_qty, 0) = 0;
  GET DIAGNOSTICS v_batches = ROW_COUNT;

  INSERT INTO public.distributor_inventory_transactions (
    distributor_id, product_id, product_name, transaction_type,
    balance_qty, unit, notes, warehouse_id, reference_type
  )
  SELECT f.distributor_id, f.product_id, f.product_name, 'UOM_CORRECTION',
         f.new_qty, f.unit,
         format('opening stock entered in KG: %s %s recorded as %s is %s %s',
                f.old_qty, f.unit, f.unit, f.new_qty, f.unit),
         f.warehouse_id, 'adjustment'
  FROM _kg_fix f;
  GET DIAGNOSTICS v_ledger = ROW_COUNT;

  IF v_batches <> v_expected THEN
    RAISE EXCEPTION
      'Corrected % inventory rows but % batch rows. Rolling back rather than leaving batches behind stock.',
      v_inv, v_batches;
  END IF;

  RAISE NOTICE 'Corrected % inventory rows, % batch rows, and wrote % ledger corrections.',
    v_inv, v_batches, v_ledger;
END;
$$$Q527$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261028100200_opening_stock_28oct_was_entered_in_kilograms.sql', left($Q527$-- The opening stock run of 28 Oct 2026 was entered in kilograms.
--
-- Twelve BHARATH BEVERAGES products took "50" from the bulk-apply field. The
-- dialog resolved that against each product's base unit, so for these twelve --
-- all based in GRAM -- it stored 50 grams. The intent was 50 kilograms. The
-- previous migration corrected the unit label; this corrects the number it
-- labels.
--
-- 50 kg is 50,000 g by definition, not by configuration, so the factor is a
-- literal 1000 rather than a lookup: a product whose KG mapping said anything
-- else would be wrong about grams, not about this stock.
--
-- Three things carry the figure and all three move together, because leaving
-- any one behind is how the batch-vs-stock gaps in
-- docs/inventory-batch-unit-audit.md were made:
--
--   distributor_inventory.quantity          50 -> 50000
--   inventory_batches.quantity/available    50 -> 50000
--   a UOM_CORRECTION ledger row             +49950, so the running balance
--                                           arrives at 50000 honestly
--
-- The ledger row is an addition, not an edit. The original OPENING_STOCK entry
-- still says 50: it records what was actually entered, and the correction sits
-- after it saying what it should have been. calc_transaction_balance derives
-- the delta for a UOM_CORRECTION by reading the old figure out of the note, so
-- the note's shape is load-bearing and matches the rows the 16 Oct migration
-- left behind.
--
-- Scope is deliberately narrow: only rows still untouched since that run. If
-- any of this stock has since been reserved, damaged, expired, loaded onto a
-- van or settled, the correction stops rather than multiply a figure other
-- records have already been derived from.

DO $$
DECLARE
  v_expected CONSTANT integer := 12;
  v_factor   CONSTANT integer := 1000;
  v_found integer;
  v_inv integer;
  v_batches integer;
  v_ledger integer;
BEGIN
  CREATE TEMP TABLE _kg_fix ON COMMIT DROP AS
  SELECT di.id AS inventory_id,
         di.distributor_id,
         di.product_id,
         di.warehouse_id,
         di.product_name,
         di.unit,
         di.quantity AS old_qty,
         di.quantity * v_factor AS new_qty
  FROM public.distributor_inventory di
  JOIN public.distributors d ON d.id = di.distributor_id
  WHERE d.name = 'BHARATH BEVERAGES'
    AND di.created_at::date = DATE '2026-10-28'
    AND public.normalise_unit(di.unit) = 'gram'
    AND di.quantity = 50
    AND COALESCE(di.reserved_quantity, 0) = 0
    AND COALESCE(di.damaged_quantity, 0) = 0
    AND COALESCE(di.expired_quantity, 0) = 0
    AND COALESCE(di.on_van_quantity, 0) = 0
    -- Still exactly as that run left it: one ledger entry, nothing since.
    AND (SELECT count(*) FROM public.distributor_inventory_transactions t
          WHERE t.distributor_id = di.distributor_id
            AND t.product_id = di.product_id) = 1;

  SELECT count(*) INTO v_found FROM _kg_fix;

  IF v_found = 0 THEN
    RAISE NOTICE 'Nothing to correct: already applied, or the stock has moved since.';
    RETURN;
  END IF;

  IF v_found <> v_expected THEN
    RAISE EXCEPTION
      'Expected exactly % rows to correct, found %. Refusing: this is a stock movement, not a relabel.',
      v_expected, v_found;
  END IF;

  UPDATE public.distributor_inventory di
     SET quantity = f.new_qty,
         updated_at = now()
    FROM _kg_fix f
   WHERE di.id = f.inventory_id;
  GET DIAGNOSTICS v_inv = ROW_COUNT;

  UPDATE public.inventory_batches b
     SET quantity = b.quantity * v_factor,
         available_qty = b.available_qty * v_factor
    FROM _kg_fix f
   WHERE b.distributor_id = f.distributor_id
     AND b.product_id = f.product_id
     AND b.warehouse_id = f.warehouse_id
     AND b.quantity = f.old_qty
     AND COALESCE(b.reserved_qty, 0) = 0;
  GET DIAGNOSTICS v_batches = ROW_COUNT;

  INSERT INTO public.distributor_inventory_transactions (
    distributor_id, product_id, product_name, transaction_type,
    balance_qty, unit, notes, warehouse_id, reference_type
  )
  SELECT f.distributor_id, f.product_id, f.product_name, 'UOM_CORRECTION',
         f.new_qty, f.unit,
         format('opening stock entered in KG: %s %s recorded as %s is %s %s',
                f.old_qty, f.unit, f.unit, f.new_qty, f.unit),
         f.warehouse_id, 'adjustment'
  FROM _kg_fix f;
  GET DIAGNOSTICS v_ledger = ROW_COUNT;

  IF v_batches <> v_expected THEN
    RAISE EXCEPTION
      'Corrected % inventory rows but % batch rows. Rolling back rather than leaving batches behind stock.',
      v_inv, v_batches;
  END IF;

  RAISE NOTICE 'Corrected % inventory rows, % batch rows, and wrote % ledger corrections.',
    v_inv, v_batches, v_ledger;
END;
$$$Q527$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q528$-- A credit note has never recorded whose book it belongs to.
--
-- That is why the Returns panel on the inventory screen could show one
-- distributor another's credit notes: there was nothing to filter on. The
-- panel now infers ownership live, from the note's retailer or its originating
-- order, and withholds anything it cannot attribute. This gives it a fact to
-- read instead of an inference.
--
-- Resolved at creation, in the order of how directly each link knows:
--
--   1. the van the return came off  -- a van belongs to exactly one distributor
--   2. the order it was raised from -- set on 169 of 793 orders; field sales
--                                      leave it null
--   3. the retailer it was raised against -- set on 234 of 285 retailers
--
-- Nullable on purpose. A credit note raised where none of the three resolves
-- is still a real credit note, and refusing to write it would be a worse
-- outcome than leaving it unattributed: the panel already treats unknown as
-- "do not show", so a null is withheld rather than leaked.
--
-- Existing rows are NOT backfilled. Of the nine on staging, five resolve
-- through their retailer and four resolve to nothing at all, and writing a
-- distributor onto a financial document after the fact is a decision to put in
-- front of someone rather than infer. The panel keeps deriving ownership for
-- those, so nothing regresses while they stay null.

ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS distributor_id uuid$Q528$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261028110000_credit_notes_carry_a_distributor.sql', left($Q528$-- A credit note has never recorded whose book it belongs to.
--
-- That is why the Returns panel on the inventory screen could show one
-- distributor another's credit notes: there was nothing to filter on. The
-- panel now infers ownership live, from the note's retailer or its originating
-- order, and withholds anything it cannot attribute. This gives it a fact to
-- read instead of an inference.
--
-- Resolved at creation, in the order of how directly each link knows:
--
--   1. the van the return came off  -- a van belongs to exactly one distributor
--   2. the order it was raised from -- set on 169 of 793 orders; field sales
--                                      leave it null
--   3. the retailer it was raised against -- set on 234 of 285 retailers
--
-- Nullable on purpose. A credit note raised where none of the three resolves
-- is still a real credit note, and refusing to write it would be a worse
-- outcome than leaving it unattributed: the panel already treats unknown as
-- "do not show", so a null is withheld rather than leaked.
--
-- Existing rows are NOT backfilled. Of the nine on staging, five resolve
-- through their retailer and four resolve to nothing at all, and writing a
-- distributor onto a financial document after the fact is a decision to put in
-- front of someone rather than infer. The panel keeps deriving ownership for
-- those, so nothing regresses while they stay null.

ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS distributor_id uuid$Q528$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q529$DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_distributor_id_fkey'
  ) THEN
    ALTER TABLE public.credit_notes
      ADD CONSTRAINT credit_notes_distributor_id_fkey
      FOREIGN KEY (distributor_id) REFERENCES public.distributors(id);
  END IF;
END;
$$$Q529$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261028110000_credit_notes_carry_a_distributor.sql', left($Q529$DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_notes_distributor_id_fkey'
  ) THEN
    ALTER TABLE public.credit_notes
      ADD CONSTRAINT credit_notes_distributor_id_fkey
      FOREIGN KEY (distributor_id) REFERENCES public.distributors(id);
  END IF;
END;
$$$Q529$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q530$-- The panel filters by it on every row expansion.
CREATE INDEX IF NOT EXISTS idx_credit_notes_distributor_id
  ON public.credit_notes (distributor_id)
  WHERE distributor_id IS NOT NULL$Q530$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261028110000_credit_notes_carry_a_distributor.sql', left($Q530$-- The panel filters by it on every row expansion.
CREATE INDEX IF NOT EXISTS idx_credit_notes_distributor_id
  ON public.credit_notes (distributor_id)
  WHERE distributor_id IS NOT NULL$Q530$,400), SQLERRM, SQLSTATE); END $R$;
DO $R$ BEGIN EXECUTE $Q531$COMMENT ON COLUMN public.credit_notes.distributor_id IS
  'Whose book this credit note belongs to. Resolved at creation from the van, '
  'then the originating order, then the retailer. Null when none of the three '
  'knows; consumers must treat null as "do not show", never as "show to all".'$Q531$; EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function OR duplicate_schema THEN NULL; WHEN OTHERS THEN INSERT INTO replay_log.errors2(file,stmt,err,state) VALUES ('20261028110000_credit_notes_carry_a_distributor.sql', left($Q531$COMMENT ON COLUMN public.credit_notes.distributor_id IS
  'Whose book this credit note belongs to. Resolved at creation from the van, '
  'then the originating order, then the retailer. Null when none of the three '
  'knows; consumers must treat null as "do not show", never as "show to all".'$Q531$,400), SQLERRM, SQLSTATE); END $R$;