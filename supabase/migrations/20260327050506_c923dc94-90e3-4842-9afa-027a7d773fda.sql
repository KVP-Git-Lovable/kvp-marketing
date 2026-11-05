
-- BATCH 5: All remaining tables - read-all authenticated, admin-write

-- recycle_bin
DROP POLICY IF EXISTS "Auth read recycle_bin" ON public.recycle_bin; CREATE POLICY "Auth read recycle_bin" ON public.recycle_bin FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert recycle_bin" ON public.recycle_bin; CREATE POLICY "Admin insert recycle_bin" ON public.recycle_bin FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update recycle_bin" ON public.recycle_bin; CREATE POLICY "Admin update recycle_bin" ON public.recycle_bin FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- recycle_bin_config
DROP POLICY IF EXISTS "Auth read recycle_bin_config" ON public.recycle_bin_config; CREATE POLICY "Auth read recycle_bin_config" ON public.recycle_bin_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert recycle_bin_config" ON public.recycle_bin_config; CREATE POLICY "Admin insert recycle_bin_config" ON public.recycle_bin_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update recycle_bin_config" ON public.recycle_bin_config; CREATE POLICY "Admin update recycle_bin_config" ON public.recycle_bin_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- regularization_policy
DROP POLICY IF EXISTS "Auth read regularization_policy" ON public.regularization_policy; CREATE POLICY "Auth read regularization_policy" ON public.regularization_policy FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert regularization_policy" ON public.regularization_policy; CREATE POLICY "Admin insert regularization_policy" ON public.regularization_policy FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update regularization_policy" ON public.regularization_policy; CREATE POLICY "Admin update regularization_policy" ON public.regularization_policy FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- retailer_credit_scores
DROP POLICY IF EXISTS "Auth read retailer_credit_scores" ON public.retailer_credit_scores; CREATE POLICY "Auth read retailer_credit_scores" ON public.retailer_credit_scores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert retailer_credit_scores" ON public.retailer_credit_scores; CREATE POLICY "Admin insert retailer_credit_scores" ON public.retailer_credit_scores FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update retailer_credit_scores" ON public.retailer_credit_scores; CREATE POLICY "Admin update retailer_credit_scores" ON public.retailer_credit_scores FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- retailer_external_unsorted
DROP POLICY IF EXISTS "Auth read retailer_external_unsorted" ON public.retailer_external_unsorted; CREATE POLICY "Auth read retailer_external_unsorted" ON public.retailer_external_unsorted FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert retailer_external_unsorted" ON public.retailer_external_unsorted; CREATE POLICY "Auth insert retailer_external_unsorted" ON public.retailer_external_unsorted FOR INSERT TO authenticated WITH CHECK (true);

-- retailer_gift_redemptions
DROP POLICY IF EXISTS "Auth read retailer_gift_redemptions" ON public.retailer_gift_redemptions; CREATE POLICY "Auth read retailer_gift_redemptions" ON public.retailer_gift_redemptions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert retailer_gift_redemptions" ON public.retailer_gift_redemptions; CREATE POLICY "Auth insert retailer_gift_redemptions" ON public.retailer_gift_redemptions FOR INSERT TO authenticated WITH CHECK (true);

-- retailer_gift_subscriptions
DROP POLICY IF EXISTS "Auth read retailer_gift_subscriptions" ON public.retailer_gift_subscriptions; CREATE POLICY "Auth read retailer_gift_subscriptions" ON public.retailer_gift_subscriptions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert retailer_gift_subscriptions" ON public.retailer_gift_subscriptions; CREATE POLICY "Auth insert retailer_gift_subscriptions" ON public.retailer_gift_subscriptions FOR INSERT TO authenticated WITH CHECK (true);

