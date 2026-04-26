import os

def update_file_2():
    content = """-- Parte 2: Lojas e Produtos (Atualizada com colunas reais)
CREATE TABLE IF NOT EXISTS stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    category store_category,
    image_url text,
    is_open boolean DEFAULT false,
    rating numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status store_status DEFAULT 'analise',
    force_closed boolean DEFAULT false,
    slug text UNIQUE,
    address_street text,
    address_number text,
    address_complement text,
    address_neighborhood text,
    address_reference text,
    address_city text,
    address_state text,
    address_cep text,
    delivery_mode text,
    own_delivery_fee numeric,
    asaas_account_id text,
    asaas_wallet_id text,
    settings jsonb DEFAULT '{}'::jsonb,
    commission_rate numeric DEFAULT 10,
    app_enabled boolean DEFAULT true,
    app_subscribed boolean DEFAULT false,
    latitude double precision,
    longitude double precision,
    is_test boolean DEFAULT false,
    categories text[]
);

CREATE TABLE IF NOT EXISTS menu_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    section_id uuid REFERENCES menu_sections(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    price numeric NOT NULL,
    image_url text,
    is_available boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addon_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    name text NOT NULL,
    min_select integer NOT NULL DEFAULT 0,
    max_select integer NOT NULL DEFAULT 1,
    sort_order integer NOT NULL DEFAULT 0,
    price_replaces_base boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addon_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_addon_groups (
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    group_id uuid REFERENCES addon_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, group_id)
);

CREATE TABLE IF NOT EXISTS opening_hours (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time text NOT NULL,
    close_time text NOT NULL,
    is_closed boolean DEFAULT false,
    UNIQUE(store_id, day_of_week)
);
"""
    with open('public/migracao_parte_2.sql', 'w', encoding='utf-8') as f:
        f.write(content)

def update_file_3():
    content = """-- Parte 3: Pedidos (Atualizada com colunas reais)
CREATE TABLE IF NOT EXISTS neighborhood_fees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    fee numeric NOT NULL,
    city text NOT NULL DEFAULT 'Itaocara',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id uuid REFERENCES stores(id),
    status order_status DEFAULT 'pendente',
    subtotal numeric NOT NULL DEFAULT 0,
    delivery_fee numeric DEFAULT 0,
    total_price numeric NOT NULL DEFAULT 0,
    payment_method text NOT NULL,
    neighborhood text,
    address_details text,
    created_at timestamptz DEFAULT now(),
    driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    app_fee numeric DEFAULT 0,
    delivery_pin text,
    confirmed_at timestamptz,
    needs_change boolean DEFAULT false,
    change_for numeric,
    return_to_store_confirmed boolean DEFAULT false,
    collection_code text,
    collection_validated boolean DEFAULT false,
    visible_to_client boolean DEFAULT true,
    settlement_code text,
    scheduled_for timestamptz,
    delivery_confirmed_by_client boolean DEFAULT false,
    client_lat double precision,
    client_lng double precision,
    assigned_driver_id uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id),
    quantity integer NOT NULL,
    unit_price numeric NOT NULL,
    total_price numeric NOT NULL,
    notes text,
    addon_details jsonb
);

CREATE TABLE IF NOT EXISTS order_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES auth.users(id),
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);
"""
    with open('public/migracao_parte_3.sql', 'w', encoding='utf-8') as f:
        f.write(content)

update_file_2()
update_file_3()
