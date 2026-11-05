begin;
create type public.app_role as enum ('admin', 'user');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.user_status as enum ('pending_completion', 'pending_approval', 'approved', 'rejected', 'active', 'inactive');
create table public.meta_lead_forms (id uuid not null default gen_random_uuid(), connection_id uuid, page_id text not null, external_id text, name text not null, questions jsonb not null default '[]'::jsonb, privacy_policy_url text, privacy_link_text text, follow_up_action_url text, thank_you_page jsonb, context_card jsonb, locale text not null default 'EN_US'::text, is_optimized_for_quality boolean not null default false, block_display_for_non_targeted_viewer boolean not null default false, status text not null default 'ACTIVE'::text, leads_count integer not null default 0, imported boolean not null default false, created_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.meta_lead_submissions (id uuid not null default gen_random_uuid(), external_id text not null, form_external_id text, ad_external_id text, ad_id uuid, created_time timestamp with time zone, is_organic boolean, field_data jsonb not null default '[]'::jsonb, created_at timestamp with time zone not null default now());
create table public.marketing_contacts (id uuid not null default gen_random_uuid(), database_type text not null, name text not null, phone text, email text, website text, state text, country text, uploaded_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), address text, city text, pincode text, first_name text, last_name text, business_details text, status text not null default 'new'::text, converted_to_retailer_id uuid, converted_at timestamp with time zone, converted_by uuid, lead_source text);
create table public.marketing_leads_activity_log (id uuid not null default gen_random_uuid(), contact_id uuid not null, type text not null, body text, meta jsonb, created_by uuid, created_at timestamp with time zone not null default now());
create table public.marketing_contact_list_views (id uuid not null default gen_random_uuid(), database_type text not null, name text not null, filters jsonb not null default '[]'::jsonb, visible_columns jsonb not null default '["name", "phone", "email", "state"]'::jsonb, is_shared boolean not null default false, created_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.marketing_contact_list_view_members (id uuid not null default gen_random_uuid(), list_view_id uuid not null, contact_id uuid not null, added_at timestamp with time zone not null default now());
create table public.marketing_contact_engagement_scores (id uuid not null default gen_random_uuid(), contact_id uuid not null, score numeric not null default 0, last_event_at timestamp with time zone, updated_at timestamp with time zone not null default now());
create table public.marketing_journey_enrollments (id uuid not null default gen_random_uuid(), journey_id uuid not null, contact_id uuid not null, current_node_id text, status text not null default 'active'::text, enrolled_at timestamp with time zone not null default now(), next_fire_at timestamp with time zone, updated_at timestamp with time zone not null default now(), retry_count integer not null default 0);
create table public.marketing_journey_excluded_contacts (id uuid not null default gen_random_uuid(), journey_id uuid not null, contact_id uuid not null, reason text, excluded_at timestamp with time zone not null default now());
create table public.meta_pages (id uuid not null default gen_random_uuid(), connection_id uuid not null, page_id text not null, page_name text, page_token_enc text, instagram_business_id text, created_at timestamp with time zone not null default now(), category text, picture_url text, instagram_username text);
create table public.meta_ad_accounts (id uuid not null default gen_random_uuid(), connection_id uuid not null, ad_account_id text not null, account_name text, currency text, created_at timestamp with time zone not null default now(), timezone_name text, account_status integer, disable_reason text);
create table public.meta_connections (id uuid not null default gen_random_uuid(), meta_user_id text, access_token_enc text, token_expires_at timestamp with time zone, status text not null default 'disconnected'::text, connected_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), external_user_name text, business_id text, business_name text, scopes text[], default_page_id text, default_instagram_id text, default_ad_account_id text, default_ad_instagram_id text, default_ad_instagram_username text);
create table public.meta_campaigns (id uuid not null default gen_random_uuid(), ad_account_id uuid not null, meta_campaign_id text not null, name text not null, objective text, status text not null default 'paused'::text, daily_budget numeric, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), buying_type text, budget_type text, bid_strategy text, spend_cap numeric, special_ad_categories text[], start_date timestamp with time zone, end_date timestamp with time zone, meta_effective_status text, published_at timestamp with time zone, last_synced_at timestamp with time zone, created_by uuid);
create table public.meta_ad_sets (id uuid not null default gen_random_uuid(), campaign_id uuid not null, meta_ad_set_id text not null, name text not null, status text not null default 'paused'::text, targeting jsonb not null default '{}'::jsonb, daily_budget numeric, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), optimization_goal text, billing_event text, bid_strategy text, bid_amount numeric, budget_type text, placements jsonb, custom_audience_id text, page_id text, instagram_id text, timezone_name text, start_at timestamp with time zone, end_at timestamp with time zone, meta_effective_status text, published_at timestamp with time zone, last_synced_at timestamp with time zone, custom_audience_row_id uuid);
create table public.meta_ads (id uuid not null default gen_random_uuid(), ad_set_id uuid not null, meta_ad_id text not null, name text not null, status text not null default 'paused'::text, creative jsonb not null default '{}'::jsonb, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), format text, primary_text text, headline text, description text, call_to_action text, destination_url text, display_link text, creative_type text, last_synced_at timestamp with time zone, lead_form_id text);
create table public.meta_insights (id uuid not null default gen_random_uuid(), entity_type text not null, entity_id uuid not null, date date not null, impressions bigint not null default 0, clicks bigint not null default 0, spend numeric not null default 0, reach bigint not null default 0, created_at timestamp with time zone not null default now());
create table public.meta_custom_audiences (id uuid not null default gen_random_uuid(), connection_id uuid, ad_account_id text not null, external_id text, name text not null, description text, source text not null default 'customer_list'::text, origin text not null default 'file'::text, origin_ref text, identifier_schema text[] not null default '{EMAIL,PHONE}'::text[], row_count integer not null default 0, invalid_count integer not null default 0, duplicate_count integer not null default 0, status text not null default 'ready'::text, meta_status jsonb not null default '{}'::jsonb, error text, created_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.meta_organic_posts (id uuid not null default gen_random_uuid(), page_id uuid, meta_post_id text, message text, media_url text, status text not null default 'draft'::text, scheduled_for timestamp with time zone, published_at timestamp with time zone, created_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), post_type text not null default 'text'::text, destination text not null default 'facebook'::text, instagram_id text, instagram_post_id text, error_message text);
create table public.meta_api_diagnostics (id uuid not null default gen_random_uuid(), check_name text not null, status text not null, detail text, run_at timestamp with time zone not null default now(), run_by uuid, category text, endpoint text, method text, http_status integer, duration_ms integer, records integer, sample jsonb);
create table public.meta_api_diagnostic_test_objects (id uuid not null default gen_random_uuid(), diagnostic_id uuid not null, object_type text not null, meta_object_id text, cleaned_up boolean not null default false, created_at timestamp with time zone not null default now());
create table public.journeys (id uuid not null default gen_random_uuid(), name text not null, status text not null default 'draft'::text, canvas_data jsonb not null default '{}'::jsonb, segment_type text not null default 'retailers'::text, filters jsonb not null default '{}'::jsonb, created_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), approval_status text not null default 'draft'::text, approval_notes text, approved_by uuid, approved_at timestamp with time zone, deleted_at timestamp with time zone, deleted_by uuid);
create table public.journey_cost_settings (id uuid not null default gen_random_uuid(), journey_id uuid, whatsapp_cost_per_message numeric not null default 0, sms_cost_per_message numeric not null default 0, email_cost_per_message numeric not null default 0, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.journey_enrollments (id uuid not null default gen_random_uuid(), journey_id uuid not null, retailer_id uuid not null, current_node_id text, status text not null default 'active'::text, enrolled_at timestamp with time zone not null default now(), next_fire_at timestamp with time zone, updated_at timestamp with time zone not null default now(), retry_count integer not null default 0);
create table public.journey_excluded_contacts (id uuid not null default gen_random_uuid(), journey_id uuid not null, retailer_id uuid not null, reason text, excluded_at timestamp with time zone not null default now());
create table public.journey_message_events (id uuid not null default gen_random_uuid(), journey_message_log_id uuid, event_type text not null, occurred_at timestamp with time zone not null default now(), raw_payload jsonb);
create table public.journey_message_log (id uuid not null default gen_random_uuid(), journey_id uuid not null, enrollment_id uuid, retailer_id uuid, node_id text, channel text not null default 'whatsapp'::text, status text not null default 'queued'::text, provider_message_id text, error_code text, error_message text, created_at timestamp with time zone not null default now(), contact_id uuid);
create table public.journey_meta_ad_links (id uuid not null default gen_random_uuid(), journey_id uuid not null, node_id text not null, meta_ad_set_row_id uuid not null, meta_custom_audience_row_id uuid not null, pushed_count integer not null default 0, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.journey_relative_fires (id uuid not null default gen_random_uuid(), journey_id uuid not null, enrollment_id uuid not null, node_id text not null, fire_at timestamp with time zone not null, fired boolean not null default false, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.journey_schedules (id uuid not null default gen_random_uuid(), journey_id uuid not null, schedule_type text not null default 'one_time'::text, start_at timestamp with time zone, recurrence_rule text, timezone text not null default 'Asia/Kolkata'::text, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), next_run_at timestamp with time zone);
create table public.whatsapp_config (id uuid not null default gen_random_uuid(), business_phone_number text not null, business_name text, is_active boolean default true, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), created_by uuid, webhook_url text, sms_sender_number text);
create table public.whatsapp_link_clicks (id uuid not null default gen_random_uuid(), tracked_link_id uuid not null, retailer_id uuid, clicked_at timestamp with time zone not null default now(), user_agent text, ip_address text, contact_id uuid);
create table public.whatsapp_message_log (id uuid not null default gen_random_uuid(), retailer_id uuid, to_number text not null, template_id uuid, body text, status text not null default 'queued'::text, twilio_sid text, error_code text, error_message text, journey_id uuid, sent_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.whatsapp_messages (id uuid not null default gen_random_uuid(), retailer_id uuid, order_id uuid, direction text not null, from_number text not null, to_number text not null, body text, media_url text, status text, twilio_sid text, created_at timestamp with time zone not null default now());
create table public.whatsapp_phone_name_cache (phone_key text not null, retailer_id uuid not null, name text not null, updated_at timestamp with time zone not null default now());
create table public.whatsapp_pricing_config (id uuid not null default gen_random_uuid(), category text not null, price_per_message numeric not null default 0, currency text not null default 'INR'::text, effective_from date not null default CURRENT_DATE, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.whatsapp_requests (id uuid not null default gen_random_uuid(), retailer_id uuid, from_number text not null, body text, handled boolean not null default false, created_at timestamp with time zone not null default now());
create table public.whatsapp_sessions (id uuid not null default gen_random_uuid(), phone_number text not null, state text not null default 'IDLE'::text, retailer_id uuid, retailer_name text, pending_items jsonb default '[]'::jsonb, conversation_history jsonb default '[]'::jsonb, last_active_at timestamp with time zone default now(), created_at timestamp with time zone default now(), owner_id uuid, beat_id uuid, territory_id uuid);
create table public.whatsapp_templates (id uuid not null default gen_random_uuid(), name text not null, category text not null default 'UTILITY'::text, language text not null default 'en'::text, body text not null, variables jsonb not null default '[]'::jsonb, twilio_content_sid text, approval_status text not null default 'draft'::text, rejection_reason text, created_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), status text not null default 'draft'::text, user_initiated_approved boolean not null default false, twilio_content_types jsonb, twilio_template_type text, twilio_media_url text, twilio_media_is_variable boolean not null default false, twilio_required_variables text[] not null default '{}'::text[], twilio_synced_at timestamp with time zone);
create table public.whatsapp_tracked_links (id uuid not null default gen_random_uuid(), journey_id uuid, target_url text not null, short_code text not null, created_at timestamp with time zone not null default now(), retailer_id uuid, journey_message_log_id uuid, contact_id uuid);
create table public.unhandled_queries (id uuid not null default gen_random_uuid(), phone text not null, retailer_id uuid, retailer_name text, message text not null, category text default 'unknown'::text, status text default 'open'::text, created_date text not null default to_char((now() AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD'::text), created_at timestamp with time zone default now());
create table public.profiles (id uuid not null, username text not null, full_name text not null, phone_number text, recovery_email text, hint_question text, hint_answer text, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now(), user_status user_status default 'active'::user_status, invitation_token text, profile_picture_url text, date_of_birth date, anniversary_date date, permanent_address text, current_address text, emergency_contact_name text, emergency_contact_phone text, linkedin_url text, facebook_url text, instagram_url text, interests text[], aspirations text, learning_goals text[], work_location text, territories_covered text[], role_id uuid, onboarding_completed boolean default false, onboarding_step integer default 0, preferred_language character varying(5) default 'en'::character varying, designation text, twitter_url text, must_change_password boolean default false, is_active boolean not null default true, deactivated_at timestamp with time zone, deactivated_by uuid, deactivation_reason text, reactivated_at timestamp with time zone, locale text, timezone text, currency text);
create table public.user_profiles (id uuid not null default gen_random_uuid(), user_id uuid, profile_id uuid, assigned_at timestamp with time zone default now());
create table public.user_roles (id uuid not null default gen_random_uuid(), user_id uuid not null, role app_role not null, assigned_at timestamp with time zone not null default now());
create table public.role_definitions (id uuid not null default gen_random_uuid(), role_name text not null, description text, responsibilities text[], required_competencies jsonb, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.security_profiles (id uuid not null default gen_random_uuid(), name text not null, description text, is_system boolean default false, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now(), is_active boolean not null default true);
create table public.profile_object_permissions (id uuid not null default gen_random_uuid(), profile_id uuid, object_name text not null, can_read boolean default false, can_create boolean default false, can_edit boolean default false, can_delete boolean default false, can_view_all boolean default false, can_modify_all boolean default false, created_at timestamp with time zone default now(), permission_type text not null default 'feature'::text, parent_module text);
create table public.user_object_permissions (id uuid not null default gen_random_uuid(), user_id uuid not null, object_name text not null, can_read boolean default false, can_create boolean default false, can_edit boolean default false, can_delete boolean default false, can_view_all boolean default false, can_modify_all boolean default false, created_at timestamp with time zone default now(), updated_at timestamp with time zone default now());
create table public.permission_set_groups (id uuid not null default gen_random_uuid(), name text not null, description text, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.permission_set_group_permissions (id uuid not null default gen_random_uuid(), group_id uuid not null, object_name text not null, can_read boolean not null default false, can_create boolean not null default false, can_edit boolean not null default false, can_delete boolean not null default false, can_view_all boolean not null default false, can_modify_all boolean not null default false, created_at timestamp with time zone not null default now());
create table public.permission_set_group_users (id uuid not null default gen_random_uuid(), group_id uuid not null, user_id uuid not null, created_at timestamp with time zone not null default now());
create table public.user_invitations (id uuid not null default gen_random_uuid(), email text not null, full_name text not null, phone_number text, manager_id uuid, invitation_token text not null, expires_at timestamp with time zone not null, status text default 'pending'::text, created_by uuid, created_at timestamp with time zone not null default now(), completed_at timestamp with time zone);
create table public.user_approvals (id uuid not null default gen_random_uuid(), user_id uuid, approver_id uuid, approval_level integer not null, status approval_status default 'pending'::approval_status, comments text, approved_at timestamp with time zone, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.user_status_log (id uuid not null default gen_random_uuid(), user_id uuid not null, action text not null, performed_by uuid, reason text, created_at timestamp with time zone not null default now());
create table public.user_delegations (id uuid not null default gen_random_uuid(), from_user_id uuid not null, to_user_id uuid not null, delegation_scope text not null, beat_ids text[] not null default ARRAY[]::text[], retailer_ids uuid[] not null default ARRAY[]::uuid[], effective_from timestamp with time zone not null, effective_to timestamp with time zone not null, status text not null default 'active'::text, notes text, created_at timestamp with time zone not null default now(), created_by uuid);
create table public.user_feature_config (id uuid not null default gen_random_uuid(), user_id uuid not null, feature_id uuid not null, is_enabled boolean, updated_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.role_feature_config (id uuid not null default gen_random_uuid(), role_id uuid not null, feature_id uuid not null, is_enabled boolean, updated_by uuid, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table public.notification_preferences (id uuid not null default gen_random_uuid(), user_id uuid not null, template_type text not null, is_enabled boolean not null default true, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
alter table public.meta_lead_forms add constraint meta_lead_forms_external_id_key UNIQUE (external_id);
alter table public.meta_lead_forms add constraint meta_lead_forms_pkey PRIMARY KEY (id);
alter table public.meta_lead_submissions add constraint meta_lead_submissions_external_id_key UNIQUE (external_id);
alter table public.meta_lead_submissions add constraint meta_lead_submissions_pkey PRIMARY KEY (id);
alter table public.marketing_contacts add constraint marketing_contacts_database_type_check CHECK ((database_type = ANY (ARRAY['institutional'::text, 'distributor'::text, 'event'::text])));
alter table public.marketing_contacts add constraint marketing_contacts_lead_source_check CHECK (((lead_source IS NULL) OR (lead_source = ANY (ARRAY['direct'::text, 'external'::text, 'purchased'::text]))));
alter table public.marketing_contacts add constraint marketing_contacts_pkey PRIMARY KEY (id);
alter table public.marketing_contacts add constraint marketing_contacts_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_discussion'::text, 'interested'::text, 'not_interested'::text, 'wrong_data'::text, 'converted'::text])));
alter table public.marketing_leads_activity_log add constraint marketing_leads_activity_log_pkey PRIMARY KEY (id);
alter table public.marketing_leads_activity_log add constraint marketing_leads_activity_log_type_check CHECK ((type = ANY (ARRAY['status_change'::text, 'note'::text, 'list_view_added'::text, 'imported'::text])));
alter table public.marketing_contact_list_views add constraint marketing_contact_list_views_database_type_check CHECK ((database_type = ANY (ARRAY['institutional'::text, 'distributor'::text])));
alter table public.marketing_contact_list_views add constraint marketing_contact_list_views_pkey PRIMARY KEY (id);
alter table public.marketing_contact_list_view_members add constraint marketing_contact_list_view_members_list_view_id_contact_id_key UNIQUE (list_view_id, contact_id);
alter table public.marketing_contact_list_view_members add constraint marketing_contact_list_view_members_pkey PRIMARY KEY (id);
alter table public.marketing_contact_engagement_scores add constraint marketing_contact_engagement_scores_contact_id_key UNIQUE (contact_id);
alter table public.marketing_contact_engagement_scores add constraint marketing_contact_engagement_scores_pkey PRIMARY KEY (id);
alter table public.marketing_journey_enrollments add constraint marketing_journey_enrollments_pkey PRIMARY KEY (id);
alter table public.marketing_journey_excluded_contacts add constraint marketing_journey_excluded_contacts_journey_id_contact_id_key UNIQUE (journey_id, contact_id);
alter table public.marketing_journey_excluded_contacts add constraint marketing_journey_excluded_contacts_pkey PRIMARY KEY (id);
alter table public.meta_pages add constraint meta_pages_connection_id_page_id_key UNIQUE (connection_id, page_id);
alter table public.meta_pages add constraint meta_pages_pkey PRIMARY KEY (id);
alter table public.meta_ad_accounts add constraint meta_ad_accounts_connection_id_ad_account_id_key UNIQUE (connection_id, ad_account_id);
alter table public.meta_ad_accounts add constraint meta_ad_accounts_pkey PRIMARY KEY (id);
alter table public.meta_connections add constraint meta_connections_pkey PRIMARY KEY (id);
alter table public.meta_connections add constraint meta_connections_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'error'::text])));
alter table public.meta_campaigns add constraint meta_campaigns_ad_account_id_meta_campaign_id_key UNIQUE (ad_account_id, meta_campaign_id);
alter table public.meta_campaigns add constraint meta_campaigns_pkey PRIMARY KEY (id);
alter table public.meta_ad_sets add constraint meta_ad_sets_campaign_id_meta_ad_set_id_key UNIQUE (campaign_id, meta_ad_set_id);
alter table public.meta_ad_sets add constraint meta_ad_sets_pkey PRIMARY KEY (id);
alter table public.meta_ads add constraint meta_ads_ad_set_id_meta_ad_id_key UNIQUE (ad_set_id, meta_ad_id);
alter table public.meta_ads add constraint meta_ads_pkey PRIMARY KEY (id);
alter table public.meta_insights add constraint meta_insights_entity_type_check CHECK ((entity_type = ANY (ARRAY['campaign'::text, 'ad_set'::text, 'ad'::text])));
alter table public.meta_insights add constraint meta_insights_entity_type_entity_id_date_key UNIQUE (entity_type, entity_id, date);
alter table public.meta_insights add constraint meta_insights_pkey PRIMARY KEY (id);
alter table public.meta_custom_audiences add constraint meta_custom_audiences_external_id_key UNIQUE (external_id);
alter table public.meta_custom_audiences add constraint meta_custom_audiences_pkey PRIMARY KEY (id);
alter table public.meta_organic_posts add constraint meta_organic_posts_destination_check CHECK ((destination = ANY (ARRAY['facebook'::text, 'instagram'::text, 'both'::text])));
alter table public.meta_organic_posts add constraint meta_organic_posts_pkey PRIMARY KEY (id);
alter table public.meta_organic_posts add constraint meta_organic_posts_post_type_check CHECK ((post_type = ANY (ARRAY['text'::text, 'image'::text, 'video'::text])));
alter table public.meta_organic_posts add constraint meta_organic_posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text, 'failed'::text])));
alter table public.meta_api_diagnostics add constraint meta_api_diagnostics_pkey PRIMARY KEY (id);
alter table public.meta_api_diagnostics add constraint meta_api_diagnostics_status_check CHECK ((status = ANY (ARRAY['pass'::text, 'fail'::text, 'warning'::text])));
alter table public.meta_api_diagnostic_test_objects add constraint meta_api_diagnostic_test_objects_pkey PRIMARY KEY (id);
alter table public.journeys add constraint journeys_pkey PRIMARY KEY (id);
alter table public.journeys add constraint journeys_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'completed'::text, 'archived'::text])));
alter table public.journey_cost_settings add constraint journey_cost_settings_pkey PRIMARY KEY (id);
alter table public.journey_enrollments add constraint journey_enrollments_journey_id_retailer_id_key UNIQUE (journey_id, retailer_id);
alter table public.journey_enrollments add constraint journey_enrollments_pkey PRIMARY KEY (id);
alter table public.journey_enrollments add constraint journey_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'exited'::text, 'failed'::text])));
alter table public.journey_excluded_contacts add constraint journey_excluded_contacts_journey_id_retailer_id_key UNIQUE (journey_id, retailer_id);
alter table public.journey_excluded_contacts add constraint journey_excluded_contacts_pkey PRIMARY KEY (id);
alter table public.journey_message_events add constraint journey_message_events_event_type_check CHECK ((event_type = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'clicked'::text, 'failed'::text])));
alter table public.journey_message_events add constraint journey_message_events_log_event_unique UNIQUE (journey_message_log_id, event_type);
alter table public.journey_message_events add constraint journey_message_events_pkey PRIMARY KEY (id);
alter table public.journey_message_log add constraint journey_message_log_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text, 'meta_ad'::text])));
alter table public.journey_message_log add constraint journey_message_log_pkey PRIMARY KEY (id);
alter table public.journey_message_log add constraint journey_message_log_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'rate_limited'::text])));
alter table public.journey_meta_ad_links add constraint journey_meta_ad_links_journey_id_node_id_key UNIQUE (journey_id, node_id);
alter table public.journey_meta_ad_links add constraint journey_meta_ad_links_pkey PRIMARY KEY (id);
alter table public.journey_relative_fires add constraint journey_relative_fires_pkey PRIMARY KEY (id);
alter table public.journey_schedules add constraint journey_schedules_pkey PRIMARY KEY (id);
alter table public.journey_schedules add constraint journey_schedules_schedule_type_check CHECK ((schedule_type = ANY (ARRAY['one_time'::text, 'recurring'::text])));
alter table public.whatsapp_config add constraint whatsapp_config_pkey PRIMARY KEY (id);
alter table public.whatsapp_link_clicks add constraint whatsapp_link_clicks_pkey PRIMARY KEY (id);
alter table public.whatsapp_message_log add constraint whatsapp_message_log_pkey PRIMARY KEY (id);
alter table public.whatsapp_message_log add constraint whatsapp_message_log_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'undelivered'::text])));
alter table public.whatsapp_messages add constraint whatsapp_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])));
alter table public.whatsapp_messages add constraint whatsapp_messages_pkey PRIMARY KEY (id);
alter table public.whatsapp_phone_name_cache add constraint whatsapp_phone_name_cache_pkey PRIMARY KEY (phone_key);
alter table public.whatsapp_pricing_config add constraint whatsapp_pricing_config_pkey PRIMARY KEY (id);
alter table public.whatsapp_requests add constraint whatsapp_requests_pkey PRIMARY KEY (id);
alter table public.whatsapp_sessions add constraint whatsapp_sessions_pkey PRIMARY KEY (id);
alter table public.whatsapp_templates add constraint whatsapp_templates_approval_status_check CHECK ((approval_status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text])));
alter table public.whatsapp_templates add constraint whatsapp_templates_pkey PRIMARY KEY (id);
alter table public.whatsapp_tracked_links add constraint whatsapp_tracked_links_pkey PRIMARY KEY (id);
alter table public.whatsapp_tracked_links add constraint whatsapp_tracked_links_short_code_key UNIQUE (short_code);
alter table public.unhandled_queries add constraint unhandled_queries_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_full_name_not_empty CHECK ((length(TRIM(BOTH FROM full_name)) > 0));
alter table public.profiles add constraint profiles_hint_answer_not_empty CHECK ((length(TRIM(BOTH FROM hint_answer)) > 0));
alter table public.profiles add constraint profiles_hint_question_not_empty CHECK ((length(TRIM(BOTH FROM hint_question)) > 0));
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_username_key UNIQUE (username);
alter table public.profiles add constraint profiles_username_not_empty CHECK ((length(TRIM(BOTH FROM username)) > 0));
alter table public.user_profiles add constraint user_profiles_pkey PRIMARY KEY (id);
alter table public.user_profiles add constraint user_profiles_user_id_key UNIQUE (user_id);
alter table public.user_roles add constraint user_roles_pkey PRIMARY KEY (id);
alter table public.user_roles add constraint user_roles_user_id_role_key UNIQUE (user_id, role);
alter table public.role_definitions add constraint role_definitions_pkey PRIMARY KEY (id);
alter table public.role_definitions add constraint role_definitions_role_name_key UNIQUE (role_name);
alter table public.security_profiles add constraint security_profiles_name_key UNIQUE (name);
alter table public.security_profiles add constraint security_profiles_pkey PRIMARY KEY (id);
alter table public.profile_object_permissions add constraint profile_object_permissions_pkey PRIMARY KEY (id);
alter table public.profile_object_permissions add constraint profile_object_permissions_profile_id_object_name_type_key UNIQUE (profile_id, object_name, permission_type);
alter table public.user_object_permissions add constraint user_object_permissions_pkey PRIMARY KEY (id);
alter table public.user_object_permissions add constraint user_object_permissions_user_id_object_name_key UNIQUE (user_id, object_name);
alter table public.permission_set_groups add constraint permission_set_groups_pkey PRIMARY KEY (id);
alter table public.permission_set_group_permissions add constraint permission_set_group_permissions_group_id_object_name_key UNIQUE (group_id, object_name);
alter table public.permission_set_group_permissions add constraint permission_set_group_permissions_pkey PRIMARY KEY (id);
alter table public.permission_set_group_users add constraint permission_set_group_users_group_id_user_id_key UNIQUE (group_id, user_id);
alter table public.permission_set_group_users add constraint permission_set_group_users_pkey PRIMARY KEY (id);
alter table public.user_invitations add constraint user_invitations_invitation_token_key UNIQUE (invitation_token);
alter table public.user_invitations add constraint user_invitations_pkey PRIMARY KEY (id);
alter table public.user_approvals add constraint user_approvals_approval_level_check CHECK (((approval_level >= 1) AND (approval_level <= 3)));
alter table public.user_approvals add constraint user_approvals_pkey PRIMARY KEY (id);
alter table public.user_status_log add constraint user_status_log_pkey PRIMARY KEY (id);
alter table public.user_delegations add constraint user_delegations_delegation_scope_check CHECK ((delegation_scope = ANY (ARRAY['all'::text, 'beats'::text, 'retailers'::text])));
alter table public.user_delegations add constraint user_delegations_pkey PRIMARY KEY (id);
alter table public.user_delegations add constraint user_delegations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text])));
alter table public.user_feature_config add constraint user_feature_config_pkey PRIMARY KEY (id);
alter table public.user_feature_config add constraint user_feature_config_user_id_feature_id_key UNIQUE (user_id, feature_id);
alter table public.role_feature_config add constraint role_feature_config_pkey PRIMARY KEY (id);
alter table public.role_feature_config add constraint role_feature_config_role_id_feature_id_key UNIQUE (role_id, feature_id);
alter table public.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (id);
alter table public.notification_preferences add constraint notification_preferences_user_id_template_type_key UNIQUE (user_id, template_type);
alter table public.meta_lead_forms add constraint meta_lead_forms_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES meta_connections(id) ON DELETE CASCADE;
alter table public.meta_lead_forms add constraint meta_lead_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.meta_lead_submissions add constraint meta_lead_submissions_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES meta_ads(id) ON DELETE CASCADE;
alter table public.marketing_leads_activity_log add constraint marketing_leads_activity_log_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES marketing_contacts(id) ON DELETE CASCADE;
alter table public.marketing_leads_activity_log add constraint marketing_leads_activity_log_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.marketing_contact_list_view_members add constraint marketing_contact_list_view_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES marketing_contacts(id) ON DELETE CASCADE;
alter table public.marketing_contact_list_view_members add constraint marketing_contact_list_view_members_list_view_id_fkey FOREIGN KEY (list_view_id) REFERENCES marketing_contact_list_views(id) ON DELETE CASCADE;
alter table public.meta_pages add constraint meta_pages_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES meta_connections(id) ON DELETE CASCADE;
alter table public.meta_ad_accounts add constraint meta_ad_accounts_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES meta_connections(id) ON DELETE CASCADE;
alter table public.meta_connections add constraint meta_connections_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES auth.users(id);
alter table public.meta_campaigns add constraint meta_campaigns_ad_account_id_fkey FOREIGN KEY (ad_account_id) REFERENCES meta_ad_accounts(id) ON DELETE CASCADE;
alter table public.meta_campaigns add constraint meta_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.meta_ad_sets add constraint meta_ad_sets_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES meta_campaigns(id) ON DELETE CASCADE;
alter table public.meta_ad_sets add constraint meta_ad_sets_custom_audience_row_id_fkey FOREIGN KEY (custom_audience_row_id) REFERENCES meta_custom_audiences(id) ON DELETE SET NULL;
alter table public.meta_ads add constraint meta_ads_ad_set_id_fkey FOREIGN KEY (ad_set_id) REFERENCES meta_ad_sets(id) ON DELETE CASCADE;
alter table public.meta_custom_audiences add constraint meta_custom_audiences_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES meta_connections(id) ON DELETE CASCADE;
alter table public.meta_custom_audiences add constraint meta_custom_audiences_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.meta_organic_posts add constraint meta_organic_posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.meta_organic_posts add constraint meta_organic_posts_page_id_fkey FOREIGN KEY (page_id) REFERENCES meta_pages(id) ON DELETE CASCADE;
alter table public.meta_api_diagnostics add constraint meta_api_diagnostics_run_by_fkey FOREIGN KEY (run_by) REFERENCES auth.users(id);
alter table public.meta_api_diagnostic_test_objects add constraint meta_api_diagnostic_test_objects_diagnostic_id_fkey FOREIGN KEY (diagnostic_id) REFERENCES meta_api_diagnostics(id) ON DELETE CASCADE;
alter table public.journeys add constraint journeys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.journeys add constraint journeys_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id);
alter table public.journey_cost_settings add constraint journey_cost_settings_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE;
alter table public.journey_enrollments add constraint journey_enrollments_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE;
alter table public.journey_excluded_contacts add constraint journey_excluded_contacts_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE;
alter table public.journey_message_events add constraint journey_message_events_journey_message_log_id_fkey FOREIGN KEY (journey_message_log_id) REFERENCES journey_message_log(id) ON DELETE CASCADE;
alter table public.journey_message_log add constraint journey_message_log_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES journey_enrollments(id) ON DELETE CASCADE;
alter table public.journey_message_log add constraint journey_message_log_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE;
alter table public.journey_meta_ad_links add constraint journey_meta_ad_links_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES journeys(id);
alter table public.journey_meta_ad_links add constraint journey_meta_ad_links_meta_ad_set_row_id_fkey FOREIGN KEY (meta_ad_set_row_id) REFERENCES meta_ad_sets(id);
alter table public.journey_meta_ad_links add constraint journey_meta_ad_links_meta_custom_audience_row_id_fkey FOREIGN KEY (meta_custom_audience_row_id) REFERENCES meta_custom_audiences(id);
alter table public.journey_relative_fires add constraint journey_relative_fires_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES journey_enrollments(id) ON DELETE CASCADE;
alter table public.journey_relative_fires add constraint journey_relative_fires_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE;
alter table public.journey_schedules add constraint journey_schedules_journey_id_fkey FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE;
alter table public.whatsapp_config add constraint whatsapp_config_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.whatsapp_link_clicks add constraint whatsapp_link_clicks_tracked_link_id_fkey FOREIGN KEY (tracked_link_id) REFERENCES whatsapp_tracked_links(id) ON DELETE CASCADE;
alter table public.whatsapp_message_log add constraint whatsapp_message_log_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES auth.users(id);
alter table public.whatsapp_message_log add constraint whatsapp_message_log_template_id_fkey FOREIGN KEY (template_id) REFERENCES whatsapp_templates(id);
alter table public.whatsapp_templates add constraint whatsapp_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.whatsapp_tracked_links add constraint whatsapp_tracked_links_journey_message_log_id_fkey FOREIGN KEY (journey_message_log_id) REFERENCES journey_message_log(id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_role_id_fkey FOREIGN KEY (role_id) REFERENCES role_definitions(id);
alter table public.user_profiles add constraint user_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES security_profiles(id) ON DELETE CASCADE;
alter table public.user_profiles add constraint user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_roles add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profile_object_permissions add constraint profile_object_permissions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES security_profiles(id) ON DELETE CASCADE;
alter table public.user_object_permissions add constraint user_object_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.permission_set_group_permissions add constraint permission_set_group_permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES permission_set_groups(id) ON DELETE CASCADE;
alter table public.permission_set_group_users add constraint permission_set_group_users_group_id_fkey FOREIGN KEY (group_id) REFERENCES permission_set_groups(id) ON DELETE CASCADE;
alter table public.permission_set_group_users add constraint permission_set_group_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_invitations add constraint user_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.user_invitations add constraint user_invitations_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth.users(id);
alter table public.user_approvals add constraint user_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES auth.users(id);
alter table public.user_approvals add constraint user_approvals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.role_feature_config add constraint role_feature_config_role_id_fkey FOREIGN KEY (role_id) REFERENCES security_profiles(id) ON DELETE CASCADE;
alter table public.notification_preferences add constraint notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.hash_hint_answer(answer text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN 'hash:' || md5('security_salt_2024_' || LOWER(TRIM(answer)) || '_hint_protection');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.auto_seed_system_admin_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if the inserting profile is already a system profile
  IF EXISTS (SELECT 1 FROM security_profiles WHERE id = NEW.profile_id AND is_system = true) THEN
    RETURN NEW;
  END IF;

  -- Auto-insert for all system admin profiles if not already present
  INSERT INTO profile_object_permissions (
    profile_id, object_name, permission_type, parent_module,
    can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all
  )
  SELECT
    sp.id, NEW.object_name, NEW.permission_type, NEW.parent_module,
    true, true, true, true, true, true
  FROM security_profiles sp
  WHERE sp.is_system = true
    AND NOT EXISTS (
      SELECT 1 FROM profile_object_permissions pop
      WHERE pop.profile_id = sp.id
        AND pop.object_name = NEW.object_name
        AND pop.permission_type = NEW.permission_type
    );

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_profile(_target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (auth.uid() = _target_user_id) 
    OR is_system_admin(auth.uid());
END;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_security_profile_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_users integer;
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'System profiles cannot be deleted. Deactivate the profile instead.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT count(*) INTO v_users
  FROM public.user_profiles
  WHERE profile_id = OLD.id;

  IF v_users > 0 THEN
    RAISE EXCEPTION 'Profile "%" has % user(s) assigned and cannot be deleted. Reassign those users or deactivate the profile instead.',
      OLD.name, v_users
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _role = 'admin'::app_role THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.security_profiles sp ON sp.id = up.profile_id
      WHERE up.user_id = _user_id AND sp.is_system = true
    );
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.hash_hint_answer_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only hash if hint_answer is provided and not already hashed
  IF NEW.hint_answer IS NOT NULL AND NEW.hint_answer NOT LIKE 'hash:%' THEN
    NEW.hint_answer := public.hash_hint_answer(NEW.hint_answer);
  END IF;
  
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.security_profiles sp ON sp.id = up.profile_id
    WHERE up.user_id = _user_id AND sp.is_system = true
  );
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_admin_sensitive_access()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If user is admin and trying to access someone else's profile
  IF public.has_role(auth.uid(), 'admin'::public.app_role) AND auth.uid() != NEW.id THEN
    -- Prevent updates to sensitive fields
    IF OLD.hint_question IS DISTINCT FROM NEW.hint_question 
       OR OLD.hint_answer IS DISTINCT FROM NEW.hint_answer 
       OR OLD.recovery_email IS DISTINCT FROM NEW.recovery_email 
       OR OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
      RAISE EXCEPTION 'Admins cannot access or modify sensitive profile data';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.tg_block_hard_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('app.allow_hard_delete', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'Hard delete of % is blocked by policy. Use Deactivate instead. (A superadmin may set app.allow_hard_delete only after taking a backup.)', TG_TABLE_NAME
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN OLD;
END $function$
;
CREATE OR REPLACE FUNCTION public.tg_grant_new_object_to_sysadmin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_admin uuid;
BEGIN
  SELECT id INTO v_admin FROM public.security_profiles WHERE name = 'System Administrator' LIMIT 1;
  IF v_admin IS NULL OR NEW.profile_id = v_admin THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profile_object_permissions
    (profile_id, object_name, permission_type, can_read, can_create, can_edit, can_delete)
  VALUES (v_admin, NEW.object_name, NEW.permission_type, true, true, true, true)
  ON CONFLICT (profile_id, object_name, permission_type) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a permission edit because the mirror failed.
  RAISE WARNING 'tg_grant_new_object_to_sysadmin suppressed: %', SQLERRM;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_journey_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.schedule_type = 'one_time' and new.start_at is null then
    raise exception 'one_time journey schedules require start_at';
  end if;
  if new.schedule_type = 'recurring' and new.recurrence_rule is null then
    raise exception 'recurring journey schedules require recurrence_rule';
  end if;
  return new;
end;
$function$
;
CREATE INDEX marketing_contact_list_view_members_list_view_idx ON public.marketing_contact_list_view_members USING btree (list_view_id);
CREATE INDEX idx_journey_meta_ad_links_journey ON public.journey_meta_ad_links USING btree (journey_id);
CREATE INDEX marketing_leads_activity_log_contact_id_idx ON public.marketing_leads_activity_log USING btree (contact_id, created_at DESC);
CREATE INDEX idx_marketing_contacts_status ON public.marketing_contacts USING btree (status);
CREATE INDEX idx_marketing_journey_enrollments_due ON public.marketing_journey_enrollments USING btree (status, next_fire_at);
CREATE INDEX meta_lead_submissions_form_idx ON public.meta_lead_submissions USING btree (form_external_id);
CREATE INDEX meta_lead_submissions_ad_idx ON public.meta_lead_submissions USING btree (ad_id);
CREATE INDEX idx_marketing_contacts_phone ON public.marketing_contacts USING btree (phone);
CREATE INDEX idx_marketing_contact_list_views_database_type ON public.marketing_contact_list_views USING btree (database_type);
CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);
CREATE INDEX idx_marketing_contacts_converted_to_retailer_id ON public.marketing_contacts USING btree (converted_to_retailer_id);
CREATE UNIQUE INDEX idx_unhandled_queries_dedup ON public.unhandled_queries USING btree (phone, message, created_date);
CREATE INDEX idx_marketing_contacts_database_type ON public.marketing_contacts USING btree (database_type);
CREATE INDEX idx_marketing_contacts_state ON public.marketing_contacts USING btree (state);
CREATE INDEX idx_marketing_journey_enrollments_journey ON public.marketing_journey_enrollments USING btree (journey_id);
CREATE INDEX idx_unhandled_queries_status ON public.unhandled_queries USING btree (status);
CREATE INDEX idx_user_delegations_status ON public.user_delegations USING btree (status, effective_to);
CREATE INDEX idx_profiles_preferred_language ON public.profiles USING btree (preferred_language);
CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences USING btree (user_id);
CREATE INDEX marketing_contact_list_view_members_contact_idx ON public.marketing_contact_list_view_members USING btree (contact_id);
CREATE UNIQUE INDEX idx_wa_session_phone ON public.whatsapp_sessions USING btree (phone_number);
CREATE INDEX idx_journeys_deleted_at ON public.journeys USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);
CREATE INDEX idx_unhandled_queries_phone ON public.unhandled_queries USING btree (phone);
alter table public.meta_lead_forms enable row level security;
alter table public.meta_lead_submissions enable row level security;
alter table public.marketing_contacts enable row level security;
alter table public.marketing_leads_activity_log enable row level security;
alter table public.marketing_contact_list_views enable row level security;
alter table public.marketing_contact_list_view_members enable row level security;
alter table public.marketing_contact_engagement_scores enable row level security;
alter table public.marketing_journey_enrollments enable row level security;
alter table public.marketing_journey_excluded_contacts enable row level security;
alter table public.meta_pages enable row level security;
alter table public.meta_ad_accounts enable row level security;
alter table public.meta_connections enable row level security;
alter table public.meta_campaigns enable row level security;
alter table public.meta_ad_sets enable row level security;
alter table public.meta_ads enable row level security;
alter table public.meta_insights enable row level security;
alter table public.meta_custom_audiences enable row level security;
alter table public.meta_organic_posts enable row level security;
alter table public.meta_api_diagnostics enable row level security;
alter table public.meta_api_diagnostic_test_objects enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_cost_settings enable row level security;
alter table public.journey_enrollments enable row level security;
alter table public.journey_excluded_contacts enable row level security;
alter table public.journey_message_events enable row level security;
alter table public.journey_message_log enable row level security;
alter table public.journey_meta_ad_links enable row level security;
alter table public.journey_relative_fires enable row level security;
alter table public.journey_schedules enable row level security;
alter table public.whatsapp_config enable row level security;
alter table public.whatsapp_link_clicks enable row level security;
alter table public.whatsapp_message_log enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_phone_name_cache enable row level security;
alter table public.whatsapp_pricing_config enable row level security;
alter table public.whatsapp_requests enable row level security;
alter table public.whatsapp_sessions enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.whatsapp_tracked_links enable row level security;
alter table public.unhandled_queries enable row level security;
alter table public.profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_definitions enable row level security;
alter table public.security_profiles enable row level security;
alter table public.profile_object_permissions enable row level security;
alter table public.user_object_permissions enable row level security;
alter table public.permission_set_groups enable row level security;
alter table public.permission_set_group_permissions enable row level security;
alter table public.permission_set_group_users enable row level security;
alter table public.user_invitations enable row level security;
alter table public.user_approvals enable row level security;
alter table public.user_status_log enable row level security;
alter table public.user_delegations enable row level security;
alter table public.user_feature_config enable row level security;
alter table public.role_feature_config enable row level security;
alter table public.notification_preferences enable row level security;
create policy meta_lead_forms_delete_admin on public.meta_lead_forms as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_lead_forms_insert_admin on public.meta_lead_forms as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_lead_forms_select_authenticated on public.meta_lead_forms as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_lead_forms_update_admin on public.meta_lead_forms as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_lead_submissions_delete_admin on public.meta_lead_submissions as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_lead_submissions_insert_admin on public.meta_lead_submissions as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_lead_submissions_select_authenticated on public.meta_lead_submissions as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_lead_submissions_update_admin on public.meta_lead_submissions as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy marketing_contacts_delete_admin on public.marketing_contacts as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy marketing_contacts_insert_admin on public.marketing_contacts as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy marketing_contacts_select_authenticated on public.marketing_contacts as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy marketing_contacts_update_admin on public.marketing_contacts as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy marketing_leads_activity_log_delete_admin on public.marketing_leads_activity_log as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy marketing_leads_activity_log_insert_admin on public.marketing_leads_activity_log as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy marketing_leads_activity_log_select_authenticated on public.marketing_leads_activity_log as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy marketing_leads_activity_log_update_admin on public.marketing_leads_activity_log as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy marketing_contact_list_views_delete_admin on public.marketing_contact_list_views as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy marketing_contact_list_views_insert_admin on public.marketing_contact_list_views as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy marketing_contact_list_views_select_authenticated on public.marketing_contact_list_views as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy marketing_contact_list_views_update_admin on public.marketing_contact_list_views as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy marketing_contact_list_view_members_delete_admin on public.marketing_contact_list_view_members as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy marketing_contact_list_view_members_insert_admin on public.marketing_contact_list_view_members as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy marketing_contact_list_view_members_select_authenticated on public.marketing_contact_list_view_members as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy marketing_contact_list_view_members_update_admin on public.marketing_contact_list_view_members as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy marketing_contact_engagement_scores_delete_admin on public.marketing_contact_engagement_scores as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy marketing_contact_engagement_scores_insert_admin on public.marketing_contact_engagement_scores as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy marketing_contact_engagement_scores_select_authenticated on public.marketing_contact_engagement_scores as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy marketing_contact_engagement_scores_update_admin on public.marketing_contact_engagement_scores as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy marketing_journey_enrollments_delete_admin on public.marketing_journey_enrollments as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy marketing_journey_enrollments_insert_admin on public.marketing_journey_enrollments as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy marketing_journey_enrollments_select_authenticated on public.marketing_journey_enrollments as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy marketing_journey_enrollments_update_admin on public.marketing_journey_enrollments as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy marketing_journey_excluded_contacts_delete_admin on public.marketing_journey_excluded_contacts as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy marketing_journey_excluded_contacts_insert_admin on public.marketing_journey_excluded_contacts as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy marketing_journey_excluded_contacts_select_authenticated on public.marketing_journey_excluded_contacts as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy marketing_journey_excluded_contacts_update_admin on public.marketing_journey_excluded_contacts as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_pages_delete_admin on public.meta_pages as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_pages_insert_admin on public.meta_pages as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_pages_select_authenticated on public.meta_pages as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_pages_update_admin on public.meta_pages as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_ad_accounts_delete_admin on public.meta_ad_accounts as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_ad_accounts_insert_admin on public.meta_ad_accounts as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_ad_accounts_select_authenticated on public.meta_ad_accounts as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_ad_accounts_update_admin on public.meta_ad_accounts as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_connections_delete_admin on public.meta_connections as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_connections_insert_admin on public.meta_connections as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_connections_select_authenticated on public.meta_connections as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_connections_update_admin on public.meta_connections as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_campaigns_delete_admin on public.meta_campaigns as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_campaigns_insert_admin on public.meta_campaigns as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_campaigns_select_authenticated on public.meta_campaigns as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_campaigns_update_admin on public.meta_campaigns as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_ad_sets_delete_admin on public.meta_ad_sets as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_ad_sets_insert_admin on public.meta_ad_sets as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_ad_sets_select_authenticated on public.meta_ad_sets as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_ad_sets_update_admin on public.meta_ad_sets as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_ads_delete_admin on public.meta_ads as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_ads_insert_admin on public.meta_ads as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_ads_select_authenticated on public.meta_ads as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_ads_update_admin on public.meta_ads as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_insights_delete_admin on public.meta_insights as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_insights_insert_admin on public.meta_insights as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_insights_select_authenticated on public.meta_insights as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_insights_update_admin on public.meta_insights as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_custom_audiences_delete_admin on public.meta_custom_audiences as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_custom_audiences_insert_admin on public.meta_custom_audiences as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_custom_audiences_select_authenticated on public.meta_custom_audiences as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_custom_audiences_update_admin on public.meta_custom_audiences as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_organic_posts_delete_admin on public.meta_organic_posts as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_organic_posts_insert_admin on public.meta_organic_posts as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_organic_posts_select_authenticated on public.meta_organic_posts as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_organic_posts_update_admin on public.meta_organic_posts as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_api_diagnostics_delete_admin on public.meta_api_diagnostics as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_api_diagnostics_insert_admin on public.meta_api_diagnostics as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_api_diagnostics_select_authenticated on public.meta_api_diagnostics as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_api_diagnostics_update_admin on public.meta_api_diagnostics as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy meta_api_diagnostic_test_objects_delete_admin on public.meta_api_diagnostic_test_objects as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy meta_api_diagnostic_test_objects_insert_admin on public.meta_api_diagnostic_test_objects as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy meta_api_diagnostic_test_objects_select_authenticated on public.meta_api_diagnostic_test_objects as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy meta_api_diagnostic_test_objects_update_admin on public.meta_api_diagnostic_test_objects as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journeys_delete_admin on public.journeys as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journeys_insert_admin on public.journeys as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journeys_select_authenticated on public.journeys as permissive for SELECT to public using (((auth.role() = 'authenticated'::text) AND (deleted_at IS NULL)));
create policy journeys_update_admin on public.journeys as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journey_cost_settings_delete_admin on public.journey_cost_settings as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journey_cost_settings_insert_admin on public.journey_cost_settings as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journey_cost_settings_select_authenticated on public.journey_cost_settings as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy journey_cost_settings_update_admin on public.journey_cost_settings as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journey_enrollments_delete_admin on public.journey_enrollments as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journey_enrollments_insert_admin on public.journey_enrollments as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journey_enrollments_select_authenticated on public.journey_enrollments as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy journey_enrollments_update_admin on public.journey_enrollments as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journey_excluded_contacts_delete_admin on public.journey_excluded_contacts as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journey_excluded_contacts_insert_admin on public.journey_excluded_contacts as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journey_excluded_contacts_select_authenticated on public.journey_excluded_contacts as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy journey_excluded_contacts_update_admin on public.journey_excluded_contacts as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journey_message_events_delete_admin on public.journey_message_events as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journey_message_events_insert_admin on public.journey_message_events as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journey_message_events_select_authenticated on public.journey_message_events as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy journey_message_events_update_admin on public.journey_message_events as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journey_message_log_delete_admin on public.journey_message_log as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journey_message_log_insert_admin on public.journey_message_log as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journey_message_log_select_authenticated on public.journey_message_log as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy journey_message_log_update_admin on public.journey_message_log as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journey_meta_ad_links_delete_admin on public.journey_meta_ad_links as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journey_meta_ad_links_insert_admin on public.journey_meta_ad_links as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journey_meta_ad_links_select_authenticated on public.journey_meta_ad_links as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy journey_meta_ad_links_update_admin on public.journey_meta_ad_links as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journey_relative_fires_delete_admin on public.journey_relative_fires as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journey_relative_fires_insert_admin on public.journey_relative_fires as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journey_relative_fires_select_authenticated on public.journey_relative_fires as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy journey_relative_fires_update_admin on public.journey_relative_fires as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy journey_schedules_delete_admin on public.journey_schedules as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy journey_schedules_insert_admin on public.journey_schedules as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy journey_schedules_select_authenticated on public.journey_schedules as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy journey_schedules_update_admin on public.journey_schedules as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy "Admins can insert WhatsApp config" on public.whatsapp_config as permissive for INSERT to public with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins can update WhatsApp config" on public.whatsapp_config as permissive for UPDATE to public using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins can view WhatsApp config" on public.whatsapp_config as permissive for SELECT to public using (has_role(auth.uid(), 'admin'::app_role));
create policy whatsapp_link_clicks_delete_admin on public.whatsapp_link_clicks as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy whatsapp_link_clicks_insert_admin on public.whatsapp_link_clicks as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy whatsapp_link_clicks_select_authenticated on public.whatsapp_link_clicks as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy whatsapp_link_clicks_update_admin on public.whatsapp_link_clicks as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy whatsapp_message_log_delete_admin on public.whatsapp_message_log as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy whatsapp_message_log_insert_admin on public.whatsapp_message_log as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy whatsapp_message_log_select_authenticated on public.whatsapp_message_log as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy whatsapp_message_log_update_admin on public.whatsapp_message_log as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy whatsapp_messages_delete_admin on public.whatsapp_messages as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy whatsapp_messages_insert_admin on public.whatsapp_messages as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy whatsapp_messages_select_authenticated on public.whatsapp_messages as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy whatsapp_messages_update_admin on public.whatsapp_messages as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy whatsapp_pricing_config_delete_admin on public.whatsapp_pricing_config as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy whatsapp_pricing_config_insert_admin on public.whatsapp_pricing_config as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy whatsapp_pricing_config_select_authenticated on public.whatsapp_pricing_config as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy whatsapp_pricing_config_update_admin on public.whatsapp_pricing_config as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy whatsapp_requests_delete_admin on public.whatsapp_requests as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy whatsapp_requests_insert_admin on public.whatsapp_requests as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy whatsapp_requests_select_authenticated on public.whatsapp_requests as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy whatsapp_requests_update_admin on public.whatsapp_requests as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy "Service role full access on whatsapp_sessions" on public.whatsapp_sessions as permissive for ALL to service_role using (true) with check (true);
create policy whatsapp_templates_delete_admin on public.whatsapp_templates as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy whatsapp_templates_insert_admin on public.whatsapp_templates as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy whatsapp_templates_select_authenticated on public.whatsapp_templates as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy whatsapp_templates_update_admin on public.whatsapp_templates as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy whatsapp_tracked_links_delete_admin on public.whatsapp_tracked_links as permissive for DELETE to public using (is_system_admin(auth.uid()));
create policy whatsapp_tracked_links_insert_admin on public.whatsapp_tracked_links as permissive for INSERT to public with check (is_system_admin(auth.uid()));
create policy whatsapp_tracked_links_select_authenticated on public.whatsapp_tracked_links as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy whatsapp_tracked_links_update_admin on public.whatsapp_tracked_links as permissive for UPDATE to public using (is_system_admin(auth.uid()));
create policy "Authenticated users can view unhandled queries" on public.unhandled_queries as permissive for SELECT to authenticated using (true);
create policy "Service role can insert unhandled queries" on public.unhandled_queries as permissive for INSERT to service_role with check (true);
create policy "Admins can update user status" on public.profiles as permissive for UPDATE to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Authenticated users can view profile names" on public.profiles as permissive for SELECT to public using ((auth.role() = 'authenticated'::text));
create policy "System admins can view all profiles" on public.profiles as permissive for SELECT to authenticated using (is_system_admin(auth.uid()));
create policy "Users can insert their own profile" on public.profiles as permissive for INSERT to authenticated with check ((auth.uid() = id));
create policy "Users can update only their own profile non-sensitive fields" on public.profiles as permissive for UPDATE to public using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "Users can update own non-sensitive profile" on public.profiles as permissive for UPDATE to authenticated using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "Users can update their own profile" on public.profiles as permissive for UPDATE to authenticated using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "Users can view only their own profile" on public.profiles as permissive for SELECT to public using ((auth.uid() = id));
create policy "Users can view their own profile with logging" on public.profiles as permissive for SELECT to public using (can_view_profile(id));
create policy "Only admins can manage profile assignments" on public.user_profiles as permissive for ALL to public using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Users can view profile assignments" on public.user_profiles as permissive for SELECT to public using (((auth.uid() = user_id) OR is_system_admin(auth.uid())));
create policy "Admins can manage roles" on public.user_roles as permissive for ALL to public using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins can view all roles" on public.user_roles as permissive for SELECT to public using (has_role(auth.uid(), 'admin'::app_role));
create policy "Users can view their own roles" on public.user_roles as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Admins can manage role definitions" on public.role_definitions as permissive for ALL to authenticated using (has_role(auth.uid(), 'admin'::app_role));
create policy "Authenticated users can view role definitions" on public.role_definitions as permissive for SELECT to authenticated using (true);
create policy "Anyone can view profiles" on public.security_profiles as permissive for SELECT to public using (true);
create policy "Only admins can manage profiles" on public.security_profiles as permissive for ALL to public using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Only admins can manage permissions" on public.profile_object_permissions as permissive for ALL to public using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Users can view permissions for their profile" on public.profile_object_permissions as permissive for SELECT to public using (((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.user_id = auth.uid()) AND (up.profile_id = profile_object_permissions.profile_id)))) OR has_role(auth.uid(), 'admin'::app_role)));
create policy "Admins can manage user permissions" on public.user_object_permissions as permissive for ALL to public using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Users can read own permissions" on public.user_object_permissions as permissive for SELECT to public using ((auth.uid() = user_id));
create policy "Admins can manage permission set groups" on public.permission_set_groups as permissive for ALL to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Authenticated users can read permission set groups" on public.permission_set_groups as permissive for SELECT to authenticated using (true);
create policy "Admins can manage group permissions" on public.permission_set_group_permissions as permissive for ALL to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Authenticated users can read group permissions" on public.permission_set_group_permissions as permissive for SELECT to authenticated using (true);
create policy "Admins can manage group users" on public.permission_set_group_users as permissive for ALL to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Authenticated users can read group users" on public.permission_set_group_users as permissive for SELECT to authenticated using (true);
create policy "Admin invitation creation" on public.user_invitations as permissive for INSERT to public with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Admin invitation management" on public.user_invitations as permissive for UPDATE to public using (has_role(auth.uid(), 'admin'::app_role));
create policy "Admins can manage invitations" on public.user_invitations as permissive for ALL to public using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Secure invitation access" on public.user_invitations as permissive for SELECT to public using (has_role(auth.uid(), 'admin'::app_role));
create policy "Approvers can update their approvals" on public.user_approvals as permissive for UPDATE to public using (((auth.uid() = approver_id) OR has_role(auth.uid(), 'admin'::app_role)));
create policy "System can create approvals" on public.user_approvals as permissive for INSERT to public with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Users can view their own approvals" on public.user_approvals as permissive for SELECT to public using (((auth.uid() = user_id) OR (auth.uid() = approver_id) OR has_role(auth.uid(), 'admin'::app_role)));
create policy deleg_owner_insert on public.user_delegations as permissive for INSERT to authenticated with check ((from_user_id = auth.uid()));
create policy deleg_owner_update on public.user_delegations as permissive for UPDATE to authenticated using ((from_user_id = auth.uid()));
create policy deleg_party_select on public.user_delegations as permissive for SELECT to authenticated using (((from_user_id = auth.uid()) OR (to_user_id = auth.uid())));
create policy ufc_self_read on public.user_feature_config as permissive for SELECT to authenticated using ((user_id = auth.uid()));
create policy ufc_super_admin_all on public.user_feature_config as permissive for ALL to authenticated using (is_system_admin(auth.uid())) with check (is_system_admin(auth.uid()));
create policy rfc_read_authenticated on public.role_feature_config as permissive for SELECT to authenticated using (true);
create policy rfc_super_admin_all on public.role_feature_config as permissive for ALL to authenticated using (is_system_admin(auth.uid())) with check (is_system_admin(auth.uid()));
create policy "Users can delete their own notification preferences" on public.notification_preferences as permissive for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert their own notification preferences" on public.notification_preferences as permissive for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update their own notification preferences" on public.notification_preferences as permissive for UPDATE to public using ((auth.uid() = user_id));
create policy "Users can view their own notification preferences" on public.notification_preferences as permissive for SELECT to public using ((auth.uid() = user_id));
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meta_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meta_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meta_ad_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meta_ads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meta_organic_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.journeys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.journey_cost_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.journey_enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.journey_relative_fires FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.journey_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER validate_journey_schedule_trigger BEFORE INSERT OR UPDATE ON public.journey_schedules FOR EACH ROW EXECUTE FUNCTION validate_journey_schedule();
CREATE TRIGGER update_whatsapp_config_updated_at BEFORE UPDATE ON public.whatsapp_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.whatsapp_message_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.whatsapp_pricing_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER a_block_hard_delete BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION tg_block_hard_delete();
CREATE TRIGGER hash_hint_answer_on_change BEFORE INSERT OR UPDATE OF hint_answer ON public.profiles FOR EACH ROW EXECUTE FUNCTION hash_hint_answer_trigger();
CREATE TRIGGER protect_sensitive_profile_data BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_admin_sensitive_access();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_guard_security_profile_delete BEFORE DELETE ON public.security_profiles FOR EACH ROW EXECUTE FUNCTION guard_security_profile_delete();
CREATE TRIGGER trg_auto_seed_system_admin AFTER INSERT ON public.profile_object_permissions FOR EACH ROW EXECUTE FUNCTION auto_seed_system_admin_permissions();
CREATE TRIGGER trg_grant_new_object_to_sysadmin AFTER INSERT ON public.profile_object_permissions FOR EACH ROW EXECUTE FUNCTION tg_grant_new_object_to_sysadmin();
CREATE TRIGGER update_user_object_permissions_updated_at BEFORE UPDATE ON public.user_object_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_permission_set_groups_updated_at BEFORE UPDATE ON public.permission_set_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_approvals_updated_at BEFORE UPDATE ON public.user_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ufc_touch BEFORE UPDATE ON public.user_feature_config FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_rfc_touch BEFORE UPDATE ON public.role_feature_config FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
grant select, insert, update, delete on public.meta_lead_forms to authenticated, service_role;
grant select, insert, update, delete on public.meta_lead_submissions to authenticated, service_role;
grant select, insert, update, delete on public.marketing_contacts to authenticated, service_role;
grant select, insert, update, delete on public.marketing_leads_activity_log to authenticated, service_role;
grant select, insert, update, delete on public.marketing_contact_list_views to authenticated, service_role;
grant select, insert, update, delete on public.marketing_contact_list_view_members to authenticated, service_role;
grant select, insert, update, delete on public.marketing_contact_engagement_scores to authenticated, service_role;
grant select, insert, update, delete on public.marketing_journey_enrollments to authenticated, service_role;
grant select, insert, update, delete on public.marketing_journey_excluded_contacts to authenticated, service_role;
grant select, insert, update, delete on public.meta_pages to authenticated, service_role;
grant select, insert, update, delete on public.meta_ad_accounts to authenticated, service_role;
grant select, insert, update, delete on public.meta_connections to authenticated, service_role;
grant select, insert, update, delete on public.meta_campaigns to authenticated, service_role;
grant select, insert, update, delete on public.meta_ad_sets to authenticated, service_role;
grant select, insert, update, delete on public.meta_ads to authenticated, service_role;
grant select, insert, update, delete on public.meta_insights to authenticated, service_role;
grant select, insert, update, delete on public.meta_custom_audiences to authenticated, service_role;
grant select, insert, update, delete on public.meta_organic_posts to authenticated, service_role;
grant select, insert, update, delete on public.meta_api_diagnostics to authenticated, service_role;
grant select, insert, update, delete on public.meta_api_diagnostic_test_objects to authenticated, service_role;
grant select, insert, update, delete on public.journeys to authenticated, service_role;
grant select, insert, update, delete on public.journey_cost_settings to authenticated, service_role;
grant select, insert, update, delete on public.journey_enrollments to authenticated, service_role;
grant select, insert, update, delete on public.journey_excluded_contacts to authenticated, service_role;
grant select, insert, update, delete on public.journey_message_events to authenticated, service_role;
grant select, insert, update, delete on public.journey_message_log to authenticated, service_role;
grant select, insert, update, delete on public.journey_meta_ad_links to authenticated, service_role;
grant select, insert, update, delete on public.journey_relative_fires to authenticated, service_role;
grant select, insert, update, delete on public.journey_schedules to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_config to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_link_clicks to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_message_log to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_messages to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_phone_name_cache to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_pricing_config to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_requests to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_sessions to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_templates to authenticated, service_role;
grant select, insert, update, delete on public.whatsapp_tracked_links to authenticated, service_role;
grant select, insert, update, delete on public.unhandled_queries to authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.user_profiles to authenticated, service_role;
grant select, insert, update, delete on public.user_roles to authenticated, service_role;
grant select, insert, update, delete on public.role_definitions to authenticated, service_role;
grant select, insert, update, delete on public.security_profiles to authenticated, service_role;
grant select, insert, update, delete on public.profile_object_permissions to authenticated, service_role;
grant select, insert, update, delete on public.user_object_permissions to authenticated, service_role;
grant select, insert, update, delete on public.permission_set_groups to authenticated, service_role;
grant select, insert, update, delete on public.permission_set_group_permissions to authenticated, service_role;
grant select, insert, update, delete on public.permission_set_group_users to authenticated, service_role;
grant select, insert, update, delete on public.user_invitations to authenticated, service_role;
grant select, insert, update, delete on public.user_approvals to authenticated, service_role;
grant select, insert, update, delete on public.user_status_log to authenticated, service_role;
grant select, insert, update, delete on public.user_delegations to authenticated, service_role;
grant select, insert, update, delete on public.user_feature_config to authenticated, service_role;
grant select, insert, update, delete on public.role_feature_config to authenticated, service_role;
grant select, insert, update, delete on public.notification_preferences to authenticated, service_role;
commit;
