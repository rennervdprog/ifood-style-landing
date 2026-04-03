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
      admin_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      coupon_uses: {
        Row: {
          coupon_id: string
          created_at: string
          id: string
          order_id: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          id?: string
          order_id: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          first_order_only: boolean
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_value: number
          store_id: string | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_value?: number
          store_id?: string | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_value?: number
          store_id?: string | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          mercado_pago_payment_id: string | null
          mercado_pago_transfer_id: string | null
          metadata: Json
          pix_copy_paste: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          provider: string
          reference_code: string
          settled_at: string | null
          status: Database["public"]["Enums"]["financial_transaction_status"]
          store_id: string
          transaction_kind: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          mercado_pago_payment_id?: string | null
          mercado_pago_transfer_id?: string | null
          metadata?: Json
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          provider?: string
          reference_code: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["financial_transaction_status"]
          store_id: string
          transaction_kind: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mercado_pago_payment_id?: string | null
          mercado_pago_transfer_id?: string | null
          metadata?: Json
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          provider?: string
          reference_code?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["financial_transaction_status"]
          store_id?: string
          transaction_kind?: Database["public"]["Enums"]["financial_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
      order_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          store_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          store_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          store_id?: string
          user_id?: string
        }
        Relationships: []
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
          settlement_code: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total_price: number
          visible_to_client: boolean
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
          settlement_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total_price: number
          visible_to_client?: boolean
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
          settlement_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total_price?: number
          visible_to_client?: boolean
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
      payout_history: {
        Row: {
          admin_user_id: string
          amount: number
          created_at: string
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          notes: string | null
          payout_type: string
        }
        Insert: {
          admin_user_id: string
          amount?: number
          created_at?: string
          entity_id: string
          entity_name: string
          entity_type: string
          id?: string
          notes?: string | null
          payout_type?: string
        }
        Update: {
          admin_user_id?: string
          amount?: number
          created_at?: string
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          notes?: string | null
          payout_type?: string
        }
        Relationships: []
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
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
      saved_addresses: {
        Row: {
          complement: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          neighborhood: string
          number: string
          reference_point: string | null
          street: string
          user_id: string
        }
        Insert: {
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood: string
          number: string
          reference_point?: string | null
          street: string
          user_id: string
        }
        Update: {
          complement?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood?: string
          number?: string
          reference_point?: string | null
          street?: string
          user_id?: string
        }
        Relationships: []
      }
      store_balances: {
        Row: {
          comissao_pendente: number
          id: string
          pending_commission: number
          repasse_pendente: number
          store_id: string
          updated_at: string
        }
        Insert: {
          comissao_pendente?: number
          id?: string
          pending_commission?: number
          repasse_pendente?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          comissao_pendente?: number
          id?: string
          pending_commission?: number
          repasse_pendente?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_reference: string | null
          address_state: string | null
          address_street: string | null
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
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_reference?: string | null
          address_state?: string | null
          address_street?: string | null
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
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_reference?: string | null
          address_state?: string | null
          address_street?: string | null
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
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          driver_user_id: string
          id: string
          pix_key: string
          pix_type: string
          processed_at: string | null
          status: string
          transaction_code: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          driver_user_id: string
          id?: string
          pix_key: string
          pix_type?: string
          processed_at?: string | null
          status?: string
          transaction_code?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          driver_user_id?: string
          id?: string
          pix_key?: string
          pix_type?: string
          processed_at?: string | null
          status?: string
          transaction_code?: string | null
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
      admin_cleanup_duplicate_withdrawals: { Args: never; Returns: number }
      admin_delete_store: { Args: { _store_id: string }; Returns: undefined }
      confirm_order_payment: { Args: { _order_id: string }; Returns: undefined }
      driver_accept_order: { Args: { _order_id: string }; Returns: undefined }
      driver_confirm_store_return:
        | { Args: { _order_id: string }; Returns: undefined }
        | {
            Args: { _order_id: string; _settlement_code?: string }
            Returns: undefined
          }
      driver_finish_delivery:
        | { Args: { _order_id: string }; Returns: undefined }
        | { Args: { _order_id: string; _pin?: string }; Returns: undefined }
      driver_validate_collection: {
        Args: { _code: string; _order_id: string }
        Returns: undefined
      }
      generate_financial_reference: {
        Args: { _prefix: string }
        Returns: string
      }
      get_delivery_contacts: {
        Args: { _order_ids?: string[] }
        Returns: {
          full_name: string
          neighborhood: string
          phone: string
          user_id: string
          whatsapp_number: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      app_role: "admin" | "moderator" | "user"
      financial_transaction_status:
        | "pending"
        | "approved"
        | "paid"
        | "failed"
        | "cancelled"
      financial_transaction_type: "commission_charge" | "store_payout"
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
      app_role: ["admin", "moderator", "user"],
      financial_transaction_status: [
        "pending",
        "approved",
        "paid",
        "failed",
        "cancelled",
      ],
      financial_transaction_type: ["commission_charge", "store_payout"],
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
