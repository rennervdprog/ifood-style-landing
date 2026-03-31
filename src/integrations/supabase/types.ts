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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addon_groups: {
        Row: {
          created_at: string
          id: string
          max_select: number
          min_select: number
          name: string
          product_id: string | null
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          name: string
          product_id?: string | null
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_select?: number
          min_select?: number
          name?: string
          product_id?: string | null
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_items: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "addon_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_balances: {
        Row: {
          driver_user_id: string
          id: string
          paid_amount: number
          pending_amount: number
          total_earned: number
          updated_at: string
        }
        Insert: {
          driver_user_id: string
          id?: string
          paid_amount?: number
          pending_amount?: number
          total_earned?: number
          updated_at?: string
        }
        Update: {
          driver_user_id?: string
          id?: string
          paid_amount?: number
          pending_amount?: number
          total_earned?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_earnings: {
        Row: {
          amount: number
          created_at: string
          driver_user_id: string
          id: string
          order_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_user_id: string
          id?: string
          order_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_user_id?: string
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_online: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      menu_sections: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_sections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhood_fees: {
        Row: {
          fee: number
          id: string
          name: string
        }
        Insert: {
          fee?: number
          id?: string
          name: string
        }
        Update: {
          fee?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      opening_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_closed_all_day: boolean
          open_time: string
          store_id: string
        }
        Insert: {
          close_time?: string
          day_of_week: number
          id?: string
          is_closed_all_day?: boolean
          open_time?: string
          store_id: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_closed_all_day?: boolean
          open_time?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          addons: Json | null
          id: string
          observations: string | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          addons?: Json | null
          id?: string
          observations?: string | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          addons?: Json | null
          id?: string
          observations?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_details: string
          app_fee: number
          change_for: number | null
          client_id: string
          collection_code: string | null
          collection_validated: boolean
          confirmed_at: string | null
          created_at: string
          delivery_fee: number
          delivery_pin: string | null
          driver_id: string | null
          id: string
          needs_change: boolean
          neighborhood: string
          payment_method: string
          return_to_store_confirmed: boolean
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total_price: number
        }
        Insert: {
          address_details: string
          app_fee?: number
          change_for?: number | null
          client_id: string
          collection_code?: string | null
          collection_validated?: boolean
          confirmed_at?: string | null
          created_at?: string
          delivery_fee?: number
          delivery_pin?: string | null
          driver_id?: string | null
          id?: string
          needs_change?: boolean
          neighborhood: string
          payment_method: string
          return_to_store_confirmed?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total_price: number
        }
        Update: {
          address_details?: string
          app_fee?: number
          change_for?: number | null
          client_id?: string
          collection_code?: string | null
          collection_validated?: boolean
          confirmed_at?: string | null
          created_at?: string
          delivery_fee?: number
          delivery_pin?: string | null
          driver_id?: string | null
          id?: string
          needs_change?: boolean
          neighborhood?: string
          payment_method?: string
          return_to_store_confirmed?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_addon_groups: {
        Row: {
          addon_group_id: string
          created_at: string | null
          id: string
          product_id: string
        }
        Insert: {
          addon_group_id: string
          created_at?: string | null
          id?: string
          product_id: string
        }
        Update: {
          addon_group_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_groups_addon_group_id_fkey"
            columns: ["addon_group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          section_id: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
          section_id?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          section_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          complement: string | null
          created_at: string
          document: string | null
          full_name: string
          id: string
          is_approved: boolean
          neighborhood: string | null
          number: string | null
          phone: string | null
          pix_key: string | null
          pix_type: Database["public"]["Enums"]["pix_type"] | null
          reference_point: string | null
          role: Database["public"]["Enums"]["partner_role"]
          street: string | null
          user_id: string
          vehicle: string | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          full_name?: string
          id?: string
          is_approved?: boolean
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_type?: Database["public"]["Enums"]["pix_type"] | null
          reference_point?: string | null
          role?: Database["public"]["Enums"]["partner_role"]
          street?: string | null
          user_id: string
          vehicle?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          full_name?: string
          id?: string
          is_approved?: boolean
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_type?: Database["public"]["Enums"]["pix_type"] | null
          reference_point?: string | null
          role?: Database["public"]["Enums"]["partner_role"]
          street?: string | null
          user_id?: string
          vehicle?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      store_balances: {
        Row: {
          id: string
          pending_commission: number
          store_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          pending_commission?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          pending_commission?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          category: Database["public"]["Enums"]["store_category"]
          created_at: string
          force_closed: boolean
          id: string
          image_url: string | null
          is_open: boolean
          name: string
          owner_id: string | null
          rating: number | null
          slug: string | null
          status: Database["public"]["Enums"]["store_status"]
        }
        Insert: {
          category: Database["public"]["Enums"]["store_category"]
          created_at?: string
          force_closed?: boolean
          id?: string
          image_url?: string | null
          is_open?: boolean
          name: string
          owner_id?: string | null
          rating?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["store_status"]
        }
        Update: {
          category?: Database["public"]["Enums"]["store_category"]
          created_at?: string
          force_closed?: boolean
          id?: string
          image_url?: string | null
          is_open?: boolean
          name?: string
          owner_id?: string | null
          rating?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["store_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_partner: {
        Args: { _approved: boolean; _profile_user_id: string }
        Returns: undefined
      }
      admin_cancel_order: { Args: { _order_id: string }; Returns: undefined }
      admin_delete_store: { Args: { _store_id: string }; Returns: undefined }
      driver_accept_order: { Args: { _order_id: string }; Returns: undefined }
      driver_confirm_store_return: {
        Args: { _order_id: string }
        Returns: undefined
      }
      driver_finish_delivery:
        | { Args: { _order_id: string }; Returns: undefined }
        | { Args: { _order_id: string; _pin?: string }; Returns: undefined }
      driver_validate_collection: {
        Args: { _code: string; _order_id: string }
        Returns: undefined
      }
      is_driver: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      register_as_lojista:
        | {
            Args: {
              _avatar_url?: string
              _document: string
              _full_name: string
              _store_category: Database["public"]["Enums"]["store_category"]
              _store_name: string
            }
            Returns: string
          }
        | {
            Args: {
              _avatar_url?: string
              _document: string
              _full_name: string
              _store_category: Database["public"]["Enums"]["store_category"]
              _store_name: string
              _whatsapp?: string
            }
            Returns: string
          }
      register_as_motoboy:
        | {
            Args: {
              _avatar_url?: string
              _document: string
              _full_name: string
              _vehicle: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _avatar_url?: string
              _document: string
              _full_name: string
              _vehicle: string
              _whatsapp?: string
            }
            Returns: undefined
          }
    }
    Enums: {
      order_status:
        | "aguardando_pagamento"
        | "pendente"
        | "preparando"
        | "pronto_para_entrega"
        | "em_transito"
        | "entregue"
        | "saiu_entrega"
        | "finalizado"
        | "cancelado"
      partner_role: "cliente" | "lojista" | "motoboy"
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
      store_status: "analise" | "ativo" | "bloqueado"
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
      order_status: [
        "aguardando_pagamento",
        "pendente",
        "preparando",
        "pronto_para_entrega",
        "em_transito",
        "entregue",
        "saiu_entrega",
        "finalizado",
        "cancelado",
      ],
      partner_role: ["cliente", "lojista", "motoboy"],
      pix_type: ["cpf", "cnpj", "email", "phone", "random"],
      store_category: [
        "lanches",
        "pizzas",
        "adegas",
        "japonesa",
        "saudavel",
        "sobremesas",
        "cafeteria",
        "churrasco",
        "farmacias",
        "docerias",
      ],
      store_status: ["analise", "ativo", "bloqueado"],
    },
  },
} as const
