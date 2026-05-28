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
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          lock_token: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          lock_token?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          lock_token?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_references: {
        Row: {
          bucket: string
          created_at: string
          deleted_at: string | null
          id: string
          last_referenced_at: string
          orphaned_at: string | null
          public_url: string
          reference_count: number
          reference_key: string | null
          reference_kind: string
          storage_path: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_referenced_at?: string
          orphaned_at?: string | null
          public_url: string
          reference_count?: number
          reference_key?: string | null
          reference_kind?: string
          storage_path: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_referenced_at?: string
          orphaned_at?: string | null
          public_url?: string
          reference_count?: number
          reference_key?: string | null
          reference_kind?: string
          storage_path?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_hashtags: string[] | null
          created_at: string
          default_audiences: string[] | null
          default_goals: string[] | null
          default_style: string | null
          default_timezone: string | null
          default_voice: string | null
          display_name: string | null
          id: string
          required_hashtags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          banned_hashtags?: string[] | null
          created_at?: string
          default_audiences?: string[] | null
          default_goals?: string[] | null
          default_style?: string | null
          default_timezone?: string | null
          default_voice?: string | null
          display_name?: string | null
          id?: string
          required_hashtags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          banned_hashtags?: string[] | null
          created_at?: string
          default_audiences?: string[] | null
          default_goals?: string[] | null
          default_style?: string | null
          default_timezone?: string | null
          default_voice?: string | null
          display_name?: string | null
          id?: string
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
      telemetry_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          props?: Json
          user_id?: string | null
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
      regenerate_feedback: {
        Row: {
          calendar_id: string | null
          category: string | null
          created_at: string
          day: number
          dow: string
          feedback: string
          id: string
          platform: string | null
          rating: number | null
          tweak: string | null
          user_id: string | null
        }
        Insert: {
          calendar_id?: string | null
          category?: string | null
          created_at?: string
          day: number
          dow: string
          feedback: string
          id?: string
          platform?: string | null
          rating?: number | null
          tweak?: string | null
          user_id?: string | null
        }
        Update: {
          calendar_id?: string | null
          category?: string | null
          created_at?: string
          day?: number
          dow?: string
          feedback?: string
          id?: string
          platform?: string | null
          rating?: number | null
          tweak?: string | null
          user_id?: string | null
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      claim_next_job: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["job_queue"]["Row"][]
      }
      cleanup_orphan_media_references: {
        Args: {
          max_age?: unknown
        }
        Returns: Database["public"]["Tables"]["media_references"]["Row"][]
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