-- retailer_loyalty_actions
DROP POLICY IF EXISTS "Auth read retailer_loyalty_actions" ON public.retailer_loyalty_actions; CREATE POLICY "Auth read retailer_loyalty_actions" ON public.retailer_loyalty_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert retailer_loyalty_actions" ON public.retailer_loyalty_actions; CREATE POLICY "Admin insert retailer_loyalty_actions" ON public.retailer_loyalty_actions FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update retailer_loyalty_actions" ON public.retailer_loyalty_actions; CREATE POLICY "Admin update retailer_loyalty_actions" ON public.retailer_loyalty_actions FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- retailer_loyalty_gifts
DROP POLICY IF EXISTS "Auth read retailer_loyalty_gifts" ON public.retailer_loyalty_gifts; CREATE POLICY "Auth read retailer_loyalty_gifts" ON public.retailer_loyalty_gifts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert retailer_loyalty_gifts" ON public.retailer_loyalty_gifts; CREATE POLICY "Admin insert retailer_loyalty_gifts" ON public.retailer_loyalty_gifts FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update retailer_loyalty_gifts" ON public.retailer_loyalty_gifts; CREATE POLICY "Admin update retailer_loyalty_gifts" ON public.retailer_loyalty_gifts FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- retailer_loyalty_parameters
DROP POLICY IF EXISTS "Auth read retailer_loyalty_parameters" ON public.retailer_loyalty_parameters; CREATE POLICY "Auth read retailer_loyalty_parameters" ON public.retailer_loyalty_parameters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert retailer_loyalty_parameters" ON public.retailer_loyalty_parameters; CREATE POLICY "Admin insert retailer_loyalty_parameters" ON public.retailer_loyalty_parameters FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update retailer_loyalty_parameters" ON public.retailer_loyalty_parameters; CREATE POLICY "Admin update retailer_loyalty_parameters" ON public.retailer_loyalty_parameters FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- retailer_loyalty_points
DROP POLICY IF EXISTS "Auth read retailer_loyalty_points" ON public.retailer_loyalty_points; CREATE POLICY "Auth read retailer_loyalty_points" ON public.retailer_loyalty_points FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert retailer_loyalty_points" ON public.retailer_loyalty_points; CREATE POLICY "Auth insert retailer_loyalty_points" ON public.retailer_loyalty_points FOR INSERT TO authenticated WITH CHECK (true);

-- retailer_loyalty_redemptions
DROP POLICY IF EXISTS "Auth read retailer_loyalty_redemptions" ON public.retailer_loyalty_redemptions; CREATE POLICY "Auth read retailer_loyalty_redemptions" ON public.retailer_loyalty_redemptions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert retailer_loyalty_redemptions" ON public.retailer_loyalty_redemptions; CREATE POLICY "Auth insert retailer_loyalty_redemptions" ON public.retailer_loyalty_redemptions FOR INSERT TO authenticated WITH CHECK (true);

-- retailer_loyalty_reward_redemptions
DROP POLICY IF EXISTS "Auth read rlrr" ON public.retailer_loyalty_reward_redemptions; CREATE POLICY "Auth read rlrr" ON public.retailer_loyalty_reward_redemptions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert rlrr" ON public.retailer_loyalty_reward_redemptions; CREATE POLICY "Auth insert rlrr" ON public.retailer_loyalty_reward_redemptions FOR INSERT TO authenticated WITH CHECK (true);

-- retailer_loyalty_rewards
DROP POLICY IF EXISTS "Auth read retailer_loyalty_rewards" ON public.retailer_loyalty_rewards; CREATE POLICY "Auth read retailer_loyalty_rewards" ON public.retailer_loyalty_rewards FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert retailer_loyalty_rewards" ON public.retailer_loyalty_rewards; CREATE POLICY "Admin insert retailer_loyalty_rewards" ON public.retailer_loyalty_rewards FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update retailer_loyalty_rewards" ON public.retailer_loyalty_rewards; CREATE POLICY "Admin update retailer_loyalty_rewards" ON public.retailer_loyalty_rewards FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- retailer_loyalty_tracking
DROP POLICY IF EXISTS "Auth read retailer_loyalty_tracking" ON public.retailer_loyalty_tracking; CREATE POLICY "Auth read retailer_loyalty_tracking" ON public.retailer_loyalty_tracking FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert retailer_loyalty_tracking" ON public.retailer_loyalty_tracking; CREATE POLICY "Auth insert retailer_loyalty_tracking" ON public.retailer_loyalty_tracking FOR INSERT TO authenticated WITH CHECK (true);

