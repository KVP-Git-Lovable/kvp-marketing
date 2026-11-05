
-- BATCH 1: Config/Reference Tables - All authenticated can SELECT, admins manage
-- Pattern: read-all, admin-write

-- accrual_config
DROP POLICY IF EXISTS "Authenticated can read accrual_config" ON public.accrual_config;
CREATE POLICY "Authenticated can read accrual_config" ON public.accrual_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert accrual_config" ON public.accrual_config;
CREATE POLICY "Admins can insert accrual_config" ON public.accrual_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update accrual_config" ON public.accrual_config;
CREATE POLICY "Admins can update accrual_config" ON public.accrual_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete accrual_config" ON public.accrual_config;
CREATE POLICY "Admins can delete accrual_config" ON public.accrual_config FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- ai_scheme_suggestions
DROP POLICY IF EXISTS "Authenticated can read ai_scheme_suggestions" ON public.ai_scheme_suggestions;
CREATE POLICY "Authenticated can read ai_scheme_suggestions" ON public.ai_scheme_suggestions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert ai_scheme_suggestions" ON public.ai_scheme_suggestions;
CREATE POLICY "Admins can insert ai_scheme_suggestions" ON public.ai_scheme_suggestions FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update ai_scheme_suggestions" ON public.ai_scheme_suggestions;
CREATE POLICY "Admins can update ai_scheme_suggestions" ON public.ai_scheme_suggestions FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete ai_scheme_suggestions" ON public.ai_scheme_suggestions;
CREATE POLICY "Admins can delete ai_scheme_suggestions" ON public.ai_scheme_suggestions FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- badges
DROP POLICY IF EXISTS "Authenticated can read badges" ON public.badges;
CREATE POLICY "Authenticated can read badges" ON public.badges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert badges" ON public.badges;
CREATE POLICY "Admins can insert badges" ON public.badges FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update badges" ON public.badges;
CREATE POLICY "Admins can update badges" ON public.badges FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete badges" ON public.badges;
CREATE POLICY "Admins can delete badges" ON public.badges FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- coach_badges
DROP POLICY IF EXISTS "Authenticated can read coach_badges" ON public.coach_badges;
CREATE POLICY "Authenticated can read coach_badges" ON public.coach_badges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert coach_badges" ON public.coach_badges;
CREATE POLICY "Admins can insert coach_badges" ON public.coach_badges FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update coach_badges" ON public.coach_badges;
CREATE POLICY "Admins can update coach_badges" ON public.coach_badges FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete coach_badges" ON public.coach_badges;
CREATE POLICY "Admins can delete coach_badges" ON public.coach_badges FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- coach_competencies
DROP POLICY IF EXISTS "Authenticated can read coach_competencies" ON public.coach_competencies;
CREATE POLICY "Authenticated can read coach_competencies" ON public.coach_competencies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert coach_competencies" ON public.coach_competencies;
CREATE POLICY "Admins can insert coach_competencies" ON public.coach_competencies FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update coach_competencies" ON public.coach_competencies;
CREATE POLICY "Admins can update coach_competencies" ON public.coach_competencies FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete coach_competencies" ON public.coach_competencies;
CREATE POLICY "Admins can delete coach_competencies" ON public.coach_competencies FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- coach_learning_content
DROP POLICY IF EXISTS "Authenticated can read coach_learning_content" ON public.coach_learning_content;
CREATE POLICY "Authenticated can read coach_learning_content" ON public.coach_learning_content FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert coach_learning_content" ON public.coach_learning_content;
CREATE POLICY "Admins can insert coach_learning_content" ON public.coach_learning_content FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update coach_learning_content" ON public.coach_learning_content;
CREATE POLICY "Admins can update coach_learning_content" ON public.coach_learning_content FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete coach_learning_content" ON public.coach_learning_content;
CREATE POLICY "Admins can delete coach_learning_content" ON public.coach_learning_content FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- coach_quiz_questions
DROP POLICY IF EXISTS "Authenticated can read coach_quiz_questions" ON public.coach_quiz_questions;
CREATE POLICY "Authenticated can read coach_quiz_questions" ON public.coach_quiz_questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert coach_quiz_questions" ON public.coach_quiz_questions;
CREATE POLICY "Admins can insert coach_quiz_questions" ON public.coach_quiz_questions FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update coach_quiz_questions" ON public.coach_quiz_questions;
CREATE POLICY "Admins can update coach_quiz_questions" ON public.coach_quiz_questions FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete coach_quiz_questions" ON public.coach_quiz_questions;
CREATE POLICY "Admins can delete coach_quiz_questions" ON public.coach_quiz_questions FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- coach_scenarios
DROP POLICY IF EXISTS "Authenticated can read coach_scenarios" ON public.coach_scenarios;
CREATE POLICY "Authenticated can read coach_scenarios" ON public.coach_scenarios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert coach_scenarios" ON public.coach_scenarios;
CREATE POLICY "Admins can insert coach_scenarios" ON public.coach_scenarios FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update coach_scenarios" ON public.coach_scenarios;
CREATE POLICY "Admins can update coach_scenarios" ON public.coach_scenarios FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete coach_scenarios" ON public.coach_scenarios;
CREATE POLICY "Admins can delete coach_scenarios" ON public.coach_scenarios FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- companies
DROP POLICY IF EXISTS "Authenticated can read companies" ON public.companies;
CREATE POLICY "Authenticated can read companies" ON public.companies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;
CREATE POLICY "Admins can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update companies" ON public.companies;
CREATE POLICY "Admins can update companies" ON public.companies FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete companies" ON public.companies;
CREATE POLICY "Admins can delete companies" ON public.companies FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- competencies
DROP POLICY IF EXISTS "Authenticated can read competencies" ON public.competencies;
CREATE POLICY "Authenticated can read competencies" ON public.competencies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert competencies" ON public.competencies;
CREATE POLICY "Admins can insert competencies" ON public.competencies FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update competencies" ON public.competencies;
CREATE POLICY "Admins can update competencies" ON public.competencies FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete competencies" ON public.competencies;
CREATE POLICY "Admins can delete competencies" ON public.competencies FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- competency_templates
DROP POLICY IF EXISTS "Authenticated can read competency_templates" ON public.competency_templates;
CREATE POLICY "Authenticated can read competency_templates" ON public.competency_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert competency_templates" ON public.competency_templates;
CREATE POLICY "Admins can insert competency_templates" ON public.competency_templates FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update competency_templates" ON public.competency_templates;
CREATE POLICY "Admins can update competency_templates" ON public.competency_templates FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete competency_templates" ON public.competency_templates;
CREATE POLICY "Admins can delete competency_templates" ON public.competency_templates FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- competition_master
DROP POLICY IF EXISTS "Authenticated can read competition_master" ON public.competition_master;
CREATE POLICY "Authenticated can read competition_master" ON public.competition_master FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert competition_master" ON public.competition_master;
CREATE POLICY "Admins can insert competition_master" ON public.competition_master FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update competition_master" ON public.competition_master;
CREATE POLICY "Admins can update competition_master" ON public.competition_master FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete competition_master" ON public.competition_master;
CREATE POLICY "Admins can delete competition_master" ON public.competition_master FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- competition_contacts
DROP POLICY IF EXISTS "Authenticated can read competition_contacts" ON public.competition_contacts;
CREATE POLICY "Authenticated can read competition_contacts" ON public.competition_contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert competition_contacts" ON public.competition_contacts;
CREATE POLICY "Admins can insert competition_contacts" ON public.competition_contacts FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update competition_contacts" ON public.competition_contacts;
CREATE POLICY "Admins can update competition_contacts" ON public.competition_contacts FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete competition_contacts" ON public.competition_contacts;
CREATE POLICY "Admins can delete competition_contacts" ON public.competition_contacts FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- competition_skus
DROP POLICY IF EXISTS "Authenticated can read competition_skus" ON public.competition_skus;
CREATE POLICY "Authenticated can read competition_skus" ON public.competition_skus FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert competition_skus" ON public.competition_skus;
CREATE POLICY "Admins can insert competition_skus" ON public.competition_skus FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update competition_skus" ON public.competition_skus;
CREATE POLICY "Admins can update competition_skus" ON public.competition_skus FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete competition_skus" ON public.competition_skus;
CREATE POLICY "Admins can delete competition_skus" ON public.competition_skus FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- credit_management_config
DROP POLICY IF EXISTS "Authenticated can read credit_management_config" ON public.credit_management_config;
CREATE POLICY "Authenticated can read credit_management_config" ON public.credit_management_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert credit_management_config" ON public.credit_management_config;
CREATE POLICY "Admins can insert credit_management_config" ON public.credit_management_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update credit_management_config" ON public.credit_management_config;
CREATE POLICY "Admins can update credit_management_config" ON public.credit_management_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete credit_management_config" ON public.credit_management_config;
CREATE POLICY "Admins can delete credit_management_config" ON public.credit_management_config FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- customers
DROP POLICY IF EXISTS "Authenticated can read customers" ON public.customers;
CREATE POLICY "Authenticated can read customers" ON public.customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
CREATE POLICY "Admins can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- expense_categories
DROP POLICY IF EXISTS "Authenticated can read expense_categories" ON public.expense_categories;
CREATE POLICY "Authenticated can read expense_categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert expense_categories" ON public.expense_categories;
CREATE POLICY "Admins can insert expense_categories" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update expense_categories" ON public.expense_categories;
CREATE POLICY "Admins can update expense_categories" ON public.expense_categories FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete expense_categories" ON public.expense_categories;
CREATE POLICY "Admins can delete expense_categories" ON public.expense_categories FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- expense_master_config
DROP POLICY IF EXISTS "Authenticated can read expense_master_config" ON public.expense_master_config;
CREATE POLICY "Authenticated can read expense_master_config" ON public.expense_master_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert expense_master_config" ON public.expense_master_config;
CREATE POLICY "Admins can insert expense_master_config" ON public.expense_master_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update expense_master_config" ON public.expense_master_config;
CREATE POLICY "Admins can update expense_master_config" ON public.expense_master_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete expense_master_config" ON public.expense_master_config;
CREATE POLICY "Admins can delete expense_master_config" ON public.expense_master_config FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- expense_groups
DROP POLICY IF EXISTS "Authenticated can read expense_groups" ON public.expense_groups;
CREATE POLICY "Authenticated can read expense_groups" ON public.expense_groups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert expense_groups" ON public.expense_groups;
CREATE POLICY "Admins can insert expense_groups" ON public.expense_groups FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update expense_groups" ON public.expense_groups;
CREATE POLICY "Admins can update expense_groups" ON public.expense_groups FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete expense_groups" ON public.expense_groups;
CREATE POLICY "Admins can delete expense_groups" ON public.expense_groups FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- expense_approval_rules
DROP POLICY IF EXISTS "Authenticated can read expense_approval_rules" ON public.expense_approval_rules;
CREATE POLICY "Authenticated can read expense_approval_rules" ON public.expense_approval_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert expense_approval_rules" ON public.expense_approval_rules;
CREATE POLICY "Admins can insert expense_approval_rules" ON public.expense_approval_rules FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update expense_approval_rules" ON public.expense_approval_rules;
CREATE POLICY "Admins can update expense_approval_rules" ON public.expense_approval_rules FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete expense_approval_rules" ON public.expense_approval_rules;
CREATE POLICY "Admins can delete expense_approval_rules" ON public.expense_approval_rules FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- feature_flags
DROP POLICY IF EXISTS "Authenticated can read feature_flags" ON public.feature_flags;
CREATE POLICY "Authenticated can read feature_flags" ON public.feature_flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert feature_flags" ON public.feature_flags;
CREATE POLICY "Admins can insert feature_flags" ON public.feature_flags FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update feature_flags" ON public.feature_flags;
CREATE POLICY "Admins can update feature_flags" ON public.feature_flags FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete feature_flags" ON public.feature_flags;
CREATE POLICY "Admins can delete feature_flags" ON public.feature_flags FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- feature_flag_audit
DROP POLICY IF EXISTS "Authenticated can read feature_flag_audit" ON public.feature_flag_audit;
CREATE POLICY "Authenticated can read feature_flag_audit" ON public.feature_flag_audit FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert feature_flag_audit" ON public.feature_flag_audit;
CREATE POLICY "Admins can insert feature_flag_audit" ON public.feature_flag_audit FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));

