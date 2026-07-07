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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      api_key_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          provider: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          provider?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          provider?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          period_end: string | null
          razorpay_order_id: string
          razorpay_payment_id: string | null
          status: string
          tier_granted: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          period_end?: string | null
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          status?: string
          tier_granted?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          period_end?: string | null
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          status?: string
          tier_granted?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_hashtags: string[] | null
          brand_examples: string[] | null
          created_at: string
          cta_preferences: string[] | null
          default_audiences: string[] | null
          default_framework: string | null
          default_goals: string[] | null
          default_style: string | null
          default_timezone: string | null
          default_voice: string | null
          display_name: string | null
          forbidden_phrases: string[] | null
          id: string
          preferred_structures: string[] | null
          proof_points: string[] | null
          required_hashtags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          banned_hashtags?: string[] | null
          brand_examples?: string[] | null
          created_at?: string
          cta_preferences?: string[] | null
          default_audiences?: string[] | null
          default_framework?: string | null
          default_goals?: string[] | null
          default_style?: string | null
          default_timezone?: string | null
          default_voice?: string | null
          display_name?: string | null
          forbidden_phrases?: string[] | null
          id?: string
          preferred_structures?: string[] | null
          proof_points?: string[] | null
          required_hashtags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          banned_hashtags?: string[] | null
          brand_examples?: string[] | null
          created_at?: string
          cta_preferences?: string[] | null
          default_audiences?: string[] | null
          default_framework?: string | null
          default_goals?: string[] | null
          default_style?: string | null
          default_timezone?: string | null
          default_voice?: string | null
          display_name?: string | null
          forbidden_phrases?: string[] | null
          id?: string
          preferred_structures?: string[] | null
          proof_points?: string[] | null
          required_hashtags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_calendars: {
        Row: {
          core_idea: string | null
          created_at: string
          form_payload: Json
          id: string
          industry: string | null
          industry_label: string | null
          is_favorite: boolean
          locked_hashtags: Json
          platform: string | null
          post_times: Json | null
          posts: Json
          timezone: string | null
          title: string
          tracking_url: string | null
          updated_at: string
          user_id: string
          week_start_date: string | null
        }
        Insert: {
          core_idea?: string | null
          created_at?: string
          form_payload: Json
          id?: string
          industry?: string | null
          industry_label?: string | null
          is_favorite?: boolean
          locked_hashtags?: Json
          platform?: string | null
          post_times?: Json | null
          posts: Json
          timezone?: string | null
          title: string
          tracking_url?: string | null
          updated_at?: string
          user_id: string
          week_start_date?: string | null
        }
        Update: {
          core_idea?: string | null
          created_at?: string
          form_payload?: Json
          id?: string
          industry?: string | null
          industry_label?: string | null
          is_favorite?: boolean
          locked_hashtags?: Json
          platform?: string | null
          post_times?: Json | null
          posts?: Json
          timezone?: string | null
          title?: string
          tracking_url?: string | null
          updated_at?: string
          user_id?: string
          week_start_date?: string | null
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          calendar_id: string
          copy_text: string | null
          created_at: string
          failure_reason: string | null
          id: string
          platform: string | null
          post_day: number
          post_snapshot: Json
          published_at: string | null
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
          workflow_status: Database["public"]["Enums"]["scheduled_post_status"]
        }
        Insert: {
          calendar_id: string
          copy_text?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          platform?: string | null
          post_day: number
          post_snapshot: Json
          published_at?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
          workflow_status?: Database["public"]["Enums"]["scheduled_post_status"]
        }
        Update: {
          calendar_id?: string
          copy_text?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          platform?: string | null
          post_day?: number
          post_snapshot?: Json
          published_at?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          workflow_status?: Database["public"]["Enums"]["scheduled_post_status"]
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "saved_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          api_key_enc: string | null
          api_provider: string
          created_at: string
          generation_count: number
          id: string
          key_mode: string
          plan_period_end: string | null
          quota_limit: number
          tier: string
          updated_at: string
          use_own_key: boolean
          user_id: string
        }
        Insert: {
          api_key_enc?: string | null
          api_provider?: string
          created_at?: string
          generation_count?: number
          id?: string
          key_mode?: string
          plan_period_end?: string | null
          quota_limit?: number
          tier?: string
          updated_at?: string
          use_own_key?: boolean
          user_id: string
        }
        Update: {
          api_key_enc?: string | null
          api_provider?: string
          created_at?: string
          generation_count?: number
          id?: string
          key_mode?: string
          plan_period_end?: string | null
          quota_limit?: number
          tier?: string
          updated_at?: string
          use_own_key?: boolean
          user_id?: string
        }
        Relationships: []
      }
      wizard_drafts: {
        Row: {
          created_at: string
          id: string
          snapshot: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snapshot: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snapshot?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          id: string | null
          is_comp: boolean | null
          period_end: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string | null
          tier_granted: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string | null
          is_comp?: never
          period_end?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string | null
          tier_granted?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string | null
          is_comp?: never
          period_end?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string | null
          tier_granted?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_grant_tier: {
        Args: {
          p_days?: number
          p_quota_limit: number
          p_target_user: string
          p_tier: string
        }
        Returns: {
          period_end: string
          tier: string
        }[]
      }
      get_decrypted_api_key: {
        Args: never
        Returns: {
          api_provider: string
          decrypted_key: string
        }[]
      }
      grant_tier_from_payment: {
        Args: {
          p_amount: number
          p_currency?: string
          p_order_id: string
          p_payment_id: string
          p_period_end: string
          p_quota_limit: number
          p_tier: string
          p_user_id: string
        }
        Returns: {
          period_end: string
          tier: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_generation_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      upsert_encrypted_api_key: {
        Args: { p_api_key: string; p_api_provider: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      scheduled_post_status: "drafted" | "approved" | "published" | "failed"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
      scheduled_post_status: ["drafted", "approved", "published", "failed"],
    },
  },
} as const
