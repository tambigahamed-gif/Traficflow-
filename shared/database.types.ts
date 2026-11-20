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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          permissions: Json
          social_account_id: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          permissions?: Json
          social_account_id: number
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          permissions?: Json
          social_account_id?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_assignments_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assistants: {
        Row: {
          audience: string
          id: number
          language: string
          permission: string
          rules: string
          social_account_id: number
          style: string
          tone: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          audience?: string
          id?: number
          language?: string
          permission?: string
          rules?: string
          social_account_id: number
          style?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          audience?: string
          id?: number
          language?: string
          permission?: string
          rules?: string
          social_account_id?: number
          style?: string
          tone?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistants_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: true
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          messages_used: number
          period_start: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          messages_used?: number
          period_start: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          messages_used?: number
          period_start?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: number
          next_retry_at: string | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_payload: Json
          workflow_id: string | null
          workspace_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          next_retry_at?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_payload?: Json
          workflow_id?: string | null
          workspace_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          next_retry_at?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_payload?: Json
          workflow_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_workflows: {
        Row: {
          action_config: Json
          action_type: string
          condition: Json
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          trigger_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          condition?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          trigger_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          condition?: Json
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          trigger_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_imports: {
        Row: {
          imported_at: string
          imported_by: string
          summary: Json
          workspace_id: string
        }
        Insert: {
          imported_at?: string
          imported_by: string
          summary?: Json
          workspace_id: string
        }
        Update: {
          imported_at?: string
          imported_by?: string
          summary?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_imports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          created_at: string
          created_by: string | null
          folder_id: string | null
          id: number
          media_type: string
          source_url: string | null
          storage_path: string | null
          tags: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          folder_id?: string | null
          id?: number
          media_type?: string
          source_url?: string | null
          storage_path?: string | null
          tags?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          folder_id?: string | null
          id?: number
          media_type?: string
          source_url?: string | null
          storage_path?: string | null
          tags?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media_account_links: {
        Row: {
          created_at: string
          linked_by: string | null
          media_id: number
          social_account_id: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          linked_by?: string | null
          media_id: number
          social_account_id: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          linked_by?: string | null
          media_id?: number
          social_account_id?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_account_links_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_account_links_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_account_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_account_workspace_fk"
            columns: ["workspace_id", "social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "media_link_media_workspace_fk"
            columns: ["workspace_id", "media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      media_folders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      media_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: number
          media_id: number
          snapshot: Json
          workspace_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: number
          media_id: number
          snapshot: Json
          workspace_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: number
          media_id?: number
          snapshot?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_history_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          href: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          href?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          href?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_change_requests: {
        Row: {
          created_at: string
          from_plan: string
          id: string
          requested_by: string
          requested_plan: string
          resolved_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          from_plan: string
          id?: string
          requested_by: string
          requested_plan: string
          resolved_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          from_plan?: string
          id?: string
          requested_by?: string
          requested_plan?: string
          resolved_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_requests_from_plan_fkey"
            columns: ["from_plan"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "plan_change_requests_requested_plan_fkey"
            columns: ["requested_plan"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "plan_change_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: number
          post_id: number
          snapshot: Json
          workspace_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: number
          post_id: number
          snapshot: Json
          workspace_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: number
          post_id?: number
          snapshot?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_history_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      post_approval_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          id: string
          post_id: number | null
          post_snapshot: Json
          request_note: string
          requested_by: string
          requested_scheduled_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          id?: string
          post_id?: number | null
          post_snapshot: Json
          request_note?: string
          requested_by: string
          requested_scheduled_at: string
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          id?: string
          post_id?: number | null
          post_snapshot?: Json
          request_note?: string
          requested_by?: string
          requested_scheduled_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_approval_requests_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_approval_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          assigned_to: string | null
          caption: string
          created_at: string
          created_by: string | null
          cta: string
          hashtags: string
          id: number
          media_id: number | null
          published_at: string | null
          scheduled_at: string | null
          social_account_id: number | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          hashtags?: string
          id?: number
          media_id?: number | null
          published_at?: string | null
          scheduled_at?: string | null
          social_account_id?: number | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          caption?: string
          created_at?: string
          created_by?: string | null
          cta?: string
          hashtags?: string
          id?: number
          media_id?: number | null
          published_at?: string | null
          scheduled_at?: string | null
          social_account_id?: number | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_account_workspace_fk"
            columns: ["workspace_id", "social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "posts_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_media_workspace_fk"
            columns: ["workspace_id", "media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "posts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_roles: {
        Row: {
          user_id: string
          role: string
          granted_at: string
          granted_by: string | null
          revoked_at: string | null
        }
        Insert: {
          user_id: string
          role?: string
          granted_at?: string
          granted_by?: string | null
          revoked_at?: string | null
        }
        Update: {
          user_id?: string
          role?: string
          granted_at?: string
          granted_by?: string | null
          revoked_at?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          avatar_url: string | null
          connected_at: string
          connection_status: string
          created_at: string
          created_by: string | null
          display_name: string
          engagement_rate: number
          followers: number
          handle: string
          id: number
          is_active: boolean
          niche: string
          platform: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          connected_at?: string
          connection_status?: string
          created_at?: string
          created_by?: string | null
          display_name: string
          engagement_rate?: number
          followers?: number
          handle: string
          id?: number
          is_active?: boolean
          niche?: string
          platform: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          connected_at?: string
          connection_status?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          engagement_rate?: number
          followers?: number
          handle?: string
          id?: number
          is_active?: boolean
          niche?: string
          platform?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_expires_at: string | null
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider_code: string
          provider_user_id: string | null
          scopes: string[]
          social_account_id: number
          status: string
          token_reference: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_expires_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider_code: string
          provider_user_id?: string | null
          scopes?: string[]
          social_account_id: number
          status?: string
          token_reference?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_expires_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider_code?: string
          provider_user_id?: string | null
          scopes?: string[]
          social_account_id?: number
          status?: string
          token_reference?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_provider_code_fkey"
            columns: ["provider_code"]
            isOneToOne: false
            referencedRelation: "social_platforms"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "social_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_workspace_id_social_account_id_fkey"
            columns: ["workspace_id", "social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      social_platforms: {
        Row: {
          api_capabilities: Json
          code: string
          display_name: string
          notes: string
          oauth_available: boolean
        }
        Insert: {
          api_capabilities?: Json
          code: string
          display_name: string
          notes?: string
          oauth_available?: boolean
        }
        Update: {
          api_capabilities?: Json
          code?: string
          display_name?: string
          notes?: string
          oauth_available?: boolean
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          external_event_id: string | null
          from_plan: string | null
          id: number
          note: string
          provider: string | null
          to_plan: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          external_event_id?: string | null
          from_plan?: string | null
          id?: number
          note?: string
          provider?: string | null
          to_plan?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          external_event_id?: string | null
          from_plan?: string | null
          id?: number
          note?: string
          provider?: string | null
          to_plan?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_from_plan_fkey"
            columns: ["from_plan"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscription_events_to_plan_fkey"
            columns: ["to_plan"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscription_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          id: string
          workspace_id: string
          plan_code: string
          amount_usd: number
          currency: string
          provider: string
          reference: string
          provider_transaction_id: string | null
          status: string
          failure_reason: string | null
          created_by: string
          created_at: string
          confirmed_at: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          workspace_id: string
          transaction_id: string
          number: string
          plan_code: string
          amount_usd: number
          period_start: string
          period_end: string
          issued_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      subscription_plans: {
        Row: {
          member_limit: number | null
          link_page_limit: number | null
          scheduled_post_limit: number | null
          is_public: boolean
          team_analytics: boolean
          sort_order: number
          advanced_analytics: boolean
          ai_message_limit: number
          automation_limit: number
          code: string
          created_at: string
          name: string
          price_usd: number
          priority_support: boolean
          social_account_limit: number | null
          va_limit: number
        }
        Insert: {
          member_limit?: number | null
          link_page_limit?: number | null
          scheduled_post_limit?: number | null
          is_public?: boolean
          team_analytics?: boolean
          sort_order?: number
          advanced_analytics?: boolean
          ai_message_limit: number
          automation_limit: number
          code: string
          created_at?: string
          name: string
          price_usd: number
          priority_support?: boolean
          social_account_limit: number
          va_limit: number
        }
        Update: {
          member_limit?: number | null
          link_page_limit?: number | null
          scheduled_post_limit?: number | null
          is_public?: boolean
          team_analytics?: boolean
          sort_order?: number
          advanced_analytics?: boolean
          ai_message_limit?: number
          automation_limit?: number
          code?: string
          created_at?: string
          name?: string
          price_usd?: number
          priority_support?: boolean
          social_account_limit?: number
          va_limit?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          external_subscription_id: string | null
          id: string
          payment_provider: string | null
          plan_code: string
          renews_at: string | null
          started_at: string
          status: string
          trial_ends_at: string
          trial_starts_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          external_subscription_id?: string | null
          id?: string
          payment_provider?: string | null
          plan_code?: string
          renews_at?: string | null
          started_at?: string
          status?: string
          trial_ends_at?: string
          trial_starts_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          external_subscription_id?: string | null
          id?: string
          payment_provider?: string | null
          plan_code?: string
          renews_at?: string | null
          started_at?: string
          status?: string
          trial_ends_at?: string
          trial_starts_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          due_at: string | null
          id: string
          post_id: number | null
          social_account_id: number | null
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_at?: string | null
          id?: string
          post_id?: number | null
          social_account_id?: number | null
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_at?: string | null
          id?: string
          post_id?: number | null
          social_account_id?: number | null
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_account_workspace_fk"
            columns: ["workspace_id", "social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "tasks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_post_workspace_fk"
            columns: ["workspace_id", "post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "tasks_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          permissions: Json
          revoked_at: string | null
          role: string
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          permissions?: Json
          revoked_at?: string | null
          role?: string
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          permissions?: Json
          revoked_at?: string | null
          role?: string
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          joined_at: string
          last_active_at: string | null
          permissions: Json
          role: string
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          joined_at?: string
          last_active_at?: string | null
          permissions?: Json
          role?: string
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          joined_at?: string
          last_active_at?: string | null
          permissions?: Json
          role?: string
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_workspace_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      trafficflow_consume_ai_message: {
        Args: { p_workspace_id: string }
        Returns: number
      }
      trafficflow_submit_post_for_approval: {
        Args: { p_workspace_id: string; p_post_id: number; p_scheduled_at: string; p_request_note?: string }
        Returns: string
      }
      trafficflow_decide_post_approval: {
        Args: { p_workspace_id: string; p_request_id: string; p_decision: string; p_decision_note?: string }
        Returns: undefined
      }
      trafficflow_create_invitation: {
        Args: {
          p_email: string
          p_permissions?: Json
          p_role: string
          p_token_hash: string
          p_workspace_id: string
        }
        Returns: string
      }
      trafficflow_create_social_account: {
        Args: {
          p_display_name: string
          p_handle: string
          p_niche?: string
          p_platform: string
          p_workspace_id: string
        }
        Returns: number
      }
      trafficflow_create_task: {
        Args: {
          p_assigned_to: string
          p_description: string
          p_due_at: string
          p_post_id: number
          p_social_account_id: number
          p_title: string
          p_workspace_id: string
        }
        Returns: string
      }
      trafficflow_create_workflow: {
        Args: {
          p_action_config: Json
          p_action_type: string
          p_condition: Json
          p_name: string
          p_trigger_type: string
          p_workspace_id: string
        }
        Returns: string
      }
      trafficflow_create_workspace: {
        Args: { p_name: string }
        Returns: string
      }
      trafficflow_delete_assignment: {
        Args: {
          p_social_account_id: number
          p_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      trafficflow_get_my_workspaces: {
        Args: never
        Returns: {
          member_status: string
          plan_code: string
          role: string
          subscription_status: string
          trial_ends_at: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      trafficflow_apply_payment_result: {
        Args: { p_provider: string; p_event_id: string; p_reference: string; p_provider_transaction_id: string; p_amount_usd: number; p_success: boolean; p_reason?: string }
        Returns: string
      }
      trafficflow_expire_subscriptions: {
        Args: { p_grace_days?: number }
        Returns: number
      }
      trafficflow_get_usage_v3: {
        Args: { p_workspace_id: string }
        Returns: {
          plan_code: string
          plan_name: string
          price_usd: number
          subscription_status: string
          trial_ends_at: string
          renews_at: string | null
          grace_ends_at: string | null
          cancel_at_period_end: boolean
          effective_plan_code: string
          social_account_limit: number | null
          member_limit: number | null
          link_page_limit: number | null
          scheduled_post_limit: number | null
          ai_message_limit: number
          automation_limit: number
          advanced_analytics: boolean
          team_analytics: boolean
          priority_support: boolean
          social_accounts_used: number
          members_used: number
          link_pages_used: number
          scheduled_posts_used: number
          automations_used: number
          ai_messages_used: number
          can_manage_billing: boolean
        }[]
      }
      trafficflow_create_payment: {
        Args: { p_workspace_id: string; p_plan_code: string; p_provider: string }
        Returns: { transaction_id: string; reference: string; amount_usd: number }[]
      }
      trafficflow_cancel_subscription: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      trafficflow_get_usage: {
        Args: { p_workspace_id: string }
        Returns: {
          plan_code: string
          plan_name: string
          price_usd: number
          subscription_status: string
          trial_ends_at: string
          renews_at: string | null
          social_account_limit: number
          va_limit: number
          ai_message_limit: number
          automation_limit: number
          advanced_analytics: boolean
          priority_support: boolean
          social_accounts_used: number
          vas_used: number
          automations_used: number
          ai_messages_used: number
          period_start: string
          can_manage_billing: boolean
        }[]
      }
      trafficflow_touch_membership: {
        Args: never
        Returns: undefined
      }
      trafficflow_update_member_role: {
        Args: { p_workspace_id: string; p_user_id: string; p_role: string }
        Returns: undefined
      }
      trafficflow_import_v1: {
        Args: { p_payload: Json; p_workspace_id: string }
        Returns: Json
      }
      trafficflow_release_ai_message: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      trafficflow_remove_member: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      trafficflow_request_plan_change: {
        Args: { p_plan_code: string; p_workspace_id: string }
        Returns: string
      }
      trafficflow_revoke_invitation: {
        Args: { p_invitation_id: string; p_workspace_id: string }
        Returns: undefined
      }
      trafficflow_save_assistant: {
        Args: {
          p_audience: string
          p_language: string
          p_permission: string
          p_rules: string
          p_social_account_id: number
          p_style: string
          p_tone: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      trafficflow_set_assignment: {
        Args: {
          p_permissions: Json
          p_social_account_id: number
          p_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      trafficflow_set_member: {
        Args: {
          p_permissions?: Json
          p_role: string
          p_status: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      trafficflow_update_task_status: {
        Args: { p_status: string; p_task_id: string; p_workspace_id: string }
        Returns: undefined
      }
      trafficflow_update_workflow: {
        Args: {
          p_enabled: boolean
          p_workflow_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