-- gamification_actions
DROP POLICY IF EXISTS "Authenticated can read gamification_actions" ON public.gamification_actions;
CREATE POLICY "Authenticated can read gamification_actions" ON public.gamification_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert gamification_actions" ON public.gamification_actions;
CREATE POLICY "Admins can insert gamification_actions" ON public.gamification_actions FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update gamification_actions" ON public.gamification_actions;
CREATE POLICY "Admins can update gamification_actions" ON public.gamification_actions FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete gamification_actions" ON public.gamification_actions;
CREATE POLICY "Admins can delete gamification_actions" ON public.gamification_actions FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- gamification_games
DROP POLICY IF EXISTS "Authenticated can read gamification_games" ON public.gamification_games;
CREATE POLICY "Authenticated can read gamification_games" ON public.gamification_games FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert gamification_games" ON public.gamification_games;
CREATE POLICY "Admins can insert gamification_games" ON public.gamification_games FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update gamification_games" ON public.gamification_games;
CREATE POLICY "Admins can update gamification_games" ON public.gamification_games FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete gamification_games" ON public.gamification_games;
CREATE POLICY "Admins can delete gamification_games" ON public.gamification_games FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- holidays
DROP POLICY IF EXISTS "Authenticated can read holidays" ON public.holidays;
CREATE POLICY "Authenticated can read holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert holidays" ON public.holidays;
CREATE POLICY "Admins can insert holidays" ON public.holidays FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update holidays" ON public.holidays;
CREATE POLICY "Admins can update holidays" ON public.holidays FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete holidays" ON public.holidays;
CREATE POLICY "Admins can delete holidays" ON public.holidays FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- invoice_display_settings
DROP POLICY IF EXISTS "Authenticated can read invoice_display_settings" ON public.invoice_display_settings;
CREATE POLICY "Authenticated can read invoice_display_settings" ON public.invoice_display_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert invoice_display_settings" ON public.invoice_display_settings;
CREATE POLICY "Admins can insert invoice_display_settings" ON public.invoice_display_settings FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update invoice_display_settings" ON public.invoice_display_settings;
CREATE POLICY "Admins can update invoice_display_settings" ON public.invoice_display_settings FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete invoice_display_settings" ON public.invoice_display_settings;
CREATE POLICY "Admins can delete invoice_display_settings" ON public.invoice_display_settings FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- invoice_document_settings
DROP POLICY IF EXISTS "Authenticated can read invoice_document_settings" ON public.invoice_document_settings;
CREATE POLICY "Authenticated can read invoice_document_settings" ON public.invoice_document_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert invoice_document_settings" ON public.invoice_document_settings;
CREATE POLICY "Admins can insert invoice_document_settings" ON public.invoice_document_settings FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update invoice_document_settings" ON public.invoice_document_settings;
CREATE POLICY "Admins can update invoice_document_settings" ON public.invoice_document_settings FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete invoice_document_settings" ON public.invoice_document_settings;
CREATE POLICY "Admins can delete invoice_document_settings" ON public.invoice_document_settings FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- license_config
DROP POLICY IF EXISTS "Authenticated can read license_config" ON public.license_config;
CREATE POLICY "Authenticated can read license_config" ON public.license_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert license_config" ON public.license_config;
CREATE POLICY "Admins can insert license_config" ON public.license_config FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update license_config" ON public.license_config;
CREATE POLICY "Admins can update license_config" ON public.license_config FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete license_config" ON public.license_config;
CREATE POLICY "Admins can delete license_config" ON public.license_config FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- notification_event_types
DROP POLICY IF EXISTS "Authenticated can read notification_event_types" ON public.notification_event_types;
CREATE POLICY "Authenticated can read notification_event_types" ON public.notification_event_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert notification_event_types" ON public.notification_event_types;
CREATE POLICY "Admins can insert notification_event_types" ON public.notification_event_types FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update notification_event_types" ON public.notification_event_types;
CREATE POLICY "Admins can update notification_event_types" ON public.notification_event_types FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

