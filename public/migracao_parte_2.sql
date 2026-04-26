CREATE TABLE IF NOT EXISTS stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    logo_url text,
    cover_url text,
    category store_category,
    address text,
    rating numeric DEFAULT 0,
    delivery_time text,
    min_order numeric DEFAULT 0,
    delivery_fee numeric DEFAULT 0,
    is_open boolean DEFAULT false,
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status store_status DEFAULT 'analise',
    slug text UNIQUE,
    city text,
    neighborhood text,
    commission_rate numeric DEFAULT 10,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    document text,
    phone text,
    tablet_mode boolean DEFAULT false,
    auto_accept_orders boolean DEFAULT false,
    preparation_time_minutes integer DEFAULT 30,
    phone_verified boolean DEFAULT false,
    delivery_mode text DEFAULT 'platform',
    plan_type store_plan_type DEFAULT 'commission_only',
    monthly_fee numeric DEFAULT 0
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
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    store_id uuid NOT NULL REFERENCES stores(id),
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

CREATE TABLE IF NOT EXISTS opening_hours (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time text NOT NULL,
    close_time text NOT NULL,
    is_closed boolean DEFAULT false,
    UNIQUE(store_id, day_of_week)
);