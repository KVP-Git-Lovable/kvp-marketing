export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      journey_cost_settings: {
        Row: {
          created_at: string
          email_cost_per_message: number
          id: string
          journey_id: string | null
          sms_cost_per_message: number
          updated_at: string
          whatsapp_cost_per_message: number
        }
        Insert: {
          created_at?: string
          email_cost_per_message?: number
          id?: string
          journey_id?: string | null
          sms_cost_per_message?: number
          updated_at?: string
          whatsapp_cost_per_message?: number
        }
        Update: {
          created_at?: string
          email_cost_per_message?: number
          id?: string
          journey_id?: string | null
          sms_cost_per_message?: number
          updated_at?: string
          whatsapp_cost_per_message?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_cost_settings_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_enrollments: {
        Row: {
          current_node_id: string | null
          enrolled_at: string
          id: string
          journey_id: string
          next_fire_at: string | null
          retailer_id: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          current_node_id?: string | null
          enrolled_at?: string
          id?: string
          journey_id: string
          next_fire_at?: string | null
          retailer_id: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          current_node_id?: string | null
          enrolled_at?: string
          id?: string
          journey_id?: string
          next_fire_at?: string | null
          retailer_id?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_enrollments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_excluded_contacts: {
        Row: {
          excluded_at: string
          id: string
          journey_id: string
          reason: string | null
          retailer_id: string
        }
        Insert: {
          excluded_at?: string
          id?: string
          journey_id: string
          reason?: string | null
          retailer_id: string
        }
        Update: {
          excluded_at?: string
          id?: string
          journey_id?: string
          reason?: string | null
          retailer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_excluded_contacts_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_message_events: {
        Row: {
          event_type: string
          id: string
          journey_message_log_id: string | null
          occurred_at: string
          raw_payload: Json | null
        }
        Insert: {
          event_type: string
          id?: string
          journey_message_log_id?: string | null
          occurred_at?: string
          raw_payload?: Json | null
        }
        Update: {
          event_type?: string
          id?: string
          journey_message_log_id?: string | null
          occurred_at?: string
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_message_events_journey_message_log_id_fkey"
            columns: ["journey_message_log_id"]
            isOneToOne: false
            referencedRelation: "journey_message_log"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_message_log: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string
          enrollment_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          journey_id: string
          node_id: string | null
          provider_message_id: string | null
          retailer_id: string | null
          status: string
        }
        Insert: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          journey_id: string
          node_id?: string | null
          provider_message_id?: string | null
          retailer_id?: string | null
          status?: string
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          journey_id?: string
          node_id?: string | null
          provider_message_id?: string | null
          retailer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_message_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "journey_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_message_log_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_meta_ad_links: {
        Row: {
          created_at: string
          id: string
          journey_id: string
          meta_ad_set_row_id: string
          meta_custom_audience_row_id: string
          node_id: string
          pushed_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          journey_id: string
          meta_ad_set_row_id: string
          meta_custom_audience_row_id: string
          node_id: string
          pushed_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          journey_id?: string
          meta_ad_set_row_id?: string
          meta_custom_audience_row_id?: string
          node_id?: string
          pushed_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_meta_ad_links_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_meta_ad_links_meta_ad_set_row_id_fkey"
            columns: ["meta_ad_set_row_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_meta_ad_links_meta_custom_audience_row_id_fkey"
            columns: ["meta_custom_audience_row_id"]
            isOneToOne: false
            referencedRelation: "meta_custom_audiences"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_relative_fires: {
        Row: {
          created_at: string
          enrollment_id: string
          fire_at: string
          fired: boolean
          id: string
          journey_id: string
          node_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          fire_at: string
          fired?: boolean
          id?: string
          journey_id: string
          node_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          fire_at?: string
          fired?: boolean
          id?: string
          journey_id?: string
          node_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_relative_fires_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "journey_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_relative_fires_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_schedules: {
        Row: {
          created_at: string
          id: string
          journey_id: string
          next_run_at: string | null
          recurrence_rule: string | null
          schedule_type: string
          start_at: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          journey_id: string
          next_run_at?: string | null
          recurrence_rule?: string | null
          schedule_type?: string
          start_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          journey_id?: string
          next_run_at?: string | null
          recurrence_rule?: string | null
          schedule_type?: string
          start_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_schedules_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          approval_notes: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          canvas_data: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          filters: Json
          id: string
          name: string
          segment_type: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          canvas_data?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          filters?: Json
          id?: string
          name: string
          segment_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          canvas_data?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          filters?: Json
          id?: string
          name?: string
          segment_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_contact_engagement_scores: {
        Row: {
          contact_id: string
          id: string
          last_event_at: string | null
          score: number
          updated_at: string
        }
        Insert: {
          contact_id: string
          id?: string
          last_event_at?: string | null
          score?: number
          updated_at?: string
        }
        Update: {
          contact_id?: string
          id?: string
          last_event_at?: string | null
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketing_contact_list_view_members: {
        Row: {
          added_at: string
          contact_id: string
          id: string
          list_view_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          id?: string
          list_view_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          id?: string
          list_view_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_contact_list_view_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_contact_list_view_members_list_view_id_fkey"
            columns: ["list_view_id"]
            isOneToOne: false
            referencedRelation: "marketing_contact_list_views"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_contact_list_views: {
        Row: {
          created_at: string
          created_by: string | null
          database_type: string
          filters: Json
          id: string
          is_shared: boolean
          name: string
          updated_at: string
          visible_columns: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          database_type: string
          filters?: Json
          id?: string
          is_shared?: boolean
          name: string
          updated_at?: string
          visible_columns?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          database_type?: string
          filters?: Json
          id?: string
          is_shared?: boolean
          name?: string
          updated_at?: string
          visible_columns?: Json
        }
        Relationships: []
      }
      marketing_contacts: {
        Row: {
          address: string | null
          business_details: string | null
          city: string | null
          converted_at: string | null
          converted_by: string | null
          converted_to_retailer_id: string | null
          country: string | null
          created_at: string
          database_type: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_source: string | null
          name: string
          phone: string | null
          pincode: string | null
          state: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          business_details?: string | null
          city?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_to_retailer_id?: string | null
          country?: string | null
          created_at?: string
          database_type: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          name: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          business_details?: string | null
          city?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_to_retailer_id?: string | null
          country?: string | null
          created_at?: string
          database_type?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          name?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      marketing_journey_enrollments: {
        Row: {
          contact_id: string
          current_node_id: string | null
          enrolled_at: string
          id: string
          journey_id: string
          next_fire_at: string | null
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          current_node_id?: string | null
          enrolled_at?: string
          id?: string
          journey_id: string
          next_fire_at?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          current_node_id?: string | null
          enrolled_at?: string
          id?: string
          journey_id?: string
          next_fire_at?: string | null
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_journey_excluded_contacts: {
        Row: {
          contact_id: string
          excluded_at: string
          id: string
          journey_id: string
          reason: string | null
        }
        Insert: {
          contact_id: string
          excluded_at?: string
          id?: string
          journey_id: string
          reason?: string | null
        }
        Update: {
          contact_id?: string
          excluded_at?: string
          id?: string
          journey_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      marketing_leads_activity_log: {
        Row: {
          body: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          meta: Json | null
          type: string
        }
        Insert: {
          body?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json | null
          type: string
        }
        Update: {
          body?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_leads_activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_accounts: {
        Row: {
          account_name: string | null
          account_status: number | null
          ad_account_id: string
          connection_id: string
          created_at: string
          currency: string | null
          disable_reason: string | null
          id: string
          timezone_name: string | null
        }
        Insert: {
          account_name?: string | null
          account_status?: number | null
          ad_account_id: string
          connection_id: string
          created_at?: string
          currency?: string | null
          disable_reason?: string | null
          id?: string
          timezone_name?: string | null
        }
        Update: {
          account_name?: string | null
          account_status?: number | null
          ad_account_id?: string
          connection_id?: string
          created_at?: string
          currency?: string | null
          disable_reason?: string | null
          id?: string
          timezone_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_sets: {
        Row: {
          bid_amount: number | null
          bid_strategy: string | null
          billing_event: string | null
          budget_type: string | null
          campaign_id: string
          created_at: string
          custom_audience_id: string | null
          custom_audience_row_id: string | null
          daily_budget: number | null
          end_at: string | null
          id: string
          instagram_id: string | null
          last_synced_at: string | null
          meta_ad_set_id: string
          meta_effective_status: string | null
          name: string
          optimization_goal: string | null
          page_id: string | null
          placements: Json | null
          published_at: string | null
          start_at: string | null
          status: string
          targeting: Json
          timezone_name: string | null
          updated_at: string
        }
        Insert: {
          bid_amount?: number | null
          bid_strategy?: string | null
          billing_event?: string | null
          budget_type?: string | null
          campaign_id: string
          created_at?: string
          custom_audience_id?: string | null
          custom_audience_row_id?: string | null
          daily_budget?: number | null
          end_at?: string | null
          id?: string
          instagram_id?: string | null
          last_synced_at?: string | null
          meta_ad_set_id: string
          meta_effective_status?: string | null
          name: string
          optimization_goal?: string | null
          page_id?: string | null
          placements?: Json | null
          published_at?: string | null
          start_at?: string | null
          status?: string
          targeting?: Json
          timezone_name?: string | null
          updated_at?: string
        }
        Update: {
          bid_amount?: number | null
          bid_strategy?: string | null
          billing_event?: string | null
          budget_type?: string | null
          campaign_id?: string
          created_at?: string
          custom_audience_id?: string | null
          custom_audience_row_id?: string | null
          daily_budget?: number | null
          end_at?: string | null
          id?: string
          instagram_id?: string | null
          last_synced_at?: string | null
          meta_ad_set_id?: string
          meta_effective_status?: string | null
          name?: string
          optimization_goal?: string | null
          page_id?: string | null
          placements?: Json | null
          published_at?: string | null
          start_at?: string | null
          status?: string
          targeting?: Json
          timezone_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_sets_custom_audience_row_id_fkey"
            columns: ["custom_audience_row_id"]
            isOneToOne: false
            referencedRelation: "meta_custom_audiences"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads: {
        Row: {
          ad_set_id: string
          call_to_action: string | null
          created_at: string
          creative: Json
          creative_type: string | null
          description: string | null
          destination_url: string | null
          display_link: string | null
          format: string | null
          headline: string | null
          id: string
          last_synced_at: string | null
          lead_form_id: string | null
          meta_ad_id: string
          name: string
          primary_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ad_set_id: string
          call_to_action?: string | null
          created_at?: string
          creative?: Json
          creative_type?: string | null
          description?: string | null
          destination_url?: string | null
          display_link?: string | null
          format?: string | null
          headline?: string | null
          id?: string
          last_synced_at?: string | null
          lead_form_id?: string | null
          meta_ad_id: string
          name: string
          primary_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ad_set_id?: string
          call_to_action?: string | null
          created_at?: string
          creative?: Json
          creative_type?: string | null
          description?: string | null
          destination_url?: string | null
          display_link?: string | null
          format?: string | null
          headline?: string | null
          id?: string
          last_synced_at?: string | null
          lead_form_id?: string | null
          meta_ad_id?: string
          name?: string
          primary_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ads_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_api_diagnostic_test_objects: {
        Row: {
          cleaned_up: boolean
          created_at: string
          diagnostic_id: string
          id: string
          meta_object_id: string | null
          object_type: string
        }
        Insert: {
          cleaned_up?: boolean
          created_at?: string
          diagnostic_id: string
          id?: string
          meta_object_id?: string | null
          object_type: string
        }
        Update: {
          cleaned_up?: boolean
          created_at?: string
          diagnostic_id?: string
          id?: string
          meta_object_id?: string | null
          object_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_api_diagnostic_test_objects_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "meta_api_diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_api_diagnostics: {
        Row: {
          category: string | null
          check_name: string
          detail: string | null
          duration_ms: number | null
          endpoint: string | null
          http_status: number | null
          id: string
          method: string | null
          records: number | null
          run_at: string
          run_by: string | null
          sample: Json | null
          status: string
        }
        Insert: {
          category?: string | null
          check_name: string
          detail?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          http_status?: number | null
          id?: string
          method?: string | null
          records?: number | null
          run_at?: string
          run_by?: string | null
          sample?: Json | null
          status: string
        }
        Update: {
          category?: string | null
          check_name?: string
          detail?: string | null
          duration_ms?: number | null
          endpoint?: string | null
          http_status?: number | null
          id?: string
          method?: string | null
          records?: number | null
          run_at?: string
          run_by?: string | null
          sample?: Json | null
          status?: string
        }
        Relationships: []
      }
      meta_campaigns: {
        Row: {
          ad_account_id: string
          bid_strategy: string | null
          budget_type: string | null
          buying_type: string | null
          created_at: string
          created_by: string | null
          daily_budget: number | null
          end_date: string | null
          id: string
          last_synced_at: string | null
          meta_campaign_id: string
          meta_effective_status: string | null
          name: string
          objective: string | null
          published_at: string | null
          special_ad_categories: string[] | null
          spend_cap: number | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          bid_strategy?: string | null
          budget_type?: string | null
          buying_type?: string | null
          created_at?: string
          created_by?: string | null
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          last_synced_at?: string | null
          meta_campaign_id: string
          meta_effective_status?: string | null
          name: string
          objective?: string | null
          published_at?: string | null
          special_ad_categories?: string[] | null
          spend_cap?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          bid_strategy?: string | null
          budget_type?: string | null
          buying_type?: string | null
          created_at?: string
          created_by?: string | null
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          last_synced_at?: string | null
          meta_campaign_id?: string
          meta_effective_status?: string | null
          name?: string
          objective?: string | null
          published_at?: string | null
          special_ad_categories?: string[] | null
          spend_cap?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          access_token_enc: string | null
          business_id: string | null
          business_name: string | null
          connected_by: string | null
          created_at: string
          default_ad_account_id: string | null
          default_ad_instagram_id: string | null
          default_ad_instagram_username: string | null
          default_instagram_id: string | null
          default_page_id: string | null
          external_user_name: string | null
          id: string
          meta_user_id: string | null
          scopes: string[] | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_enc?: string | null
          business_id?: string | null
          business_name?: string | null
          connected_by?: string | null
          created_at?: string
          default_ad_account_id?: string | null
          default_ad_instagram_id?: string | null
          default_ad_instagram_username?: string | null
          default_instagram_id?: string | null
          default_page_id?: string | null
          external_user_name?: string | null
          id?: string
          meta_user_id?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_enc?: string | null
          business_id?: string | null
          business_name?: string | null
          connected_by?: string | null
          created_at?: string
          default_ad_account_id?: string | null
          default_ad_instagram_id?: string | null
          default_ad_instagram_username?: string | null
          default_instagram_id?: string | null
          default_page_id?: string | null
          external_user_name?: string | null
          id?: string
          meta_user_id?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_custom_audiences: {
        Row: {
          ad_account_id: string
          connection_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duplicate_count: number
          error: string | null
          external_id: string | null
          id: string
          identifier_schema: string[]
          invalid_count: number
          meta_status: Json
          name: string
          origin: string
          origin_ref: string | null
          row_count: number
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duplicate_count?: number
          error?: string | null
          external_id?: string | null
          id?: string
          identifier_schema?: string[]
          invalid_count?: number
          meta_status?: Json
          name: string
          origin?: string
          origin_ref?: string | null
          row_count?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duplicate_count?: number
          error?: string | null
          external_id?: string | null
          id?: string
          identifier_schema?: string[]
          invalid_count?: number
          meta_status?: Json
          name?: string
          origin?: string
          origin_ref?: string | null
          row_count?: number
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_custom_audiences_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_insights: {
        Row: {
          clicks: number
          created_at: string
          date: string
          entity_id: string
          entity_type: string
          id: string
          impressions: number
          reach: number
          spend: number
        }
        Insert: {
          clicks?: number
          created_at?: string
          date: string
          entity_id: string
          entity_type: string
          id?: string
          impressions?: number
          reach?: number
          spend?: number
        }
        Update: {
          clicks?: number
          created_at?: string
          date?: string
          entity_id?: string
          entity_type?: string
          id?: string
          impressions?: number
          reach?: number
          spend?: number
        }
        Relationships: []
      }
      meta_lead_forms: {
        Row: {
          block_display_for_non_targeted_viewer: boolean
          connection_id: string | null
          context_card: Json | null
          created_at: string
          created_by: string | null
          external_id: string | null
          follow_up_action_url: string | null
          id: string
          imported: boolean
          is_optimized_for_quality: boolean
          leads_count: number
          locale: string
          name: string
          page_id: string
          privacy_link_text: string | null
          privacy_policy_url: string | null
          questions: Json
          status: string
          thank_you_page: Json | null
          updated_at: string
        }
        Insert: {
          block_display_for_non_targeted_viewer?: boolean
          connection_id?: string | null
          context_card?: Json | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          follow_up_action_url?: string | null
          id?: string
          imported?: boolean
          is_optimized_for_quality?: boolean
          leads_count?: number
          locale?: string
          name: string
          page_id: string
          privacy_link_text?: string | null
          privacy_policy_url?: string | null
          questions?: Json
          status?: string
          thank_you_page?: Json | null
          updated_at?: string
        }
        Update: {
          block_display_for_non_targeted_viewer?: boolean
          connection_id?: string | null
          context_card?: Json | null
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          follow_up_action_url?: string | null
          id?: string
          imported?: boolean
          is_optimized_for_quality?: boolean
          leads_count?: number
          locale?: string
          name?: string
          page_id?: string
          privacy_link_text?: string | null
          privacy_policy_url?: string | null
          questions?: Json
          status?: string
          thank_you_page?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_forms_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_submissions: {
        Row: {
          ad_external_id: string | null
          ad_id: string | null
          created_at: string
          created_time: string | null
          external_id: string
          field_data: Json
          form_external_id: string | null
          id: string
          is_organic: boolean | null
        }
        Insert: {
          ad_external_id?: string | null
          ad_id?: string | null
          created_at?: string
          created_time?: string | null
          external_id: string
          field_data?: Json
          form_external_id?: string | null
          id?: string
          is_organic?: boolean | null
        }
        Update: {
          ad_external_id?: string | null
          ad_id?: string | null
          created_at?: string
          created_time?: string | null
          external_id?: string
          field_data?: Json
          form_external_id?: string | null
          id?: string
          is_organic?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_submissions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "meta_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_organic_posts: {
        Row: {
          created_at: string
          created_by: string | null
          destination: string
          error_message: string | null
          id: string
          instagram_id: string | null
          instagram_post_id: string | null
          media_url: string | null
          message: string | null
          meta_post_id: string | null
          page_id: string | null
          post_type: string
          published_at: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination?: string
          error_message?: string | null
          id?: string
          instagram_id?: string | null
          instagram_post_id?: string | null
          media_url?: string | null
          message?: string | null
          meta_post_id?: string | null
          page_id?: string | null
          post_type?: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination?: string
          error_message?: string | null
          id?: string
          instagram_id?: string | null
          instagram_post_id?: string | null
          media_url?: string | null
          message?: string | null
          meta_post_id?: string | null
          page_id?: string | null
          post_type?: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_organic_posts_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          category: string | null
          connection_id: string
          created_at: string
          id: string
          instagram_business_id: string | null
          instagram_username: string | null
          page_id: string
          page_name: string | null
          page_token_enc: string | null
          picture_url: string | null
        }
        Insert: {
          category?: string | null
          connection_id: string
          created_at?: string
          id?: string
          instagram_business_id?: string | null
          instagram_username?: string | null
          page_id: string
          page_name?: string | null
          page_token_enc?: string | null
          picture_url?: string | null
        }
        Update: {
          category?: string | null
          connection_id?: string
          created_at?: string
          id?: string
          instagram_business_id?: string | null
          instagram_username?: string | null
          page_id?: string
          page_name?: string | null
          page_token_enc?: string | null
          picture_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          template_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          template_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          template_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      permission_set_group_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_modify_all: boolean
          can_read: boolean
          can_view_all: boolean
          created_at: string
          group_id: string
          id: string
          object_name: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_modify_all?: boolean
          can_read?: boolean
          can_view_all?: boolean
          created_at?: string
          group_id: string
          id?: string
          object_name: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_modify_all?: boolean
          can_read?: boolean
          can_view_all?: boolean
          created_at?: string
          group_id?: string
          id?: string
          object_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_set_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_set_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_set_group_users: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_set_group_users_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_set_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_set_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_object_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_modify_all: boolean | null
          can_read: boolean | null
          can_view_all: boolean | null
          created_at: string | null
          id: string
          object_name: string
          parent_module: string | null
          permission_type: string
          profile_id: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_modify_all?: boolean | null
          can_read?: boolean | null
          can_view_all?: boolean | null
          created_at?: string | null
          id?: string
          object_name: string
          parent_module?: string | null
          permission_type?: string
          profile_id?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_modify_all?: boolean | null
          can_read?: boolean | null
          can_view_all?: boolean | null
          created_at?: string | null
          id?: string
          object_name?: string
          parent_module?: string | null
          permission_type?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_object_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "security_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          anniversary_date: string | null
          aspirations: string | null
          created_at: string
          currency: string | null
          current_address: string | null
          date_of_birth: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          designation: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          facebook_url: string | null
          full_name: string
          hint_answer: string | null
          hint_question: string | null
          id: string
          instagram_url: string | null
          interests: string[] | null
          invitation_token: string | null
          is_active: boolean
          learning_goals: string[] | null
          linkedin_url: string | null
          locale: string | null
          must_change_password: boolean | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          permanent_address: string | null
          phone_number: string | null
          preferred_language: string | null
          profile_picture_url: string | null
          reactivated_at: string | null
          recovery_email: string | null
          role_id: string | null
          territories_covered: string[] | null
          timezone: string | null
          twitter_url: string | null
          updated_at: string
          user_status: Database["public"]["Enums"]["user_status"] | null
          username: string
          work_location: string | null
        }
        Insert: {
          anniversary_date?: string | null
          aspirations?: string | null
          created_at?: string
          currency?: string | null
          current_address?: string | null
          date_of_birth?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          designation?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          facebook_url?: string | null
          full_name: string
          hint_answer?: string | null
          hint_question?: string | null
          id: string
          instagram_url?: string | null
          interests?: string[] | null
          invitation_token?: string | null
          is_active?: boolean
          learning_goals?: string[] | null
          linkedin_url?: string | null
          locale?: string | null
          must_change_password?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          permanent_address?: string | null
          phone_number?: string | null
          preferred_language?: string | null
          profile_picture_url?: string | null
          reactivated_at?: string | null
          recovery_email?: string | null
          role_id?: string | null
          territories_covered?: string[] | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_status?: Database["public"]["Enums"]["user_status"] | null
          username: string
          work_location?: string | null
        }
        Update: {
          anniversary_date?: string | null
          aspirations?: string | null
          created_at?: string
          currency?: string | null
          current_address?: string | null
          date_of_birth?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          designation?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          facebook_url?: string | null
          full_name?: string
          hint_answer?: string | null
          hint_question?: string | null
          id?: string
          instagram_url?: string | null
          interests?: string[] | null
          invitation_token?: string | null
          is_active?: boolean
          learning_goals?: string[] | null
          linkedin_url?: string | null
          locale?: string | null
          must_change_password?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          permanent_address?: string | null
          phone_number?: string | null
          preferred_language?: string | null
          profile_picture_url?: string | null
          reactivated_at?: string | null
          recovery_email?: string | null
          role_id?: string | null
          territories_covered?: string[] | null
          timezone?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_status?: Database["public"]["Enums"]["user_status"] | null
          username?: string
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      role_definitions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          required_competencies: Json | null
          responsibilities: string[] | null
          role_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          required_competencies?: Json | null
          responsibilities?: string[] | null
          role_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          required_competencies?: Json | null
          responsibilities?: string[] | null
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_feature_config: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          is_enabled: boolean | null
          role_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          is_enabled?: boolean | null
          role_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          is_enabled?: boolean | null
          role_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_feature_config_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "security_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_profiles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      unhandled_queries: {
        Row: {
          category: string | null
          created_at: string | null
          created_date: string
          id: string
          message: string
          phone: string
          retailer_id: string | null
          retailer_name: string | null
          status: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_date?: string
          id?: string
          message: string
          phone: string
          retailer_id?: string | null
          retailer_name?: string | null
          status?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_date?: string
          id?: string
          message?: string
          phone?: string
          retailer_id?: string | null
          retailer_name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      user_approvals: {
        Row: {
          approval_level: number
          approved_at: string | null
          approver_id: string | null
          comments: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["approval_status"] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approval_level: number
          approved_at?: string | null
          approver_id?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approval_level?: number
          approved_at?: string | null
          approver_id?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_delegations: {
        Row: {
          beat_ids: string[]
          created_at: string
          created_by: string | null
          delegation_scope: string
          effective_from: string
          effective_to: string
          from_user_id: string
          id: string
          notes: string | null
          retailer_ids: string[]
          status: string
          to_user_id: string
        }
        Insert: {
          beat_ids?: string[]
          created_at?: string
          created_by?: string | null
          delegation_scope: string
          effective_from: string
          effective_to: string
          from_user_id: string
          id?: string
          notes?: string | null
          retailer_ids?: string[]
          status?: string
          to_user_id: string
        }
        Update: {
          beat_ids?: string[]
          created_at?: string
          created_by?: string | null
          delegation_scope?: string
          effective_from?: string
          effective_to?: string
          from_user_id?: string
          id?: string
          notes?: string | null
          retailer_ids?: string[]
          status?: string
          to_user_id?: string
        }
        Relationships: []
      }
      user_feature_config: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          is_enabled: boolean | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invitation_token: string
          manager_id: string | null
          phone_number: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          full_name: string
          id?: string
          invitation_token: string
          manager_id?: string | null
          phone_number?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invitation_token?: string
          manager_id?: string | null
          phone_number?: string | null
          status?: string | null
        }
        Relationships: []
      }
      user_object_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_modify_all: boolean | null
          can_read: boolean | null
          can_view_all: boolean | null
          created_at: string | null
          id: string
          object_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_modify_all?: boolean | null
          can_read?: boolean | null
          can_view_all?: boolean | null
          created_at?: string | null
          id?: string
          object_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_modify_all?: boolean | null
          can_read?: boolean | null
          can_view_all?: boolean | null
          created_at?: string | null
          id?: string
          object_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          assigned_at: string | null
          id: string
          profile_id: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "security_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_status_log: {
        Row: {
          action: string
          created_at: string
          id: string
          performed_by: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          performed_by?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          performed_by?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          business_name: string | null
          business_phone_number: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          sms_sender_number: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          business_name?: string | null
          business_phone_number: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          sms_sender_number?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          business_name?: string | null
          business_phone_number?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          sms_sender_number?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_link_clicks: {
        Row: {
          clicked_at: string
          contact_id: string | null
          id: string
          ip_address: string | null
          retailer_id: string | null
          tracked_link_id: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          contact_id?: string | null
          id?: string
          ip_address?: string | null
          retailer_id?: string | null
          tracked_link_id: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          contact_id?: string | null
          id?: string
          ip_address?: string | null
          retailer_id?: string | null
          tracked_link_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_link_clicks_tracked_link_id_fkey"
            columns: ["tracked_link_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_tracked_links"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          body: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          journey_id: string | null
          retailer_id: string | null
          sent_by: string | null
          status: string
          template_id: string | null
          to_number: string
          twilio_sid: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          journey_id?: string | null
          retailer_id?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          to_number: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          journey_id?: string | null
          retailer_id?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          to_number?: string
          twilio_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string
          direction: string
          from_number: string
          id: string
          media_url: string | null
          order_id: string | null
          retailer_id: string | null
          status: string | null
          to_number: string
          twilio_sid: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          direction: string
          from_number: string
          id?: string
          media_url?: string | null
          order_id?: string | null
          retailer_id?: string | null
          status?: string | null
          to_number: string
          twilio_sid?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          direction?: string
          from_number?: string
          id?: string
          media_url?: string | null
          order_id?: string | null
          retailer_id?: string | null
          status?: string | null
          to_number?: string
          twilio_sid?: string | null
        }
        Relationships: []
      }
      whatsapp_phone_name_cache: {
        Row: {
          name: string
          phone_key: string
          retailer_id: string
          updated_at: string
        }
        Insert: {
          name: string
          phone_key: string
          retailer_id: string
          updated_at?: string
        }
        Update: {
          name?: string
          phone_key?: string
          retailer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_pricing_config: {
        Row: {
          category: string
          created_at: string
          currency: string
          effective_from: string
          id: string
          price_per_message: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          effective_from?: string
          id?: string
          price_per_message?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          effective_from?: string
          id?: string
          price_per_message?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_requests: {
        Row: {
          body: string | null
          created_at: string
          from_number: string
          handled: boolean
          id: string
          retailer_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          from_number: string
          handled?: boolean
          id?: string
          retailer_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          from_number?: string
          handled?: boolean
          id?: string
          retailer_id?: string | null
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          beat_id: string | null
          conversation_history: Json | null
          created_at: string | null
          id: string
          last_active_at: string | null
          owner_id: string | null
          pending_items: Json | null
          phone_number: string
          retailer_id: string | null
          retailer_name: string | null
          state: string
          territory_id: string | null
        }
        Insert: {
          beat_id?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          id?: string
          last_active_at?: string | null
          owner_id?: string | null
          pending_items?: Json | null
          phone_number: string
          retailer_id?: string | null
          retailer_name?: string | null
          state?: string
          territory_id?: string | null
        }
        Update: {
          beat_id?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          id?: string
          last_active_at?: string | null
          owner_id?: string | null
          pending_items?: Json | null
          phone_number?: string
          retailer_id?: string | null
          retailer_name?: string | null
          state?: string
          territory_id?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          approval_status: string
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          language: string
          name: string
          rejection_reason: string | null
          status: string
          twilio_content_sid: string | null
          twilio_content_types: Json | null
          twilio_media_is_variable: boolean
          twilio_media_url: string | null
          twilio_required_variables: string[]
          twilio_synced_at: string | null
          twilio_template_type: string | null
          updated_at: string
          user_initiated_approved: boolean
          variables: Json
        }
        Insert: {
          approval_status?: string
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name: string
          rejection_reason?: string | null
          status?: string
          twilio_content_sid?: string | null
          twilio_content_types?: Json | null
          twilio_media_is_variable?: boolean
          twilio_media_url?: string | null
          twilio_required_variables?: string[]
          twilio_synced_at?: string | null
          twilio_template_type?: string | null
          updated_at?: string
          user_initiated_approved?: boolean
          variables?: Json
        }
        Update: {
          approval_status?: string
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          name?: string
          rejection_reason?: string | null
          status?: string
          twilio_content_sid?: string | null
          twilio_content_types?: Json | null
          twilio_media_is_variable?: boolean
          twilio_media_url?: string | null
          twilio_required_variables?: string[]
          twilio_synced_at?: string | null
          twilio_template_type?: string | null
          updated_at?: string
          user_initiated_approved?: boolean
          variables?: Json
        }
        Relationships: []
      }
      whatsapp_tracked_links: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          journey_id: string | null
          journey_message_log_id: string | null
          retailer_id: string | null
          short_code: string
          target_url: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          journey_id?: string | null
          journey_message_log_id?: string | null
          retailer_id?: string | null
          short_code: string
          target_url: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          journey_id?: string | null
          journey_message_log_id?: string | null
          retailer_id?: string | null
          short_code?: string
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_tracked_links_journey_message_log_id_fkey"
            columns: ["journey_message_log_id"]
            isOneToOne: false
            referencedRelation: "journey_message_log"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_profile: { Args: { _target_user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_hint_answer: { Args: { answer: string }; Returns: string }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      approval_status: "pending" | "approved" | "rejected"
      user_status:
        | "pending_completion"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "active"
        | "inactive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      approval_status: ["pending", "approved", "rejected"],
      user_status: [
        "pending_completion",
        "pending_approval",
        "approved",
        "rejected",
        "active",
        "inactive",
      ],
    },
  },
} as const
