
-- BATCH 4: Child/join tables and remaining config - all get read-all, admin-write

-- branding_request_items
DROP POLICY IF EXISTS "Auth can read branding_request_items" ON public.branding_request_items;
CREATE POLICY "Auth can read branding_request_items" ON public.branding_request_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can manage branding_request_items" ON public.branding_request_items;
CREATE POLICY "Admin can manage branding_request_items" ON public.branding_request_items FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update branding_request_items" ON public.branding_request_items;
CREATE POLICY "Admin can update branding_request_items" ON public.branding_request_items FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- chat_messages
DROP POLICY IF EXISTS "Auth can read chat_messages" ON public.chat_messages;
CREATE POLICY "Auth can read chat_messages" ON public.chat_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert chat_messages" ON public.chat_messages;
CREATE POLICY "Auth can insert chat_messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin can update chat_messages" ON public.chat_messages;
CREATE POLICY "Admin can update chat_messages" ON public.chat_messages FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- credit_note_items
DROP POLICY IF EXISTS "Auth can read credit_note_items" ON public.credit_note_items;
CREATE POLICY "Auth can read credit_note_items" ON public.credit_note_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert credit_note_items" ON public.credit_note_items;
CREATE POLICY "Auth can insert credit_note_items" ON public.credit_note_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin can update credit_note_items" ON public.credit_note_items;
CREATE POLICY "Admin can update credit_note_items" ON public.credit_note_items FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- feedback_policy_rules
DROP POLICY IF EXISTS "Auth can read feedback_policy_rules" ON public.feedback_policy_rules;
CREATE POLICY "Auth can read feedback_policy_rules" ON public.feedback_policy_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert feedback_policy_rules" ON public.feedback_policy_rules;
CREATE POLICY "Admin can insert feedback_policy_rules" ON public.feedback_policy_rules FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update feedback_policy_rules" ON public.feedback_policy_rules;
CREATE POLICY "Admin can update feedback_policy_rules" ON public.feedback_policy_rules FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete feedback_policy_rules" ON public.feedback_policy_rules;
CREATE POLICY "Admin can delete feedback_policy_rules" ON public.feedback_policy_rules FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- fy_period_targets
DROP POLICY IF EXISTS "Auth can read fy_period_targets" ON public.fy_period_targets;
CREATE POLICY "Auth can read fy_period_targets" ON public.fy_period_targets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert fy_period_targets" ON public.fy_period_targets;
CREATE POLICY "Admin can insert fy_period_targets" ON public.fy_period_targets FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update fy_period_targets" ON public.fy_period_targets;
CREATE POLICY "Admin can update fy_period_targets" ON public.fy_period_targets FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete fy_period_targets" ON public.fy_period_targets;
CREATE POLICY "Admin can delete fy_period_targets" ON public.fy_period_targets FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- inst_contacts
DROP POLICY IF EXISTS "Auth can read inst_contacts" ON public.inst_contacts;
CREATE POLICY "Auth can read inst_contacts" ON public.inst_contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert inst_contacts" ON public.inst_contacts;
CREATE POLICY "Auth can insert inst_contacts" ON public.inst_contacts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update inst_contacts" ON public.inst_contacts;
CREATE POLICY "Auth can update inst_contacts" ON public.inst_contacts FOR UPDATE TO authenticated USING (true);

-- inst_invoice_lines
DROP POLICY IF EXISTS "Auth can read inst_invoice_lines" ON public.inst_invoice_lines;
CREATE POLICY "Auth can read inst_invoice_lines" ON public.inst_invoice_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert inst_invoice_lines" ON public.inst_invoice_lines;
CREATE POLICY "Auth can insert inst_invoice_lines" ON public.inst_invoice_lines FOR INSERT TO authenticated WITH CHECK (true);

-- inst_order_commitment_lines
DROP POLICY IF EXISTS "Auth can read inst_ocl" ON public.inst_order_commitment_lines;
CREATE POLICY "Auth can read inst_ocl" ON public.inst_order_commitment_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert inst_ocl" ON public.inst_order_commitment_lines;
CREATE POLICY "Auth can insert inst_ocl" ON public.inst_order_commitment_lines FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update inst_ocl" ON public.inst_order_commitment_lines;
CREATE POLICY "Auth can update inst_ocl" ON public.inst_order_commitment_lines FOR UPDATE TO authenticated USING (true);