-- role_definitions
DROP POLICY IF EXISTS "Auth read role_definitions" ON public.role_definitions; CREATE POLICY "Auth read role_definitions" ON public.role_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert role_definitions" ON public.role_definitions; CREATE POLICY "Admin insert role_definitions" ON public.role_definitions FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update role_definitions" ON public.role_definitions; CREATE POLICY "Admin update role_definitions" ON public.role_definitions FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- scheme_applicability
DROP POLICY IF EXISTS "Auth read scheme_applicability" ON public.scheme_applicability; CREATE POLICY "Auth read scheme_applicability" ON public.scheme_applicability FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert scheme_applicability" ON public.scheme_applicability; CREATE POLICY "Admin insert scheme_applicability" ON public.scheme_applicability FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update scheme_applicability" ON public.scheme_applicability; CREATE POLICY "Admin update scheme_applicability" ON public.scheme_applicability FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin delete scheme_applicability" ON public.scheme_applicability; CREATE POLICY "Admin delete scheme_applicability" ON public.scheme_applicability FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- scheme_policy_config
DROP POLICY IF EXISTS "Auth read scheme_policy_config" ON public.scheme_policy_config; CREATE POLICY "Auth read scheme_policy_config" ON public.scheme_policy_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert scheme_policy_config" ON public.scheme_policy_config; CREATE POLICY "Admin insert scheme_policy_config" ON public.scheme_policy_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update scheme_policy_config" ON public.scheme_policy_config; CREATE POLICY "Admin update scheme_policy_config" ON public.scheme_policy_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- sms_config
DROP POLICY IF EXISTS "Auth read sms_config" ON public.sms_config; CREATE POLICY "Auth read sms_config" ON public.sms_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert sms_config" ON public.sms_config; CREATE POLICY "Admin insert sms_config" ON public.sms_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update sms_config" ON public.sms_config; CREATE POLICY "Admin update sms_config" ON public.sms_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- social_post_attachments
DROP POLICY IF EXISTS "Auth read social_post_attachments" ON public.social_post_attachments; CREATE POLICY "Auth read social_post_attachments" ON public.social_post_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert social_post_attachments" ON public.social_post_attachments; CREATE POLICY "Auth insert social_post_attachments" ON public.social_post_attachments FOR INSERT TO authenticated WITH CHECK (true);

-- stockist_contacts
DROP POLICY IF EXISTS "Auth read stockist_contacts" ON public.stockist_contacts; CREATE POLICY "Auth read stockist_contacts" ON public.stockist_contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert stockist_contacts" ON public.stockist_contacts; CREATE POLICY "Admin insert stockist_contacts" ON public.stockist_contacts FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update stockist_contacts" ON public.stockist_contacts; CREATE POLICY "Admin update stockist_contacts" ON public.stockist_contacts FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- stockist_locations
DROP POLICY IF EXISTS "Auth read stockist_locations" ON public.stockist_locations; CREATE POLICY "Auth read stockist_locations" ON public.stockist_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert stockist_locations" ON public.stockist_locations; CREATE POLICY "Admin insert stockist_locations" ON public.stockist_locations FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update stockist_locations" ON public.stockist_locations; CREATE POLICY "Admin update stockist_locations" ON public.stockist_locations FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- target_kpi_definitions
DROP POLICY IF EXISTS "Auth read target_kpi_definitions" ON public.target_kpi_definitions; CREATE POLICY "Auth read target_kpi_definitions" ON public.target_kpi_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert target_kpi_definitions" ON public.target_kpi_definitions; CREATE POLICY "Admin insert target_kpi_definitions" ON public.target_kpi_definitions FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update target_kpi_definitions" ON public.target_kpi_definitions; CREATE POLICY "Admin update target_kpi_definitions" ON public.target_kpi_definitions FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- target_metric_definitions
DROP POLICY IF EXISTS "Auth read target_metric_definitions" ON public.target_metric_definitions; CREATE POLICY "Auth read target_metric_definitions" ON public.target_metric_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert target_metric_definitions" ON public.target_metric_definitions; CREATE POLICY "Admin insert target_metric_definitions" ON public.target_metric_definitions FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update target_metric_definitions" ON public.target_metric_definitions; CREATE POLICY "Admin update target_metric_definitions" ON public.target_metric_definitions FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- target_parameter_definitions
DROP POLICY IF EXISTS "Auth read target_parameter_definitions" ON public.target_parameter_definitions; CREATE POLICY "Auth read target_parameter_definitions" ON public.target_parameter_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert target_parameter_definitions" ON public.target_parameter_definitions; CREATE POLICY "Admin insert target_parameter_definitions" ON public.target_parameter_definitions FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update target_parameter_definitions" ON public.target_parameter_definitions; CREATE POLICY "Admin update target_parameter_definitions" ON public.target_parameter_definitions FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- tax_components
DROP POLICY IF EXISTS "Auth read tax_components" ON public.tax_components; CREATE POLICY "Auth read tax_components" ON public.tax_components FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert tax_components" ON public.tax_components; CREATE POLICY "Admin insert tax_components" ON public.tax_components FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update tax_components" ON public.tax_components; CREATE POLICY "Admin update tax_components" ON public.tax_components FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- tax_product_map
DROP POLICY IF EXISTS "Auth read tax_product_map" ON public.tax_product_map; CREATE POLICY "Auth read tax_product_map" ON public.tax_product_map FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert tax_product_map" ON public.tax_product_map; CREATE POLICY "Admin insert tax_product_map" ON public.tax_product_map FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update tax_product_map" ON public.tax_product_map; CREATE POLICY "Admin update tax_product_map" ON public.tax_product_map FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- user_business_plan_distributors
DROP POLICY IF EXISTS "Auth read ubpd" ON public.user_business_plan_distributors; CREATE POLICY "Auth read ubpd" ON public.user_business_plan_distributors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert ubpd" ON public.user_business_plan_distributors; CREATE POLICY "Auth insert ubpd" ON public.user_business_plan_distributors FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update ubpd" ON public.user_business_plan_distributors; CREATE POLICY "Auth update ubpd" ON public.user_business_plan_distributors FOR UPDATE TO authenticated USING (true);

