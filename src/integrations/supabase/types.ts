export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      store_networks: {
        Row: {
          created_at: string
          id: string
          is_approved: boolean
          logo_url: string | null
          max_units: number
          monthly_fee: number
          name: string
          owner_id: string
          plan_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_approved?: boolean
          logo_url?: string | null
          max_units?: number
          monthly_fee?: number
          name: string
          owner_id: string
          plan_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_approved?: boolean
          logo_url?: string | null
          max_units?: number
          monthly_fee?: number
          name?: string
          owner_id?: string
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cep: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          document: string | null
          email: string | null
          full_name: string
          has_seen_onboarding: boolean
          id: string
          is_approved: boolean
          neighborhood: string | null
          network_id: string | null
          number: string | null
          phone: string | null
          pix_key: string | null
          pix_type: Database["public"]["Enums"]["pix_type"] | null
          role: Database["public"]["Enums"]["partner_role"]
          street: string | null
          terms_accepted_at: string | null
          unit_store_id: string | null
          user_id: string
          vehicle: string | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          full_name?: string
          has_seen_onboarding?: boolean
          id?: string
          is_approved?: boolean
          neighborhood?: string | null
          network_id?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_type?: Database["public"]["Enums"]["pix_type"] | null
          role?: Database["public"]["Enums"]["partner_role"]
          street?: string | null
          terms_accepted_at?: string | null
          unit_store_id?: string | null
          user_id: string
          vehicle?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          full_name?: string
          has_seen_onboarding?: boolean
          id?: string
          is_approved?: boolean
          neighborhood?: string | null
          network_id?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_type?: Database["public"]["Enums"]["pix_type"] | null
          role?: Database["public"]["Enums"]["partner_role"]
          street?: string | null
          terms_accepted_at?: string | null
          unit_store_id?: string | null
          user_id?: string
          vehicle?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "store_networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_store_id_fkey"
            columns: ["unit_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          category: Database["public"]["Enums"]["store_category"]
          created_at: string
          delivery_fee: number | null
          delivery_mode: string
          force_closed: boolean
          id: string
          image_url: string | null
          is_open: boolean
          name: string
          network_id: string | null
          owner_id: string | null
          rating: number | null
          settings: Json
          slug: string | null
          status: Database["public"]["Enums"]["store_status"]
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          category: Database["public"]["Enums"]["store_category"]
          created_at?: string
          delivery_fee?: number | null
          delivery_mode?: string
          force_closed?: boolean
          id?: string
          image_url?: string | null
          is_open?: boolean
          name: string
          network_id?: string | null
          owner_id?: string | null
          rating?: number | null
          settings?: Json
          slug?: string | null
          status?: Database["public"]["Enums"]["store_status"]
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          category?: Database["public"]["Enums"]["store_category"]
          created_at?: string
          delivery_fee?: number | null
          delivery_mode?: string
          force_closed?: boolean
          id?: string
          image_url?: string | null
          is_open?: boolean
          name?: string
          network_id?: string | null
          owner_id?: string | null
          rating?: number | null
          settings?: Json
          slug?: string | null
          status?: Database["public"]["Enums"]["store_status"]
        }
        Relationships: [
          {
            foreignKeyName: "stores_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "store_networks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      register_as_matriz: {
        Args: {
          _logo_url?: string
          _monthly_fee?: number
          _network_name: string
          _plan_type?: string
        }
        Returns: string
      }
      create_network_unit: {
        Args: {
          _address_cep?: string
          _address_city?: string
          _address_neighborhood?: string
          _address_number?: string
          _address_state?: string
          _address_street?: string
          _category: string
          _name: string
          _slug: string
        }
        Returns: string
      }
      link_unit_user: {
        Args: { _store_id: string; _user_email: string }
        Returns: undefined
      }
      clone_menu_from_matriz: {
        Args: { _source_store_id: string; _target_store_id: string }
        Returns: Json
      }
      is_unit_manager: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      partner_role:
        | "cliente"
        | "lojista"
        | "motoboy"
        | "suporte"
        | "lojista_matriz"
        | "lojista_unidade"
      pix_type: "cpf" | "cnpj" | "email" | "phone" | "random"
      store_category:
        | "lanches"
        | "pizzas"
        | "adegas"
        | "japonesa"
        | "saudavel"
        | "sobremesas"
        | "cafeteria"
        | "churrasco"
        | "farmacias"
        | "docerias"
        | "restaurante"
        | "esfihas"
      store_status: "analise" | "ativo" | "bloqueado"
      store_plan_type: "fixed" | "hybrid" | "commission_only" | "supporter"
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
