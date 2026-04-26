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
    driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, 
    status order_status DEFAULT 'pendente', 
    total_amount numeric NOT NULL, 
    delivery_fee numeric DEFAULT 0, 
    delivery_address text NOT NULL, 
    payment_method text NOT NULL, 
    created_at timestamptz DEFAULT now(), 
    updated_at timestamptz DEFAULT now(), 
    neighborhood_fee_id uuid REFERENCES neighborhood_fees(id), 
    change_amount numeric, 
    observation text, 
    cancellation_reason text, 
    collection_code text, 
    delivery_code text, 
    client_delivery_code text, 
    cancellation_role text
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

CREATE TABLE IF NOT EXISTS order_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    order_id uuid UNIQUE REFERENCES orders(id) ON DELETE CASCADE, 
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE, 
    client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, 
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5), 
    comment text, 
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), 
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE, 
    status order_status NOT NULL, 
    created_at timestamptz DEFAULT now(), 
    created_by uuid REFERENCES auth.users(id)
);