-- inst_quote_line_items
DROP POLICY IF EXISTS "Auth can read inst_qli" ON public.inst_quote_line_items;
CREATE POLICY "Auth can read inst_qli" ON public.inst_quote_line_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert inst_qli" ON public.inst_quote_line_items;
CREATE POLICY "Auth can insert inst_qli" ON public.inst_quote_line_items FOR INSERT TO authenticated WITH CHECK (true);

-- invoice_items
DROP POLICY IF EXISTS "Auth can read invoice_items" ON public.invoice_items;
CREATE POLICY "Auth can read invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert invoice_items" ON public.invoice_items;
CREATE POLICY "Auth can insert invoice_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (true);

-- order_cancellation_log
DROP POLICY IF EXISTS "Auth can read order_cancellation_log" ON public.order_cancellation_log;
CREATE POLICY "Auth can read order_cancellation_log" ON public.order_cancellation_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert order_cancellation_log" ON public.order_cancellation_log;
CREATE POLICY "Auth can insert order_cancellation_log" ON public.order_cancellation_log FOR INSERT TO authenticated WITH CHECK (true);

-- packing_list_assignments
DROP POLICY IF EXISTS "Auth can read packing_list_assignments" ON public.packing_list_assignments;
CREATE POLICY "Auth can read packing_list_assignments" ON public.packing_list_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert packing_list_assignments" ON public.packing_list_assignments;
CREATE POLICY "Auth can insert packing_list_assignments" ON public.packing_list_assignments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update packing_list_assignments" ON public.packing_list_assignments;
CREATE POLICY "Auth can update packing_list_assignments" ON public.packing_list_assignments FOR UPDATE TO authenticated USING (true);

-- packing_list_items
DROP POLICY IF EXISTS "Auth can read packing_list_items" ON public.packing_list_items;
CREATE POLICY "Auth can read packing_list_items" ON public.packing_list_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert packing_list_items" ON public.packing_list_items;
CREATE POLICY "Auth can insert packing_list_items" ON public.packing_list_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update packing_list_items" ON public.packing_list_items;
CREATE POLICY "Auth can update packing_list_items" ON public.packing_list_items FOR UPDATE TO authenticated USING (true);

-- password_reset_attempts
DROP POLICY IF EXISTS "Auth can read password_reset_attempts" ON public.password_reset_attempts;
CREATE POLICY "Auth can read password_reset_attempts" ON public.password_reset_attempts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert password_reset_attempts" ON public.password_reset_attempts;
CREATE POLICY "Auth can insert password_reset_attempts" ON public.password_reset_attempts FOR INSERT TO authenticated WITH CHECK (true);

-- performance_module_config
DROP POLICY IF EXISTS "Auth can read performance_module_config" ON public.performance_module_config;
CREATE POLICY "Auth can read performance_module_config" ON public.performance_module_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert performance_module_config" ON public.performance_module_config;
CREATE POLICY "Admin can insert performance_module_config" ON public.performance_module_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update performance_module_config" ON public.performance_module_config;
CREATE POLICY "Admin can update performance_module_config" ON public.performance_module_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- permanent_deletion_log
DROP POLICY IF EXISTS "Auth can read permanent_deletion_log" ON public.permanent_deletion_log;
CREATE POLICY "Auth can read permanent_deletion_log" ON public.permanent_deletion_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert permanent_deletion_log" ON public.permanent_deletion_log;
CREATE POLICY "Admin can insert permanent_deletion_log" ON public.permanent_deletion_log FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

