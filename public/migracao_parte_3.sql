    product_id uuid NOT NULL,
    addon_group_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: products; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    description text,
    image_url text,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    section_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


-- Name: profiles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    role public.partner_role DEFAULT 'cliente'::public.partner_role NOT NULL,
    document text,
    vehicle text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    street text,
    number text,
    complement text,
    reference_point text,
    neighborhood text,
    phone text,
    pix_key text,
    pix_type public.pix_type,
    whatsapp_number text,
    email text,
    cep text,
    has_seen_onboarding boolean DEFAULT false NOT NULL,
    city text DEFAULT 'itatinga'::text,
    cnh_number text,
    cnh_front_url text,
    cnh_back_url text,
    selfie_url text,
    terms_accepted_at timestamp with time zone,
    deleted_at timestamp with time zone
);


-- Name: profile_contacts; Type: VIEW; Schema: public; Owner: -

CREATE VIEW public.profile_contacts WITH (security_invoker='true') AS
 SELECT user_id,
    full_name,
    phone,
    whatsapp_number,
    neighborhood,
    email
   FROM public.profiles
  WHERE (deleted_at IS NULL);


-- Name: refund_requests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.refund_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    store_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    reason public.refund_reason DEFAULT 'other'::public.refund_reason NOT NULL,
    description text,
    evidence_urls text[] DEFAULT '{}'::text[],
    refund_type public.refund_type DEFAULT 'wallet_credit'::public.refund_type NOT NULL,
    requested_amount numeric DEFAULT 0 NOT NULL,
    approved_amount numeric,
    status public.refund_status DEFAULT 'pending'::public.refund_status NOT NULL,
    admin_notes text,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


-- Name: saved_addresses; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.saved_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text DEFAULT 'Casa'::text NOT NULL,
    street text NOT NULL,
    number text NOT NULL,
    complement text,
    neighborhood text NOT NULL,
    reference_point text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cep text
);


-- Name: store_balances; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    pending_commission numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    repasse_pendente numeric DEFAULT 0 NOT NULL,
    comissao_pendente numeric DEFAULT 0 NOT NULL
);


-- Name: store_driver_earnings; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_driver_earnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    driver_user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    fee_total numeric DEFAULT 0 NOT NULL,
    platform_cut numeric DEFAULT 0 NOT NULL,
    driver_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    paid_at timestamp with time zone,
    paid_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    store_marked_paid_at timestamp with time zone,
    driver_confirmed_at timestamp with time zone,
    payment_mode text DEFAULT 'fim_do_dia'::text
);


-- Name: store_drivers; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    driver_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_mode text DEFAULT 'fim_do_dia'::text NOT NULL,
    CONSTRAINT store_drivers_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['instantaneo'::text, 'fim_do_dia'::text])))
);


-- Name: store_plans; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    plan_type public.store_plan_type DEFAULT 'commission_only'::public.store_plan_type NOT NULL,
    monthly_fee numeric DEFAULT 0 NOT NULL,
    commission_rate numeric DEFAULT 15 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    next_billing_date timestamp with time zone,
    last_billed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_ends_at timestamp with time zone,
    app_addon_fee numeric DEFAULT 0 NOT NULL,
    pix_operational_fee_override numeric,
    platform_delivery_split_override numeric
);


-- Name: COLUMN store_plans.pix_operational_fee_override; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.store_plans.pix_operational_fee_override IS 'NULL = use admin_settings global; numeric = override specific to this store (R$ per PIX transaction)';


-- Name: COLUMN store_plans.platform_delivery_split_override; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.store_plans.platform_delivery_split_override IS 'NULL = use admin_settings global; numeric = override specific to this store (R$ per delivery for platform)';


-- Name: store_plans_public; Type: VIEW; Schema: public; Owner: -

CREATE VIEW public.store_plans_public WITH (security_invoker='true') AS
 SELECT store_id,
    plan_type,
    is_active,
    trial_ends_at
   FROM public.store_plans;


-- Name: store_secrets; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.store_secrets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    zapi_enabled boolean DEFAULT false NOT NULL,
    zapi_instance_id text,
    zapi_token text,
    zapi_client_token text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: stores; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category public.store_category NOT NULL,
    image_url text,
    is_open boolean DEFAULT true NOT NULL,
    rating numeric(2,1) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_id uuid,
    status public.store_status DEFAULT 'analise'::public.store_status NOT NULL,
    force_closed boolean DEFAULT false NOT NULL,
    slug text,
    address_street text,
    address_number text,
    address_complement text,
    address_neighborhood text,
    address_reference text,
    address_city text DEFAULT 'Itatinga'::text,
    address_state text DEFAULT 'SP'::text,
    address_cep text,
    delivery_mode text DEFAULT 'own'::text NOT NULL,
    own_delivery_fee numeric DEFAULT 0 NOT NULL,
    asaas_account_id text,
    asaas_wallet_id text,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    commission_rate numeric DEFAULT 6 NOT NULL,
    app_enabled boolean DEFAULT false NOT NULL,
    app_subscribed boolean DEFAULT false NOT NULL,
    latitude double precision,
    longitude double precision,
    is_test boolean DEFAULT false NOT NULL,
    categories public.store_category[] DEFAULT '{}'::public.store_category[] NOT NULL,
    CONSTRAINT stores_delivery_mode_check CHECK ((delivery_mode = ANY (ARRAY['platform'::text, 'own'::text])))
);


-- Name: COLUMN stores.asaas_account_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.stores.asaas_account_id IS 'Asaas subaccount ID for split payments';


