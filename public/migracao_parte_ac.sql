
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

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Admin can delete settings" ON public.admin_settings FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: withdrawal_requests Admin can delete withdrawal requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Admin can delete withdrawal requests" ON public.withdrawal_requests FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: archived_accounts Admin can insert archived accounts; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert archived accounts' AND tablename = 'archived_accounts') THEN
        CREATE POLICY "Admin can insert archived accounts" ON public.archived_accounts FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: admin_settings Admin can insert settings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Admin can insert settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: loyalty_config Admin can manage all config; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all config' AND tablename = 'loyalty_config') THEN
        CREATE POLICY "Admin can manage all config" ON public.loyalty_config TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: coupons Admin can manage all coupons; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all coupons' AND tablename = 'coupons') THEN
        CREATE POLICY "Admin can manage all coupons" ON public.coupons TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: plan_change_requests Admin can manage all plan requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all plan requests' AND tablename = 'plan_change_requests') THEN
        CREATE POLICY "Admin can manage all plan requests" ON public.plan_change_requests TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: store_plans Admin can manage all store plans; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all store plans' AND tablename = 'store_plans') THEN
        CREATE POLICY "Admin can manage all store plans" ON public.store_plans TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: compliance_alerts Admin can manage compliance alerts; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage compliance alerts' AND tablename = 'compliance_alerts') THEN
        CREATE POLICY "Admin can manage compliance alerts" ON public.compliance_alerts TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: payout_history Admin can manage payout history; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage payout history' AND tablename = 'payout_history') THEN
        CREATE POLICY "Admin can manage payout history" ON public.payout_history TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: coupon_uses Admin can read all coupon uses; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all coupon uses' AND tablename = 'coupon_uses') THEN
        CREATE POLICY "Admin can read all coupon uses" ON public.coupon_uses FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: driver_balances Admin can read all driver balances; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all driver balances' AND tablename = 'driver_balances') THEN
        CREATE POLICY "Admin can read all driver balances" ON public.driver_balances FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: driver_earnings Admin can read all driver earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all driver earnings' AND tablename = 'driver_earnings') THEN
        CREATE POLICY "Admin can read all driver earnings" ON public.driver_earnings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: fcm_tokens Admin can read all fcm tokens; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all fcm tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Admin can read all fcm tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: order_ratings Admin can read all ratings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all ratings' AND tablename = 'order_ratings') THEN
        CREATE POLICY "Admin can read all ratings" ON public.order_ratings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: terms_acceptance Admin can read all terms acceptance; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all terms acceptance' AND tablename = 'terms_acceptance') THEN
        CREATE POLICY "Admin can read all terms acceptance" ON public.terms_acceptance FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: withdrawal_requests Admin can read all withdrawal requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read all withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Admin can read all withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: archived_accounts Admin can read archived accounts; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read archived accounts' AND tablename = 'archived_accounts') THEN
        CREATE POLICY "Admin can read archived accounts" ON public.archived_accounts FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: admin_settings Admin can read settings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Admin can read settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: driver_balances Admin can update driver balances; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update driver balances' AND tablename = 'driver_balances') THEN
        CREATE POLICY "Admin can update driver balances" ON public.driver_balances FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: driver_earnings Admin can update driver earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update driver earnings' AND tablename = 'driver_earnings') THEN
        CREATE POLICY "Admin can update driver earnings" ON public.driver_earnings FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: admin_settings Admin can update settings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Admin can update settings" ON public.admin_settings FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: withdrawal_requests Admin can update withdrawal requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Admin can update withdrawal requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: store_drivers Admin full access store drivers; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access store drivers' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Admin full access store drivers" ON public.store_drivers TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: store_driver_earnings Admin manage store driver earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manage store driver earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Admin manage store driver earnings" ON public.store_driver_earnings TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: drivers Admins and store owners can read online drivers; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins and store owners can read online drivers' AND tablename = 'drivers') THEN
        CREATE POLICY "Admins and store owners can read online drivers" ON public.drivers FOR SELECT TO authenticated USING ((public.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))));
    END IF;
-- END


-- Name: moderator_earnings Admins can manage earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage earnings' AND tablename = 'moderator_earnings') THEN
        CREATE POLICY "Admins can manage earnings" ON public.moderator_earnings TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    END IF;
-- END


-- Name: emergency_fund Admins can manage emergency fund; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage emergency fund' AND tablename = 'emergency_fund') THEN
        CREATE POLICY "Admins can manage emergency fund" ON public.emergency_fund TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: moderators Admins can manage moderators; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage moderators' AND tablename = 'moderators') THEN
        CREATE POLICY "Admins can manage moderators" ON public.moderators TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    END IF;
