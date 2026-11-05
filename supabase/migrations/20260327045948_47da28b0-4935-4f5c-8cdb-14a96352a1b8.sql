
-- BATCH 2: User-owned tables (created_by / owner_id / created_by_user_id)
-- Users can SELECT/INSERT/UPDATE own data; admins can do all

-- credit_ledger (created_by)
DROP POLICY IF EXISTS "Users can read own credit_ledger" ON public.credit_ledger;
CREATE POLICY "Users can read own credit_ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert own credit_ledger" ON public.credit_ledger;
CREATE POLICY "Users can insert own credit_ledger" ON public.credit_ledger FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own credit_ledger" ON public.credit_ledger;
CREATE POLICY "Users can update own credit_ledger" ON public.credit_ledger FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own credit_ledger" ON public.credit_ledger;
CREATE POLICY "Users can delete own credit_ledger" ON public.credit_ledger FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- credit_notes (created_by)
DROP POLICY IF EXISTS "Users can read own credit_notes" ON public.credit_notes;
CREATE POLICY "Users can read own credit_notes" ON public.credit_notes FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert own credit_notes" ON public.credit_notes;
CREATE POLICY "Users can insert own credit_notes" ON public.credit_notes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own credit_notes" ON public.credit_notes;
CREATE POLICY "Users can update own credit_notes" ON public.credit_notes FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own credit_notes" ON public.credit_notes;
CREATE POLICY "Users can delete own credit_notes" ON public.credit_notes FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- custom_invoice_templates (created_by)
DROP POLICY IF EXISTS "Users can read own custom_invoice_templates" ON public.custom_invoice_templates;
CREATE POLICY "Users can read own custom_invoice_templates" ON public.custom_invoice_templates FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert own custom_invoice_templates" ON public.custom_invoice_templates;
CREATE POLICY "Users can insert own custom_invoice_templates" ON public.custom_invoice_templates FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own custom_invoice_templates" ON public.custom_invoice_templates;
CREATE POLICY "Users can update own custom_invoice_templates" ON public.custom_invoice_templates FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own custom_invoice_templates" ON public.custom_invoice_templates;
CREATE POLICY "Users can delete own custom_invoice_templates" ON public.custom_invoice_templates FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- feedback_policies (created_by)
DROP POLICY IF EXISTS "Users can read own feedback_policies" ON public.feedback_policies;
CREATE POLICY "Users can read own feedback_policies" ON public.feedback_policies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert feedback_policies" ON public.feedback_policies;
CREATE POLICY "Users can insert feedback_policies" ON public.feedback_policies FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own feedback_policies" ON public.feedback_policies;
CREATE POLICY "Users can update own feedback_policies" ON public.feedback_policies FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own feedback_policies" ON public.feedback_policies;
CREATE POLICY "Users can delete own feedback_policies" ON public.feedback_policies FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- feedback_questions (created_by)
DROP POLICY IF EXISTS "Users can read feedback_questions" ON public.feedback_questions;
CREATE POLICY "Users can read feedback_questions" ON public.feedback_questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert feedback_questions" ON public.feedback_questions;
CREATE POLICY "Users can insert feedback_questions" ON public.feedback_questions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own feedback_questions" ON public.feedback_questions;
CREATE POLICY "Users can update own feedback_questions" ON public.feedback_questions FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own feedback_questions" ON public.feedback_questions;
CREATE POLICY "Users can delete own feedback_questions" ON public.feedback_questions FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- fy_target_config (created_by)
DROP POLICY IF EXISTS "Users can read fy_target_config" ON public.fy_target_config;
CREATE POLICY "Users can read fy_target_config" ON public.fy_target_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert fy_target_config" ON public.fy_target_config;
CREATE POLICY "Users can insert fy_target_config" ON public.fy_target_config FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own fy_target_config" ON public.fy_target_config;
CREATE POLICY "Users can update own fy_target_config" ON public.fy_target_config FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own fy_target_config" ON public.fy_target_config;
CREATE POLICY "Users can delete own fy_target_config" ON public.fy_target_config FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- hierarchy_targets (created_by)
DROP POLICY IF EXISTS "Users can read hierarchy_targets" ON public.hierarchy_targets;
CREATE POLICY "Users can read hierarchy_targets" ON public.hierarchy_targets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert hierarchy_targets" ON public.hierarchy_targets;
CREATE POLICY "Users can insert hierarchy_targets" ON public.hierarchy_targets FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own hierarchy_targets" ON public.hierarchy_targets;
CREATE POLICY "Users can update own hierarchy_targets" ON public.hierarchy_targets FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own hierarchy_targets" ON public.hierarchy_targets;
CREATE POLICY "Users can delete own hierarchy_targets" ON public.hierarchy_targets FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- inst_invoices (created_by)
DROP POLICY IF EXISTS "Users can read own inst_invoices" ON public.inst_invoices;
CREATE POLICY "Users can read own inst_invoices" ON public.inst_invoices FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert inst_invoices" ON public.inst_invoices;
CREATE POLICY "Users can insert inst_invoices" ON public.inst_invoices FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own inst_invoices" ON public.inst_invoices;
CREATE POLICY "Users can update own inst_invoices" ON public.inst_invoices FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- inst_leads (created_by, assigned_to)
DROP POLICY IF EXISTS "Users can read own inst_leads" ON public.inst_leads;
CREATE POLICY "Users can read own inst_leads" ON public.inst_leads FOR SELECT TO authenticated USING (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert inst_leads" ON public.inst_leads;
CREATE POLICY "Users can insert inst_leads" ON public.inst_leads FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own inst_leads" ON public.inst_leads;
CREATE POLICY "Users can update own inst_leads" ON public.inst_leads FOR UPDATE TO authenticated USING (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_system_admin(auth.uid()));

-- inst_opportunities (owner_id)
DROP POLICY IF EXISTS "Users can read own inst_opportunities" ON public.inst_opportunities;
CREATE POLICY "Users can read own inst_opportunities" ON public.inst_opportunities FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert inst_opportunities" ON public.inst_opportunities;
CREATE POLICY "Users can insert inst_opportunities" ON public.inst_opportunities FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own inst_opportunities" ON public.inst_opportunities;
CREATE POLICY "Users can update own inst_opportunities" ON public.inst_opportunities FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- inst_order_commitments (created_by)
DROP POLICY IF EXISTS "Users can read own inst_order_commitments" ON public.inst_order_commitments;
CREATE POLICY "Users can read own inst_order_commitments" ON public.inst_order_commitments FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert inst_order_commitments" ON public.inst_order_commitments;
CREATE POLICY "Users can insert inst_order_commitments" ON public.inst_order_commitments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own inst_order_commitments" ON public.inst_order_commitments;
CREATE POLICY "Users can update own inst_order_commitments" ON public.inst_order_commitments FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- inst_quotes (created_by)
DROP POLICY IF EXISTS "Users can read own inst_quotes" ON public.inst_quotes;
CREATE POLICY "Users can read own inst_quotes" ON public.inst_quotes FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert inst_quotes" ON public.inst_quotes;
CREATE POLICY "Users can insert inst_quotes" ON public.inst_quotes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own inst_quotes" ON public.inst_quotes;
CREATE POLICY "Users can update own inst_quotes" ON public.inst_quotes FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- invoices (created_by)
DROP POLICY IF EXISTS "Users can read own invoices" ON public.invoices;
CREATE POLICY "Users can read own invoices" ON public.invoices FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert invoices" ON public.invoices;
CREATE POLICY "Users can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
CREATE POLICY "Users can update own invoices" ON public.invoices FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- packing_lists (created_by)
DROP POLICY IF EXISTS "Users can read own packing_lists" ON public.packing_lists;
CREATE POLICY "Users can read own packing_lists" ON public.packing_lists FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert packing_lists" ON public.packing_lists;
CREATE POLICY "Users can insert packing_lists" ON public.packing_lists FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own packing_lists" ON public.packing_lists;
CREATE POLICY "Users can update own packing_lists" ON public.packing_lists FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- pm_ideas (created_by)
DROP POLICY IF EXISTS "Users can read pm_ideas" ON public.pm_ideas;
CREATE POLICY "Users can read pm_ideas" ON public.pm_ideas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert pm_ideas" ON public.pm_ideas;
CREATE POLICY "Users can insert pm_ideas" ON public.pm_ideas FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own pm_ideas" ON public.pm_ideas;
CREATE POLICY "Users can update own pm_ideas" ON public.pm_ideas FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own pm_ideas" ON public.pm_ideas;
CREATE POLICY "Users can delete own pm_ideas" ON public.pm_ideas FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- pm_projects (owner_id, created_by)
DROP POLICY IF EXISTS "Users can read pm_projects" ON public.pm_projects;
CREATE POLICY "Users can read pm_projects" ON public.pm_projects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert pm_projects" ON public.pm_projects;
CREATE POLICY "Users can insert pm_projects" ON public.pm_projects FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own pm_projects" ON public.pm_projects;
CREATE POLICY "Users can update own pm_projects" ON public.pm_projects FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own pm_projects" ON public.pm_projects;
CREATE POLICY "Users can delete own pm_projects" ON public.pm_projects FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- pm_risks (owner_id)
DROP POLICY IF EXISTS "Users can read pm_risks" ON public.pm_risks;
CREATE POLICY "Users can read pm_risks" ON public.pm_risks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert pm_risks" ON public.pm_risks;
CREATE POLICY "Users can insert pm_risks" ON public.pm_risks FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own pm_risks" ON public.pm_risks;
CREATE POLICY "Users can update own pm_risks" ON public.pm_risks FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- pm_tasks (created_by)
DROP POLICY IF EXISTS "Users can read pm_tasks" ON public.pm_tasks;
CREATE POLICY "Users can read pm_tasks" ON public.pm_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert pm_tasks" ON public.pm_tasks;
CREATE POLICY "Users can insert pm_tasks" ON public.pm_tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own pm_tasks" ON public.pm_tasks;
CREATE POLICY "Users can update own pm_tasks" ON public.pm_tasks FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- pm_task_templates (created_by)
DROP POLICY IF EXISTS "Users can read pm_task_templates" ON public.pm_task_templates;
CREATE POLICY "Users can read pm_task_templates" ON public.pm_task_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert pm_task_templates" ON public.pm_task_templates;
CREATE POLICY "Users can insert pm_task_templates" ON public.pm_task_templates FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own pm_task_templates" ON public.pm_task_templates;
CREATE POLICY "Users can update own pm_task_templates" ON public.pm_task_templates FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- price_books (created_by)
DROP POLICY IF EXISTS "Users can read price_books" ON public.price_books;
CREATE POLICY "Users can read price_books" ON public.price_books FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert price_books" ON public.price_books;
CREATE POLICY "Users can insert price_books" ON public.price_books FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own price_books" ON public.price_books;
CREATE POLICY "Users can update own price_books" ON public.price_books FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own price_books" ON public.price_books;
CREATE POLICY "Users can delete own price_books" ON public.price_books FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- primary_orders (created_by_user_id)
DROP POLICY IF EXISTS "Users can read own primary_orders" ON public.primary_orders;
CREATE POLICY "Users can read own primary_orders" ON public.primary_orders FOR SELECT TO authenticated USING (created_by_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert primary_orders" ON public.primary_orders;
CREATE POLICY "Users can insert primary_orders" ON public.primary_orders FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own primary_orders" ON public.primary_orders;
CREATE POLICY "Users can update own primary_orders" ON public.primary_orders FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- push_content_templates (created_by)
DROP POLICY IF EXISTS "Users can read push_content_templates" ON public.push_content_templates;
CREATE POLICY "Users can read push_content_templates" ON public.push_content_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert push_content_templates" ON public.push_content_templates;
CREATE POLICY "Admins can insert push_content_templates" ON public.push_content_templates FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update push_content_templates" ON public.push_content_templates;
CREATE POLICY "Admins can update push_content_templates" ON public.push_content_templates FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete push_content_templates" ON public.push_content_templates;
CREATE POLICY "Admins can delete push_content_templates" ON public.push_content_templates FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- retailer_loyalty_plans (created_by)
DROP POLICY IF EXISTS "Users can read retailer_loyalty_plans" ON public.retailer_loyalty_plans;
CREATE POLICY "Users can read retailer_loyalty_plans" ON public.retailer_loyalty_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert retailer_loyalty_plans" ON public.retailer_loyalty_plans;
CREATE POLICY "Users can insert retailer_loyalty_plans" ON public.retailer_loyalty_plans FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own retailer_loyalty_plans" ON public.retailer_loyalty_plans;
CREATE POLICY "Users can update own retailer_loyalty_plans" ON public.retailer_loyalty_plans FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- retailer_loyalty_programs (created_by)
DROP POLICY IF EXISTS "Users can read retailer_loyalty_programs" ON public.retailer_loyalty_programs;
CREATE POLICY "Users can read retailer_loyalty_programs" ON public.retailer_loyalty_programs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert retailer_loyalty_programs" ON public.retailer_loyalty_programs;
CREATE POLICY "Users can insert retailer_loyalty_programs" ON public.retailer_loyalty_programs FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own retailer_loyalty_programs" ON public.retailer_loyalty_programs;
CREATE POLICY "Users can update own retailer_loyalty_programs" ON public.retailer_loyalty_programs FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- role_targets (created_by)
DROP POLICY IF EXISTS "Users can read role_targets" ON public.role_targets;
CREATE POLICY "Users can read role_targets" ON public.role_targets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert role_targets" ON public.role_targets;
CREATE POLICY "Users can insert role_targets" ON public.role_targets FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own role_targets" ON public.role_targets;
CREATE POLICY "Users can update own role_targets" ON public.role_targets FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- target_plans (created_by)
DROP POLICY IF EXISTS "Users can read target_plans" ON public.target_plans;
CREATE POLICY "Users can read target_plans" ON public.target_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert target_plans" ON public.target_plans;
CREATE POLICY "Users can insert target_plans" ON public.target_plans FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own target_plans" ON public.target_plans;
CREATE POLICY "Users can update own target_plans" ON public.target_plans FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- target_policies (created_by)
DROP POLICY IF EXISTS "Users can read target_policies" ON public.target_policies;
CREATE POLICY "Users can read target_policies" ON public.target_policies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert target_policies" ON public.target_policies;
CREATE POLICY "Users can insert target_policies" ON public.target_policies FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own target_policies" ON public.target_policies;
CREATE POLICY "Users can update own target_policies" ON public.target_policies FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- target_setup_master (created_by)
DROP POLICY IF EXISTS "Users can read target_setup_master" ON public.target_setup_master;
CREATE POLICY "Users can read target_setup_master" ON public.target_setup_master FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert target_setup_master" ON public.target_setup_master;
CREATE POLICY "Users can insert target_setup_master" ON public.target_setup_master FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own target_setup_master" ON public.target_setup_master;
CREATE POLICY "Users can update own target_setup_master" ON public.target_setup_master FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- target_types (created_by)
DROP POLICY IF EXISTS "Users can read target_types" ON public.target_types;
CREATE POLICY "Users can read target_types" ON public.target_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert target_types" ON public.target_types;
CREATE POLICY "Users can insert target_types" ON public.target_types FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own target_types" ON public.target_types;
CREATE POLICY "Users can update own target_types" ON public.target_types FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- tax_masters (created_by)
DROP POLICY IF EXISTS "Users can read tax_masters" ON public.tax_masters;
CREATE POLICY "Users can read tax_masters" ON public.tax_masters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert tax_masters" ON public.tax_masters;
CREATE POLICY "Users can insert tax_masters" ON public.tax_masters FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own tax_masters" ON public.tax_masters;
CREATE POLICY "Users can update own tax_masters" ON public.tax_masters FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- territories (owner_id, created_by)
DROP POLICY IF EXISTS "Users can read territories" ON public.territories;
CREATE POLICY "Users can read territories" ON public.territories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert territories" ON public.territories;
CREATE POLICY "Users can insert territories" ON public.territories FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own territories" ON public.territories;
CREATE POLICY "Users can update own territories" ON public.territories FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- van_beat_assignments (created_by)
DROP POLICY IF EXISTS "Users can read van_beat_assignments" ON public.van_beat_assignments;
CREATE POLICY "Users can read van_beat_assignments" ON public.van_beat_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert van_beat_assignments" ON public.van_beat_assignments;
CREATE POLICY "Users can insert van_beat_assignments" ON public.van_beat_assignments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own van_beat_assignments" ON public.van_beat_assignments;
CREATE POLICY "Users can update own van_beat_assignments" ON public.van_beat_assignments FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- van_stock_adjustments (created_by)
DROP POLICY IF EXISTS "Users can read van_stock_adjustments" ON public.van_stock_adjustments;
CREATE POLICY "Users can read van_stock_adjustments" ON public.van_stock_adjustments FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert van_stock_adjustments" ON public.van_stock_adjustments;
CREATE POLICY "Users can insert van_stock_adjustments" ON public.van_stock_adjustments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own van_stock_adjustments" ON public.van_stock_adjustments;
CREATE POLICY "Users can update own van_stock_adjustments" ON public.van_stock_adjustments FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- vans (created_by)
DROP POLICY IF EXISTS "Users can read vans" ON public.vans;
CREATE POLICY "Users can read vans" ON public.vans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert vans" ON public.vans;
CREATE POLICY "Users can insert vans" ON public.vans FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own vans" ON public.vans;
CREATE POLICY "Users can update own vans" ON public.vans FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- vendors (created_by)
DROP POLICY IF EXISTS "Users can read vendors" ON public.vendors;
CREATE POLICY "Users can read vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert vendors" ON public.vendors;
CREATE POLICY "Users can insert vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own vendors" ON public.vendors;
CREATE POLICY "Users can update own vendors" ON public.vendors FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- whatsapp_config (created_by)
DROP POLICY IF EXISTS "Users can read whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Users can read whatsapp_config" ON public.whatsapp_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Admins can insert whatsapp_config" ON public.whatsapp_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Admins can update whatsapp_config" ON public.whatsapp_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- joint_sales_feedback (manager_id, fse_user_id)
DROP POLICY IF EXISTS "Users can read own joint_sales_feedback" ON public.joint_sales_feedback;
CREATE POLICY "Users can read own joint_sales_feedback" ON public.joint_sales_feedback FOR SELECT TO authenticated USING (manager_id = auth.uid() OR fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert joint_sales_feedback" ON public.joint_sales_feedback;
CREATE POLICY "Users can insert joint_sales_feedback" ON public.joint_sales_feedback FOR INSERT TO authenticated WITH CHECK (manager_id = auth.uid() OR fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own joint_sales_feedback" ON public.joint_sales_feedback;
CREATE POLICY "Users can update own joint_sales_feedback" ON public.joint_sales_feedback FOR UPDATE TO authenticated USING (manager_id = auth.uid() OR fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- joint_sales_sessions (manager_id, fse_user_id)
DROP POLICY IF EXISTS "Users can read own joint_sales_sessions" ON public.joint_sales_sessions;
CREATE POLICY "Users can read own joint_sales_sessions" ON public.joint_sales_sessions FOR SELECT TO authenticated USING (manager_id = auth.uid() OR fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert joint_sales_sessions" ON public.joint_sales_sessions;
CREATE POLICY "Users can insert joint_sales_sessions" ON public.joint_sales_sessions FOR INSERT TO authenticated WITH CHECK (manager_id = auth.uid() OR fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own joint_sales_sessions" ON public.joint_sales_sessions;
CREATE POLICY "Users can update own joint_sales_sessions" ON public.joint_sales_sessions FOR UPDATE TO authenticated USING (manager_id = auth.uid() OR fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- employee_connections (follower_id, following_id)
DROP POLICY IF EXISTS "Users can read employee_connections" ON public.employee_connections;
CREATE POLICY "Users can read employee_connections" ON public.employee_connections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert own employee_connections" ON public.employee_connections;
CREATE POLICY "Users can insert own employee_connections" ON public.employee_connections FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own employee_connections" ON public.employee_connections;
CREATE POLICY "Users can delete own employee_connections" ON public.employee_connections FOR DELETE TO authenticated USING (follower_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- inst_collections (collected_by)
DROP POLICY IF EXISTS "Users can read own inst_collections" ON public.inst_collections;
CREATE POLICY "Users can read own inst_collections" ON public.inst_collections FOR SELECT TO authenticated USING (collected_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert inst_collections" ON public.inst_collections;
CREATE POLICY "Users can insert inst_collections" ON public.inst_collections FOR INSERT TO authenticated WITH CHECK (collected_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own inst_collections" ON public.inst_collections;
CREATE POLICY "Users can update own inst_collections" ON public.inst_collections FOR UPDATE TO authenticated USING (collected_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- retailer_loyalty_feedback (fse_user_id)
DROP POLICY IF EXISTS "Users can read own retailer_loyalty_feedback" ON public.retailer_loyalty_feedback;
CREATE POLICY "Users can read own retailer_loyalty_feedback" ON public.retailer_loyalty_feedback FOR SELECT TO authenticated USING (fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert retailer_loyalty_feedback" ON public.retailer_loyalty_feedback;
CREATE POLICY "Users can insert retailer_loyalty_feedback" ON public.retailer_loyalty_feedback FOR INSERT TO authenticated WITH CHECK (fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own retailer_loyalty_feedback" ON public.retailer_loyalty_feedback;
CREATE POLICY "Users can update own retailer_loyalty_feedback" ON public.retailer_loyalty_feedback FOR UPDATE TO authenticated USING (fse_user_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- team_expense_config (manager_id)
DROP POLICY IF EXISTS "Users can read team_expense_config" ON public.team_expense_config;
CREATE POLICY "Users can read team_expense_config" ON public.team_expense_config FOR SELECT TO authenticated USING (manager_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert team_expense_config" ON public.team_expense_config;
CREATE POLICY "Users can insert team_expense_config" ON public.team_expense_config FOR INSERT TO authenticated WITH CHECK (manager_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own team_expense_config" ON public.team_expense_config;
CREATE POLICY "Users can update own team_expense_config" ON public.team_expense_config FOR UPDATE TO authenticated USING (manager_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- territory_assignment_history (assigned_to)
DROP POLICY IF EXISTS "Users can read territory_assignment_history" ON public.territory_assignment_history;
CREATE POLICY "Users can read territory_assignment_history" ON public.territory_assignment_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert territory_assignment_history" ON public.territory_assignment_history;
CREATE POLICY "Admins can insert territory_assignment_history" ON public.territory_assignment_history FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

-- user_invitations (manager_id, created_by)
DROP POLICY IF EXISTS "Users can read own user_invitations" ON public.user_invitations;
CREATE POLICY "Users can read own user_invitations" ON public.user_invitations FOR SELECT TO authenticated USING (manager_id = auth.uid() OR created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can insert user_invitations" ON public.user_invitations;
CREATE POLICY "Users can insert user_invitations" ON public.user_invitations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own user_invitations" ON public.user_invitations;
CREATE POLICY "Users can update own user_invitations" ON public.user_invitations FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- stockist_attachments (uploaded_by)
DROP POLICY IF EXISTS "Users can read stockist_attachments" ON public.stockist_attachments;
CREATE POLICY "Users can read stockist_attachments" ON public.stockist_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert own stockist_attachments" ON public.stockist_attachments;
CREATE POLICY "Users can insert own stockist_attachments" ON public.stockist_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own stockist_attachments" ON public.stockist_attachments;
CREATE POLICY "Users can update own stockist_attachments" ON public.stockist_attachments FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() OR public.is_system_admin(auth.uid()));