-- Name: COLUMN stores.asaas_wallet_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.stores.asaas_wallet_id IS 'Asaas wallet ID for receiving split payments';


-- Name: stores_driver_view; Type: VIEW; Schema: public; Owner: -

CREATE VIEW public.stores_driver_view WITH (security_invoker='true') AS
 SELECT id,
    name,
    slug,
    image_url,
    category,
    is_open,
    force_closed,
    status,
    delivery_mode,
    own_delivery_fee,
    address_cep,
    address_city,
    address_neighborhood,
    address_street,
    address_number,
    address_complement,
    address_reference,
    address_state,
    latitude,
    longitude
   FROM public.stores;


-- Name: stores_public; Type: VIEW; Schema: public; Owner: -

CREATE VIEW public.stores_public WITH (security_invoker='true') AS
 SELECT id,
    name,
    slug,
    image_url,
    category,
    categories,
    rating,
    is_open,
    force_closed,
    status,
    delivery_mode,
    own_delivery_fee,
    created_at,
    owner_id,
    address_cep,
    address_city,
    address_complement,
    address_neighborhood,
    address_number,
    address_reference,
    address_state,
    address_street,
    settings
   FROM public.stores s
  WHERE ((is_test = false) OR (is_test IS NULL));


-- Name: terms_acceptance; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.terms_acceptance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    terms_version text DEFAULT '1.0'::text NOT NULL,
    privacy_version text DEFAULT '1.0'::text NOT NULL,
    ip_address text,
    user_agent text,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: user_active_devices; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.user_active_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_id text NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: user_roles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


-- Name: user_wallet; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.user_wallet (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    balance numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    transaction_type public.wallet_transaction_type NOT NULL,
    reference_type text DEFAULT 'refund'::text NOT NULL,
    reference_id uuid,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: withdrawal_code_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.withdrawal_code_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS IF NOT EXISTS IF NOT EXISTS public.withdrawal_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_user_id uuid NOT NULL,
    amount numeric NOT NULL,
    pix_key text NOT NULL,
    pix_type text DEFAULT 'cpf'::text NOT NULL,
    status text DEFAULT 'solicitado'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    admin_notes text,
    transaction_code text
);


-- Name: addon_groups addon_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.addon_groups
    ADD CONSTRAINT addon_groups_pkey PRIMARY KEY (id);


-- Name: addon_items addon_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.addon_items
    ADD CONSTRAINT addon_items_pkey PRIMARY KEY (id);


-- Name: admin_settings admin_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_key_key UNIQUE (key);


-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);


-- Name: app_links app_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.app_links
    ADD CONSTRAINT app_links_pkey PRIMARY KEY (id);


-- Name: archived_accounts archived_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.archived_accounts
    ADD CONSTRAINT archived_accounts_pkey PRIMARY KEY (id);


-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


-- Name: compliance_alerts compliance_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.compliance_alerts
    ADD CONSTRAINT compliance_alerts_pkey PRIMARY KEY (id);


-- Name: coupon_uses coupon_uses_coupon_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_coupon_id_user_id_key UNIQUE (coupon_id, user_id);


-- Name: coupon_uses coupon_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_pkey PRIMARY KEY (id);


-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


-- Name: driver_balances driver_balances_driver_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.driver_balances
    ADD CONSTRAINT driver_balances_driver_user_id_key UNIQUE (driver_user_id);


-- Name: driver_balances driver_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.driver_balances
    ADD CONSTRAINT driver_balances_pkey PRIMARY KEY (id);


-- Name: driver_earnings driver_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.driver_earnings
    ADD CONSTRAINT driver_earnings_pkey PRIMARY KEY (id);


-- Name: driver_locations driver_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_pkey PRIMARY KEY (id);


-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


-- Name: drivers drivers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);


-- Name: emergency_fund emergency_fund_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.emergency_fund
    ADD CONSTRAINT emergency_fund_pkey PRIMARY KEY (id);


-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);


-- Name: fcm_tokens fcm_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_token_key UNIQUE (user_id, token);


-- Name: financial_transactions financial_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_pkey PRIMARY KEY (id);


-- Name: financial_transactions financial_transactions_reference_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_reference_code_key UNIQUE (reference_code);


-- Name: loyalty_config loyalty_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.loyalty_config
    ADD CONSTRAINT loyalty_config_pkey PRIMARY KEY (id);


-- Name: loyalty_config loyalty_config_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.loyalty_config
    ADD CONSTRAINT loyalty_config_store_id_key UNIQUE (store_id);


-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (id);


-- Name: loyalty_points loyalty_points_user_id_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_user_id_store_id_key UNIQUE (user_id, store_id);


-- Name: loyalty_points loyalty_points_user_store_unique; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_user_store_unique UNIQUE (user_id, store_id);


-- Name: menu_sections menu_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.menu_sections
    ADD CONSTRAINT menu_sections_pkey PRIMARY KEY (id);


-- Name: moderator_earnings moderator_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderator_earnings
    ADD CONSTRAINT moderator_earnings_pkey PRIMARY KEY (id);


-- Name: moderator_referrals moderator_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderator_referrals
    ADD CONSTRAINT moderator_referrals_pkey PRIMARY KEY (id);


-- Name: moderator_referrals moderator_referrals_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderator_referrals
    ADD CONSTRAINT moderator_referrals_store_id_key UNIQUE (store_id);


-- Name: moderators moderators_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderators
    ADD CONSTRAINT moderators_pkey PRIMARY KEY (id);


-- Name: moderators moderators_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderators
    ADD CONSTRAINT moderators_referral_code_key UNIQUE (referral_code);