-- petty_cash_limits
DROP POLICY IF EXISTS "Auth can read petty_cash_limits" ON public.petty_cash_limits;
CREATE POLICY "Auth can read petty_cash_limits" ON public.petty_cash_limits FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert petty_cash_limits" ON public.petty_cash_limits;
CREATE POLICY "Admin can insert petty_cash_limits" ON public.petty_cash_limits FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update petty_cash_limits" ON public.petty_cash_limits;
CREATE POLICY "Admin can update petty_cash_limits" ON public.petty_cash_limits FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- pincode_master
DROP POLICY IF EXISTS "Auth can read pincode_master" ON public.pincode_master;
CREATE POLICY "Auth can read pincode_master" ON public.pincode_master FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert pincode_master" ON public.pincode_master;
CREATE POLICY "Admin can insert pincode_master" ON public.pincode_master FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update pincode_master" ON public.pincode_master;
CREATE POLICY "Admin can update pincode_master" ON public.pincode_master FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- plan_enabled_metrics
DROP POLICY IF EXISTS "Auth can read plan_enabled_metrics" ON public.plan_enabled_metrics;
CREATE POLICY "Auth can read plan_enabled_metrics" ON public.plan_enabled_metrics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert plan_enabled_metrics" ON public.plan_enabled_metrics;
CREATE POLICY "Admin can insert plan_enabled_metrics" ON public.plan_enabled_metrics FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update plan_enabled_metrics" ON public.plan_enabled_metrics;
CREATE POLICY "Admin can update plan_enabled_metrics" ON public.plan_enabled_metrics FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- pm_ai_insights
DROP POLICY IF EXISTS "Auth can read pm_ai_insights" ON public.pm_ai_insights;
CREATE POLICY "Auth can read pm_ai_insights" ON public.pm_ai_insights FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert pm_ai_insights" ON public.pm_ai_insights;
CREATE POLICY "Admin can insert pm_ai_insights" ON public.pm_ai_insights FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

-- pm_knowledge_documents
DROP POLICY IF EXISTS "Auth can read pm_knowledge_documents" ON public.pm_knowledge_documents;
CREATE POLICY "Auth can read pm_knowledge_documents" ON public.pm_knowledge_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert pm_knowledge_documents" ON public.pm_knowledge_documents;
CREATE POLICY "Auth can insert pm_knowledge_documents" ON public.pm_knowledge_documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update pm_knowledge_documents" ON public.pm_knowledge_documents;
CREATE POLICY "Auth can update pm_knowledge_documents" ON public.pm_knowledge_documents FOR UPDATE TO authenticated USING (true);

-- pm_milestones
DROP POLICY IF EXISTS "Auth can read pm_milestones" ON public.pm_milestones;
CREATE POLICY "Auth can read pm_milestones" ON public.pm_milestones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert pm_milestones" ON public.pm_milestones;
CREATE POLICY "Auth can insert pm_milestones" ON public.pm_milestones FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update pm_milestones" ON public.pm_milestones;
CREATE POLICY "Auth can update pm_milestones" ON public.pm_milestones FOR UPDATE TO authenticated USING (true);

-- pm_project_resources
DROP POLICY IF EXISTS "Auth can read pm_project_resources" ON public.pm_project_resources;
CREATE POLICY "Auth can read pm_project_resources" ON public.pm_project_resources FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert pm_project_resources" ON public.pm_project_resources;
CREATE POLICY "Auth can insert pm_project_resources" ON public.pm_project_resources FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update pm_project_resources" ON public.pm_project_resources;
CREATE POLICY "Auth can update pm_project_resources" ON public.pm_project_resources FOR UPDATE TO authenticated USING (true);

-- pm_sections
DROP POLICY IF EXISTS "Auth can read pm_sections" ON public.pm_sections;
CREATE POLICY "Auth can read pm_sections" ON public.pm_sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert pm_sections" ON public.pm_sections;
CREATE POLICY "Auth can insert pm_sections" ON public.pm_sections FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update pm_sections" ON public.pm_sections;
CREATE POLICY "Auth can update pm_sections" ON public.pm_sections FOR UPDATE TO authenticated USING (true);

-- pm_sprints
DROP POLICY IF EXISTS "Auth can read pm_sprints" ON public.pm_sprints;
CREATE POLICY "Auth can read pm_sprints" ON public.pm_sprints FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert pm_sprints" ON public.pm_sprints;
CREATE POLICY "Auth can insert pm_sprints" ON public.pm_sprints FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update pm_sprints" ON public.pm_sprints;
CREATE POLICY "Auth can update pm_sprints" ON public.pm_sprints FOR UPDATE TO authenticated USING (true);

