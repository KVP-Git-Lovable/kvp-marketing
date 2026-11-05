
-- BATCH 3: Distributor tables (retry with type fixes)

-- distributors (owner_id uuid)
DROP POLICY IF EXISTS "Authenticated can read distributors" ON public.distributors;
CREATE POLICY "Authenticated can read distributors" ON public.distributors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Owner or admin can insert distributors" ON public.distributors;
CREATE POLICY "Owner or admin can insert distributors" ON public.distributors FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Owner or admin can update distributors" ON public.distributors;
CREATE POLICY "Owner or admin can update distributors" ON public.distributors FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete distributors" ON public.distributors;
CREATE POLICY "Admin can delete distributors" ON public.distributors FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_attachments (uploaded_by uuid)
DROP POLICY IF EXISTS "Authenticated can read distributor_attachments" ON public.distributor_attachments;
CREATE POLICY "Authenticated can read distributor_attachments" ON public.distributor_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert distributor_attachments" ON public.distributor_attachments;
CREATE POLICY "Users can insert distributor_attachments" ON public.distributor_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own distributor_attachments" ON public.distributor_attachments;
CREATE POLICY "Users can update own distributor_attachments" ON public.distributor_attachments FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete distributor_attachments" ON public.distributor_attachments;
CREATE POLICY "Admin can delete distributor_attachments" ON public.distributor_attachments FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_beat_mappings (created_by uuid)
DROP POLICY IF EXISTS "Authenticated can read distributor_beat_mappings" ON public.distributor_beat_mappings;
CREATE POLICY "Authenticated can read distributor_beat_mappings" ON public.distributor_beat_mappings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert distributor_beat_mappings" ON public.distributor_beat_mappings;
CREATE POLICY "Users can insert distributor_beat_mappings" ON public.distributor_beat_mappings FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own distributor_beat_mappings" ON public.distributor_beat_mappings;
CREATE POLICY "Users can update own distributor_beat_mappings" ON public.distributor_beat_mappings FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete distributor_beat_mappings" ON public.distributor_beat_mappings;
CREATE POLICY "Admin can delete distributor_beat_mappings" ON public.distributor_beat_mappings FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_business_plans (no ownership col)
DROP POLICY IF EXISTS "Authenticated can read distributor_business_plans" ON public.distributor_business_plans;
CREATE POLICY "Authenticated can read distributor_business_plans" ON public.distributor_business_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert distributor_business_plans" ON public.distributor_business_plans;
CREATE POLICY "Admins can insert distributor_business_plans" ON public.distributor_business_plans FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update distributor_business_plans" ON public.distributor_business_plans;
CREATE POLICY "Admins can update distributor_business_plans" ON public.distributor_business_plans FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete distributor_business_plans" ON public.distributor_business_plans;
CREATE POLICY "Admins can delete distributor_business_plans" ON public.distributor_business_plans FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_business_plan_month_products
DROP POLICY IF EXISTS "Authenticated can read dbpmp" ON public.distributor_business_plan_month_products;
CREATE POLICY "Authenticated can read dbpmp" ON public.distributor_business_plan_month_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert dbpmp" ON public.distributor_business_plan_month_products;
CREATE POLICY "Admins can insert dbpmp" ON public.distributor_business_plan_month_products FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dbpmp" ON public.distributor_business_plan_month_products;
CREATE POLICY "Admins can update dbpmp" ON public.distributor_business_plan_month_products FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete dbpmp" ON public.distributor_business_plan_month_products;
CREATE POLICY "Admins can delete dbpmp" ON public.distributor_business_plan_month_products FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_business_plan_months
DROP POLICY IF EXISTS "Authenticated can read dbpm" ON public.distributor_business_plan_months;
CREATE POLICY "Authenticated can read dbpm" ON public.distributor_business_plan_months FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert dbpm" ON public.distributor_business_plan_months;
CREATE POLICY "Admins can insert dbpm" ON public.distributor_business_plan_months FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dbpm" ON public.distributor_business_plan_months;
CREATE POLICY "Admins can update dbpm" ON public.distributor_business_plan_months FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete dbpm" ON public.distributor_business_plan_months;
CREATE POLICY "Admins can delete dbpm" ON public.distributor_business_plan_months FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_business_plan_products
DROP POLICY IF EXISTS "Authenticated can read dbpp" ON public.distributor_business_plan_products;
CREATE POLICY "Authenticated can read dbpp" ON public.distributor_business_plan_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert dbpp" ON public.distributor_business_plan_products;
CREATE POLICY "Admins can insert dbpp" ON public.distributor_business_plan_products FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dbpp" ON public.distributor_business_plan_products;
CREATE POLICY "Admins can update dbpp" ON public.distributor_business_plan_products FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete dbpp" ON public.distributor_business_plan_products;
CREATE POLICY "Admins can delete dbpp" ON public.distributor_business_plan_products FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_business_plan_retailers
DROP POLICY IF EXISTS "Authenticated can read dbpr" ON public.distributor_business_plan_retailers;
CREATE POLICY "Authenticated can read dbpr" ON public.distributor_business_plan_retailers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert dbpr" ON public.distributor_business_plan_retailers;
CREATE POLICY "Admins can insert dbpr" ON public.distributor_business_plan_retailers FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dbpr" ON public.distributor_business_plan_retailers;
CREATE POLICY "Admins can update dbpr" ON public.distributor_business_plan_retailers FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete dbpr" ON public.distributor_business_plan_retailers;
CREATE POLICY "Admins can delete dbpr" ON public.distributor_business_plan_retailers FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_claims (created_by_user_id uuid)
DROP POLICY IF EXISTS "Authenticated can read distributor_claims" ON public.distributor_claims;
CREATE POLICY "Authenticated can read distributor_claims" ON public.distributor_claims FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert distributor_claims" ON public.distributor_claims;
CREATE POLICY "Users can insert distributor_claims" ON public.distributor_claims FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own distributor_claims" ON public.distributor_claims;
CREATE POLICY "Users can update own distributor_claims" ON public.distributor_claims FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- distributor_company_return_items
DROP POLICY IF EXISTS "Authenticated can read dcri" ON public.distributor_company_return_items;
CREATE POLICY "Authenticated can read dcri" ON public.distributor_company_return_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage dcri" ON public.distributor_company_return_items;
CREATE POLICY "Admins can manage dcri" ON public.distributor_company_return_items FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dcri" ON public.distributor_company_return_items;
CREATE POLICY "Admins can update dcri" ON public.distributor_company_return_items FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_company_returns (created_by uuid)
DROP POLICY IF EXISTS "Authenticated can read distributor_company_returns" ON public.distributor_company_returns;
CREATE POLICY "Authenticated can read distributor_company_returns" ON public.distributor_company_returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert distributor_company_returns" ON public.distributor_company_returns;
CREATE POLICY "Users can insert distributor_company_returns" ON public.distributor_company_returns FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own distributor_company_returns" ON public.distributor_company_returns;
CREATE POLICY "Users can update own distributor_company_returns" ON public.distributor_company_returns FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- distributor_contacts
DROP POLICY IF EXISTS "Authenticated can read distributor_contacts" ON public.distributor_contacts;
CREATE POLICY "Authenticated can read distributor_contacts" ON public.distributor_contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert distributor_contacts" ON public.distributor_contacts;
CREATE POLICY "Admins can insert distributor_contacts" ON public.distributor_contacts FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update distributor_contacts" ON public.distributor_contacts;
CREATE POLICY "Admins can update distributor_contacts" ON public.distributor_contacts FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete distributor_contacts" ON public.distributor_contacts;
CREATE POLICY "Admins can delete distributor_contacts" ON public.distributor_contacts FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_credit_limits
DROP POLICY IF EXISTS "Authenticated can read distributor_credit_limits" ON public.distributor_credit_limits;
CREATE POLICY "Authenticated can read distributor_credit_limits" ON public.distributor_credit_limits FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert distributor_credit_limits" ON public.distributor_credit_limits;
CREATE POLICY "Admins can insert distributor_credit_limits" ON public.distributor_credit_limits FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update distributor_credit_limits" ON public.distributor_credit_limits;
CREATE POLICY "Admins can update distributor_credit_limits" ON public.distributor_credit_limits FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_evaluation_tasks (created_by uuid)
DROP POLICY IF EXISTS "Authenticated can read distributor_evaluation_tasks" ON public.distributor_evaluation_tasks;
CREATE POLICY "Authenticated can read distributor_evaluation_tasks" ON public.distributor_evaluation_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert distributor_evaluation_tasks" ON public.distributor_evaluation_tasks;
CREATE POLICY "Users can insert distributor_evaluation_tasks" ON public.distributor_evaluation_tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own distributor_evaluation_tasks" ON public.distributor_evaluation_tasks;
CREATE POLICY "Users can update own distributor_evaluation_tasks" ON public.distributor_evaluation_tasks FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- distributor_ideas (created_by_user_id uuid)
DROP POLICY IF EXISTS "Authenticated can read distributor_ideas" ON public.distributor_ideas;
CREATE POLICY "Authenticated can read distributor_ideas" ON public.distributor_ideas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert distributor_ideas" ON public.distributor_ideas;
CREATE POLICY "Users can insert distributor_ideas" ON public.distributor_ideas FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own distributor_ideas" ON public.distributor_ideas;
CREATE POLICY "Users can update own distributor_ideas" ON public.distributor_ideas FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid() OR public.is_system_admin(auth.uid()));