-- Name: neighborhood_fees neighborhood_fees_name_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.neighborhood_fees
    ADD CONSTRAINT neighborhood_fees_name_key UNIQUE (name);


-- Name: neighborhood_fees neighborhood_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.neighborhood_fees
    ADD CONSTRAINT neighborhood_fees_pkey PRIMARY KEY (id);


-- Name: onesignal_players onesignal_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.onesignal_players
    ADD CONSTRAINT onesignal_players_pkey PRIMARY KEY (id);


-- Name: onesignal_players onesignal_players_user_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.onesignal_players
    ADD CONSTRAINT onesignal_players_user_id_player_id_key UNIQUE (user_id, player_id);


-- Name: opening_hours opening_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_pkey PRIMARY KEY (id);


-- Name: opening_hours opening_hours_store_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_store_id_day_of_week_key UNIQUE (store_id, day_of_week);


-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


-- Name: order_messages order_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_pkey PRIMARY KEY (id);


-- Name: order_ratings order_ratings_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.order_ratings
    ADD CONSTRAINT order_ratings_order_id_key UNIQUE (order_id);


-- Name: order_ratings order_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.order_ratings
    ADD CONSTRAINT order_ratings_pkey PRIMARY KEY (id);


-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


-- Name: partner_payouts partner_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_pkey PRIMARY KEY (id);


-- Name: payout_history payout_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.payout_history
    ADD CONSTRAINT payout_history_pkey PRIMARY KEY (id);


-- Name: pizza_borders pizza_borders_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.pizza_borders
    ADD CONSTRAINT pizza_borders_pkey PRIMARY KEY (id);


-- Name: plan_change_requests plan_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.plan_change_requests
    ADD CONSTRAINT plan_change_requests_pkey PRIMARY KEY (id);


-- Name: platform_partners platform_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.platform_partners
    ADD CONSTRAINT platform_partners_pkey PRIMARY KEY (id);


-- Name: product_addon_groups product_addon_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.product_addon_groups
    ADD CONSTRAINT product_addon_groups_pkey PRIMARY KEY (id);


-- Name: product_addon_groups product_addon_groups_product_id_addon_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.product_addon_groups
    ADD CONSTRAINT product_addon_groups_product_id_addon_group_id_key UNIQUE (product_id, addon_group_id);


-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


-- Name: refund_requests refund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_pkey PRIMARY KEY (id);


-- Name: saved_addresses saved_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.saved_addresses
    ADD CONSTRAINT saved_addresses_pkey PRIMARY KEY (id);


-- Name: store_balances store_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_balances
    ADD CONSTRAINT store_balances_pkey PRIMARY KEY (id);


-- Name: store_balances store_balances_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_balances
    ADD CONSTRAINT store_balances_store_id_key UNIQUE (store_id);


-- Name: store_driver_earnings store_driver_earnings_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_driver_earnings
    ADD CONSTRAINT store_driver_earnings_order_id_key UNIQUE (order_id);


-- Name: store_driver_earnings store_driver_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_driver_earnings
    ADD CONSTRAINT store_driver_earnings_pkey PRIMARY KEY (id);


-- Name: store_drivers store_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_drivers
    ADD CONSTRAINT store_drivers_pkey PRIMARY KEY (id);


-- Name: store_drivers store_drivers_store_id_driver_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_drivers
    ADD CONSTRAINT store_drivers_store_id_driver_user_id_key UNIQUE (store_id, driver_user_id);


-- Name: store_plans store_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_plans
    ADD CONSTRAINT store_plans_pkey PRIMARY KEY (id);


-- Name: store_plans store_plans_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_plans
    ADD CONSTRAINT store_plans_store_id_key UNIQUE (store_id);


-- Name: store_secrets store_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_secrets
    ADD CONSTRAINT store_secrets_pkey PRIMARY KEY (id);


-- Name: store_secrets store_secrets_store_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_secrets
    ADD CONSTRAINT store_secrets_store_id_key UNIQUE (store_id);


-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


-- Name: stores stores_slug_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_slug_key UNIQUE (slug);


-- Name: terms_acceptance terms_acceptance_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.terms_acceptance
    ADD CONSTRAINT terms_acceptance_pkey PRIMARY KEY (id);


-- Name: user_active_devices user_active_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_active_devices
    ADD CONSTRAINT user_active_devices_pkey PRIMARY KEY (id);


-- Name: user_active_devices user_active_devices_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_active_devices
    ADD CONSTRAINT user_active_devices_user_id_key UNIQUE (user_id);


-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


-- Name: user_wallet user_wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_wallet
    ADD CONSTRAINT user_wallet_pkey PRIMARY KEY (id);


-- Name: user_wallet user_wallet_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_wallet
    ADD CONSTRAINT user_wallet_user_id_key UNIQUE (user_id);


-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


-- Name: idx_driver_locations_driver; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON public.driver_locations USING btree (driver_user_id);


-- Name: idx_driver_locations_order; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_driver_locations_order ON public.driver_locations USING btree (order_id);


-- Name: idx_driver_locations_unique_driver; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_locations_unique_driver ON public.driver_locations USING btree (driver_user_id);


-- Name: idx_driver_locations_updated; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_driver_locations_updated ON public.driver_locations USING btree (updated_at DESC);


-- Name: idx_fcm_tokens_store_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_store_id ON public.fcm_tokens USING btree (store_id) WHERE (store_id IS NOT NULL);


-- Name: idx_financial_transactions_kind_status; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_financial_transactions_kind_status ON public.financial_transactions USING btree (transaction_kind, status);


