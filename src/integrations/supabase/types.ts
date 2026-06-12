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
      one_time_passcodes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          intended_role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          intended_role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          intended_role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      pathway_credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          task_id: string | null
          type: string
          user_id: string
          verified_by: string | null
        }
        Insert: {
          amount: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          task_id?: string | null
          type: string
          user_id: string
          verified_by?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          task_id?: string | null
          type?: string
          user_id?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pathway_credit_transactions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathway_credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          case_manager_id: string | null
          city: string | null
          created_at: string
          credits: number
          email: string | null
          full_name: string | null
          housing_goals: string | null
          id: string
          is_admin: boolean
          phone: string | null
          skills: string[] | null
          updated_at: string
        }
        Insert: {
          case_manager_id?: string | null
          city?: string | null
          created_at?: string
          credits?: number
          email?: string | null
          full_name?: string | null
          housing_goals?: string | null
          id: string
          is_admin?: boolean
          phone?: string | null
          skills?: string[] | null
          updated_at?: string
        }
        Update: {
          case_manager_id?: string | null
          city?: string | null
          created_at?: string
          credits?: number
          email?: string | null
          full_name?: string | null
          housing_goals?: string | null
          id?: string
          is_admin?: boolean
          phone?: string | null
          skills?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          cost: number
          created_at: string
          id: string
          pathway_credits_used: number | null
          reward_key: string
          reward_name: string | null
          reward_title: string
          status: string
          user_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          pathway_credits_used?: number | null
          reward_key: string
          reward_name?: string | null
          reward_title: string
          status?: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          pathway_credits_used?: number | null
          reward_key?: string
          reward_name?: string | null
          reward_title?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      task_claims: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          claimed_at: string
          id: string
          status: Database["public"]["Enums"]["claim_status"]
          task_id: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          claimed_at?: string
          id?: string
          status?: Database["public"]["Enums"]["claim_status"]
          task_id: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          claimed_at?: string
          id?: string
          status?: Database["public"]["Enums"]["claim_status"]
          task_id?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_claims_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          active: boolean
          created_at: string
          credits: number
          description: string
          duration: string
          est_hours: number | null
          id: string
          location: string
          org: string
          partner: string
          pathway_credits: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits?: number
          description: string
          duration?: string
          est_hours?: number | null
          id?: string
          location?: string
          org?: string
          partner?: string
          pathway_credits?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credits?: number
          description?: string
          duration?: string
          est_hours?: number | null
          id?: string
          location?: string
          org?: string
          partner?: string
          pathway_credits?: number | null
          status?: string
          title?: string
          updated_at?: string
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
      user_tasks: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          claimed_at: string
          completed_at: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["user_task_status"]
          task_id: string
          user_id: string
          verification_method: string | null
          verified: boolean
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          claimed_at?: string
          completed_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["user_task_status"]
          task_id: string
          user_id: string
          verification_method?: string | null
          verified?: boolean
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          claimed_at?: string
          completed_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["user_task_status"]
          task_id?: string
          user_id?: string
          verification_method?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_credits_for_verified_task: {
        Args: { p_user_task_id: string }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          task_id: string | null
          type: string
          user_id: string
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pathway_credit_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_case_manager_of: {
        Args: { _manager_id: string; _participant_id: string }
        Returns: boolean
      }
      redeem_passcode: { Args: { _code: string }; Returns: Json }
      redeem_reward: {
        Args: { p_cost: number; p_title: string }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          task_id: string | null
          type: string
          user_id: string
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pathway_credit_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_user_task: {
        Args: { p_notes: string; p_user_task_id: string }
        Returns: {
          assigned_at: string | null
          assigned_by: string | null
          claimed_at: string
          completed_at: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["user_task_status"]
          task_id: string
          user_id: string
          verification_method: string | null
          verified: boolean
        }
        SetofOptions: {
          from: "*"
          to: "user_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_task_for_verification: {
        Args: { p_task_id: string }
        Returns: {
          assigned_at: string | null
          assigned_by: string | null
          claimed_at: string
          completed_at: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["user_task_status"]
          task_id: string
          user_id: string
          verification_method: string | null
          verified: boolean
        }
        SetofOptions: {
          from: "*"
          to: "user_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "partner" | "participant" | "pending"
      claim_status: "claimed" | "verified"
      user_task_status:
        | "claimed"
        | "pending_verification"
        | "verified"
        | "rejected"
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
      app_role: ["admin", "partner", "participant", "pending"],
      claim_status: ["claimed", "verified"],
      user_task_status: [
        "claimed",
        "pending_verification",
        "verified",
        "rejected",
      ],
    },
  },
} as const