-- distributor_inventory
DROP POLICY IF EXISTS "Authenticated can read distributor_inventory" ON public.distributor_inventory;
CREATE POLICY "Authenticated can read distributor_inventory" ON public.distributor_inventory FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert distributor_inventory" ON public.distributor_inventory;
CREATE POLICY "Admins can insert distributor_inventory" ON public.distributor_inventory FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update distributor_inventory" ON public.distributor_inventory;
CREATE POLICY "Admins can update distributor_inventory" ON public.distributor_inventory FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_inventory_transactions (created_by uuid)
DROP POLICY IF EXISTS "Authenticated can read dit" ON public.distributor_inventory_transactions;
CREATE POLICY "Authenticated can read dit" ON public.distributor_inventory_transactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert dit" ON public.distributor_inventory_transactions;
CREATE POLICY "Users can insert dit" ON public.distributor_inventory_transactions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- distributor_item_mappings
DROP POLICY IF EXISTS "Authenticated can read dim" ON public.distributor_item_mappings;
CREATE POLICY "Authenticated can read dim" ON public.distributor_item_mappings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert dim" ON public.distributor_item_mappings;
CREATE POLICY "Admins can insert dim" ON public.distributor_item_mappings FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dim" ON public.distributor_item_mappings;
CREATE POLICY "Admins can update dim" ON public.distributor_item_mappings FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete dim" ON public.distributor_item_mappings;
CREATE POLICY "Admins can delete dim" ON public.distributor_item_mappings FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_locations
DROP POLICY IF EXISTS "Authenticated can read distributor_locations" ON public.distributor_locations;
CREATE POLICY "Authenticated can read distributor_locations" ON public.distributor_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert distributor_locations" ON public.distributor_locations;
CREATE POLICY "Admins can insert distributor_locations" ON public.distributor_locations FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update distributor_locations" ON public.distributor_locations;
CREATE POLICY "Admins can update distributor_locations" ON public.distributor_locations FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_payments (created_by TEXT - need cast)
DROP POLICY IF EXISTS "Authenticated can read distributor_payments" ON public.distributor_payments;
CREATE POLICY "Authenticated can read distributor_payments" ON public.distributor_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert distributor_payments" ON public.distributor_payments;
CREATE POLICY "Users can insert distributor_payments" ON public.distributor_payments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid()::text OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own distributor_payments" ON public.distributor_payments;
CREATE POLICY "Users can update own distributor_payments" ON public.distributor_payments FOR UPDATE TO authenticated USING (created_by = auth.uid()::text OR public.is_system_admin(auth.uid()));