-- Name: idx_financial_transactions_mp_payment_id; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_mp_payment_id ON public.financial_transactions USING btree (mercado_pago_payment_id) WHERE (mercado_pago_payment_id IS NOT NULL);


-- Name: idx_financial_transactions_mp_transfer_id; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_mp_transfer_id ON public.financial_transactions USING btree (mercado_pago_transfer_id) WHERE (mercado_pago_transfer_id IS NOT NULL);


-- Name: idx_financial_transactions_store_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_financial_transactions_store_id ON public.financial_transactions USING btree (store_id);


-- Name: idx_orders_assigned_driver; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON public.orders USING btree (assigned_driver_id) WHERE (assigned_driver_id IS NOT NULL);


-- Name: idx_page_views_created; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_page_views_created ON public.page_views USING btree (created_at DESC);


-- Name: idx_page_views_page_created; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_page_views_page_created ON public.page_views USING btree (page, created_at DESC);


-- Name: idx_products_store_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products USING btree (store_id);


-- Name: idx_store_driver_earnings_driver; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_store_driver_earnings_driver ON public.store_driver_earnings USING btree (driver_user_id, status);


-- Name: idx_store_driver_earnings_store; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_store_driver_earnings_store ON public.store_driver_earnings USING btree (store_id, status);


-- Name: idx_stores_categories_gin; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_stores_categories_gin ON public.stores USING gin (categories);


-- Name: idx_stores_category; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_stores_category ON public.stores USING btree (category);


-- Name: idx_stores_is_open; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_stores_is_open ON public.stores USING btree (is_open);


-- Name: idx_stores_is_test; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_stores_is_test ON public.stores USING btree (is_test) WHERE (is_test = true);


-- Name: idx_stores_slug; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_stores_slug ON public.stores USING btree (slug);


-- Name: idx_terms_acceptance_user; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user ON public.terms_acceptance USING btree (user_id);


-- Name: ux_withdrawal_requests_one_active_per_driver; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX IF NOT EXISTS ux_withdrawal_requests_one_active_per_driver ON public.withdrawal_requests USING btree (driver_user_id) WHERE (status = 'solicitado'::text);


-- Name: ux_withdrawal_requests_transaction_code; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX IF NOT EXISTS ux_withdrawal_requests_transaction_code ON public.withdrawal_requests USING btree (transaction_code) WHERE (transaction_code IS NOT NULL);


-- Name: orders award_loyalty_on_order_finalized; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS award_loyalty_on_order_finalized ON public.orders; DROP TRIGGER IF EXISTS award_loyalty_on_order_finalized ON public.orders; CREATE TRIGGER award_loyalty_on_order_finalized AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.award_loyalty_points();


-- Name: order_ratings on_rating_insert; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS on_rating_insert ON public.order_ratings; DROP TRIGGER IF EXISTS on_rating_insert ON public.order_ratings; CREATE TRIGGER on_rating_insert AFTER INSERT ON public.order_ratings FOR EACH ROW EXECUTE FUNCTION public.update_store_rating();


-- Name: profiles prevent_role_change; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS prevent_role_change ON public.profiles; DROP TRIGGER IF EXISTS prevent_role_change ON public.profiles; CREATE TRIGGER prevent_role_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();


-- Name: orders set_delivery_pin; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS set_delivery_pin ON public.orders; DROP TRIGGER IF EXISTS set_delivery_pin ON public.orders; CREATE TRIGGER set_delivery_pin BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_delivery_pin();


-- Name: withdrawal_requests set_withdrawal_code; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS set_withdrawal_code ON public.withdrawal_requests; DROP TRIGGER IF EXISTS set_withdrawal_code ON public.withdrawal_requests; CREATE TRIGGER set_withdrawal_code BEFORE INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.generate_withdrawal_code();


-- Name: driver_balances sync_driver_balances_to_external; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS sync_driver_balances_to_external ON public.driver_balances; DROP TRIGGER IF EXISTS sync_driver_balances_to_external ON public.driver_balances; CREATE TRIGGER sync_driver_balances_to_external AFTER INSERT OR UPDATE ON public.driver_balances FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: driver_earnings sync_driver_earnings_to_external; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS sync_driver_earnings_to_external ON public.driver_earnings; DROP TRIGGER IF EXISTS sync_driver_earnings_to_external ON public.driver_earnings; CREATE TRIGGER sync_driver_earnings_to_external AFTER INSERT OR UPDATE ON public.driver_earnings FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: drivers sync_drivers_to_external; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS sync_drivers_to_external ON public.drivers; DROP TRIGGER IF EXISTS sync_drivers_to_external ON public.drivers; CREATE TRIGGER sync_drivers_to_external AFTER INSERT OR UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: financial_transactions sync_financial_transactions_to_external; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS sync_financial_transactions_to_external ON public.financial_transactions; DROP TRIGGER IF EXISTS sync_financial_transactions_to_external ON public.financial_transactions; CREATE TRIGGER sync_financial_transactions_to_external AFTER INSERT OR UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: order_items sync_order_items_to_external; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS sync_order_items_to_external ON public.order_items; DROP TRIGGER IF EXISTS sync_order_items_to_external ON public.order_items; CREATE TRIGGER sync_order_items_to_external AFTER INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: order_messages sync_order_messages_to_external; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS sync_order_messages_to_external ON public.order_messages; DROP TRIGGER IF EXISTS sync_order_messages_to_external ON public.order_messages; CREATE TRIGGER sync_order_messages_to_external AFTER INSERT OR UPDATE ON public.order_messages FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: store_balances sync_store_balances_to_external; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS sync_store_balances_to_external ON public.store_balances; DROP TRIGGER IF EXISTS sync_store_balances_to_external ON public.store_balances; CREATE TRIGGER sync_store_balances_to_external AFTER INSERT OR UPDATE ON public.store_balances FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: stores sync_store_categories_trg; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS sync_store_categories_trg ON public.stores; DROP TRIGGER IF EXISTS sync_store_categories_trg ON public.stores; CREATE TRIGGER sync_store_categories_trg BEFORE INSERT OR UPDATE OF category, categories ON public.stores FOR EACH ROW EXECUTE FUNCTION public.sync_store_categories();