-- notification_rules
DROP POLICY IF EXISTS "Authenticated can read notification_rules" ON public.notification_rules;
CREATE POLICY "Authenticated can read notification_rules" ON public.notification_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert notification_rules" ON public.notification_rules;
CREATE POLICY "Admins can insert notification_rules" ON public.notification_rules FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update notification_rules" ON public.notification_rules;
CREATE POLICY "Admins can update notification_rules" ON public.notification_rules FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete notification_rules" ON public.notification_rules;
CREATE POLICY "Admins can delete notification_rules" ON public.notification_rules FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- onboarding_tasks
DROP POLICY IF EXISTS "Authenticated can read onboarding_tasks" ON public.onboarding_tasks;
CREATE POLICY "Authenticated can read onboarding_tasks" ON public.onboarding_tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert onboarding_tasks" ON public.onboarding_tasks;
CREATE POLICY "Admins can insert onboarding_tasks" ON public.onboarding_tasks FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update onboarding_tasks" ON public.onboarding_tasks;
CREATE POLICY "Admins can update onboarding_tasks" ON public.onboarding_tasks FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete onboarding_tasks" ON public.onboarding_tasks;
CREATE POLICY "Admins can delete onboarding_tasks" ON public.onboarding_tasks FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- inst_products
DROP POLICY IF EXISTS "Authenticated can read inst_products" ON public.inst_products;
CREATE POLICY "Authenticated can read inst_products" ON public.inst_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert inst_products" ON public.inst_products;
CREATE POLICY "Admins can insert inst_products" ON public.inst_products FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update inst_products" ON public.inst_products;
CREATE POLICY "Admins can update inst_products" ON public.inst_products FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete inst_products" ON public.inst_products;
CREATE POLICY "Admins can delete inst_products" ON public.inst_products FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- inst_price_books
DROP POLICY IF EXISTS "Authenticated can read inst_price_books" ON public.inst_price_books;
CREATE POLICY "Authenticated can read inst_price_books" ON public.inst_price_books FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert inst_price_books" ON public.inst_price_books;
CREATE POLICY "Admins can insert inst_price_books" ON public.inst_price_books FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update inst_price_books" ON public.inst_price_books;
CREATE POLICY "Admins can update inst_price_books" ON public.inst_price_books FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete inst_price_books" ON public.inst_price_books;
CREATE POLICY "Admins can delete inst_price_books" ON public.inst_price_books FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- inst_price_book_entries
DROP POLICY IF EXISTS "Authenticated can read inst_price_book_entries" ON public.inst_price_book_entries;
CREATE POLICY "Authenticated can read inst_price_book_entries" ON public.inst_price_book_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert inst_price_book_entries" ON public.inst_price_book_entries;
CREATE POLICY "Admins can insert inst_price_book_entries" ON public.inst_price_book_entries FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update inst_price_book_entries" ON public.inst_price_book_entries;
CREATE POLICY "Admins can update inst_price_book_entries" ON public.inst_price_book_entries FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete inst_price_book_entries" ON public.inst_price_book_entries;
CREATE POLICY "Admins can delete inst_price_book_entries" ON public.inst_price_book_entries FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- inst_accounts
DROP POLICY IF EXISTS "Authenticated can read inst_accounts" ON public.inst_accounts;
CREATE POLICY "Authenticated can read inst_accounts" ON public.inst_accounts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert inst_accounts" ON public.inst_accounts;
CREATE POLICY "Admins can insert inst_accounts" ON public.inst_accounts FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can update inst_accounts" ON public.inst_accounts;
CREATE POLICY "Admins can update inst_accounts" ON public.inst_accounts FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete inst_accounts" ON public.inst_accounts;
CREATE POLICY "Admins can delete inst_accounts" ON public.inst_accounts FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- leave_holidays_bridge
DROP POLICY IF EXISTS "Authenticated can read leave_holidays_bridge" ON public.leave_holidays_bridge;
CREATE POLICY "Authenticated can read leave_holidays_bridge" ON public.leave_holidays_bridge FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can insert leave_holidays_bridge" ON public.leave_holidays_bridge;
CREATE POLICY "Admins can insert leave_holidays_bridge" ON public.leave_holidays_bridge FOR INSERT TO authenticated WITH CHECK (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete leave_holidays_bridge" ON public.leave_holidays_bridge;
CREATE POLICY "Admins can delete leave_holidays_bridge" ON public.leave_holidays_bridge FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

-- notification_event_log
DROP POLICY IF EXISTS "Authenticated can read notification_event_log" ON public.notification_event_log;
CREATE POLICY "Authenticated can read notification_event_log" ON public.notification_event_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can insert notification_event_log" ON public.notification_event_log;
CREATE POLICY "Authenticated can insert notification_event_log" ON public.notification_event_log FOR INSERT TO authenticated WITH CHECK (true);