-- pm_support_requests
DROP POLICY IF EXISTS "Auth can read pm_support_requests" ON public.pm_support_requests;
CREATE POLICY "Auth can read pm_support_requests" ON public.pm_support_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert pm_support_requests" ON public.pm_support_requests;
CREATE POLICY "Auth can insert pm_support_requests" ON public.pm_support_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update pm_support_requests" ON public.pm_support_requests;
CREATE POLICY "Auth can update pm_support_requests" ON public.pm_support_requests FOR UPDATE TO authenticated USING (true);

-- pm_task_attachments
DROP POLICY IF EXISTS "Auth can read pm_task_attachments" ON public.pm_task_attachments;
CREATE POLICY "Auth can read pm_task_attachments" ON public.pm_task_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert pm_task_attachments" ON public.pm_task_attachments;
CREATE POLICY "Auth can insert pm_task_attachments" ON public.pm_task_attachments FOR INSERT TO authenticated WITH CHECK (true);

-- pm_task_dependencies
DROP POLICY IF EXISTS "Auth can read pm_task_dependencies" ON public.pm_task_dependencies;
CREATE POLICY "Auth can read pm_task_dependencies" ON public.pm_task_dependencies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert pm_task_dependencies" ON public.pm_task_dependencies;
CREATE POLICY "Auth can insert pm_task_dependencies" ON public.pm_task_dependencies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can delete pm_task_dependencies" ON public.pm_task_dependencies;
CREATE POLICY "Auth can delete pm_task_dependencies" ON public.pm_task_dependencies FOR DELETE TO authenticated USING (true);

-- pm_template_attachments
DROP POLICY IF EXISTS "Auth can read pm_template_attachments" ON public.pm_template_attachments;
CREATE POLICY "Auth can read pm_template_attachments" ON public.pm_template_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert pm_template_attachments" ON public.pm_template_attachments;
CREATE POLICY "Admin can insert pm_template_attachments" ON public.pm_template_attachments FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

-- pm_template_dependencies
DROP POLICY IF EXISTS "Auth can read pm_template_dependencies" ON public.pm_template_dependencies;
CREATE POLICY "Auth can read pm_template_dependencies" ON public.pm_template_dependencies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert pm_template_dependencies" ON public.pm_template_dependencies;
CREATE POLICY "Admin can insert pm_template_dependencies" ON public.pm_template_dependencies FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

-- pm_template_sections
DROP POLICY IF EXISTS "Auth can read pm_template_sections" ON public.pm_template_sections;
CREATE POLICY "Auth can read pm_template_sections" ON public.pm_template_sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert pm_template_sections" ON public.pm_template_sections;
CREATE POLICY "Admin can insert pm_template_sections" ON public.pm_template_sections FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update pm_template_sections" ON public.pm_template_sections;
CREATE POLICY "Admin can update pm_template_sections" ON public.pm_template_sections FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- pm_template_tasks
DROP POLICY IF EXISTS "Auth can read pm_template_tasks" ON public.pm_template_tasks;
CREATE POLICY "Auth can read pm_template_tasks" ON public.pm_template_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert pm_template_tasks" ON public.pm_template_tasks;
CREATE POLICY "Admin can insert pm_template_tasks" ON public.pm_template_tasks FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update pm_template_tasks" ON public.pm_template_tasks;
CREATE POLICY "Admin can update pm_template_tasks" ON public.pm_template_tasks FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- pm_templates
DROP POLICY IF EXISTS "Auth can read pm_templates" ON public.pm_templates;
CREATE POLICY "Auth can read pm_templates" ON public.pm_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert pm_templates" ON public.pm_templates;
CREATE POLICY "Admin can insert pm_templates" ON public.pm_templates FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update pm_templates" ON public.pm_templates;
CREATE POLICY "Admin can update pm_templates" ON public.pm_templates FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- price_book_entries
DROP POLICY IF EXISTS "Auth can read price_book_entries" ON public.price_book_entries;
CREATE POLICY "Auth can read price_book_entries" ON public.price_book_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert price_book_entries" ON public.price_book_entries;
CREATE POLICY "Admin can insert price_book_entries" ON public.price_book_entries FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update price_book_entries" ON public.price_book_entries;
CREATE POLICY "Admin can update price_book_entries" ON public.price_book_entries FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete price_book_entries" ON public.price_book_entries;
CREATE POLICY "Admin can delete price_book_entries" ON public.price_book_entries FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- primary_order_items
DROP POLICY IF EXISTS "Auth can read primary_order_items" ON public.primary_order_items;
CREATE POLICY "Auth can read primary_order_items" ON public.primary_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert primary_order_items" ON public.primary_order_items;
CREATE POLICY "Auth can insert primary_order_items" ON public.primary_order_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update primary_order_items" ON public.primary_order_items;
CREATE POLICY "Auth can update primary_order_items" ON public.primary_order_items FOR UPDATE TO authenticated USING (true);