-- Name: orders trg_accrue_fixed_plan_split; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_accrue_fixed_plan_split ON public.orders; DROP TRIGGER IF EXISTS trg_accrue_fixed_plan_split ON public.orders; CREATE TRIGGER trg_accrue_fixed_plan_split BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.accrue_fixed_plan_split();


-- Name: orders trg_accrue_moderator_earnings; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_accrue_moderator_earnings ON public.orders; DROP TRIGGER IF EXISTS trg_accrue_moderator_earnings ON public.orders; CREATE TRIGGER trg_accrue_moderator_earnings BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.accrue_moderator_earnings();


-- Name: app_links trg_app_links_updated_at; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_app_links_updated_at ON public.app_links; DROP TRIGGER IF EXISTS trg_app_links_updated_at ON public.app_links; CREATE TRIGGER trg_app_links_updated_at BEFORE UPDATE ON public.app_links FOR EACH ROW EXECUTE FUNCTION public.set_app_links_updated_at();


-- Name: orders trg_create_store_driver_earning; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_create_store_driver_earning ON public.orders; DROP TRIGGER IF EXISTS trg_create_store_driver_earning ON public.orders; CREATE TRIGGER trg_create_store_driver_earning AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.create_store_driver_earning();


-- Name: orders trg_generate_collection_code; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_generate_collection_code ON public.orders; DROP TRIGGER IF EXISTS trg_generate_collection_code ON public.orders; CREATE TRIGGER trg_generate_collection_code BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_collection_code();


-- Name: orders trg_generate_settlement_code; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_generate_settlement_code ON public.orders; DROP TRIGGER IF EXISTS trg_generate_settlement_code ON public.orders; CREATE TRIGGER trg_generate_settlement_code BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_settlement_code();


-- Name: profiles trg_notify_admins_new_approval; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_notify_admins_new_approval ON public.profiles; DROP TRIGGER IF EXISTS trg_notify_admins_new_approval ON public.profiles; CREATE TRIGGER trg_notify_admins_new_approval AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_approval();


-- Name: orders trg_notify_order_status_zapi; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_notify_order_status_zapi ON public.orders; DROP TRIGGER IF EXISTS trg_notify_order_status_zapi ON public.orders; CREATE TRIGGER trg_notify_order_status_zapi AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_zapi();


-- Name: orders trg_order_status_chat; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_order_status_chat ON public.orders; DROP TRIGGER IF EXISTS trg_order_status_chat ON public.orders; CREATE TRIGGER trg_order_status_chat AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.insert_order_status_chat_message();


-- Name: drivers trg_prevent_driver_protected_fields; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_prevent_driver_protected_fields ON public.drivers; DROP TRIGGER IF EXISTS trg_prevent_driver_protected_fields ON public.drivers; CREATE TRIGGER trg_prevent_driver_protected_fields BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.prevent_driver_protected_fields_update();


-- Name: orders trg_sync_order_to_external; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_sync_order_to_external ON public.orders; DROP TRIGGER IF EXISTS trg_sync_order_to_external ON public.orders; CREATE TRIGGER trg_sync_order_to_external AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_sync();


-- Name: store_balances trg_sync_store_balances_legacy_fields; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_sync_store_balances_legacy_fields ON public.store_balances; DROP TRIGGER IF EXISTS trg_sync_store_balances_legacy_fields ON public.store_balances; CREATE TRIGGER trg_sync_store_balances_legacy_fields BEFORE INSERT OR UPDATE ON public.store_balances FOR EACH ROW EXECUTE FUNCTION public.sync_store_balances_legacy_fields();


-- Name: financial_transactions trg_touch_financial_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_touch_financial_transactions_updated_at ON public.financial_transactions; DROP TRIGGER IF EXISTS trg_touch_financial_transactions_updated_at ON public.financial_transactions; CREATE TRIGGER trg_touch_financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


-- Name: orders trg_validate_order_prices; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_validate_order_prices ON public.orders; DROP TRIGGER IF EXISTS trg_validate_order_prices ON public.orders; CREATE TRIGGER trg_validate_order_prices BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_prices();


-- Name: order_items trg_verify_order_subtotal; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trg_verify_order_subtotal ON public.order_items; DROP TRIGGER IF EXISTS trg_verify_order_subtotal ON public.order_items; CREATE TRIGGER trg_verify_order_subtotal AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.verify_order_subtotal();


-- Name: orders trigger_generate_collection_code; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_generate_collection_code ON public.orders; DROP TRIGGER IF EXISTS trigger_generate_collection_code ON public.orders; CREATE TRIGGER trigger_generate_collection_code BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_collection_code();


-- Name: orders trigger_generate_delivery_pin; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_generate_delivery_pin ON public.orders; DROP TRIGGER IF EXISTS trigger_generate_delivery_pin ON public.orders; CREATE TRIGGER trigger_generate_delivery_pin BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_delivery_pin();