-- distributor_price_books
DROP POLICY IF EXISTS "Authenticated can read distributor_price_books" ON public.distributor_price_books;
CREATE POLICY "Authenticated can read distributor_price_books" ON public.distributor_price_books FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert distributor_price_books" ON public.distributor_price_books;
CREATE POLICY "Admins can insert distributor_price_books" ON public.distributor_price_books FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update distributor_price_books" ON public.distributor_price_books;
CREATE POLICY "Admins can update distributor_price_books" ON public.distributor_price_books FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_retailer_credit_limits
DROP POLICY IF EXISTS "Authenticated can read drcl" ON public.distributor_retailer_credit_limits;
CREATE POLICY "Authenticated can read drcl" ON public.distributor_retailer_credit_limits FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert drcl" ON public.distributor_retailer_credit_limits;
CREATE POLICY "Admins can insert drcl" ON public.distributor_retailer_credit_limits FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update drcl" ON public.distributor_retailer_credit_limits;
CREATE POLICY "Admins can update drcl" ON public.distributor_retailer_credit_limits FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_retailer_feedback (created_by uuid)
DROP POLICY IF EXISTS "Authenticated can read drf" ON public.distributor_retailer_feedback;
CREATE POLICY "Authenticated can read drf" ON public.distributor_retailer_feedback FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert drf" ON public.distributor_retailer_feedback;
CREATE POLICY "Users can insert drf" ON public.distributor_retailer_feedback FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own drf" ON public.distributor_retailer_feedback;
CREATE POLICY "Users can update own drf" ON public.distributor_retailer_feedback FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- distributor_retailer_ledger (created_by TEXT - need cast)
DROP POLICY IF EXISTS "Authenticated can read drl" ON public.distributor_retailer_ledger;
CREATE POLICY "Authenticated can read drl" ON public.distributor_retailer_ledger FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert drl" ON public.distributor_retailer_ledger;
CREATE POLICY "Users can insert drl" ON public.distributor_retailer_ledger FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid()::text OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own drl" ON public.distributor_retailer_ledger;
CREATE POLICY "Users can update own drl" ON public.distributor_retailer_ledger FOR UPDATE TO authenticated USING (created_by = auth.uid()::text OR public.is_system_admin(auth.uid()));

