-- Parte 3: Pedidos (Atualizada com colunas reais)
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