-- Name: withdrawal_requests trigger_generate_withdrawal_code; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_generate_withdrawal_code ON public.withdrawal_requests; DROP TRIGGER IF EXISTS trigger_generate_withdrawal_code ON public.withdrawal_requests; CREATE TRIGGER trigger_generate_withdrawal_code BEFORE INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.generate_withdrawal_code();


-- Name: profiles trigger_prevent_role_self_change; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_prevent_role_self_change ON public.profiles; DROP TRIGGER IF EXISTS trigger_prevent_role_self_change ON public.profiles; CREATE TRIGGER trigger_prevent_role_self_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();


-- Name: addon_groups trigger_sync_addon_groups; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_addon_groups ON public.addon_groups; DROP TRIGGER IF EXISTS trigger_sync_addon_groups ON public.addon_groups; CREATE TRIGGER trigger_sync_addon_groups AFTER INSERT OR UPDATE ON public.addon_groups FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: addon_items trigger_sync_addon_items; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_addon_items ON public.addon_items; DROP TRIGGER IF EXISTS trigger_sync_addon_items ON public.addon_items; CREATE TRIGGER trigger_sync_addon_items AFTER INSERT OR UPDATE ON public.addon_items FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: banners trigger_sync_banners; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_banners ON public.banners; DROP TRIGGER IF EXISTS trigger_sync_banners ON public.banners; CREATE TRIGGER trigger_sync_banners AFTER INSERT OR UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: coupons trigger_sync_coupons; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_coupons ON public.coupons; DROP TRIGGER IF EXISTS trigger_sync_coupons ON public.coupons; CREATE TRIGGER trigger_sync_coupons AFTER INSERT OR UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: driver_balances trigger_sync_driver_balances; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_driver_balances ON public.driver_balances; DROP TRIGGER IF EXISTS trigger_sync_driver_balances ON public.driver_balances; CREATE TRIGGER trigger_sync_driver_balances AFTER INSERT OR UPDATE ON public.driver_balances FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: driver_earnings trigger_sync_driver_earnings; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_driver_earnings ON public.driver_earnings; DROP TRIGGER IF EXISTS trigger_sync_driver_earnings ON public.driver_earnings; CREATE TRIGGER trigger_sync_driver_earnings AFTER INSERT OR UPDATE ON public.driver_earnings FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: drivers trigger_sync_drivers; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_drivers ON public.drivers; DROP TRIGGER IF EXISTS trigger_sync_drivers ON public.drivers; CREATE TRIGGER trigger_sync_drivers AFTER INSERT OR UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: financial_transactions trigger_sync_financial_transactions; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_financial_transactions ON public.financial_transactions; DROP TRIGGER IF EXISTS trigger_sync_financial_transactions ON public.financial_transactions; CREATE TRIGGER trigger_sync_financial_transactions AFTER INSERT OR UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: menu_sections trigger_sync_menu_sections; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_menu_sections ON public.menu_sections; DROP TRIGGER IF EXISTS trigger_sync_menu_sections ON public.menu_sections; CREATE TRIGGER trigger_sync_menu_sections AFTER INSERT OR UPDATE ON public.menu_sections FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: neighborhood_fees trigger_sync_neighborhood_fees; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_neighborhood_fees ON public.neighborhood_fees; DROP TRIGGER IF EXISTS trigger_sync_neighborhood_fees ON public.neighborhood_fees; CREATE TRIGGER trigger_sync_neighborhood_fees AFTER INSERT OR UPDATE ON public.neighborhood_fees FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: opening_hours trigger_sync_opening_hours; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_opening_hours ON public.opening_hours; DROP TRIGGER IF EXISTS trigger_sync_opening_hours ON public.opening_hours; CREATE TRIGGER trigger_sync_opening_hours AFTER INSERT OR UPDATE ON public.opening_hours FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: order_items trigger_sync_order_items; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_order_items ON public.order_items; DROP TRIGGER IF EXISTS trigger_sync_order_items ON public.order_items; CREATE TRIGGER trigger_sync_order_items AFTER INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: order_messages trigger_sync_order_messages; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_order_messages ON public.order_messages; DROP TRIGGER IF EXISTS trigger_sync_order_messages ON public.order_messages; CREATE TRIGGER trigger_sync_order_messages AFTER INSERT OR UPDATE ON public.order_messages FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: orders trigger_sync_orders; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_orders ON public.orders; DROP TRIGGER IF EXISTS trigger_sync_orders ON public.orders; CREATE TRIGGER trigger_sync_orders AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: product_addon_groups trigger_sync_product_addon_groups; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_product_addon_groups ON public.product_addon_groups; DROP TRIGGER IF EXISTS trigger_sync_product_addon_groups ON public.product_addon_groups; CREATE TRIGGER trigger_sync_product_addon_groups AFTER INSERT OR UPDATE ON public.product_addon_groups FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: products trigger_sync_products; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_products ON public.products; DROP TRIGGER IF EXISTS trigger_sync_products ON public.products; CREATE TRIGGER trigger_sync_products AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: profiles trigger_sync_profiles; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_profiles ON public.profiles; DROP TRIGGER IF EXISTS trigger_sync_profiles ON public.profiles; CREATE TRIGGER trigger_sync_profiles AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: store_balances trigger_sync_store_balances; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_store_balances ON public.store_balances; DROP TRIGGER IF EXISTS trigger_sync_store_balances ON public.store_balances; CREATE TRIGGER trigger_sync_store_balances AFTER INSERT OR UPDATE ON public.store_balances FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: store_balances trigger_sync_store_balances_legacy; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_store_balances_legacy ON public.store_balances; DROP TRIGGER IF EXISTS trigger_sync_store_balances_legacy ON public.store_balances; CREATE TRIGGER trigger_sync_store_balances_legacy BEFORE INSERT OR UPDATE ON public.store_balances FOR EACH ROW EXECUTE FUNCTION public.sync_store_balances_legacy_fields();