-- END


-- Name: partner_payouts Admins can manage partner payouts; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage partner payouts' AND tablename = 'partner_payouts') THEN
        CREATE POLICY "Admins can manage partner payouts" ON public.partner_payouts TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: platform_partners Admins can manage partners; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage partners' AND tablename = 'platform_partners') THEN
        CREATE POLICY "Admins can manage partners" ON public.platform_partners TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: moderator_referrals Admins can manage referrals; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage referrals' AND tablename = 'moderator_referrals') THEN
        CREATE POLICY "Admins can manage referrals" ON public.moderator_referrals TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    END IF;
-- END


-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    END IF;
-- END


-- Name: driver_locations Admins can read all locations; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all locations' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Admins can read all locations" ON public.driver_locations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    END IF;
-- END


-- Name: user_roles Admins can read all roles; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
    END IF;
-- END


-- Name: page_views Admins can read page views; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read page views' AND tablename = 'page_views') THEN
        CREATE POLICY "Admins can read page views" ON public.page_views FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: refund_requests Admins can update all refund requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update all refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Admins can update all refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: refund_requests Admins can view all refund requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Admins can view all refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: wallet_transactions Admins can view all wallet transactions; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all wallet transactions' AND tablename = 'wallet_transactions') THEN
        CREATE POLICY "Admins can view all wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: user_wallet Admins can view all wallets; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all wallets' AND tablename = 'user_wallet') THEN
        CREATE POLICY "Admins can view all wallets" ON public.user_wallet FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: app_links Anyone can read active app_links; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active app_links' AND tablename = 'app_links') THEN
        CREATE POLICY "Anyone can read active app_links" ON public.app_links FOR SELECT USING ((is_active = true));
    END IF;
-- END


-- Name: banners Anyone can read active banners; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active banners' AND tablename = 'banners') THEN
        CREATE POLICY "Anyone can read active banners" ON public.banners FOR SELECT USING ((is_active = true));
    END IF;
-- END


-- Name: addon_groups Anyone can read addon groups; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Anyone can read addon groups" ON public.addon_groups FOR SELECT USING (true);
    END IF;
-- END


-- Name: addon_items Anyone can read addon items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Anyone can read addon items" ON public.addon_items FOR SELECT USING (true);
    END IF;
-- END


-- Name: loyalty_config Anyone can read loyalty config; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read loyalty config' AND tablename = 'loyalty_config') THEN
        CREATE POLICY "Anyone can read loyalty config" ON public.loyalty_config FOR SELECT USING (true);
    END IF;
-- END


-- Name: menu_sections Anyone can read menu sections; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Anyone can read menu sections" ON public.menu_sections FOR SELECT USING (true);
    END IF;
-- END


-- Name: neighborhood_fees Anyone can read neighborhood_fees; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read neighborhood_fees' AND tablename = 'neighborhood_fees') THEN
        CREATE POLICY "Anyone can read neighborhood_fees" ON public.neighborhood_fees FOR SELECT USING (true);
    END IF;
-- END


-- Name: opening_hours Anyone can read opening hours; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read opening hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Anyone can read opening hours" ON public.opening_hours FOR SELECT USING (true);
    END IF;
-- END


-- Name: pizza_borders Anyone can read pizza borders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read pizza borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Anyone can read pizza borders" ON public.pizza_borders FOR SELECT USING (true);
    END IF;
-- END


-- Name: product_addon_groups Anyone can read product addon links; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read product addon links' AND tablename = 'product_addon_groups') THEN
        CREATE POLICY "Anyone can read product addon links" ON public.product_addon_groups FOR SELECT USING (true);
    END IF;
-- END


-- Name: products Anyone can read products; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read products' AND tablename = 'products') THEN
        CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);
    END IF;
-- END


-- Name: admin_settings Anyone can read public settings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read public settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Anyone can read public settings" ON public.admin_settings FOR SELECT USING ((key = ANY (ARRAY['delivery_fee_config'::text, 'min_payout_amount'::text])));
    END IF;
-- END


-- Name: page_views Anyone can record page view; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can record page view' AND tablename = 'page_views') THEN
        CREATE POLICY "Anyone can record page view" ON public.page_views FOR INSERT TO authenticated, anon WITH CHECK ((((auth.uid() IS NULL) AND (user_id IS NULL)) OR ((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (user_id IS NULL)))));
    END IF;
-- END


-- Name: refund_requests Clients can create refund requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can create refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Clients can create refund requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (((requester_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = refund_requests.order_id) AND (orders.client_id = auth.uid()))))));
    END IF;
