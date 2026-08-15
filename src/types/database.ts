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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      __mig019_test_results: {
        Row: {
          details: string | null
          passed: boolean
          test_name: string
        }
        Insert: {
          details?: string | null
          passed: boolean
          test_name: string
        }
        Update: {
          details?: string | null
          passed?: boolean
          test_name?: string
        }
        Relationships: []
      }
      __mig024_test_results: {
        Row: {
          details: string | null
          passed: boolean
          test_name: string
        }
        Insert: {
          details?: string | null
          passed: boolean
          test_name: string
        }
        Update: {
          details?: string | null
          passed?: boolean
          test_name?: string
        }
        Relationships: []
      }
      __mig025_test_results: {
        Row: {
          details: string | null
          passed: boolean
          test_name: string
        }
        Insert: {
          details?: string | null
          passed: boolean
          test_name: string
        }
        Update: {
          details?: string | null
          passed?: boolean
          test_name?: string
        }
        Relationships: []
      }
      __mig026_test_results: {
        Row: {
          details: string | null
          passed: boolean
          test_name: string
        }
        Insert: {
          details?: string | null
          passed: boolean
          test_name: string
        }
        Update: {
          details?: string | null
          passed?: boolean
          test_name?: string
        }
        Relationships: []
      }
      __mig027_test_results: {
        Row: {
          details: string | null
          passed: boolean
          test_name: string
        }
        Insert: {
          details?: string | null
          passed: boolean
          test_name: string
        }
        Update: {
          details?: string | null
          passed?: boolean
          test_name?: string
        }
        Relationships: []
      }
      __mig028_test_results: {
        Row: {
          details: string | null
          passed: boolean
          test_name: string
        }
        Insert: {
          details?: string | null
          passed: boolean
          test_name: string
        }
        Update: {
          details?: string | null
          passed?: boolean
          test_name?: string
        }
        Relationships: []
      }
      __mig029_test_results: {
        Row: {
          details: string | null
          passed: boolean
          test_name: string
        }
        Insert: {
          details?: string | null
          passed: boolean
          test_name: string
        }
        Update: {
          details?: string | null
          passed?: boolean
          test_name?: string
        }
        Relationships: []
      }
      ai_jobs: {
        Row: {
          app: string
          attempts: number
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          organization_id: string
          payload: Json
          processed_at: string | null
          resultado: Json | null
          status: string
          tipo: string
        }
        Insert: {
          app?: string
          attempts?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          payload: Json
          processed_at?: string | null
          resultado?: Json | null
          status?: string
          tipo: string
        }
        Update: {
          app?: string
          attempts?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          resultado?: Json | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          after_data: Json | null
          before_data: Json | null
          changed_fields: string[]
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          source: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          changed_fields?: string[]
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          source?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          changed_fields?: string[]
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_invitations: {
        Row: {
          accepted_by_profile_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_profile_id: string
          organization_id: string
          season_team_player_id: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_by_profile_id?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by_profile_id: string
          organization_id: string
          season_team_player_id: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_by_profile_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_profile_id?: string
          organization_id?: string
          season_team_player_id?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captain_invitations_accepted_by_profile_id_fkey"
            columns: ["accepted_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_invitations_invited_by_profile_id_fkey"
            columns: ["invited_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_invitations_season_team_player_id_fkey"
            columns: ["season_team_player_id"]
            isOneToOne: false
            referencedRelation: "season_team_players"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      discipline_suspensions: {
        Row: {
          created_at: string
          id: string
          matches_remaining: number
          matches_served: number
          notes: string | null
          organization_id: string
          season_team_player_id: string
          source_match_event_id: string | null
          status: string
          suspension_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          matches_remaining: number
          matches_served?: number
          notes?: string | null
          organization_id: string
          season_team_player_id: string
          source_match_event_id?: string | null
          status?: string
          suspension_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          matches_remaining?: number
          matches_served?: number
          notes?: string | null
          organization_id?: string
          season_team_player_id?: string
          source_match_event_id?: string | null
          status?: string
          suspension_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_suspensions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_suspensions_season_team_player_id_fkey"
            columns: ["season_team_player_id"]
            isOneToOne: false
            referencedRelation: "season_team_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_suspensions_source_match_event_id_fkey"
            columns: ["source_match_event_id"]
            isOneToOne: false
            referencedRelation: "match_events"
            referencedColumns: ["id"]
          },
        ]
      }
      field_availability_rules: {
        Row: {
          created_at: string
          day_of_week: number
          ends_at: string
          field_id: string
          id: string
          organization_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          ends_at: string
          field_id: string
          id?: string
          organization_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          ends_at?: string
          field_id?: string
          id?: string
          organization_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_availability_rules_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_availability_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      field_reservations: {
        Row: {
          created_at: string
          ends_at: string
          field_id: string
          id: string
          match_id: string | null
          organization_id: string
          reservation_type: string
          starts_at: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          field_id: string
          id?: string
          match_id?: string | null
          organization_id: string
          reservation_type: string
          starts_at: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          field_id?: string
          id?: string
          match_id?: string | null
          organization_id?: string
          reservation_type?: string
          starts_at?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_reservations_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_reservations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          surface_type: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          surface_type?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          surface_type?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      match_chronicles: {
        Row: {
          ai_job_id: string | null
          content: string
          created_at: string
          generated_at: string
          id: string
          is_published: boolean
          match_id: string
          model_used: string | null
          organization_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          ai_job_id?: string | null
          content: string
          created_at?: string
          generated_at?: string
          id?: string
          is_published?: boolean
          match_id: string
          model_used?: string | null
          organization_id: string
          tier?: string
          updated_at?: string
        }
        Update: {
          ai_job_id?: string | null
          content?: string
          created_at?: string
          generated_at?: string
          id?: string
          is_published?: boolean
          match_id?: string
          model_used?: string | null
          organization_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_chronicles_ai_job_id_fkey"
            columns: ["ai_job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_chronicles_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_chronicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_summaries: {
        Row: {
          ai_job_id: string | null
          content: string
          created_at: string
          id: string
          is_published: boolean
          model_used: string | null
          organization_id: string
          round_number: number
          season_id: string
          updated_at: string
        }
        Insert: {
          ai_job_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          model_used?: string | null
          organization_id: string
          round_number: number
          season_id: string
          updated_at?: string
        }
        Update: {
          ai_job_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          model_used?: string | null
          organization_id?: string
          round_number?: number
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_summaries_ai_job_id_fkey"
            columns: ["ai_job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_summaries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      match_context: {
        Row: {
          attendance: number | null
          created_at: string
          highlight_note: string | null
          id: string
          match_id: string
          organization_id: string
          referee_name: string | null
          updated_at: string
          weather: string | null
        }
        Insert: {
          attendance?: number | null
          created_at?: string
          highlight_note?: string | null
          id?: string
          match_id: string
          organization_id: string
          referee_name?: string | null
          updated_at?: string
          weather?: string | null
        }
        Update: {
          attendance?: number | null
          created_at?: string
          highlight_note?: string | null
          id?: string
          match_id?: string
          organization_id?: string
          referee_name?: string | null
          updated_at?: string
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_context_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_context_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          assist_season_team_player_id: string | null
          created_at: string
          event_type: string
          id: string
          match_id: string
          minute: number
          notes: string | null
          organization_id: string
          season_team_player_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        Insert: {
          assist_season_team_player_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          match_id: string
          minute: number
          notes?: string | null
          organization_id: string
          season_team_player_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Update: {
          assist_season_team_player_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          match_id?: string
          minute?: number
          notes?: string | null
          organization_id?: string
          season_team_player_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_assist_season_team_player_id_fkey"
            columns: ["assist_season_team_player_id"]
            isOneToOne: false
            referencedRelation: "season_team_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_season_team_player_id_fkey"
            columns: ["season_team_player_id"]
            isOneToOne: false
            referencedRelation: "season_team_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_voided_by_profile_id_fkey"
            columns: ["voided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_officials: {
        Row: {
          created_at: string
          id: string
          match_id: string
          organization_id: string
          profile_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          organization_id: string
          profile_id: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          organization_id?: string
          profile_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_officials_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_officials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_officials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_player_stats: {
        Row: {
          created_at: string
          distance_km: number | null
          id: string
          is_man_of_match: boolean
          match_id: string
          minutes_played: number | null
          organization_id: string
          passes_attempted: number | null
          passes_completed: number | null
          rating: number | null
          season_team_player_id: string
          shots: number | null
          shots_on_target: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          id?: string
          is_man_of_match?: boolean
          match_id: string
          minutes_played?: number | null
          organization_id: string
          passes_attempted?: number | null
          passes_completed?: number | null
          rating?: number | null
          season_team_player_id: string
          shots?: number | null
          shots_on_target?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          id?: string
          is_man_of_match?: boolean
          match_id?: string
          minutes_played?: number | null
          organization_id?: string
          passes_attempted?: number | null
          passes_completed?: number | null
          rating?: number | null
          season_team_player_id?: string
          shots?: number | null
          shots_on_target?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_season_team_player_id_fkey"
            columns: ["season_team_player_id"]
            isOneToOne: false
            referencedRelation: "season_team_players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_reschedule_requests: {
        Row: {
          admin_resolution_notes: string | null
          admin_resolved_by_profile_id: string | null
          created_at: string
          expires_at: string
          id: string
          match_id: string
          organization_id: string
          proposed_by_profile_id: string
          proposed_field_id: string | null
          proposed_starts_at: string
          responded_at: string | null
          responded_by_profile_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_resolution_notes?: string | null
          admin_resolved_by_profile_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          match_id: string
          organization_id: string
          proposed_by_profile_id: string
          proposed_field_id?: string | null
          proposed_starts_at: string
          responded_at?: string | null
          responded_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_resolution_notes?: string | null
          admin_resolved_by_profile_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          match_id?: string
          organization_id?: string
          proposed_by_profile_id?: string
          proposed_field_id?: string | null
          proposed_starts_at?: string
          responded_at?: string | null
          responded_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_reschedule_requests_admin_resolved_by_profile_id_fkey"
            columns: ["admin_resolved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reschedule_requests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reschedule_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reschedule_requests_proposed_by_profile_id_fkey"
            columns: ["proposed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reschedule_requests_proposed_field_id_fkey"
            columns: ["proposed_field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reschedule_requests_responded_by_profile_id_fkey"
            columns: ["responded_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_team_stats: {
        Row: {
          corners: number | null
          created_at: string
          fouls: number | null
          id: string
          match_id: string
          offsides: number | null
          organization_id: string
          possession_pct: number | null
          season_team_id: string
          shots: number | null
          shots_on_target: number | null
          updated_at: string
        }
        Insert: {
          corners?: number | null
          created_at?: string
          fouls?: number | null
          id?: string
          match_id: string
          offsides?: number | null
          organization_id: string
          possession_pct?: number | null
          season_team_id: string
          shots?: number | null
          shots_on_target?: number | null
          updated_at?: string
        }
        Update: {
          corners?: number | null
          created_at?: string
          fouls?: number | null
          id?: string
          match_id?: string
          offsides?: number | null
          organization_id?: string
          possession_pct?: number | null
          season_team_id?: string
          shots?: number | null
          shots_on_target?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_team_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_team_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_team_stats_season_team_id_fkey"
            columns: ["season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_season_team_id: string
          bracket_slot: number | null
          calendar_status: string
          created_at: string
          field_reservation_id: string | null
          home_score: number | null
          home_season_team_id: string
          id: string
          knockout_round_id: string | null
          leg_number: number | null
          organization_id: string
          round_label: string | null
          round_number: number | null
          season_group_id: string | null
          season_id: string
          sequence_in_round: number | null
          status: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_season_team_id: string
          bracket_slot?: number | null
          calendar_status?: string
          created_at?: string
          field_reservation_id?: string | null
          home_score?: number | null
          home_season_team_id: string
          id?: string
          knockout_round_id?: string | null
          leg_number?: number | null
          organization_id: string
          round_label?: string | null
          round_number?: number | null
          season_group_id?: string | null
          season_id: string
          sequence_in_round?: number | null
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_season_team_id?: string
          bracket_slot?: number | null
          calendar_status?: string
          created_at?: string
          field_reservation_id?: string | null
          home_score?: number | null
          home_season_team_id?: string
          id?: string
          knockout_round_id?: string | null
          leg_number?: number | null
          organization_id?: string
          round_label?: string | null
          round_number?: number | null
          season_group_id?: string | null
          season_id?: string
          sequence_in_round?: number | null
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_season_team_id_fkey"
            columns: ["away_season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_field_reservation_id_fkey"
            columns: ["field_reservation_id"]
            isOneToOne: false
            referencedRelation: "field_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_season_team_id_fkey"
            columns: ["home_season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_knockout_round_id_fkey"
            columns: ["knockout_round_id"]
            isOneToOne: false
            referencedRelation: "season_knockout_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_group_id_fkey"
            columns: ["season_group_id"]
            isOneToOne: false
            referencedRelation: "season_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_scopes: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          id: string
          organization_id: string
          organization_member_id: string
          scope_id: string
          scope_type: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          id?: string
          organization_id: string
          organization_member_id: string
          scope_id: string
          scope_type: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          id?: string
          organization_id?: string
          organization_member_id?: string
          scope_id?: string
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_scopes_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_scopes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_scopes_organization_member_id_fkey"
            columns: ["organization_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          profile_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          profile_id: string
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_profile_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_profile_id: string
          organization_id: string
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_profile_id?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by_profile_id: string
          organization_id: string
          role: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_profile_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_profile_id?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_profile_id_fkey"
            columns: ["accepted_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_invited_by_profile_id_fkey"
            columns: ["invited_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_color: string | null
          created_at: string
          created_by: string
          id: string
          logo_path: string | null
          name: string
          plan_tier: string
          slug: string
          sold_by_platform_staff_id: string | null
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          created_by: string
          id?: string
          logo_path?: string | null
          name: string
          plan_tier?: string
          slug: string
          sold_by_platform_staff_id?: string | null
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          logo_path?: string | null
          name?: string
          plan_tier?: string
          slug?: string
          sold_by_platform_staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_sold_by_platform_staff_id_fkey"
            columns: ["sold_by_platform_staff_id"]
            isOneToOne: false
            referencedRelation: "platform_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_expense_entries: {
        Row: {
          amount: number
          category: string
          id: string
          notes: string | null
          recorded_at: string
          recorded_by_profile_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        Insert: {
          amount: number
          category: string
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by_profile_id: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by_profile_id?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_expense_entries_recorded_by_profile_id_fkey"
            columns: ["recorded_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_expense_entries_voided_by_profile_id_fkey"
            columns: ["voided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_income_entries: {
        Row: {
          amount: number
          id: string
          notes: string | null
          organization_id: string | null
          recorded_at: string
          recorded_by_profile_id: string
          season_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        Insert: {
          amount: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          recorded_at?: string
          recorded_by_profile_id: string
          season_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Update: {
          amount?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          recorded_at?: string
          recorded_by_profile_id?: string
          season_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_income_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_income_entries_recorded_by_profile_id_fkey"
            columns: ["recorded_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_income_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_income_entries_voided_by_profile_id_fkey"
            columns: ["voided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_pricing_defaults: {
        Row: {
          base_price_per_team: number
          duration_multiplier_4_to_6: number
          duration_multiplier_7_to_12: number
          duration_multiplier_hasta_3: number
          id: number
          updated_at: string
          updated_by_profile_id: string | null
          volume_multiplier_1_to_2: number
          volume_multiplier_3_to_5: number
          volume_multiplier_6_plus: number
        }
        Insert: {
          base_price_per_team: number
          duration_multiplier_4_to_6: number
          duration_multiplier_7_to_12: number
          duration_multiplier_hasta_3: number
          id?: number
          updated_at?: string
          updated_by_profile_id?: string | null
          volume_multiplier_1_to_2: number
          volume_multiplier_3_to_5: number
          volume_multiplier_6_plus: number
        }
        Update: {
          base_price_per_team?: number
          duration_multiplier_4_to_6?: number
          duration_multiplier_7_to_12?: number
          duration_multiplier_hasta_3?: number
          id?: number
          updated_at?: string
          updated_by_profile_id?: string | null
          volume_multiplier_1_to_2?: number
          volume_multiplier_3_to_5?: number
          volume_multiplier_6_plus?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_pricing_defaults_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_staff: {
        Row: {
          granted_at: string
          granted_by_profile_id: string | null
          id: string
          profile_id: string
          role: string
        }
        Insert: {
          granted_at?: string
          granted_by_profile_id?: string | null
          id?: string
          profile_id: string
          role?: string
        }
        Update: {
          granted_at?: string
          granted_by_profile_id?: string | null
          id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_staff_granted_by_profile_id_fkey"
            columns: ["granted_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_transfer_lock_releases: {
        Row: {
          id: string
          organization_id: string
          player_id: string
          reason: string
          released_at: string
          released_by_profile_id: string
          season_id: string
        }
        Insert: {
          id?: string
          organization_id: string
          player_id: string
          reason: string
          released_at?: string
          released_by_profile_id: string
          season_id: string
        }
        Update: {
          id?: string
          organization_id?: string
          player_id?: string
          reason?: string
          released_at?: string
          released_by_profile_id?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_transfer_lock_releases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_transfer_lock_releases_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_transfer_lock_releases_released_by_profile_id_fkey"
            columns: ["released_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_transfer_lock_releases_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_verification_reviews: {
        Row: {
          id: string
          organization_id: string
          player_id: string
          reason: string | null
          reviewed_at: string
          reviewed_by_profile_id: string
          status: string
        }
        Insert: {
          id?: string
          organization_id: string
          player_id: string
          reason?: string | null
          reviewed_at?: string
          reviewed_by_profile_id: string
          status: string
        }
        Update: {
          id?: string
          organization_id?: string
          player_id?: string
          reason?: string | null
          reviewed_at?: string
          reviewed_by_profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_verification_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_verification_reviews_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_verification_reviews_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          full_name: string
          id: string
          organization_id: string
          photo_path: string | null
          profile_id: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          organization_id: string
          photo_path?: string | null
          profile_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          organization_id?: string
          photo_path?: string | null
          profile_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      season_field_blocks: {
        Row: {
          created_at: string
          day_of_week: number
          ends_at: string
          field_id: string
          id: string
          organization_id: string
          season_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          ends_at: string
          field_id: string
          id?: string
          organization_id: string
          season_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          ends_at?: string
          field_id?: string
          id?: string
          organization_id?: string
          season_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_field_blocks_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_field_blocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_field_blocks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          season_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          season_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_groups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_knockout_rounds: {
        Row: {
          bracket_size: number
          created_at: string
          id: string
          is_two_legs: boolean
          organization_id: string
          round_label: string
          round_number: number
          season_id: string
          updated_at: string
        }
        Insert: {
          bracket_size: number
          created_at?: string
          id?: string
          is_two_legs?: boolean
          organization_id: string
          round_label: string
          round_number: number
          season_id: string
          updated_at?: string
        }
        Update: {
          bracket_size?: number
          created_at?: string
          id?: string
          is_two_legs?: boolean
          organization_id?: string
          round_label?: string
          round_number?: number
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_knockout_rounds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_knockout_rounds_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_knockout_ties: {
        Row: {
          away_season_team_id: string | null
          bracket_slot: number
          created_at: string
          home_season_team_id: string
          id: string
          knockout_round_id: string
          organization_id: string
          penalty_winner_season_team_id: string | null
          season_id: string
          updated_at: string
        }
        Insert: {
          away_season_team_id?: string | null
          bracket_slot: number
          created_at?: string
          home_season_team_id: string
          id?: string
          knockout_round_id: string
          organization_id: string
          penalty_winner_season_team_id?: string | null
          season_id: string
          updated_at?: string
        }
        Update: {
          away_season_team_id?: string | null
          bracket_slot?: number
          created_at?: string
          home_season_team_id?: string
          id?: string
          knockout_round_id?: string
          organization_id?: string
          penalty_winner_season_team_id?: string | null
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_knockout_ties_away_season_team_id_fkey"
            columns: ["away_season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_knockout_ties_home_season_team_id_fkey"
            columns: ["home_season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_knockout_ties_knockout_round_id_fkey"
            columns: ["knockout_round_id"]
            isOneToOne: false
            referencedRelation: "season_knockout_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_knockout_ties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_knockout_ties_penalty_winner_season_team_id_fkey"
            columns: ["penalty_winner_season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_knockout_ties_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          profile_id: string
          role: string
          season_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          profile_id: string
          role: string
          season_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
          role?: string
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_roles_organization_member_fkey"
            columns: ["organization_id", "profile_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "profile_id"]
          },
          {
            foreignKeyName: "season_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_roles_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_rules: {
        Row: {
          allow_draws: boolean
          created_at: string
          groups_advance_per_group: number | null
          id: string
          match_duration_minutes: number
          max_roster_size: number | null
          minimum_rest_minutes: number
          organization_id: string
          points_draw: number
          points_loss: number
          points_win: number
          recurring_slot_day_of_week: number | null
          recurring_slot_field_id: string | null
          recurring_slot_start_time: string | null
          registration_fee: number | null
          require_player_verification: boolean
          reschedule_request_ttl_hours: number
          season_id: string
          suspension_matches: number
          transfer_lock_days: number
          updated_at: string
          yellow_card_limit: number
        }
        Insert: {
          allow_draws?: boolean
          created_at?: string
          groups_advance_per_group?: number | null
          id?: string
          match_duration_minutes?: number
          max_roster_size?: number | null
          minimum_rest_minutes?: number
          organization_id: string
          points_draw?: number
          points_loss?: number
          points_win?: number
          recurring_slot_day_of_week?: number | null
          recurring_slot_field_id?: string | null
          recurring_slot_start_time?: string | null
          registration_fee?: number | null
          require_player_verification?: boolean
          reschedule_request_ttl_hours?: number
          season_id: string
          suspension_matches?: number
          transfer_lock_days?: number
          updated_at?: string
          yellow_card_limit?: number
        }
        Update: {
          allow_draws?: boolean
          created_at?: string
          groups_advance_per_group?: number | null
          id?: string
          match_duration_minutes?: number
          max_roster_size?: number | null
          minimum_rest_minutes?: number
          organization_id?: string
          points_draw?: number
          points_loss?: number
          points_win?: number
          recurring_slot_day_of_week?: number | null
          recurring_slot_field_id?: string | null
          recurring_slot_start_time?: string | null
          registration_fee?: number | null
          require_player_verification?: boolean
          reschedule_request_ttl_hours?: number
          season_id?: string
          suspension_matches?: number
          transfer_lock_days?: number
          updated_at?: string
          yellow_card_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_rules_recurring_slot_field_id_fkey"
            columns: ["recurring_slot_field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_rules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_team_player_payment_marks: {
        Row: {
          created_at: string
          id: string
          marked_by_profile_id: string
          marked_paid: boolean
          notes: string | null
          organization_id: string
          season_team_player_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_by_profile_id: string
          marked_paid?: boolean
          notes?: string | null
          organization_id: string
          season_team_player_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_by_profile_id?: string
          marked_paid?: boolean
          notes?: string | null
          organization_id?: string
          season_team_player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_team_player_payment_marks_marked_by_profile_id_fkey"
            columns: ["marked_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_player_payment_marks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_player_payment_marks_season_team_player_id_fkey"
            columns: ["season_team_player_id"]
            isOneToOne: true
            referencedRelation: "season_team_players"
            referencedColumns: ["id"]
          },
        ]
      }
      season_team_players: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean
          is_vice_captain: boolean
          jersey_number: number | null
          organization_id: string
          player_id: string
          registration_status: string
          season_id: string
          season_team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean
          is_vice_captain?: boolean
          jersey_number?: number | null
          organization_id: string
          player_id: string
          registration_status?: string
          season_id: string
          season_team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean
          is_vice_captain?: boolean
          jersey_number?: number | null
          organization_id?: string
          player_id?: string
          registration_status?: string
          season_id?: string
          season_team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_team_players_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_players_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_team_players_season_team_id_fkey"
            columns: ["season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      season_teams: {
        Row: {
          created_at: string
          display_name: string | null
          group_name: string | null
          id: string
          organization_id: string
          registration_status: string
          roster_locked_by_captain: boolean
          season_group_id: string | null
          season_id: string
          status: string
          status_effective_at: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          group_name?: string | null
          id?: string
          organization_id: string
          registration_status?: string
          roster_locked_by_captain?: boolean
          season_group_id?: string | null
          season_id: string
          status?: string
          status_effective_at?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          group_name?: string | null
          id?: string
          organization_id?: string
          registration_status?: string
          roster_locked_by_captain?: boolean
          season_group_id?: string | null
          season_id?: string
          status?: string
          status_effective_at?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_teams_season_group_id_fkey"
            columns: ["season_group_id"]
            isOneToOne: false
            referencedRelation: "season_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          competition_id: string
          created_at: string
          ends_on: string | null
          format_type: string
          id: string
          name: string
          organization_id: string
          platform_billing_status: string
          slug: string
          starts_on: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          ends_on?: string | null
          format_type: string
          id?: string
          name: string
          organization_id: string
          platform_billing_status?: string
          slug: string
          starts_on?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          ends_on?: string | null
          format_type?: string
          id?: string
          name?: string
          organization_id?: string
          platform_billing_status?: string
          slug?: string
          starts_on?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_charges: {
        Row: {
          amount: number
          charge_type: string
          created_at: string
          created_by_profile_id: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          season_team_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        Insert: {
          amount: number
          charge_type: string
          created_at?: string
          created_by_profile_id: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          season_team_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Update: {
          amount?: number
          charge_type?: string
          created_at?: string
          created_by_profile_id?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          season_team_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_charges_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_charges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_charges_season_team_id_fkey"
            columns: ["season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_charges_voided_by_profile_id_fkey"
            columns: ["voided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          organization_id: string
          paid_at: string
          payment_method: string
          recorded_by_profile_id: string
          reference: string | null
          season_team_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          organization_id: string
          paid_at?: string
          payment_method: string
          recorded_by_profile_id: string
          reference?: string | null
          season_team_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string
          payment_method?: string
          recorded_by_profile_id?: string
          reference?: string | null
          season_team_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_payments_recorded_by_profile_id_fkey"
            columns: ["recorded_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_payments_season_team_id_fkey"
            columns: ["season_team_id"]
            isOneToOne: false
            referencedRelation: "season_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_payments_voided_by_profile_id_fkey"
            columns: ["voided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      season_team_financial_summary: {
        Row: {
          balance_due: number | null
          currency: string | null
          next_due_date: string | null
          organization_id: string | null
          season_team_id: string | null
          total_active_charges: number | null
          total_active_payments: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      __assert_captain_roster_add_allowed: {
        Args: { p_season_team_id: string }
        Returns: undefined
      }
      __assert_field_slot_not_blocked_by_other_season: {
        Args: {
          p_day_of_week: number
          p_end_time: string
          p_field_id: string
          p_season_id: string
          p_start_time: string
        }
        Returns: undefined
      }
      __assert_match_capture_window: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      __assert_player_activation_allowed: {
        Args: {
          p_bypass: boolean
          p_player_id: string
          p_season_id: string
          p_target_season_team_id: string
        }
        Returns: undefined
      }
      __assert_season_not_archived: {
        Args: { p_season_id: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_captain_invitation: {
        Args: { p_token: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_knockout_round: {
        Args: { p_round_id: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_match: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_match_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_season_team: {
        Args: { p_season_team_id: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_season_team_player: {
        Args: { p_season_team_player_id: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_suspension: {
        Args: { p_suspension_id: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_team_charge: {
        Args: { p_charge_id: string }
        Returns: undefined
      }
      __assert_season_not_archived_for_team_payment: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      __assert_season_platform_billing_active: {
        Args: { p_season_id: string }
        Returns: undefined
      }
      __assert_season_readable: {
        Args: { p_season_id: string }
        Returns: string
      }
      __can_request_player_verification: {
        Args: { p_player_id: string }
        Returns: boolean
      }
      __can_set_player_photo: {
        Args: { p_player_id: string }
        Returns: boolean
      }
      __captain_season_team_for_match: {
        Args: { p_match_id: string; p_profile_id: string }
        Returns: string
      }
      __create_knockout_bracket_from_slots: {
        Args: {
          p_require_no_prior_matches?: boolean
          p_season_id: string
          p_slots: Json
        }
        Returns: Json
      }
      __knockout_create_tie_matches: {
        Args: {
          p_away: string
          p_bracket_slot: number
          p_home: string
          p_is_two_legs: boolean
          p_org: string
          p_round_id: string
          p_round_label: string
          p_season_id: string
        }
        Returns: undefined
      }
      __knockout_next_power_of_two: { Args: { p_n: number }; Returns: number }
      __knockout_resolve_tie_winner: {
        Args: { p_tie_id: string }
        Returns: string
      }
      __knockout_round_label: {
        Args: { p_bracket_size: number; p_round_number: number }
        Returns: string
      }
      __knockout_tie_is_tied: { Args: { p_tie_id: string }; Returns: boolean }
      __match_capture_window_bypass: {
        Args: { p_match_id: string }
        Returns: boolean
      }
      __match_capture_window_open: {
        Args: { p_match_id: string }
        Returns: boolean
      }
      __mig019_fixture_4: {
        Args: { p_st1: string; p_st2: string; p_st3: string; p_st4: string }
        Returns: Json
      }
      __mig028_as: { Args: { p_uid: string }; Returns: undefined }
      __mig029_as: { Args: { p_uid: string }; Returns: undefined }
      __resolve_public_season: {
        Args: { p_organization_id: string; p_season_slug: string }
        Returns: string
      }
      __round_slot_starts_at: {
        Args: {
          p_day_of_week: number
          p_round_number: number
          p_season_id: string
          p_start_time: string
        }
        Returns: string
      }
      __schedule_match_core: {
        Args: {
          p_calendar_status?: string
          p_field_id: string
          p_match_id: string
          p_starts_at: string
        }
        Returns: undefined
      }
      __season_standings_core: {
        Args: { p_group_id?: string; p_season_id: string }
        Returns: {
          drawn: number
          goal_difference: number
          goals_against: number
          goals_for: number
          lost: number
          played: number
          points: number
          position: number
          recent_form: string
          registration_status: string
          season_team_id: string
          team_id: string
          team_name: string
          won: number
        }[]
      }
      accept_captain_invitation: { Args: { p_token: string }; Returns: string }
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      add_player_to_season_team: {
        Args: {
          p_jersey_number?: number
          p_player_id: string
          p_registration_status?: string
          p_season_team_id: string
        }
        Returns: string
      }
      adjust_discipline_suspension_length: {
        Args: {
          p_matches_remaining: number
          p_reason: string
          p_suspension_id: string
        }
        Returns: undefined
      }
      advance_knockout_round: {
        Args: { p_round_number: number; p_season_id: string }
        Returns: Json
      }
      apply_recurring_slot_to_season: {
        Args: {
          p_day_of_week: number
          p_season_id: string
          p_start_time: string
        }
        Returns: Json
      }
      assign_teams_to_groups: {
        Args: { p_assignments: Json; p_season_id: string }
        Returns: {
          created_at: string
          display_name: string | null
          group_name: string | null
          id: string
          organization_id: string
          registration_status: string
          roster_locked_by_captain: boolean
          season_group_id: string | null
          season_id: string
          team_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "season_teams"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      can_capture_match: { Args: { p_match_id: string }; Returns: boolean }
      can_view_player_photo: { Args: { p_player_id: string }; Returns: boolean }
      configure_knockout_round: {
        Args: { p_is_two_legs: boolean; p_round_id: string }
        Returns: undefined
      }
      copy_season_teams: {
        Args: {
          p_copy_roster?: boolean
          p_from_season_id: string
          p_team_ids: string[]
          p_to_season_id: string
        }
        Returns: number
      }
      confirm_match_calendar: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      create_administrative_suspension: {
        Args: {
          p_matches_remaining: number
          p_reason: string
          p_season_team_player_id: string
          p_suspension_type: string
        }
        Returns: string
      }
      create_captain_player_with_invitation: {
        Args: {
          p_email: string
          p_full_name: string
          p_jersey_number?: number
          p_season_team_id: string
        }
        Returns: string
      }
      create_organization_with_owner: {
        Args: { p_brand_color?: string; p_name: string }
        Returns: string
      }
      create_player_and_add_to_roster: {
        Args: {
          p_full_name: string
          p_jersey_number?: number
          p_registration_status?: string
          p_season_team_id: string
        }
        Returns: string
      }
      create_season_knockout_bracket: {
        Args: { p_season_id: string; p_seed_mode?: string }
        Returns: Json
      }
      create_season_round_robin_fixture: {
        Args: {
          p_group_id?: string
          p_matches: Json
          p_mode: string
          p_season_id: string
        }
        Returns: {
          away_score: number | null
          away_season_team_id: string
          bracket_slot: number | null
          calendar_status: string
          created_at: string
          field_reservation_id: string | null
          home_score: number | null
          home_season_team_id: string
          id: string
          knockout_round_id: string | null
          leg_number: number | null
          organization_id: string
          round_label: string | null
          round_number: number | null
          season_group_id: string | null
          season_id: string
          sequence_in_round: number | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_season_with_rules: {
        Args: {
          p_allow_draws: boolean
          p_competition_id: string
          p_ends_on: string
          p_format_type: string
          p_match_duration_minutes: number
          p_minimum_rest_minutes: number
          p_name: string
          p_points_draw: number
          p_points_loss: number
          p_points_win: number
          p_slug: string
          p_starts_on: string
          p_suspension_matches: number
          p_visibility: string
          p_yellow_card_limit: number
        }
        Returns: string
      }
      deactivate_season_team_player: {
        Args: { p_season_team_player_id: string }
        Returns: undefined
      }
      enroll_team_in_season: {
        Args: {
          p_display_name?: string
          p_group_name?: string
          p_registration_status?: string
          p_season_id: string
          p_team_id: string
        }
        Returns: string
      }
      expire_stale_match_reschedule_requests: { Args: never; Returns: number }
      generate_knockout_from_groups: {
        Args: { p_season_id: string }
        Returns: Json
      }
      get_own_platform_staff_role: {
        Args: { p_profile_id: string }
        Returns: {
          role: string
          staff_id: string
        }[]
      }
      get_platform_billing_overview: {
        Args: never
        Returns: {
          enrolled_team_count: number
          has_fixture: boolean
          organization_name: string
          platform_billing_status: string
          season_id: string
          season_name: string
        }[]
      }
      get_platform_finance_summary: {
        Args: { p_month: number; p_year: number }
        Returns: Json
      }
      get_platform_pricing_defaults: {
        Args: never
        Returns: {
          base_price_per_team: number
          duration_multiplier_4_to_6: number
          duration_multiplier_7_to_12: number
          duration_multiplier_hasta_3: number
          updated_at: string
          updated_by_profile_id: string
          volume_multiplier_1_to_2: number
          volume_multiplier_3_to_5: number
          volume_multiplier_6_plus: number
        }[]
      }
      get_platform_sales_overview: {
        Args: never
        Returns: {
          active_season_count: number
          member_count: number
          organization_created_at: string
          organization_id: string
          organization_name: string
          sold_by_display_name: string
          sold_by_staff_id: string
        }[]
      }
      get_public_match_chronicle: {
        Args: {
          p_match_id: string
          p_organization_id: string
          p_season_slug: string
        }
        Returns: {
          content: string
          generated_at: string
          tier: string
        }[]
      }
      get_public_match_detail: {
        Args: {
          p_match_id: string
          p_organization_id: string
          p_season_slug: string
        }
        Returns: {
          away_score: number
          away_team_name: string
          field_name: string
          home_score: number
          home_team_name: string
          leg_number: number
          match_id: string
          round_label: string
          round_number: number
          starts_at: string
          status: string
          venue_name: string
        }[]
      }
      get_public_match_events: {
        Args: {
          p_match_id: string
          p_organization_id: string
          p_season_slug: string
        }
        Returns: {
          event_type: string
          minute: number
          player_name: string
          team_name: string
        }[]
      }
      get_public_season_discipline: {
        Args: { p_organization_id: string; p_season_slug: string }
        Returns: {
          is_suspended: boolean
          matches_remaining: number
          player_name: string
          team_name: string
        }[]
      }
      get_public_season_groups: {
        Args: { p_organization_id: string; p_season_slug: string }
        Returns: {
          group_id: string
          group_name: string
        }[]
      }
      get_public_season_matches: {
        Args: { p_organization_id: string; p_season_slug: string }
        Returns: {
          away_score: number
          away_team_name: string
          bracket_slot: number
          calendar_status: string
          field_name: string
          home_score: number
          home_team_name: string
          knockout_round_number: number
          leg_number: number
          match_id: string
          round_label: string
          round_number: number
          sequence_in_round: number
          starts_at: string
          status: string
          venue_name: string
        }[]
      }
      get_public_season_overview: {
        Args: { p_organization_id: string; p_season_slug: string }
        Returns: {
          competition_name: string
          ends_on: string
          format_type: string
          organization_brand_color: string
          organization_logo_path: string
          organization_name: string
          season_name: string
          season_slug: string
          starts_on: string
          visibility: string
        }[]
      }
      get_public_season_scorers: {
        Args: { p_organization_id: string; p_season_slug: string }
        Returns: {
          goals: number
          player_name: string
          position: number
          team_name: string
        }[]
      }
      get_public_season_standings: {
        Args: {
          p_group_name?: string
          p_organization_id: string
          p_season_slug: string
        }
        Returns: {
          drawn: number
          goal_difference: number
          goals_against: number
          goals_for: number
          lost: number
          played: number
          points: number
          position: number
          recent_form: string
          registration_status: string
          team_name: string
          won: number
        }[]
      }
      get_season_discipline_summary: {
        Args: { p_season_id: string }
        Returns: {
          active_suspensions: number
          matches_remaining: number
          player_id: string
          player_name: string
          red_cards: number
          season_team_id: string
          suspension_status: string
          team_name: string
          yellow_cards: number
        }[]
      }
      get_season_knockout_champion: {
        Args: { p_season_id: string }
        Returns: string
      }
      get_season_standings: {
        Args: { p_group_id?: string; p_season_id: string }
        Returns: {
          drawn: number
          goal_difference: number
          goals_against: number
          goals_for: number
          lost: number
          played: number
          points: number
          position: number
          recent_form: string
          registration_status: string
          season_team_id: string
          team_id: string
          team_name: string
          won: number
        }[]
      }
      get_season_top_scorers: {
        Args: { p_season_id: string }
        Returns: {
          goals: number
          player_id: string
          player_name: string
          position: number
          season_team_id: string
          team_name: string
        }[]
      }
      has_role_in_org: {
        Args: { p_org_id: string; p_roles: string[] }
        Returns: boolean
      }
      has_role_in_org_scoped: {
        Args: {
          p_org_id: string
          p_roles: string[]
          p_scope_id: string
          p_scope_type: string
        }
        Returns: boolean
      }
      has_season_role: {
        Args: { p_roles: string[]; p_season_id: string }
        Returns: boolean
      }
      invite_captain_to_roster: {
        Args: { p_email: string; p_season_team_player_id: string }
        Returns: string
      }
      invite_organization_member: {
        Args: {
          p_email: string
          p_organization_id: string
          p_role: string
        }
        Returns: string
      }
      is_active_captain_of_match: {
        Args: { p_match_id: string; p_profile_id?: string }
        Returns: boolean
      }
      is_active_captain_of_season_team: {
        Args: { p_profile_id?: string; p_season_team_id: string }
        Returns: boolean
      }
      is_active_captain_or_vice_of_season_team: {
        Args: { p_profile_id?: string; p_season_team_id: string }
        Returns: boolean
      }
      is_member_of: { Args: { p_org_id: string }; Returns: boolean }
      is_platform_staff: { Args: { p_profile_id: string }; Returns: boolean }
      is_team_leader_for_roster_player: {
        Args: { p_profile_id?: string; p_season_team_player_id: string }
        Returns: boolean
      }
      is_valid_organization_logo_path: {
        Args: { p_logo_path: string; p_organization_id: string }
        Returns: boolean
      }
      is_valid_player_photo_path: {
        Args: {
          p_organization_id: string
          p_photo_path: string
          p_player_id: string
        }
        Returns: boolean
      }
      is_valid_uuid_text: { Args: { p_value: string }; Returns: boolean }
      normalize_brand_color: { Args: { p_color: string }; Returns: string }
      propose_match_reschedule: {
        Args: {
          p_match_id: string
          p_proposed_field_id?: string
          p_proposed_starts_at: string
        }
        Returns: string
      }
      record_match_event: {
        Args: {
          p_event_type: string
          p_match_id: string
          p_minute: number
          p_notes?: string
          p_season_team_player_id: string
        }
        Returns: string
      }
      record_platform_expense: {
        Args: { p_amount: number; p_category: string; p_notes?: string }
        Returns: string
      }
      record_platform_income: {
        Args: { p_amount: number; p_notes?: string; p_season_id: string }
        Returns: string
      }
      release_player_transfer_lock: {
        Args: { p_player_id: string; p_reason: string; p_season_id: string }
        Returns: {
          id: string
          organization_id: string
          player_id: string
          reason: string
          released_at: string
          released_by_profile_id: string
          season_id: string
        }
        SetofOptions: {
          from: "*"
          to: "player_transfer_lock_releases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_field_availability: {
        Args: { p_field_id: string; p_intervals: Json }
        Returns: {
          created_at: string
          day_of_week: number
          ends_at: string
          field_id: string
          id: string
          organization_id: string
          starts_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "field_availability_rules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      request_player_verification: {
        Args: { p_player_id: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
          organization_id: string
          photo_path: string | null
          profile_id: string | null
          updated_at: string
          verification_status: string
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_match_reschedule: {
        Args: { p_action: string; p_notes?: string; p_request_id: string }
        Returns: undefined
      }
      respond_match_reschedule: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: undefined
      }
      review_player_verification: {
        Args: { p_approved: boolean; p_player_id: string; p_reason?: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
          organization_id: string
          photo_path: string | null
          profile_id: string | null
          updated_at: string
          verification_status: string
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_match: {
        Args: { p_field_id: string; p_match_id: string; p_starts_at: string }
        Returns: undefined
      }
      set_knockout_tie_penalty_winner: {
        Args: {
          p_bracket_slot: number
          p_round_id: string
          p_winner_season_team_id: string
        }
        Returns: undefined
      }
      set_match_context: {
        Args: {
          p_attendance?: number | null
          p_highlight_note?: string | null
          p_match_id: string
          p_referee_name?: string | null
          p_weather?: string | null
        }
        Returns: string
      }
      set_match_player_stats: {
        Args: {
          p_distance_km?: number | null
          p_is_man_of_match?: boolean
          p_match_id: string
          p_minutes_played?: number | null
          p_passes_attempted?: number | null
          p_passes_completed?: number | null
          p_rating?: number | null
          p_season_team_player_id: string
          p_shots?: number | null
          p_shots_on_target?: number | null
        }
        Returns: string
      }
      set_match_team_stats: {
        Args: {
          p_corners?: number | null
          p_fouls?: number | null
          p_match_id: string
          p_offsides?: number | null
          p_possession_pct?: number | null
          p_season_team_id: string
          p_shots?: number | null
          p_shots_on_target?: number | null
        }
        Returns: string
      }
      set_organization_logo: {
        Args: { p_logo_path: string; p_organization_id: string }
        Returns: undefined
      }
      set_platform_billing_status: {
        Args: { p_reason?: string; p_season_id: string; p_status: string }
        Returns: undefined
      }
      set_platform_pricing_defaults: {
        Args: {
          p_base_price_per_team: number
          p_duration_multiplier_4_to_6: number
          p_duration_multiplier_7_to_12: number
          p_duration_multiplier_hasta_3: number
          p_volume_multiplier_1_to_2: number
          p_volume_multiplier_3_to_5: number
          p_volume_multiplier_6_plus: number
        }
        Returns: undefined
      }
      set_player_payment_mark: {
        Args: {
          p_marked_paid: boolean
          p_notes?: string
          p_season_team_player_id: string
        }
        Returns: string
      }
      set_player_photo: {
        Args: { p_photo_path: string; p_player_id: string }
        Returns: undefined
      }
      update_captain_roster_jersey: {
        Args: { p_jersey_number?: number | null; p_season_team_player_id: string }
        Returns: undefined
      }
      set_roster_lock: {
        Args: { p_locked: boolean; p_season_team_id: string }
        Returns: undefined
      }
      set_season_field_blocks: {
        Args: { p_blocks: Json; p_season_id: string }
        Returns: {
          created_at: string
          day_of_week: number
          ends_at: string
          field_id: string
          id: string
          organization_id: string
          season_id: string
          starts_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "season_field_blocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_season_groups: {
        Args: { p_group_names: Json; p_season_id: string }
        Returns: {
          created_at: string
          id: string
          name: string
          organization_id: string
          season_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "season_groups"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_season_team_captain: {
        Args: { p_player_id: string; p_season_team_id: string }
        Returns: {
          created_at: string
          id: string
          is_captain: boolean
          is_vice_captain: boolean
          jersey_number: number | null
          organization_id: string
          player_id: string
          registration_status: string
          season_id: string
          season_team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "season_team_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_season_team_player_status: {
        Args: { p_registration_status: string; p_season_team_player_id: string }
        Returns: undefined
      }
      set_season_team_vice_captain: {
        Args: { p_player_id: string; p_season_team_id: string }
        Returns: {
          created_at: string
          id: string
          is_captain: boolean
          is_vice_captain: boolean
          jersey_number: number | null
          organization_id: string
          player_id: string
          registration_status: string
          season_id: string
          season_team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "season_team_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      slugify_organization_name: { Args: { p_name: string }; Returns: string }
      unschedule_match: { Args: { p_match_id: string }; Returns: undefined }
      update_match_result: {
        Args: {
          p_away_score: number
          p_home_score: number
          p_match_id: string
          p_status: string
        }
        Returns: {
          away_score: number | null
          away_season_team_id: string
          bracket_slot: number | null
          calendar_status: string
          created_at: string
          field_reservation_id: string | null
          home_score: number | null
          home_season_team_id: string
          id: string
          knockout_round_id: string | null
          leg_number: number | null
          organization_id: string
          round_label: string | null
          round_number: number | null
          season_group_id: string | null
          season_id: string
          sequence_in_round: number | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_organization_branding: {
        Args: {
          p_brand_color?: string
          p_name: string
          p_organization_id: string
        }
        Returns: undefined
      }
      update_season_with_rules: {
        Args: {
          p_allow_draws: boolean
          p_ends_on: string
          p_format_type: string
          p_match_duration_minutes: number
          p_minimum_rest_minutes: number
          p_name: string
          p_points_draw: number
          p_points_loss: number
          p_points_win: number
          p_season_id: string
          p_starts_on: string
          p_suspension_matches: number
          p_visibility: string
          p_yellow_card_limit: number
        }
        Returns: undefined
      }
      void_match_event: {
        Args: { p_event_id: string; p_reason: string }
        Returns: {
          assist_season_team_player_id: string | null
          created_at: string
          event_type: string
          id: string
          match_id: string
          minute: number
          notes: string | null
          organization_id: string
          season_team_player_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "match_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_platform_expense_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: undefined
      }
      void_platform_income_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: undefined
      }
      void_team_charge: {
        Args: { p_charge_id: string; p_reason: string }
        Returns: {
          amount: number
          charge_type: string
          created_at: string
          created_by_profile_id: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          season_team_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "team_charges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_team_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          organization_id: string
          paid_at: string
          payment_method: string
          recorded_by_profile_id: string
          reference: string | null
          season_team_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "team_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      waive_discipline_suspension: {
        Args: { p_reason: string; p_suspension_id: string }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