-- Name: stores trigger_sync_stores; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_stores ON public.stores; DROP TRIGGER IF EXISTS trigger_sync_stores ON public.stores; CREATE TRIGGER trigger_sync_stores AFTER INSERT OR UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: withdrawal_requests trigger_sync_withdrawal_requests; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_sync_withdrawal_requests ON public.withdrawal_requests; DROP TRIGGER IF EXISTS trigger_sync_withdrawal_requests ON public.withdrawal_requests; CREATE TRIGGER trigger_sync_withdrawal_requests AFTER INSERT OR UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.notify_record_sync();


-- Name: financial_transactions trigger_touch_financial_updated_at; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_touch_financial_updated_at ON public.financial_transactions; DROP TRIGGER IF EXISTS trigger_touch_financial_updated_at ON public.financial_transactions; CREATE TRIGGER trigger_touch_financial_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


-- Name: order_ratings trigger_update_store_rating; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS trigger_update_store_rating ON public.order_ratings; DROP TRIGGER IF EXISTS trigger_update_store_rating ON public.order_ratings; CREATE TRIGGER trigger_update_store_rating AFTER INSERT ON public.order_ratings FOR EACH ROW EXECUTE FUNCTION public.update_store_rating();


-- Name: moderators update_moderators_updated_at; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS update_moderators_updated_at ON public.moderators; DROP TRIGGER IF EXISTS update_moderators_updated_at ON public.moderators; CREATE TRIGGER update_moderators_updated_at BEFORE UPDATE ON public.moderators FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


-- Name: platform_partners update_platform_partners_updated_at; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS update_platform_partners_updated_at ON public.platform_partners; DROP TRIGGER IF EXISTS update_platform_partners_updated_at ON public.platform_partners; CREATE TRIGGER update_platform_partners_updated_at BEFORE UPDATE ON public.platform_partners FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


-- Name: store_plans update_store_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS update_store_plans_updated_at ON public.store_plans; DROP TRIGGER IF EXISTS update_store_plans_updated_at ON public.store_plans; CREATE TRIGGER update_store_plans_updated_at BEFORE UPDATE ON public.store_plans FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


-- Name: store_secrets update_store_secrets_updated_at; Type: TRIGGER; Schema: public; Owner: -

DROP TRIGGER IF EXISTS update_store_secrets_updated_at ON public.store_secrets; DROP TRIGGER IF EXISTS update_store_secrets_updated_at ON public.store_secrets; CREATE TRIGGER update_store_secrets_updated_at BEFORE UPDATE ON public.store_secrets FOR EACH ROW EXECUTE FUNCTION public.touch_financial_transactions_updated_at();


-- Name: addon_groups addon_groups_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.addon_groups
    ADD CONSTRAINT addon_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


-- Name: addon_items addon_items_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.addon_items
    ADD CONSTRAINT addon_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.addon_groups(id) ON DELETE CASCADE;


-- Name: banners banners_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: compliance_alerts compliance_alerts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.compliance_alerts
    ADD CONSTRAINT compliance_alerts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: coupon_uses coupon_uses_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;


-- Name: coupons coupons_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: driver_locations driver_locations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- Name: emergency_fund emergency_fund_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.emergency_fund
    ADD CONSTRAINT emergency_fund_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.platform_partners(id);


-- Name: fcm_tokens fcm_tokens_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


-- Name: financial_transactions financial_transactions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.financial_transactions
    ADD CONSTRAINT financial_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: loyalty_config loyalty_config_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.loyalty_config
    ADD CONSTRAINT loyalty_config_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: loyalty_points loyalty_points_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: menu_sections menu_sections_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.menu_sections
    ADD CONSTRAINT menu_sections_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: moderator_earnings moderator_earnings_moderator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderator_earnings
    ADD CONSTRAINT moderator_earnings_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.moderators(id) ON DELETE CASCADE;


-- Name: moderator_earnings moderator_earnings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderator_earnings
    ADD CONSTRAINT moderator_earnings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


-- Name: moderator_earnings moderator_earnings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderator_earnings
    ADD CONSTRAINT moderator_earnings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: moderator_referrals moderator_referrals_moderator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderator_referrals
    ADD CONSTRAINT moderator_referrals_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES public.moderators(id) ON DELETE CASCADE;


-- Name: moderator_referrals moderator_referrals_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderator_referrals
    ADD CONSTRAINT moderator_referrals_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: moderators moderators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.moderators
    ADD CONSTRAINT moderators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- Name: opening_hours opening_hours_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


-- Name: order_messages order_messages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.order_messages
    ADD CONSTRAINT order_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


-- Name: orders orders_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- Name: orders orders_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- Name: orders orders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


-- Name: partner_payouts partner_payouts_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.platform_partners(id);


-- Name: pizza_borders pizza_borders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.pizza_borders
    ADD CONSTRAINT pizza_borders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: plan_change_requests plan_change_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.plan_change_requests
    ADD CONSTRAINT plan_change_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: product_addon_groups product_addon_groups_addon_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.product_addon_groups
    ADD CONSTRAINT product_addon_groups_addon_group_id_fkey FOREIGN KEY (addon_group_id) REFERENCES public.addon_groups(id) ON DELETE CASCADE;


