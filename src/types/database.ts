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
      __mig001_test_results: {
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
      __mig006b_test_results: {
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
      __mig007_test_results: {
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
      __mig008_test_results: {
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
      __mig009_test_results: {
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
      __mig010_test_results: {
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
      __mig011_test_results: {
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
      __mig012_test_results: {
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
      match_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          match_id: string
          minute: number
          notes: string | null
          organization_id: string
          season_team_player_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          match_id: string
          minute: number
          notes?: string | null
          organization_id: string
          season_team_player_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          match_id?: string
          minute?: number
          notes?: string | null
          organization_id?: string
          season_team_player_id?: string
          updated_at?: string
        }
        Relationships: [
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
      matches: {
        Row: {
          away_score: number | null
          away_season_team_id: string
          created_at: string
          field_reservation_id: string | null
          home_score: number | null
          home_season_team_id: string
          id: string
          organization_id: string
          round_label: string | null
          season_id: string
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_season_team_id: string
          created_at?: string
          field_reservation_id?: string | null
          home_score?: number | null
          home_season_team_id: string
          id?: string
          organization_id: string
          round_label?: string | null
          season_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_season_team_id?: string
          created_at?: string
          field_reservation_id?: string | null
          home_score?: number | null
          home_season_team_id?: string
          id?: string
          organization_id?: string
          round_label?: string | null
          season_id?: string
          status?: string
          updated_at?: string
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
            foreignKeyName: "matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      organizations: {
        Row: {
          brand_color: string | null
          created_at: string
          created_by: string
          id: string
          logo_path: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          created_by: string
          id?: string
          logo_path?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          logo_path?: string | null
          name?: string
          slug?: string
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
        ]
      }
      players: {
        Row: {
          created_at: string
          full_name: string
          id: string
          organization_id: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          organization_id: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          organization_id?: string
          profile_id?: string | null
          updated_at?: string
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
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
          id: string
          match_duration_minutes: number
          minimum_rest_minutes: number
          organization_id: string
          points_draw: number
          points_loss: number
          points_win: number
          season_id: string
          suspension_matches: number
          updated_at: string
          yellow_card_limit: number
        }
        Insert: {
          allow_draws?: boolean
          created_at?: string
          id?: string
          match_duration_minutes?: number
          minimum_rest_minutes?: number
          organization_id: string
          points_draw?: number
          points_loss?: number
          points_win?: number
          season_id: string
          suspension_matches?: number
          updated_at?: string
          yellow_card_limit?: number
        }
        Update: {
          allow_draws?: boolean
          created_at?: string
          id?: string
          match_duration_minutes?: number
          minimum_rest_minutes?: number
          organization_id?: string
          points_draw?: number
          points_loss?: number
          points_win?: number
          season_id?: string
          suspension_matches?: number
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
            foreignKeyName: "season_rules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: true
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_team_players: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean
          jersey_number: number | null
          organization_id: string
          player_id: string
          registration_status: string
          season_team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean
          jersey_number?: number | null
          organization_id: string
          player_id: string
          registration_status?: string
          season_team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean
          jersey_number?: number | null
          organization_id?: string
          player_id?: string
          registration_status?: string
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
          season_id: string
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
          season_id: string
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
          season_id?: string
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
      can_capture_match: { Args: { p_match_id: string }; Returns: boolean }
      create_organization_with_owner: {
        Args: { p_brand_color?: string; p_name: string }
        Returns: string
      }
      has_role_in_org: {
        Args: { p_org_id: string; p_roles: string[] }
        Returns: boolean
      }
      has_season_role: {
        Args: { p_roles: string[]; p_season_id: string }
        Returns: boolean
      }
      is_member_of: { Args: { p_org_id: string }; Returns: boolean }
      is_valid_organization_logo_path: {
        Args: { p_logo_path: string; p_organization_id: string }
        Returns: boolean
      }
      is_valid_uuid_text: { Args: { p_value: string }; Returns: boolean }
      normalize_brand_color: { Args: { p_color: string }; Returns: string }
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
      set_organization_logo: {
        Args: { p_logo_path: string; p_organization_id: string }
        Returns: undefined
      }
      set_season_team_captain: {
        Args: { p_player_id: string; p_season_team_id: string }
        Returns: {
          created_at: string
          id: string
          is_captain: boolean
          jersey_number: number | null
          organization_id: string
          player_id: string
          registration_status: string
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
          created_at: string
          field_reservation_id: string | null
          home_score: number | null
          home_season_team_id: string
          id: string
          organization_id: string
          round_label: string | null
          season_id: string
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