-- user_business_plan_month_products
DROP POLICY IF EXISTS "Auth read ubpmp" ON public.user_business_plan_month_products; CREATE POLICY "Auth read ubpmp" ON public.user_business_plan_month_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert ubpmp" ON public.user_business_plan_month_products; CREATE POLICY "Auth insert ubpmp" ON public.user_business_plan_month_products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update ubpmp" ON public.user_business_plan_month_products; CREATE POLICY "Auth update ubpmp" ON public.user_business_plan_month_products FOR UPDATE TO authenticated USING (true);

-- user_business_plan_months
DROP POLICY IF EXISTS "Auth read ubpm" ON public.user_business_plan_months; CREATE POLICY "Auth read ubpm" ON public.user_business_plan_months FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert ubpm" ON public.user_business_plan_months; CREATE POLICY "Auth insert ubpm" ON public.user_business_plan_months FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update ubpm" ON public.user_business_plan_months; CREATE POLICY "Auth update ubpm" ON public.user_business_plan_months FOR UPDATE TO authenticated USING (true);

-- user_business_plan_products
DROP POLICY IF EXISTS "Auth read ubpp" ON public.user_business_plan_products; CREATE POLICY "Auth read ubpp" ON public.user_business_plan_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert ubpp" ON public.user_business_plan_products; CREATE POLICY "Auth insert ubpp" ON public.user_business_plan_products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update ubpp" ON public.user_business_plan_products; CREATE POLICY "Auth update ubpp" ON public.user_business_plan_products FOR UPDATE TO authenticated USING (true);

-- user_business_plan_retailers
DROP POLICY IF EXISTS "Auth read ubpr" ON public.user_business_plan_retailers; CREATE POLICY "Auth read ubpr" ON public.user_business_plan_retailers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert ubpr" ON public.user_business_plan_retailers; CREATE POLICY "Auth insert ubpr" ON public.user_business_plan_retailers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update ubpr" ON public.user_business_plan_retailers; CREATE POLICY "Auth update ubpr" ON public.user_business_plan_retailers FOR UPDATE TO authenticated USING (true);

-- user_business_plan_territories
DROP POLICY IF EXISTS "Auth read ubpt" ON public.user_business_plan_territories; CREATE POLICY "Auth read ubpt" ON public.user_business_plan_territories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert ubpt" ON public.user_business_plan_territories; CREATE POLICY "Auth insert ubpt" ON public.user_business_plan_territories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update ubpt" ON public.user_business_plan_territories; CREATE POLICY "Auth update ubpt" ON public.user_business_plan_territories FOR UPDATE TO authenticated USING (true);

-- user_business_plan_territory_beats
DROP POLICY IF EXISTS "Auth read ubptb" ON public.user_business_plan_territory_beats; CREATE POLICY "Auth read ubptb" ON public.user_business_plan_territory_beats FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert ubptb" ON public.user_business_plan_territory_beats; CREATE POLICY "Auth insert ubptb" ON public.user_business_plan_territory_beats FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update ubptb" ON public.user_business_plan_territory_beats; CREATE POLICY "Auth update ubptb" ON public.user_business_plan_territory_beats FOR UPDATE TO authenticated USING (true);

-- user_period_allocations
DROP POLICY IF EXISTS "Auth read user_period_allocations" ON public.user_period_allocations; CREATE POLICY "Auth read user_period_allocations" ON public.user_period_allocations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert user_period_allocations" ON public.user_period_allocations; CREATE POLICY "Admin insert user_period_allocations" ON public.user_period_allocations FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update user_period_allocations" ON public.user_period_allocations; CREATE POLICY "Admin update user_period_allocations" ON public.user_period_allocations FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- van_closing_stock
DROP POLICY IF EXISTS "Auth read van_closing_stock" ON public.van_closing_stock; CREATE POLICY "Auth read van_closing_stock" ON public.van_closing_stock FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert van_closing_stock" ON public.van_closing_stock; CREATE POLICY "Auth insert van_closing_stock" ON public.van_closing_stock FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update van_closing_stock" ON public.van_closing_stock; CREATE POLICY "Auth update van_closing_stock" ON public.van_closing_stock FOR UPDATE TO authenticated USING (true);

