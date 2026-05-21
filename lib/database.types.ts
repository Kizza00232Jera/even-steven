export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          google_avatar_url: string | null
          preferred_currency: "USD" | "EUR" | "DKK" | "SEK"
          onboarding_done: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          google_avatar_url?: string | null
          preferred_currency?: "USD" | "EUR" | "DKK" | "SEK"
          onboarding_done?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          google_avatar_url?: string | null
          preferred_currency?: "USD" | "EUR" | "DKK" | "SEK"
          onboarding_done?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      groups: {
        Row: {
          id: string
          name: string
          type: "Trip" | "Home" | "Couple" | "Utilities" | "Family" | "Other"
          base_currency: "USD" | "EUR" | "DKK" | "SEK"
          admin_id: string
          status: "active" | "expired" | "archived"
          start_date: string | null
          end_date: string | null
          settlement_visibility: "public" | "private"
          background_image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: "Trip" | "Home" | "Couple" | "Utilities" | "Family" | "Other"
          base_currency: "USD" | "EUR" | "DKK" | "SEK"
          admin_id: string
          status?: "active" | "expired" | "archived"
          start_date?: string | null
          end_date?: string | null
          settlement_visibility?: "public" | "private"
          background_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: "Trip" | "Home" | "Couple" | "Utilities" | "Family" | "Other"
          base_currency?: "USD" | "EUR" | "DKK" | "SEK"
          admin_id?: string
          status?: "active" | "expired" | "archived"
          start_date?: string | null
          end_date?: string | null
          settlement_visibility?: "public" | "private"
          background_image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          email: string
          display_name: string | null
          role: "admin" | "member"
          status: "active" | "invited" | "removed"
          is_pinned: boolean
          is_muted: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          email: string
          display_name?: string | null
          role?: "admin" | "member"
          status?: "active" | "invited" | "removed"
          is_pinned?: boolean
          is_muted?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          email?: string
          display_name?: string | null
          role?: "admin" | "member"
          status?: "active" | "invited" | "removed"
          is_pinned?: boolean
          is_muted?: boolean
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          group_id: string
          title: string
          description: string | null
          amount: number
          currency: "USD" | "EUR" | "DKK" | "SEK"
          category: string
          payer_id: string
          split_method: "equal" | "unequal" | "percentage"
          expense_date: string
          receipt_url: string | null
          is_edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          title: string
          description?: string | null
          amount: number
          currency: "USD" | "EUR" | "DKK" | "SEK"
          category?: string
          payer_id: string
          split_method: "equal" | "unequal" | "percentage"
          expense_date: string
          receipt_url?: string | null
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          title?: string
          description?: string | null
          amount?: number
          currency?: "USD" | "EUR" | "DKK" | "SEK"
          category?: string
          payer_id?: string
          split_method?: "equal" | "unequal" | "percentage"
          expense_date?: string
          receipt_url?: string | null
          is_edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          }
        ]
      }
      expense_participants: {
        Row: {
          id: string
          expense_id: string
          member_id: string
          share_amount: number
          share_percentage: number | null
        }
        Insert: {
          id?: string
          expense_id: string
          member_id: string
          share_amount: number
          share_percentage?: number | null
        }
        Update: {
          id?: string
          expense_id?: string
          member_id?: string
          share_amount?: number
          share_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_participants_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          }
        ]
      }
      settlements: {
        Row: {
          id: string
          group_id: string
          payer_member_id: string
          payee_member_id: string
          amount: number
          currency: "USD" | "EUR" | "DKK" | "SEK"
          recorded_by: string
          is_voided: boolean
          voided_by: string | null
          voided_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          payer_member_id: string
          payee_member_id: string
          amount: number
          currency: "USD" | "EUR" | "DKK" | "SEK"
          recorded_by: string
          is_voided?: boolean
          voided_by?: string | null
          voided_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          payer_member_id?: string
          payee_member_id?: string
          amount?: number
          currency?: "USD" | "EUR" | "DKK" | "SEK"
          recorded_by?: string
          is_voided?: boolean
          voided_by?: string | null
          voided_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_payer_member_id_fkey"
            columns: ["payer_member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_payee_member_id_fkey"
            columns: ["payee_member_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          }
        ]
      }
      invite_tokens: {
        Row: {
          id: string
          group_id: string
          token: string
          created_by: string
          invalidated_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          token?: string
          created_by: string
          invalidated_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          token?: string
          created_by?: string
          invalidated_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          }
        ]
      }
      friendships: {
        Row: {
          id: string
          user_id: string
          friend_id: string | null
          friend_email: string
          status: "active" | "pending"
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          friend_id?: string | null
          friend_email: string
          status?: "active" | "pending"
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          friend_id?: string | null
          friend_email?: string
          status?: "active" | "pending"
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      activity_events: {
        Row: {
          id: string
          group_id: string | null
          actor_id: string | null
          event_type:
            | "expense_added"
            | "expense_edited"
            | "expense_deleted"
            | "settlement_recorded"
            | "settlement_voided"
            | "member_joined"
            | "member_removed"
            | "member_left"
            | "group_created"
            | "group_archived"
            | "group_unarchived"
            | "invite_link_reset"
            | "trip_expired"
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          group_id?: string | null
          actor_id?: string | null
          event_type:
            | "expense_added"
            | "expense_edited"
            | "expense_deleted"
            | "settlement_recorded"
            | "settlement_voided"
            | "member_joined"
            | "member_removed"
            | "member_left"
            | "group_created"
            | "group_archived"
            | "group_unarchived"
            | "invite_link_reset"
            | "trip_expired"
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string | null
          actor_id?: string | null
          event_type?:
            | "expense_added"
            | "expense_edited"
            | "expense_deleted"
            | "settlement_recorded"
            | "settlement_voided"
            | "member_joined"
            | "member_removed"
            | "member_left"
            | "group_created"
            | "group_archived"
            | "group_unarchived"
            | "invite_link_reset"
            | "trip_expired"
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          trip_expired: boolean
          someone_joins_group: boolean
          someone_added: boolean
          member_removed: boolean
          trip_end_approaching: boolean
          trip_ends_today: boolean
          new_expense: boolean
          expense_edited: boolean
          expense_deleted: boolean
          payment_received: boolean
          payment_in_group: boolean
          balance_reaches_zero: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          trip_expired?: boolean
          someone_joins_group?: boolean
          someone_added?: boolean
          member_removed?: boolean
          trip_end_approaching?: boolean
          trip_ends_today?: boolean
          new_expense?: boolean
          expense_edited?: boolean
          expense_deleted?: boolean
          payment_received?: boolean
          payment_in_group?: boolean
          balance_reaches_zero?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          trip_expired?: boolean
          someone_joins_group?: boolean
          someone_added?: boolean
          member_removed?: boolean
          trip_end_approaching?: boolean
          trip_ends_today?: boolean
          new_expense?: boolean
          expense_edited?: boolean
          expense_deleted?: boolean
          payment_received?: boolean
          payment_in_group?: boolean
          balance_reaches_zero?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          platform: "ios" | "android" | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          platform?: "ios" | "android" | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          platform?: "ios" | "android" | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_group_member: {
        Args: { p_group_id: string }
        Returns: boolean
      }
      is_expense_participant: {
        Args: { p_expense_id: string }
        Returns: boolean
      }
      current_member_id: {
        Args: { p_group_id: string }
        Returns: string | null
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never