-- primary_order_schemes
DROP POLICY IF EXISTS "Auth can read primary_order_schemes" ON public.primary_order_schemes;
CREATE POLICY "Auth can read primary_order_schemes" ON public.primary_order_schemes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert primary_order_schemes" ON public.primary_order_schemes;
CREATE POLICY "Auth can insert primary_order_schemes" ON public.primary_order_schemes FOR INSERT TO authenticated WITH CHECK (true);

-- primary_order_status_history
DROP POLICY IF EXISTS "Auth can read primary_order_status_history" ON public.primary_order_status_history;
CREATE POLICY "Auth can read primary_order_status_history" ON public.primary_order_status_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert primary_order_status_history" ON public.primary_order_status_history;
CREATE POLICY "Auth can insert primary_order_status_history" ON public.primary_order_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- primary_return_items
DROP POLICY IF EXISTS "Auth can read primary_return_items" ON public.primary_return_items;
CREATE POLICY "Auth can read primary_return_items" ON public.primary_return_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert primary_return_items" ON public.primary_return_items;
CREATE POLICY "Auth can insert primary_return_items" ON public.primary_return_items FOR INSERT TO authenticated WITH CHECK (true);

-- primary_return_notes
DROP POLICY IF EXISTS "Auth can read primary_return_notes" ON public.primary_return_notes;
CREATE POLICY "Auth can read primary_return_notes" ON public.primary_return_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert primary_return_notes" ON public.primary_return_notes;
CREATE POLICY "Auth can insert primary_return_notes" ON public.primary_return_notes FOR INSERT TO authenticated WITH CHECK (true);

-- primary_shipments
DROP POLICY IF EXISTS "Auth can read primary_shipments" ON public.primary_shipments;
CREATE POLICY "Auth can read primary_shipments" ON public.primary_shipments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth can insert primary_shipments" ON public.primary_shipments;
CREATE POLICY "Auth can insert primary_shipments" ON public.primary_shipments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth can update primary_shipments" ON public.primary_shipments;
CREATE POLICY "Auth can update primary_shipments" ON public.primary_shipments FOR UPDATE TO authenticated USING (true);

-- product_categories
DROP POLICY IF EXISTS "Auth can read product_categories" ON public.product_categories;
CREATE POLICY "Auth can read product_categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert product_categories" ON public.product_categories;
CREATE POLICY "Admin can insert product_categories" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update product_categories" ON public.product_categories;
CREATE POLICY "Admin can update product_categories" ON public.product_categories FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete product_categories" ON public.product_categories;
CREATE POLICY "Admin can delete product_categories" ON public.product_categories FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- product_schemes
DROP POLICY IF EXISTS "Auth can read product_schemes" ON public.product_schemes;
CREATE POLICY "Auth can read product_schemes" ON public.product_schemes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert product_schemes" ON public.product_schemes;
CREATE POLICY "Admin can insert product_schemes" ON public.product_schemes FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update product_schemes" ON public.product_schemes;
CREATE POLICY "Admin can update product_schemes" ON public.product_schemes FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete product_schemes" ON public.product_schemes;
CREATE POLICY "Admin can delete product_schemes" ON public.product_schemes FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- product_variants
DROP POLICY IF EXISTS "Auth can read product_variants" ON public.product_variants;
CREATE POLICY "Auth can read product_variants" ON public.product_variants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin can insert product_variants" ON public.product_variants;
CREATE POLICY "Admin can insert product_variants" ON public.product_variants FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can update product_variants" ON public.product_variants;
CREATE POLICY "Admin can update product_variants" ON public.product_variants FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin can delete product_variants" ON public.product_variants;
CREATE POLICY "Admin can delete product_variants" ON public.product_variants FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));