-- van_closing_stock_items
DROP POLICY IF EXISTS "Auth read van_closing_stock_items" ON public.van_closing_stock_items; CREATE POLICY "Auth read van_closing_stock_items" ON public.van_closing_stock_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert van_closing_stock_items" ON public.van_closing_stock_items; CREATE POLICY "Auth insert van_closing_stock_items" ON public.van_closing_stock_items FOR INSERT TO authenticated WITH CHECK (true);

-- van_inward_grn_items
DROP POLICY IF EXISTS "Auth read van_inward_grn_items" ON public.van_inward_grn_items; CREATE POLICY "Auth read van_inward_grn_items" ON public.van_inward_grn_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert van_inward_grn_items" ON public.van_inward_grn_items; CREATE POLICY "Auth insert van_inward_grn_items" ON public.van_inward_grn_items FOR INSERT TO authenticated WITH CHECK (true);

-- van_live_inventory
DROP POLICY IF EXISTS "Auth read van_live_inventory" ON public.van_live_inventory; CREATE POLICY "Auth read van_live_inventory" ON public.van_live_inventory FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert van_live_inventory" ON public.van_live_inventory; CREATE POLICY "Auth insert van_live_inventory" ON public.van_live_inventory FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update van_live_inventory" ON public.van_live_inventory; CREATE POLICY "Auth update van_live_inventory" ON public.van_live_inventory FOR UPDATE TO authenticated USING (true);

-- van_order_fulfillment
DROP POLICY IF EXISTS "Auth read van_order_fulfillment" ON public.van_order_fulfillment; CREATE POLICY "Auth read van_order_fulfillment" ON public.van_order_fulfillment FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert van_order_fulfillment" ON public.van_order_fulfillment; CREATE POLICY "Auth insert van_order_fulfillment" ON public.van_order_fulfillment FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update van_order_fulfillment" ON public.van_order_fulfillment; CREATE POLICY "Auth update van_order_fulfillment" ON public.van_order_fulfillment FOR UPDATE TO authenticated USING (true);

-- van_return_grn_items
DROP POLICY IF EXISTS "Auth read van_return_grn_items" ON public.van_return_grn_items; CREATE POLICY "Auth read van_return_grn_items" ON public.van_return_grn_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert van_return_grn_items" ON public.van_return_grn_items; CREATE POLICY "Auth insert van_return_grn_items" ON public.van_return_grn_items FOR INSERT TO authenticated WITH CHECK (true);

-- van_sales_settings
DROP POLICY IF EXISTS "Auth read van_sales_settings" ON public.van_sales_settings; CREATE POLICY "Auth read van_sales_settings" ON public.van_sales_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert van_sales_settings" ON public.van_sales_settings; CREATE POLICY "Admin insert van_sales_settings" ON public.van_sales_settings FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update van_sales_settings" ON public.van_sales_settings; CREATE POLICY "Admin update van_sales_settings" ON public.van_sales_settings FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- van_stock_items
DROP POLICY IF EXISTS "Auth read van_stock_items" ON public.van_stock_items; CREATE POLICY "Auth read van_stock_items" ON public.van_stock_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth insert van_stock_items" ON public.van_stock_items; CREATE POLICY "Auth insert van_stock_items" ON public.van_stock_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth update van_stock_items" ON public.van_stock_items; CREATE POLICY "Auth update van_stock_items" ON public.van_stock_items FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth delete van_stock_items" ON public.van_stock_items; CREATE POLICY "Auth delete van_stock_items" ON public.van_stock_items FOR DELETE TO authenticated USING (true);

-- week_off_config
DROP POLICY IF EXISTS "Auth read week_off_config" ON public.week_off_config; CREATE POLICY "Auth read week_off_config" ON public.week_off_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert week_off_config" ON public.week_off_config; CREATE POLICY "Admin insert week_off_config" ON public.week_off_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update week_off_config" ON public.week_off_config; CREATE POLICY "Admin update week_off_config" ON public.week_off_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- working_days_config
DROP POLICY IF EXISTS "Auth read working_days_config" ON public.working_days_config; CREATE POLICY "Auth read working_days_config" ON public.working_days_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin insert working_days_config" ON public.working_days_config; CREATE POLICY "Admin insert working_days_config" ON public.working_days_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin update working_days_config" ON public.working_days_config; CREATE POLICY "Admin update working_days_config" ON public.working_days_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