-- distributor_return_items
DROP POLICY IF EXISTS "Authenticated can read dri" ON public.distributor_return_items;
CREATE POLICY "Authenticated can read dri" ON public.distributor_return_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert dri" ON public.distributor_return_items;
CREATE POLICY "Admins can insert dri" ON public.distributor_return_items FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dri" ON public.distributor_return_items;
CREATE POLICY "Admins can update dri" ON public.distributor_return_items FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_returns (created_by uuid)
DROP POLICY IF EXISTS "Authenticated can read distributor_returns" ON public.distributor_returns;
CREATE POLICY "Authenticated can read distributor_returns" ON public.distributor_returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert distributor_returns" ON public.distributor_returns;
CREATE POLICY "Users can insert distributor_returns" ON public.distributor_returns FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own distributor_returns" ON public.distributor_returns;
CREATE POLICY "Users can update own distributor_returns" ON public.distributor_returns FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_system_admin(auth.uid()));

-- distributor_secondary_invoice_items
DROP POLICY IF EXISTS "Authenticated can read dsii" ON public.distributor_secondary_invoice_items;
CREATE POLICY "Authenticated can read dsii" ON public.distributor_secondary_invoice_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert dsii" ON public.distributor_secondary_invoice_items;
CREATE POLICY "Admins can insert dsii" ON public.distributor_secondary_invoice_items FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dsii" ON public.distributor_secondary_invoice_items;
CREATE POLICY "Admins can update dsii" ON public.distributor_secondary_invoice_items FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_secondary_invoices
DROP POLICY IF EXISTS "Authenticated can read dsi" ON public.distributor_secondary_invoices;
CREATE POLICY "Authenticated can read dsi" ON public.distributor_secondary_invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert dsi" ON public.distributor_secondary_invoices;
CREATE POLICY "Admins can insert dsi" ON public.distributor_secondary_invoices FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update dsi" ON public.distributor_secondary_invoices;
CREATE POLICY "Admins can update dsi" ON public.distributor_secondary_invoices FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- distributor_support_requests (created_by_user_id uuid, assigned_to uuid)
DROP POLICY IF EXISTS "Authenticated can read dsr" ON public.distributor_support_requests;
CREATE POLICY "Authenticated can read dsr" ON public.distributor_support_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert dsr" ON public.distributor_support_requests;
CREATE POLICY "Users can insert dsr" ON public.distributor_support_requests FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Users can update own dsr" ON public.distributor_support_requests;
CREATE POLICY "Users can update own dsr" ON public.distributor_support_requests FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid() OR assigned_to = auth.uid() OR public.is_system_admin(auth.uid()));

-- distributor_users
DROP POLICY IF EXISTS "Authenticated can read distributor_users" ON public.distributor_users;
CREATE POLICY "Authenticated can read distributor_users" ON public.distributor_users FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert distributor_users" ON public.distributor_users;
CREATE POLICY "Admins can insert distributor_users" ON public.distributor_users FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update distributor_users" ON public.distributor_users;
CREATE POLICY "Admins can update distributor_users" ON public.distributor_users FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete distributor_users" ON public.distributor_users;
CREATE POLICY "Admins can delete distributor_users" ON public.distributor_users FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));