-- Name: product_addon_groups product_addon_groups_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.product_addon_groups
    ADD CONSTRAINT product_addon_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


-- Name: products products_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.menu_sections(id) ON DELETE SET NULL;


-- Name: products products_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- Name: refund_requests refund_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


-- Name: refund_requests refund_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


-- Name: store_driver_earnings store_driver_earnings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_driver_earnings
    ADD CONSTRAINT store_driver_earnings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


-- Name: store_driver_earnings store_driver_earnings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_driver_earnings
    ADD CONSTRAINT store_driver_earnings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: store_drivers store_drivers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_drivers
    ADD CONSTRAINT store_drivers_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: store_plans store_plans_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_plans
    ADD CONSTRAINT store_plans_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: store_secrets store_secrets_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.store_secrets
    ADD CONSTRAINT store_secrets_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


-- Name: stores stores_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- Name: terms_acceptance terms_acceptance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.terms_acceptance
    ADD CONSTRAINT terms_acceptance_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- Name: admin_settings Admin can delete settings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Admin can delete settings" ON public.admin_settings FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: withdrawal_requests Admin can delete withdrawal requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Admin can delete withdrawal requests" ON public.withdrawal_requests FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: archived_accounts Admin can insert archived accounts; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert archived accounts' AND tablename = 'archived_accounts') THEN
        CREATE POLICY "Admin can insert archived accounts" ON public.archived_accounts FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: admin_settings Admin can insert settings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Admin can insert settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: loyalty_config Admin can manage all config; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all config' AND tablename = 'loyalty_config') THEN
        CREATE POLICY "Admin can manage all config" ON public.loyalty_config TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: coupons Admin can manage all coupons; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all coupons' AND tablename = 'coupons') THEN
        CREATE POLICY "Admin can manage all coupons" ON public.coupons TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: plan_change_requests Admin can manage all plan requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all plan requests' AND tablename = 'plan_change_requests') THEN
        CREATE POLICY "Admin can manage all plan requests" ON public.plan_change_requests TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: store_plans Admin can manage all store plans; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all store plans' AND tablename = 'store_plans') THEN
        CREATE POLICY "Admin can manage all store plans" ON public.store_plans TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: compliance_alerts Admin can manage compliance alerts; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage compliance alerts' AND tablename = 'compliance_alerts') THEN
        CREATE POLICY "Admin can manage compliance alerts" ON public.compliance_alerts TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: payout_history Admin can manage payout history; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage payout history' AND tablename = 'payout_history') THEN
        CREATE POLICY "Admin can manage payout history" ON public.payout_history TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: coupon_uses Admin can read all coupon uses; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all coupon uses' AND tablename = 'coupon_uses') THEN
        CREATE POLICY "Admin can read all coupon uses" ON public.coupon_uses FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: driver_balances Admin can read all driver balances; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all driver balances' AND tablename = 'driver_balances') THEN
        CREATE POLICY "Admin can read all driver balances" ON public.driver_balances FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: driver_earnings Admin can read all driver earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all driver earnings' AND tablename = 'driver_earnings') THEN
        CREATE POLICY "Admin can read all driver earnings" ON public.driver_earnings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: fcm_tokens Admin can read all fcm tokens; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all fcm tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Admin can read all fcm tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: order_ratings Admin can read all ratings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all ratings' AND tablename = 'order_ratings') THEN
        CREATE POLICY "Admin can read all ratings" ON public.order_ratings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: terms_acceptance Admin can read all terms acceptance; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all terms acceptance' AND tablename = 'terms_acceptance') THEN
        CREATE POLICY "Admin can read all terms acceptance" ON public.terms_acceptance FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: withdrawal_requests Admin can read all withdrawal requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Admin can read all withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: archived_accounts Admin can read archived accounts; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read archived accounts' AND tablename = 'archived_accounts') THEN
        CREATE POLICY "Admin can read archived accounts" ON public.archived_accounts FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: admin_settings Admin can read settings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Admin can read settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: driver_balances Admin can update driver balances; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update driver balances' AND tablename = 'driver_balances') THEN
        CREATE POLICY "Admin can update driver balances" ON public.driver_balances FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: driver_earnings Admin can update driver earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update driver earnings' AND tablename = 'driver_earnings') THEN
        CREATE POLICY "Admin can update driver earnings" ON public.driver_earnings FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: admin_settings Admin can update settings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Admin can update settings" ON public.admin_settings FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: withdrawal_requests Admin can update withdrawal requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Admin can update withdrawal requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: store_drivers Admin full access store drivers; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access store drivers' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Admin full access store drivers" ON public.store_drivers TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: store_driver_earnings Admin manage store driver earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage store driver earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Admin manage store driver earnings" ON public.store_driver_earnings TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;
END $$;


-- Name: drivers Admins and store owners can read online drivers; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins and store owners can read online drivers' AND tablename = 'drivers') THEN
        CREATE POLICY "Admins and store owners can read online drivers" ON public.drivers FOR SELECT TO authenticated USING ((public.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))));
--     END IF;
END $$;


-- Name: moderator_earnings Admins can manage earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage earnings' AND tablename = 'moderator_earnings') THEN
        CREATE POLICY "Admins can manage earnings" ON public.moderator_earnings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
--     END IF;
END $$;


-- Name: emergency_fund Admins can manage emergency fund; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
--     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage emergency fund' AND tablename = 'emergency_fund') THEN
        CREATE POLICY "Admins can manage emergency fund" ON public.emergency_fund TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
--     END IF;