-- END


-- Name: orders Clients can hide own completed orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can hide own completed orders' AND tablename = 'orders') THEN
        CREATE POLICY "Clients can hide own completed orders" ON public.orders FOR UPDATE TO authenticated USING (((client_id = auth.uid()) AND (status = ANY (ARRAY['entregue'::public.order_status, 'finalizado'::public.order_status, 'cancelado'::public.order_status])))) WITH CHECK (((client_id = auth.uid()) AND (status = ANY (ARRAY['entregue'::public.order_status, 'finalizado'::public.order_status, 'cancelado'::public.order_status]))));
    END IF;
-- END


-- Name: order_items Clients can insert own order items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can insert own order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Clients can insert own order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.client_id = auth.uid())))));
    END IF;
-- END


-- Name: orders Clients can insert own orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can insert own orders' AND tablename = 'orders') THEN
        CREATE POLICY "Clients can insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK ((client_id = auth.uid()));
    END IF;
-- END


-- Name: driver_locations Clients can read driver location for their orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read driver location for their orders' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Clients can read driver location for their orders" ON public.driver_locations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.driver_id = driver_locations.driver_user_id) AND (o.client_id = auth.uid()) AND (o.status = ANY (ARRAY['em_transito'::public.order_status, 'saiu_entrega'::public.order_status]))))));
    END IF;
-- END


-- Name: order_items Clients can read own order items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read own order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Clients can read own order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.client_id = auth.uid())))));
    END IF;
-- END


-- Name: orders Clients can read own orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read own orders' AND tablename = 'orders') THEN
        CREATE POLICY "Clients can read own orders" ON public.orders FOR SELECT TO authenticated USING ((client_id = auth.uid()));
    END IF;
-- END


-- Name: orders Clients can update own orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can update own orders' AND tablename = 'orders') THEN
        CREATE POLICY "Clients can update own orders" ON public.orders FOR UPDATE TO authenticated USING (((client_id = auth.uid()) AND (status = 'aguardando_pagamento'::public.order_status))) WITH CHECK (((client_id = auth.uid()) AND (status = 'cancelado'::public.order_status)));
    END IF;
-- END


-- Name: refund_requests Clients can view own refund requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Clients can view own refund requests" ON public.refund_requests FOR SELECT TO authenticated USING ((requester_id = auth.uid()));
    END IF;
-- END


-- Name: store_driver_earnings Drivers can confirm own earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can confirm own earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Drivers can confirm own earnings" ON public.store_driver_earnings FOR UPDATE TO authenticated USING ((driver_user_id = auth.uid())) WITH CHECK ((driver_user_id = auth.uid()));
    END IF;
-- END


-- Name: withdrawal_requests Drivers can create withdrawal requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can create withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Drivers can create withdrawal requests" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK ((driver_user_id = auth.uid()));
    END IF;
-- END


-- Name: driver_locations Drivers can insert own location; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can insert own location' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Drivers can insert own location" ON public.driver_locations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = driver_user_id));
    END IF;
-- END


-- Name: order_messages Drivers can read messages for assigned orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read messages for assigned orders' AND tablename = 'order_messages') THEN
        CREATE POLICY "Drivers can read messages for assigned orders" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND (o.driver_id = auth.uid())))));
    END IF;
-- END


-- Name: driver_balances Drivers can read own balance; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own balance' AND tablename = 'driver_balances') THEN
        CREATE POLICY "Drivers can read own balance" ON public.driver_balances FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
    END IF;
-- END


-- Name: driver_earnings Drivers can read own earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own earnings' AND tablename = 'driver_earnings') THEN
        CREATE POLICY "Drivers can read own earnings" ON public.driver_earnings FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
    END IF;
-- END


-- Name: driver_locations Drivers can read own location; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own location' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Drivers can read own location" ON public.driver_locations FOR SELECT TO authenticated USING ((auth.uid() = driver_user_id));
    END IF;
-- END


-- Name: drivers Drivers can read own record; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own record' AND tablename = 'drivers') THEN
        CREATE POLICY "Drivers can read own record" ON public.drivers FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: store_drivers Drivers can read own store links; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own store links' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Drivers can read own store links" ON public.store_drivers FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
    END IF;
-- END


-- Name: withdrawal_requests Drivers can read own withdrawal requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Drivers can read own withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
    END IF;
-- END


