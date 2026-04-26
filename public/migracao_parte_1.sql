-- Parte 1: Enums e Tabelas Base (Versão sem blocos DO para maior compatibilidade)
-- Se der erro de "already exists", você pode ignorar.

CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE financial_transaction_status AS ENUM ('pending', 'approved', 'paid', 'failed', 'cancelled');
CREATE TYPE financial_transaction_type AS ENUM ('commission_charge', 'store_payout', 'driver_payout');
CREATE TYPE order_status AS ENUM ('aguardando_pagamento', 'pendente', 'preparando', 'pronto_para_entrega', 'em_transito', 'entregue', 'saiu_entrega', 'finalizado', 'cancelado');
CREATE TYPE partner_role AS ENUM ('cliente', 'lojista', 'motoboy');
CREATE TYPE pix_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');
CREATE TYPE refund_reason AS ENUM ('wrong_product', 'missing_items', 'damaged', 'late_delivery', 'poor_quality', 'other');
CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'processed', 'rejected');
CREATE TYPE refund_type AS ENUM ('full', 'partial', 'wallet_credit');
CREATE TYPE store_category AS ENUM ('lanches', 'pizzas', 'adegas', 'japonesa', 'saudavel', 'sobremesas', 'cafeteria', 'churrasco', 'farmacias', 'docerias', 'restaurante', 'esfihas');
CREATE TYPE store_plan_type AS ENUM ('fixed', 'hybrid', 'commission_only');
CREATE TYPE store_status AS ENUM ('analise', 'ativo', 'bloqueado');
CREATE TYPE wallet_transaction_type AS ENUM ('credit', 'debit');

CREATE TABLE IF NOT EXISTS admin_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS app_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), label text NOT NULL, description text, url text NOT NULL, icon text NOT NULL DEFAULT 'Link', is_external boolean NOT NULL DEFAULT false, is_highlight boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, role text, document text, vehicle text, avatar_url text, neighborhood text, city text, phone text, whatsapp_number text, pix_key text, pix_type text, cep text, street text, address_number text, terms_accepted_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS drivers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, name text NOT NULL, vehicle_info text, is_available boolean DEFAULT false, current_lat numeric, current_lng numeric, last_location_update timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS archived_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), original_user_id uuid NOT NULL, full_name text, email text, document text, phone text, whatsapp_number text, role text, city text, neighborhood text, pix_key text, pix_type text, cep text, street text, address_number text, terms_accepted_at timestamptz, deleted_at timestamptz DEFAULT now());
