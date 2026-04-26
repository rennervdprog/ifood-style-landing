
DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_status') THEN
        CREATE TYPE financial_transaction_status AS ENUM ('pending', 'approved', 'paid', 'failed', 'cancelled');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_transaction_type') THEN
        CREATE TYPE financial_transaction_type AS ENUM ('commission_charge', 'store_payout', 'driver_payout');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('aguardando_pagamento', 'pendente', 'preparando', 'pronto_para_entrega', 'em_transito', 'entregue', 'saiu_entrega', 'finalizado', 'cancelado');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_role') THEN
        CREATE TYPE partner_role AS ENUM ('cliente', 'lojista', 'motoboy');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pix_type') THEN
        CREATE TYPE pix_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_reason') THEN
        CREATE TYPE refund_reason AS ENUM ('wrong_product', 'missing_items', 'damaged', 'late_delivery', 'poor_quality', 'other');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
        CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'processed', 'rejected');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_type') THEN
        CREATE TYPE refund_type AS ENUM ('full', 'partial', 'wallet_credit');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_category') THEN
        CREATE TYPE store_category AS ENUM ('lanches', 'pizzas', 'adegas', 'japonesa', 'saudavel', 'sobremesas', 'cafeteria', 'churrasco', 'farmacias', 'docerias', 'restaurante', 'esfihas');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_plan_type') THEN
        CREATE TYPE store_plan_type AS ENUM ('fixed', 'hybrid', 'commission_only');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_status') THEN
        CREATE TYPE store_status AS ENUM ('analise', 'ativo', 'bloqueado');
    END IF;
END $$;

DO $$
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_type') THEN
        CREATE TYPE wallet_transaction_type AS ENUM ('credit', 'debit');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text NOT NULL, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS app_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), label text NOT NULL, description text, url text NOT NULL, icon text NOT NULL DEFAULT 'Link', is_external boolean NOT NULL DEFAULT false, is_highlight boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, role text, document text, vehicle text, avatar_url text, neighborhood text, city text, phone text, whatsapp_number text, pix_key text, pix_type text, cep text, street text, address_number text, terms_accepted_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS drivers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, name text NOT NULL, vehicle_info text, is_available boolean DEFAULT false, current_lat numeric, current_lng numeric, last_location_update timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS archived_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), original_user_id uuid NOT NULL, full_name text, email text, document text, phone text, whatsapp_number text, role text, city text, neighborhood text, pix_key text, pix_type text, cep text, street text, address_number text, terms_accepted_at timestamptz, deleted_at timestamptz DEFAULT now());