-- Name: orders Drivers can see ready orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can see ready orders' AND tablename = 'orders') THEN
        CREATE POLICY "Drivers can see ready orders" ON public.orders FOR SELECT TO authenticated USING ((public.is_driver(auth.uid()) AND (((status = 'pronto_para_entrega'::public.order_status) AND (driver_id IS NULL) AND (store_id IN ( SELECT s.id
   FROM public.stores s
  WHERE ((COALESCE(s.address_city, 'itatinga'::text) = ( SELECT COALESCE(d.city, 'itatinga'::text) AS "coalesce"
           FROM public.drivers d
          WHERE (d.user_id = auth.uid()))) AND (COALESCE(s.delivery_mode, 'platform'::text) = 'platform'::text))))) OR (driver_id = auth.uid()))));
    END IF;
-- END


-- Name: order_messages Drivers can send messages on assigned orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can send messages on assigned orders' AND tablename = 'order_messages') THEN
        CREATE POLICY "Drivers can send messages on assigned orders" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND (o.driver_id = auth.uid()))))));
    END IF;
-- END


-- Name: driver_locations Drivers can update own location; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can update own location' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Drivers can update own location" ON public.driver_locations FOR UPDATE TO authenticated USING ((auth.uid() = driver_user_id));
    END IF;
-- END


-- Name: drivers Drivers can update own online status; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can update own online status' AND tablename = 'drivers') THEN
        CREATE POLICY "Drivers can update own online status" ON public.drivers FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: store_driver_earnings Drivers see own store earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers see own store earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Drivers see own store earnings" ON public.store_driver_earnings FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
    END IF;
-- END


-- Name: moderator_earnings Moderators can view own earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Moderators can view own earnings' AND tablename = 'moderator_earnings') THEN
        CREATE POLICY "Moderators can view own earnings" ON public.moderator_earnings FOR SELECT TO authenticated USING ((moderator_id IN ( SELECT moderators.id
   FROM public.moderators
  WHERE (moderators.user_id = auth.uid()))));
    END IF;
-- END


-- Name: moderators Moderators can view own record; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Moderators can view own record' AND tablename = 'moderators') THEN
        CREATE POLICY "Moderators can view own record" ON public.moderators FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: moderator_referrals Moderators can view own referrals; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Moderators can view own referrals' AND tablename = 'moderator_referrals') THEN
        CREATE POLICY "Moderators can view own referrals" ON public.moderator_referrals FOR SELECT TO authenticated USING ((moderator_id IN ( SELECT moderators.id
   FROM public.moderators
  WHERE (moderators.user_id = auth.uid()))));
    END IF;
-- END


-- Name: drivers No direct driver delete; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'No direct driver delete' AND tablename = 'drivers') THEN
        CREATE POLICY "No direct driver delete" ON public.drivers FOR DELETE TO authenticated USING (false);
    END IF;
-- END


-- Name: drivers No direct driver insert; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'No direct driver insert' AND tablename = 'drivers') THEN
        CREATE POLICY "No direct driver insert" ON public.drivers FOR INSERT TO authenticated WITH CHECK (false);
    END IF;
-- END


-- Name: order_messages Order participants can read messages; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Order participants can read messages' AND tablename = 'order_messages') THEN
        CREATE POLICY "Order participants can read messages" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND ((o.client_id = auth.uid()) OR (o.store_id IN ( SELECT s.id
           FROM public.stores s
          WHERE (s.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid()))))));
    END IF;
-- END


-- Name: order_messages Order participants can send messages; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Order participants can send messages' AND tablename = 'order_messages') THEN
        CREATE POLICY "Order participants can send messages" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND ((o.client_id = auth.uid()) OR (o.store_id IN ( SELECT s.id
           FROM public.stores s
          WHERE (s.owner_id = auth.uid())))))))));
    END IF;
-- END


-- Name: addon_groups Platform admin can delete addon groups; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Platform admin can delete addon groups" ON public.addon_groups FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: addon_items Platform admin can delete addon items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Platform admin can delete addon items" ON public.addon_items FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: financial_transactions Platform admin can delete financial transactions; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Platform admin can delete financial transactions" ON public.financial_transactions FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: menu_sections Platform admin can delete menu sections; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Platform admin can delete menu sections" ON public.menu_sections FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: opening_hours Platform admin can delete opening hours; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete opening hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Platform admin can delete opening hours" ON public.opening_hours FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: product_addon_groups Platform admin can delete product addon links; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete product addon links' AND tablename = 'product_addon_groups') THEN
        CREATE POLICY "Platform admin can delete product addon links" ON public.product_addon_groups FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: products Platform admin can delete products; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete products' AND tablename = 'products') THEN
        CREATE POLICY "Platform admin can delete products" ON public.products FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: stores Platform admin can delete stores; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete stores' AND tablename = 'stores') THEN
        CREATE POLICY "Platform admin can delete stores" ON public.stores FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END

