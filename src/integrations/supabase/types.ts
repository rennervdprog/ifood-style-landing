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
          price_replaces_base: boolean
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
          price_replaces_base?: boolean
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
          price_replaces_base?: boolean
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
      admin_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
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
      app_links: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          is_external: boolean
          is_highlight: boolean
          label: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          is_external?: boolean
          is_highlight?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          is_external?: boolean
          is_highlight?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      archived_accounts: {
        Row: {
          account_created_at: string | null
          address_number: string | null
          cep: string | null
          city: string | null
          deleted_at: string
          deletion_reason: string | null
          document: string | null
          email: string | null
          full_name: string | null
          id: string
          metadata: Json | null
          neighborhood: string | null
          order_count: number | null
          original_user_id: string
          phone: string | null
          pix_key: string | null
          pix_type: string | null
          retain_until: string
          role: string | null
          street: string | null
          terms_accepted_at: string | null
          total_spent: number | null
          whatsapp_number: string | null
        }
        Insert: {
          account_created_at?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          deleted_at?: string
          deletion_reason?: string | null
          document?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json | null
          neighborhood?: string | null
          order_count?: number | null
          original_user_id: string
          phone?: string | null
          pix_key?: string | null
          pix_type?: string | null
          retain_until?: string
          role?: string | null
          street?: string | null
          terms_accepted_at?: string | null
          total_spent?: number | null
          whatsapp_number?: string | null
        }
        Update: {
          account_created_at?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          deleted_at?: string
          deletion_reason?: string | null
          document?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          metadata?: Json | null
          neighborhood?: string | null
          order_count?: number | null
          original_user_id?: string
          phone?: string | null
          pix_key?: string | null
          pix_type?: string | null
          retain_until?: string
          role?: string | null
          street?: string | null
          terms_accepted_at?: string | null
          total_spent?: number | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      asaas_subaccounts_registry: {
        Row: {
          account_id: string | null
          api_key: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          external_store_id: string | null
          id: string
          last_error: Json | null
          linked_at: string | null
          raw_response: Json | null
          status: string
          store_id: string | null
          updated_at: string
          wallet_id: string
        }
        Insert: {
          account_id?: string | null
          api_key?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          external_store_id?: string | null
          id?: string
          last_error?: Json | null
          linked_at?: string | null
          raw_response?: Json | null
          status?: string
          store_id?: string | null
          updated_at?: string
          wallet_id: string
        }
        Update: {
          account_id?: string | null
          api_key?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          external_store_id?: string | null
          id?: string
          last_error?: Json | null
          linked_at?: string | null
          raw_response?: Json | null
          status?: string
          store_id?: string | null
          updated_at?: string
          wallet_id?: string
        }
        Relationships: []
      }
      asaas_transfer_review_queue: {
        Row: {
          created_at: string
          description: string | null
          id: string
          payload: Json | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transfer_id: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          payload?: Json | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_id?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          payload?: Json | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transfer_id?: string | null
          value?: number | null
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          event: string
          external_reference: string | null
          id: string
          payload: Json | null
          payment_id: string
          processed_at: string
        }
        Insert: {
          event: string
          external_reference?: string | null
          id?: string
          payload?: Json | null
          payment_id: string
          processed_at?: string
        }
        Update: {
          event?: string
          external_reference?: string | null
          id?: string
          payload?: Json | null
          payment_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_type: string
          link_value: string | null
          sort_order: number
          store_id: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_type?: string
          link_value?: string | null
          sort_order?: number
          store_id?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_type?: string
          link_value?: string | null
          sort_order?: number
          store_id?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          created_at: string
          expected_balance: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_balance: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_balance?: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "cash_registers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          cash_register_id: string
          category: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          order_id: string | null
          payment_method: string | null
          type: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          type: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_resolved: boolean
          message: string
          resolved_at: string | null
          store_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message: string
          resolved_at?: string | null
          store_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message?: string
          resolved_at?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "compliance_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons_public"
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
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
      driver_locations: {
        Row: {
          accuracy: number | null
          driver_user_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          order_id: string | null
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          driver_user_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          order_id?: string | null
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          driver_user_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          order_id?: string | null
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          is_online: boolean
          name: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          name?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_fund: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          partner_id: string | null
          source: string
          transaction_type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          partner_id?: string | null
          source: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          partner_id?: string | null
          source?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_fund_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "platform_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      fcm_tokens: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          store_id: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          store_id?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          store_id?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fcm_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "fcm_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fcm_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fcm_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "financial_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_attempts: {
        Row: {
          blocked: boolean
          client_lat: number | null
          client_lng: number | null
          created_at: string
          delivery_city: string | null
          distance_km: number | null
          id: string
          reason: string
          store_city: string | null
          store_id: string | null
          store_lat: number | null
          store_lng: number | null
          store_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          blocked?: boolean
          client_lat?: number | null
          client_lng?: number | null
          created_at?: string
          delivery_city?: string | null
          distance_km?: number | null
          id?: string
          reason: string
          store_city?: string | null
          store_id?: string | null
          store_lat?: number | null
          store_lng?: number | null
          store_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          blocked?: boolean
          client_lat?: number | null
          client_lng?: number | null
          created_at?: string
          delivery_city?: string | null
          distance_km?: number | null
          id?: string
          reason?: string
          store_city?: string | null
          store_id?: string | null
          store_lat?: number | null
          store_lng?: number | null
          store_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      geocode_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          route_km: number | null
          route_minutes: number | null
          source: string | null
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          route_km?: number | null
          route_minutes?: number | null
          source?: string | null
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          route_km?: number | null
          route_minutes?: number | null
          source?: string | null
        }
        Relationships: []
      }
      loyalty_config: {
        Row: {
          created_at: string
          discount_per_point: number
          id: string
          is_enabled: boolean
          max_discount_percent: number
          min_points_redeem: number
          points_per_real: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_per_point?: number
          id?: string
          is_enabled?: boolean
          max_discount_percent?: number
          min_points_redeem?: number
          points_per_real?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_per_point?: number
          id?: string
          is_enabled?: boolean
          max_discount_percent?: number
          min_points_redeem?: number
          points_per_real?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "loyalty_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          id: string
          last_order_at: string | null
          points: number
          store_id: string
          total_orders: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_order_at?: string | null
          points?: number
          store_id: string
          total_orders?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_order_at?: string | null
          points?: number
          store_id?: string
          total_orders?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "loyalty_points_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "menu_sections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_sections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_sections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_earnings: {
        Row: {
          amount: number
          created_at: string
          earning_type: string
          id: string
          is_paid: boolean
          moderator_id: string
          order_id: string | null
          paid_at: string | null
          period: string | null
          store_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          earning_type: string
          id?: string
          is_paid?: boolean
          moderator_id: string
          order_id?: string | null
          paid_at?: string | null
          period?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          earning_type?: string
          id?: string
          is_paid?: boolean
          moderator_id?: string
          order_id?: string | null
          paid_at?: string | null
          period?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_earnings_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "moderators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "moderator_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_referrals: {
        Row: {
          created_at: string
          id: string
          moderator_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          moderator_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          moderator_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_referrals_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "moderators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "moderator_referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      moderators: {
        Row: {
          commission_split_percent: number
          created_at: string
          delivery_split: number
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          plan_fee_percent: number
          referral_code: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          commission_split_percent?: number
          created_at?: string
          delivery_split?: number
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          plan_fee_percent?: number
          referral_code: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          commission_split_percent?: number
          created_at?: string
          delivery_split?: number
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          plan_fee_percent?: number
          referral_code?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      onesignal_players: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          player_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          player_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          player_id?: string
          updated_at?: string
          user_id?: string
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
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "opening_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
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
          asaas_payment_id: string | null
          asaas_split_native: boolean
          assigned_driver_id: string | null
          change_for: number | null
          client_id: string
          client_lat: number | null
          client_lng: number | null
          collection_code: string | null
          collection_validated: boolean
          commission_rate: number | null
          confirmed_at: string | null
          created_at: string
          delivery_confirmed_by_client: boolean
          delivery_fee: number
          delivery_pin: string | null
          driver_id: string | null
          id: string
          needs_change: boolean
          neighborhood: string
          order_source: string | null
          payment_method: string
          payments: Json | null
          pdv_discount: number | null
          pdv_session_id: string | null
          return_to_store_confirmed: boolean
          scheduled_for: string | null
          settlement_code: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          store_payout_at: string | null
          store_payout_error: string | null
          store_payout_id: string | null
          subtotal: number
          table_identifier: string | null
          total_price: number
          visible_to_client: boolean
        }
        Insert: {
          address_details: string
          app_fee?: number
          asaas_payment_id?: string | null
          asaas_split_native?: boolean
          assigned_driver_id?: string | null
          change_for?: number | null
          client_id: string
          client_lat?: number | null
          client_lng?: number | null
          collection_code?: string | null
          collection_validated?: boolean
          commission_rate?: number | null
          confirmed_at?: string | null
          created_at?: string
          delivery_confirmed_by_client?: boolean
          delivery_fee?: number
          delivery_pin?: string | null
          driver_id?: string | null
          id?: string
          needs_change?: boolean
          neighborhood: string
          order_source?: string | null
          payment_method: string
          payments?: Json | null
          pdv_discount?: number | null
          pdv_session_id?: string | null
          return_to_store_confirmed?: boolean
          scheduled_for?: string | null
          settlement_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          store_payout_at?: string | null
          store_payout_error?: string | null
          store_payout_id?: string | null
          subtotal: number
          table_identifier?: string | null
          total_price: number
          visible_to_client?: boolean
        }
        Update: {
          address_details?: string
          app_fee?: number
          asaas_payment_id?: string | null
          asaas_split_native?: boolean
          assigned_driver_id?: string | null
          change_for?: number | null
          client_id?: string
          client_lat?: number | null
          client_lng?: number | null
          collection_code?: string | null
          collection_validated?: boolean
          commission_rate?: number | null
          confirmed_at?: string | null
          created_at?: string
          delivery_confirmed_by_client?: boolean
          delivery_fee?: number
          delivery_pin?: string | null
          driver_id?: string | null
          id?: string
          needs_change?: boolean
          neighborhood?: string
          order_source?: string | null
          payment_method?: string
          payments?: Json | null
          pdv_discount?: number | null
          pdv_session_id?: string | null
          return_to_store_confirmed?: boolean
          scheduled_for?: string | null
          settlement_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          store_payout_at?: string | null
          store_payout_error?: string | null
          store_payout_id?: string | null
          subtotal?: number
          table_identifier?: string | null
          total_price?: number
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page: string
          user_id: string | null
          visitor_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page: string
          user_id?: string | null
          visitor_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page?: string
          user_id?: string | null
          visitor_hash?: string | null
        }
        Relationships: []
      }
      partner_payouts: {
        Row: {
          created_at: string
          emergency_deduction: number
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          partner_id: string
          payout_method: string | null
          period_end: string | null
          period_start: string | null
          status: string
          transfer_id: string | null
        }
        Insert: {
          created_at?: string
          emergency_deduction?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          partner_id: string
          payout_method?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          transfer_id?: string | null
        }
        Update: {
          created_at?: string
          emergency_deduction?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          partner_id?: string
          payout_method?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "platform_partners"
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
      pdv_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          order_id: string | null
          payment_method: string | null
          session_id: string
          store_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          session_id: string
          store_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          session_id?: string
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdv_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pdv_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          closing_difference: number | null
          closing_method: string | null
          denomination_count: Json | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: string
          store_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          closing_difference?: number | null
          closing_method?: string | null
          denomination_count?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          status?: string
          store_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          closing_difference?: number | null
          closing_method?: string | null
          denomination_count?: Json | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: string
          store_id?: string
        }
        Relationships: []
      }
      pizza_borders: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          name: string
          price: number
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_borders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "pizza_borders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_borders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_borders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_change_requests: {
        Row: {
          admin_notes: string | null
          current_monthly_fee: number
          current_plan_type: Database["public"]["Enums"]["store_plan_type"]
          id: string
          processed_at: string | null
          prorata_credit: number
          requested_at: string
          requested_commission_rate: number
          requested_monthly_fee: number
          requested_plan_type: Database["public"]["Enums"]["store_plan_type"]
          status: string
          store_id: string
        }
        Insert: {
          admin_notes?: string | null
          current_monthly_fee?: number
          current_plan_type: Database["public"]["Enums"]["store_plan_type"]
          id?: string
          processed_at?: string | null
          prorata_credit?: number
          requested_at?: string
          requested_commission_rate?: number
          requested_monthly_fee?: number
          requested_plan_type: Database["public"]["Enums"]["store_plan_type"]
          status?: string
          store_id: string
        }
        Update: {
          admin_notes?: string | null
          current_monthly_fee?: number
          current_plan_type?: Database["public"]["Enums"]["store_plan_type"]
          id?: string
          processed_at?: string | null
          prorata_credit?: number
          requested_at?: string
          requested_commission_rate?: number
          requested_monthly_fee?: number
          requested_plan_type?: Database["public"]["Enums"]["store_plan_type"]
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "plan_change_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_templates: {
        Row: {
          commission_rate: number
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          label: string
          max_slots: number | null
          monthly_fee: number
          plan_key: string
          plan_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          label: string
          max_slots?: number | null
          monthly_fee?: number
          plan_key: string
          plan_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          label?: string
          max_slots?: number | null
          monthly_fee?: number
          plan_key?: string
          plan_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_partners: {
        Row: {
          auto_transfer: boolean
          created_at: string
          email: string | null
          emergency_fund_percent: number
          id: string
          is_active: boolean
          is_owner: boolean
          name: string
          pix_key: string | null
          pix_type: string | null
          profit_percent: number
          updated_at: string
        }
        Insert: {
          auto_transfer?: boolean
          created_at?: string
          email?: string | null
          emergency_fund_percent?: number
          id?: string
          is_active?: boolean
          is_owner?: boolean
          name: string
          pix_key?: string | null
          pix_type?: string | null
          profit_percent?: number
          updated_at?: string
        }
        Update: {
          auto_transfer?: boolean
          created_at?: string
          email?: string | null
          emergency_fund_percent?: number
          id?: string
          is_active?: boolean
          is_owner?: boolean
          name?: string
          pix_key?: string | null
          pix_type?: string | null
          profit_percent?: number
          updated_at?: string
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
          metadata: Json
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
          metadata?: Json
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
          metadata?: Json
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
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cep: string | null
          city: string | null
          cnh_back_url: string | null
          cnh_front_url: string | null
          cnh_number: string | null
          complement: string | null
          created_at: string
          deleted_at: string | null
          document: string | null
          email: string | null
          full_name: string
          has_seen_onboarding: boolean
          id: string
          is_approved: boolean
          neighborhood: string | null
          number: string | null
          phone: string | null
          pix_key: string | null
          pix_type: Database["public"]["Enums"]["pix_type"] | null
          reference_point: string | null
          role: Database["public"]["Enums"]["partner_role"]
          selfie_url: string | null
          street: string | null
          terms_accepted_at: string | null
          user_id: string
          vehicle: string | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          cnh_back_url?: string | null
          cnh_front_url?: string | null
          cnh_number?: string | null
          complement?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          full_name?: string
          has_seen_onboarding?: boolean
          id?: string
          is_approved?: boolean
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_type?: Database["public"]["Enums"]["pix_type"] | null
          reference_point?: string | null
          role?: Database["public"]["Enums"]["partner_role"]
          selfie_url?: string | null
          street?: string | null
          terms_accepted_at?: string | null
          user_id: string
          vehicle?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          cep?: string | null
          city?: string | null
          cnh_back_url?: string | null
          cnh_front_url?: string | null
          cnh_number?: string | null
          complement?: string | null
          created_at?: string
          deleted_at?: string | null
          document?: string | null
          email?: string | null
          full_name?: string
          has_seen_onboarding?: boolean
          id?: string
          is_approved?: boolean
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          pix_key?: string | null
          pix_type?: Database["public"]["Enums"]["pix_type"] | null
          reference_point?: string | null
          role?: Database["public"]["Enums"]["partner_role"]
          selfie_url?: string | null
          street?: string | null
          terms_accepted_at?: string | null
          user_id?: string
          vehicle?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          approved_amount: number | null
          created_at: string
          description: string | null
          evidence_urls: string[] | null
          id: string
          order_id: string
          reason: Database["public"]["Enums"]["refund_reason"]
          refund_type: Database["public"]["Enums"]["refund_type"]
          requested_amount: number
          requester_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          store_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved_amount?: number | null
          created_at?: string
          description?: string | null
          evidence_urls?: string[] | null
          id?: string
          order_id: string
          reason?: Database["public"]["Enums"]["refund_reason"]
          refund_type?: Database["public"]["Enums"]["refund_type"]
          requested_amount?: number
          requester_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          store_id: string
        }
        Update: {
          admin_notes?: string | null
          approved_amount?: number | null
          created_at?: string
          description?: string | null
          evidence_urls?: string[] | null
          id?: string
          order_id?: string
          reason?: Database["public"]["Enums"]["refund_reason"]
          refund_type?: Database["public"]["Enums"]["refund_type"]
          requested_amount?: number
          requester_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "refund_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_addresses: {
        Row: {
          cep: string | null
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
          cep?: string | null
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
          cep?: string | null
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
      store_driver_earnings: {
        Row: {
          created_at: string
          driver_amount: number
          driver_confirmed_at: string | null
          driver_user_id: string
          fee_total: number
          id: string
          notes: string | null
          order_id: string
          paid_at: string | null
          paid_by: string | null
          payment_mode: string | null
          platform_cut: number
          status: string
          store_id: string
          store_marked_paid_at: string | null
        }
        Insert: {
          created_at?: string
          driver_amount?: number
          driver_confirmed_at?: string | null
          driver_user_id: string
          fee_total?: number
          id?: string
          notes?: string | null
          order_id: string
          paid_at?: string | null
          paid_by?: string | null
          payment_mode?: string | null
          platform_cut?: number
          status?: string
          store_id: string
          store_marked_paid_at?: string | null
        }
        Update: {
          created_at?: string
          driver_amount?: number
          driver_confirmed_at?: string | null
          driver_user_id?: string
          fee_total?: number
          id?: string
          notes?: string | null
          order_id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_mode?: string | null
          platform_cut?: number
          status?: string
          store_id?: string
          store_marked_paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_driver_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_driver_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_driver_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_driver_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_driver_earnings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_drivers: {
        Row: {
          created_at: string
          driver_user_id: string
          id: string
          payment_mode: string
          status: Database["public"]["Enums"]["store_driver_status"] | null
          store_id: string
        }
        Insert: {
          created_at?: string
          driver_user_id: string
          id?: string
          payment_mode?: string
          status?: Database["public"]["Enums"]["store_driver_status"] | null
          store_id: string
        }
        Update: {
          created_at?: string
          driver_user_id?: string
          id?: string
          payment_mode?: string
          status?: Database["public"]["Enums"]["store_driver_status"] | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_drivers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_drivers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_drivers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_drivers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_plans: {
        Row: {
          app_addon_fee: number
          commission_rate: number
          created_at: string
          id: string
          is_active: boolean
          last_billed_at: string | null
          last_billing_attempt_at: string | null
          monthly_fee: number
          next_billing_date: string | null
          pdv_commission_pending: number | null
          pdv_commission_rate: number | null
          pdv_enabled: boolean | null
          pdv_fixed_fee_per_sale: number
          pix_operational_fee_override: number | null
          plan_type: Database["public"]["Enums"]["store_plan_type"]
          platform_delivery_split_override: number | null
          started_at: string
          store_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          app_addon_fee?: number
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_billed_at?: string | null
          last_billing_attempt_at?: string | null
          monthly_fee?: number
          next_billing_date?: string | null
          pdv_commission_pending?: number | null
          pdv_commission_rate?: number | null
          pdv_enabled?: boolean | null
          pdv_fixed_fee_per_sale?: number
          pix_operational_fee_override?: number | null
          plan_type?: Database["public"]["Enums"]["store_plan_type"]
          platform_delivery_split_override?: number | null
          started_at?: string
          store_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          app_addon_fee?: number
          commission_rate?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_billed_at?: string | null
          last_billing_attempt_at?: string | null
          monthly_fee?: number
          next_billing_date?: string | null
          pdv_commission_pending?: number | null
          pdv_commission_rate?: number | null
          pdv_enabled?: boolean | null
          pdv_fixed_fee_per_sale?: number
          pix_operational_fee_override?: number | null
          plan_type?: Database["public"]["Enums"]["store_plan_type"]
          platform_delivery_split_override?: number | null
          started_at?: string
          store_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_secrets: {
        Row: {
          id: string
          store_id: string
          updated_at: string
          zapi_client_token: string | null
          zapi_enabled: boolean
          zapi_instance_id: string | null
          zapi_token: string | null
        }
        Insert: {
          id?: string
          store_id: string
          updated_at?: string
          zapi_client_token?: string | null
          zapi_enabled?: boolean
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          updated_at?: string
          zapi_client_token?: string | null
          zapi_enabled?: boolean
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_secrets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_secrets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_secrets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_secrets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
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
          address_reference: string | null
          address_state: string | null
          address_street: string | null
          app_enabled: boolean
          app_subscribed: boolean
          asaas_account_id: string | null
          asaas_activation_status: Json | null
          asaas_auto_withdraw_enabled: boolean
          asaas_documents_sent: boolean | null
          asaas_last_withdraw_at: string | null
          asaas_min_withdraw_amount: number
          asaas_pix_key: string | null
          asaas_pix_key_type: string | null
          asaas_subaccount_api_key: string | null
          asaas_wallet_id: string | null
          categories: Database["public"]["Enums"]["store_category"][]
          category: Database["public"]["Enums"]["store_category"]
          commission_rate: number
          created_at: string
          delivery_base_km: number | null
          delivery_enabled: boolean | null
          delivery_fee: number | null
          delivery_fee_base: number | null
          delivery_fee_per_km: number | null
          delivery_fee_type: string | null
          delivery_mode: string
          delivery_radius: number | null
          estimated_delivery_time: string | null
          force_closed: boolean
          id: string
          image_url: string | null
          is_open: boolean
          is_test: boolean
          latitude: number | null
          longitude: number | null
          minimum_order_value: number | null
          name: string
          own_delivery_fee: number
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
          address_reference?: string | null
          address_state?: string | null
          address_street?: string | null
          app_enabled?: boolean
          app_subscribed?: boolean
          asaas_account_id?: string | null
          asaas_activation_status?: Json | null
          asaas_auto_withdraw_enabled?: boolean
          asaas_documents_sent?: boolean | null
          asaas_last_withdraw_at?: string | null
          asaas_min_withdraw_amount?: number
          asaas_pix_key?: string | null
          asaas_pix_key_type?: string | null
          asaas_subaccount_api_key?: string | null
          asaas_wallet_id?: string | null
          categories?: Database["public"]["Enums"]["store_category"][]
          category: Database["public"]["Enums"]["store_category"]
          commission_rate?: number
          created_at?: string
          delivery_base_km?: number | null
          delivery_enabled?: boolean | null
          delivery_fee?: number | null
          delivery_fee_base?: number | null
          delivery_fee_per_km?: number | null
          delivery_fee_type?: string | null
          delivery_mode?: string
          delivery_radius?: number | null
          estimated_delivery_time?: string | null
          force_closed?: boolean
          id?: string
          image_url?: string | null
          is_open?: boolean
          is_test?: boolean
          latitude?: number | null
          longitude?: number | null
          minimum_order_value?: number | null
          name: string
          own_delivery_fee?: number
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
          address_reference?: string | null
          address_state?: string | null
          address_street?: string | null
          app_enabled?: boolean
          app_subscribed?: boolean
          asaas_account_id?: string | null
          asaas_activation_status?: Json | null
          asaas_auto_withdraw_enabled?: boolean
          asaas_documents_sent?: boolean | null
          asaas_last_withdraw_at?: string | null
          asaas_min_withdraw_amount?: number
          asaas_pix_key?: string | null
          asaas_pix_key_type?: string | null
          asaas_subaccount_api_key?: string | null
          asaas_wallet_id?: string | null
          categories?: Database["public"]["Enums"]["store_category"][]
          category?: Database["public"]["Enums"]["store_category"]
          commission_rate?: number
          created_at?: string
          delivery_base_km?: number | null
          delivery_enabled?: boolean | null
          delivery_fee?: number | null
          delivery_fee_base?: number | null
          delivery_fee_per_km?: number | null
          delivery_fee_type?: string | null
          delivery_mode?: string
          delivery_radius?: number | null
          estimated_delivery_time?: string | null
          force_closed?: boolean
          id?: string
          image_url?: string | null
          is_open?: boolean
          is_test?: boolean
          latitude?: number | null
          longitude?: number | null
          minimum_order_value?: number | null
          name?: string
          own_delivery_fee?: number
          owner_id?: string | null
          rating?: number | null
          settings?: Json
          slug?: string | null
          status?: Database["public"]["Enums"]["store_status"]
        }
        Relationships: []
      }
      terms_acceptance: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          privacy_version: string
          terms_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          privacy_version?: string
          terms_version?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          privacy_version?: string
          terms_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_active_devices: {
        Row: {
          created_at: string
          device_id: string
          id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          last_seen_at?: string
          user_id?: string
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
      user_wallet: {
        Row: {
          balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string
          transaction_type: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string
          transaction_type: Database["public"]["Enums"]["wallet_transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string
          transaction_type?: Database["public"]["Enums"]["wallet_transaction_type"]
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
      coupons_public: {
        Row: {
          code: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          expires_at: string | null
          first_order_only: boolean | null
          id: string | null
          is_active: boolean | null
          min_order_value: number | null
          store_id: string | null
        }
        Insert: {
          code?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          expires_at?: string | null
          first_order_only?: boolean | null
          id?: string | null
          is_active?: boolean | null
          min_order_value?: number | null
          store_id?: string | null
        }
        Update: {
          code?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          expires_at?: string | null
          first_order_only?: boolean | null
          id?: string | null
          is_active?: boolean | null
          min_order_value?: number | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          email: string | null
          full_name: string | null
          neighborhood: string | null
          phone: string | null
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          neighborhood?: string | null
          phone?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          email?: string | null
          full_name?: string | null
          neighborhood?: string | null
          phone?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      store_payment_credentials: {
        Row: {
          asaas_account_id: string | null
          asaas_min_withdraw_amount: number | null
          asaas_pix_key: string | null
          asaas_pix_key_type: string | null
          asaas_subaccount_api_key: string | null
          asaas_wallet_id: string | null
          store_id: string | null
        }
        Insert: {
          asaas_account_id?: string | null
          asaas_min_withdraw_amount?: number | null
          asaas_pix_key?: string | null
          asaas_pix_key_type?: string | null
          asaas_subaccount_api_key?: string | null
          asaas_wallet_id?: string | null
          store_id?: string | null
        }
        Update: {
          asaas_account_id?: string | null
          asaas_min_withdraw_amount?: number | null
          asaas_pix_key?: string | null
          asaas_pix_key_type?: string | null
          asaas_subaccount_api_key?: string | null
          asaas_wallet_id?: string | null
          store_id?: string | null
        }
        Relationships: []
      }
      store_plans_public: {
        Row: {
          is_active: boolean | null
          plan_type: Database["public"]["Enums"]["store_plan_type"] | null
          store_id: string | null
          trial_ends_at: string | null
        }
        Insert: {
          is_active?: boolean | null
          plan_type?: Database["public"]["Enums"]["store_plan_type"] | null
          store_id?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          is_active?: boolean | null
          plan_type?: Database["public"]["Enums"]["store_plan_type"] | null
          store_id?: string | null
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "store_payment_credentials"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_driver_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stores_driver_view: {
        Row: {
          address_neighborhood: string | null
          address_street: string | null
          id: string | null
          image_url: string | null
          name: string | null
        }
        Insert: {
          address_neighborhood?: string | null
          address_street?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
        }
        Update: {
          address_neighborhood?: string | null
          address_street?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
        }
        Relationships: []
      }
      stores_public: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_reference: string | null
          address_state: string | null
          address_street: string | null
          categories: Database["public"]["Enums"]["store_category"][] | null
          category: Database["public"]["Enums"]["store_category"] | null
          created_at: string | null
          delivery_mode: string | null
          force_closed: boolean | null
          id: string | null
          image_url: string | null
          is_open: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          own_delivery_fee: number | null
          owner_id: string | null
          rating: number | null
          settings: Json | null
          slug: string | null
          status: Database["public"]["Enums"]["store_status"] | null
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_reference?: string | null
          address_state?: string | null
          address_street?: string | null
          categories?: Database["public"]["Enums"]["store_category"][] | null
          category?: Database["public"]["Enums"]["store_category"] | null
          created_at?: string | null
          delivery_mode?: string | null
          force_closed?: boolean | null
          id?: string | null
          image_url?: string | null
          is_open?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          own_delivery_fee?: number | null
          owner_id?: string | null
          rating?: number | null
          settings?: Json | null
          slug?: string | null
          status?: Database["public"]["Enums"]["store_status"] | null
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_reference?: string | null
          address_state?: string | null
          address_street?: string | null
          categories?: Database["public"]["Enums"]["store_category"][] | null
          category?: Database["public"]["Enums"]["store_category"] | null
          created_at?: string | null
          delivery_mode?: string | null
          force_closed?: boolean | null
          id?: string | null
          image_url?: string | null
          is_open?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          own_delivery_fee?: number | null
          owner_id?: string | null
          rating?: number | null
          settings?: Json | null
          slug?: string | null
          status?: Database["public"]["Enums"]["store_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      accrue_moderator_plan_fee: {
        Args: { _monthly_fee: number; _store_id: string }
        Returns: undefined
      }
      admin_approve_partner: {
        Args: { _approved: boolean; _profile_user_id: string }
        Returns: undefined
      }
      admin_cancel_order: { Args: { _order_id: string }; Returns: undefined }
      admin_cleanup_duplicate_withdrawals: { Args: never; Returns: number }
      admin_create_test_store: {
        Args: {
          _category: Database["public"]["Enums"]["store_category"]
          _name: string
        }
        Returns: string
      }
      admin_delete_partner: {
        Args: { _profile_user_id: string }
        Returns: undefined
      }
      admin_delete_store: { Args: { _store_id: string }; Returns: undefined }
      apply_cancellation_policy: {
        Args: { _order_id: string; _reason?: string }
        Returns: Json
      }
      approve_plan_change: {
        Args: { _admin_notes?: string; _request_id: string }
        Returns: undefined
      }
      auto_finalize_stale_orders: { Args: never; Returns: Json }
      calculate_prorata_credit: { Args: { _store_id: string }; Returns: number }
      check_device_active: { Args: { _device_id: string }; Returns: boolean }
      claim_push_device: {
        Args: {
          _device_info?: string
          _fcm_token?: string
          _player_id?: string
        }
        Returns: undefined
      }
      client_confirm_delivery: {
        Args: { _order_id: string }
        Returns: undefined
      }
      confirm_order_payment: { Args: { _order_id: string }; Returns: undefined }
      count_supporter_plans: { Args: never; Returns: number }
      credit_store_commission: {
        Args: { _amount: number; _store_id: string }
        Returns: undefined
      }
      driver_accept_order: { Args: { _order_id: string }; Returns: undefined }
      driver_confirm_earning_received: {
        Args: { _earning_id: string }
        Returns: undefined
      }
      driver_confirm_store_return: {
        Args: { _order_id: string; _settlement_code?: string }
        Returns: undefined
      }
      driver_finish_delivery: {
        Args: { _order_id: string; _pin?: string }
        Returns: undefined
      }
      driver_validate_collection: {
        Args: { _code: string; _order_id: string }
        Returns: undefined
      }
      generate_financial_reference: {
        Args: { _prefix: string }
        Returns: string
      }
      get_asaas_split_for_order: {
        Args: {
          _delivery_fee: number
          _payment_method?: string
          _store_id: string
          _subtotal: number
        }
        Returns: Json
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
      get_fixed_plan_platform_split: {
        Args: { _store_id: string }
        Returns: number
      }
      get_order_client_name: { Args: { _order_id: string }; Returns: string }
      get_owned_store_ids: { Args: { _user_id: string }; Returns: string[] }
      get_page_view_stats: { Args: { _page?: string }; Returns: Json }
      get_pdv_session_summary: { Args: { _session_id: string }; Returns: Json }
      get_store_commission_rate: {
        Args: { _store_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_driver: { Args: { _user_id: string }; Returns: boolean }
      is_internal_account: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_store_blocked_by_balance: {
        Args: { _store_id: string }
        Returns: boolean
      }
      is_store_driver: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_store_driver_member: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_store_owner: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_test_store: { Args: { _store_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          _action: string
          _details?: Json
          _target_id: string
          _target_type: string
        }
        Returns: string
      }
      mark_all_store_driver_earnings_paid: {
        Args: { _driver_user_id: string; _store_id: string }
        Returns: number
      }
      mark_store_driver_earning_paid: {
        Args: { _earning_id: string; _notes?: string }
        Returns: undefined
      }
      process_refund: {
        Args: {
          _admin_notes?: string
          _approved_amount: number
          _refund_id: string
        }
        Returns: undefined
      }
      reconcile_debit_store_balance: {
        Args: { _amount: number; _plan_type: string; _store_id: string }
        Returns: undefined
      }
      record_page_view: {
        Args: { _page: string; _visitor_hash?: string }
        Returns: undefined
      }
      register_as_lojista: {
        Args: {
          _avatar_url?: string
          _document: string
          _full_name: string
          _selected_plan?: string
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
      register_device_login: { Args: { _device_id: string }; Returns: Json }
      reject_plan_change: {
        Args: { _admin_notes?: string; _request_id: string }
        Returns: undefined
      }
      search_motoboy_profiles: {
        Args: { _search: string }
        Returns: {
          email: string
          full_name: string
          phone: string
          user_id: string
          vehicle: string
          whatsapp_number: string
        }[]
      }
      store_assign_order_driver: {
        Args: { _driver_user_id: string; _order_id: string }
        Returns: undefined
      }
      store_mark_all_driver_earnings_paid: {
        Args: { _driver_user_id: string; _store_id: string }
        Returns: number
      }
      store_mark_driver_earning_paid: {
        Args: { _earning_id: string; _notes?: string }
        Returns: undefined
      }
      use_coupon: {
        Args: { _coupon_id: string; _order_id: string; _user_id: string }
        Returns: boolean
      }
      use_wallet_balance: {
        Args: { _amount: number; _order_id: string; _user_id: string }
        Returns: number
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
      financial_transaction_type:
        | "commission_charge"
        | "store_payout"
        | "driver_payout"
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
      refund_reason:
        | "wrong_product"
        | "missing_items"
        | "damaged"
        | "late_delivery"
        | "poor_quality"
        | "other"
      refund_status: "pending" | "approved" | "processed" | "rejected"
      refund_type: "full" | "partial" | "wallet_credit"
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
      store_driver_status: "pending" | "accepted" | "rejected"
      store_plan_type: "fixed" | "hybrid" | "commission_only" | "supporter"
      store_status: "analise" | "ativo" | "bloqueado"
      wallet_transaction_type: "credit" | "debit"
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
      financial_transaction_type: [
        "commission_charge",
        "store_payout",
        "driver_payout",
      ],
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
      refund_reason: [
        "wrong_product",
        "missing_items",
        "damaged",
        "late_delivery",
        "poor_quality",
        "other",
      ],
      refund_status: ["pending", "approved", "processed", "rejected"],
      refund_type: ["full", "partial", "wallet_credit"],
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
        "restaurante",
        "esfihas",
      ],
      store_driver_status: ["pending", "accepted", "rejected"],
      store_plan_type: ["fixed", "hybrid", "commission_only", "supporter"],
      store_status: ["analise", "ativo", "bloqueado"],
      wallet_transaction_type: ["credit", "debit"],
    },
  },
} as const
