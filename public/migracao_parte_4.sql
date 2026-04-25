
-- Name: moderator_referrals Admins can manage referrals; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage referrals' AND tablename = 'moderator_referrals') THEN
        CREATE POLICY "Admins can manage referrals" ON public.moderator_referrals TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
END $$;


-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
END $$;


-- Name: driver_locations Admins can read all locations; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all locations' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Admins can read all locations" ON public.driver_locations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
END $$;


-- Name: user_roles Admins can read all roles; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
END $$;


-- Name: page_views Admins can read page views; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read page views' AND tablename = 'page_views') THEN
        CREATE POLICY "Admins can read page views" ON public.page_views FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: refund_requests Admins can update all refund requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update all refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Admins can update all refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: refund_requests Admins can view all refund requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Admins can view all refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: wallet_transactions Admins can view all wallet transactions; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all wallet transactions' AND tablename = 'wallet_transactions') THEN
        CREATE POLICY "Admins can view all wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: user_wallet Admins can view all wallets; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all wallets' AND tablename = 'user_wallet') THEN
        CREATE POLICY "Admins can view all wallets" ON public.user_wallet FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: app_links Anyone can read active app_links; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active app_links' AND tablename = 'app_links') THEN
        CREATE POLICY "Anyone can read active app_links" ON public.app_links FOR SELECT USING ((is_active = true));
END $$;


-- Name: banners Anyone can read active banners; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active banners' AND tablename = 'banners') THEN
        CREATE POLICY "Anyone can read active banners" ON public.banners FOR SELECT USING ((is_active = true));
END $$;


-- Name: addon_groups Anyone can read addon groups; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Anyone can read addon groups" ON public.addon_groups FOR SELECT USING (true);
END $$;


-- Name: addon_items Anyone can read addon items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Anyone can read addon items" ON public.addon_items FOR SELECT USING (true);
END $$;


-- Name: loyalty_config Anyone can read loyalty config; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read loyalty config' AND tablename = 'loyalty_config') THEN
        CREATE POLICY "Anyone can read loyalty config" ON public.loyalty_config FOR SELECT USING (true);
END $$;


-- Name: menu_sections Anyone can read menu sections; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Anyone can read menu sections" ON public.menu_sections FOR SELECT USING (true);
END $$;


-- Name: neighborhood_fees Anyone can read neighborhood_fees; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read neighborhood_fees' AND tablename = 'neighborhood_fees') THEN
        CREATE POLICY "Anyone can read neighborhood_fees" ON public.neighborhood_fees FOR SELECT USING (true);
END $$;


-- Name: opening_hours Anyone can read opening hours; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read opening hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Anyone can read opening hours" ON public.opening_hours FOR SELECT USING (true);
END $$;


-- Name: pizza_borders Anyone can read pizza borders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read pizza borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Anyone can read pizza borders" ON public.pizza_borders FOR SELECT USING (true);
END $$;


-- Name: product_addon_groups Anyone can read product addon links; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read product addon links' AND tablename = 'product_addon_groups') THEN
        CREATE POLICY "Anyone can read product addon links" ON public.product_addon_groups FOR SELECT USING (true);
END $$;


-- Name: products Anyone can read products; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read products' AND tablename = 'products') THEN
        CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);
END $$;


-- Name: admin_settings Anyone can read public settings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read public settings' AND tablename = 'admin_settings') THEN
        CREATE POLICY "Anyone can read public settings" ON public.admin_settings FOR SELECT USING ((key = ANY (ARRAY['delivery_fee_config'::text, 'min_payout_amount'::text])));
END $$;


-- Name: page_views Anyone can record page view; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can record page view' AND tablename = 'page_views') THEN
        CREATE POLICY "Anyone can record page view" ON public.page_views FOR INSERT TO authenticated, anon WITH CHECK ((((auth.uid() IS NULL) AND (user_id IS NULL)) OR ((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (user_id IS NULL)))));
END $$;


-- Name: refund_requests Clients can create refund requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can create refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Clients can create refund requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (((requester_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = refund_requests.order_id) AND (orders.client_id = auth.uid()))))));
END $$;


-- Name: orders Clients can hide own completed orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can hide own completed orders' AND tablename = 'orders') THEN
        CREATE POLICY "Clients can hide own completed orders" ON public.orders FOR UPDATE TO authenticated USING (((client_id = auth.uid()) AND (status = ANY (ARRAY['entregue'::public.order_status, 'finalizado'::public.order_status, 'cancelado'::public.order_status])))) WITH CHECK (((client_id = auth.uid()) AND (status = ANY (ARRAY['entregue'::public.order_status, 'finalizado'::public.order_status, 'cancelado'::public.order_status]))));
END $$;


-- Name: order_items Clients can insert own order items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can insert own order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Clients can insert own order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.client_id = auth.uid())))));
END $$;


-- Name: orders Clients can insert own orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can insert own orders' AND tablename = 'orders') THEN
        CREATE POLICY "Clients can insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK ((client_id = auth.uid()));
END $$;


-- Name: driver_locations Clients can read driver location for their orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read driver location for their orders' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Clients can read driver location for their orders" ON public.driver_locations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.driver_id = driver_locations.driver_user_id) AND (o.client_id = auth.uid()) AND (o.status = ANY (ARRAY['em_transito'::public.order_status, 'saiu_entrega'::public.order_status]))))));
END $$;


-- Name: order_items Clients can read own order items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read own order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Clients can read own order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.client_id = auth.uid())))));
END $$;


-- Name: orders Clients can read own orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can read own orders' AND tablename = 'orders') THEN
        CREATE POLICY "Clients can read own orders" ON public.orders FOR SELECT TO authenticated USING ((client_id = auth.uid()));
END $$;


-- Name: orders Clients can update own orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can update own orders' AND tablename = 'orders') THEN
        CREATE POLICY "Clients can update own orders" ON public.orders FOR UPDATE TO authenticated USING (((client_id = auth.uid()) AND (status = 'aguardando_pagamento'::public.order_status))) WITH CHECK (((client_id = auth.uid()) AND (status = 'cancelado'::public.order_status)));
END $$;


-- Name: refund_requests Clients can view own refund requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Clients can view own refund requests" ON public.refund_requests FOR SELECT TO authenticated USING ((requester_id = auth.uid()));
END $$;


-- Name: store_driver_earnings Drivers can confirm own earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can confirm own earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Drivers can confirm own earnings" ON public.store_driver_earnings FOR UPDATE TO authenticated USING ((driver_user_id = auth.uid())) WITH CHECK ((driver_user_id = auth.uid()));
END $$;


-- Name: withdrawal_requests Drivers can create withdrawal requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can create withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Drivers can create withdrawal requests" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK ((driver_user_id = auth.uid()));
END $$;


-- Name: driver_locations Drivers can insert own location; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can insert own location' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Drivers can insert own location" ON public.driver_locations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = driver_user_id));
END $$;


-- Name: order_messages Drivers can read messages for assigned orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read messages for assigned orders' AND tablename = 'order_messages') THEN
        CREATE POLICY "Drivers can read messages for assigned orders" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND (o.driver_id = auth.uid())))));
END $$;


-- Name: driver_balances Drivers can read own balance; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own balance' AND tablename = 'driver_balances') THEN
        CREATE POLICY "Drivers can read own balance" ON public.driver_balances FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
END $$;


-- Name: driver_earnings Drivers can read own earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own earnings' AND tablename = 'driver_earnings') THEN
        CREATE POLICY "Drivers can read own earnings" ON public.driver_earnings FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
END $$;


-- Name: driver_locations Drivers can read own location; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own location' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Drivers can read own location" ON public.driver_locations FOR SELECT TO authenticated USING ((auth.uid() = driver_user_id));
END $$;


-- Name: drivers Drivers can read own record; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own record' AND tablename = 'drivers') THEN
        CREATE POLICY "Drivers can read own record" ON public.drivers FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: store_drivers Drivers can read own store links; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own store links' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Drivers can read own store links" ON public.store_drivers FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
END $$;


-- Name: withdrawal_requests Drivers can read own withdrawal requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can read own withdrawal requests' AND tablename = 'withdrawal_requests') THEN
        CREATE POLICY "Drivers can read own withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
END $$;


-- Name: orders Drivers can see ready orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can see ready orders' AND tablename = 'orders') THEN
        CREATE POLICY "Drivers can see ready orders" ON public.orders FOR SELECT TO authenticated USING ((public.is_driver(auth.uid()) AND (((status = 'pronto_para_entrega'::public.order_status) AND (driver_id IS NULL) AND (store_id IN ( SELECT s.id
   FROM public.stores s
  WHERE ((COALESCE(s.address_city, 'itatinga'::text) = ( SELECT COALESCE(d.city, 'itatinga'::text) AS "coalesce"
           FROM public.drivers d
          WHERE (d.user_id = auth.uid()))) AND (COALESCE(s.delivery_mode, 'platform'::text) = 'platform'::text))))) OR (driver_id = auth.uid()))));
END $$;


-- Name: order_messages Drivers can send messages on assigned orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can send messages on assigned orders' AND tablename = 'order_messages') THEN
        CREATE POLICY "Drivers can send messages on assigned orders" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND (o.driver_id = auth.uid()))))));
END $$;


-- Name: driver_locations Drivers can update own location; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can update own location' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Drivers can update own location" ON public.driver_locations FOR UPDATE TO authenticated USING ((auth.uid() = driver_user_id));
END $$;


-- Name: drivers Drivers can update own online status; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers can update own online status' AND tablename = 'drivers') THEN
        CREATE POLICY "Drivers can update own online status" ON public.drivers FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: store_driver_earnings Drivers see own store earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers see own store earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Drivers see own store earnings" ON public.store_driver_earnings FOR SELECT TO authenticated USING ((driver_user_id = auth.uid()));
END $$;


-- Name: moderator_earnings Moderators can view own earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Moderators can view own earnings' AND tablename = 'moderator_earnings') THEN
        CREATE POLICY "Moderators can view own earnings" ON public.moderator_earnings FOR SELECT TO authenticated USING ((moderator_id IN ( SELECT moderators.id
   FROM public.moderators
  WHERE (moderators.user_id = auth.uid()))));
END $$;


-- Name: moderators Moderators can view own record; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Moderators can view own record' AND tablename = 'moderators') THEN
        CREATE POLICY "Moderators can view own record" ON public.moderators FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: moderator_referrals Moderators can view own referrals; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Moderators can view own referrals' AND tablename = 'moderator_referrals') THEN
        CREATE POLICY "Moderators can view own referrals" ON public.moderator_referrals FOR SELECT TO authenticated USING ((moderator_id IN ( SELECT moderators.id
   FROM public.moderators
  WHERE (moderators.user_id = auth.uid()))));
END $$;


-- Name: drivers No direct driver delete; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'No direct driver delete' AND tablename = 'drivers') THEN
        CREATE POLICY "No direct driver delete" ON public.drivers FOR DELETE TO authenticated USING (false);
END $$;


-- Name: drivers No direct driver insert; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'No direct driver insert' AND tablename = 'drivers') THEN
        CREATE POLICY "No direct driver insert" ON public.drivers FOR INSERT TO authenticated WITH CHECK (false);
END $$;


-- Name: order_messages Order participants can read messages; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Order participants can read messages' AND tablename = 'order_messages') THEN
        CREATE POLICY "Order participants can read messages" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND ((o.client_id = auth.uid()) OR (o.store_id IN ( SELECT s.id
           FROM public.stores s
          WHERE (s.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid()))))));
END $$;


-- Name: order_messages Order participants can send messages; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Order participants can send messages' AND tablename = 'order_messages') THEN
        CREATE POLICY "Order participants can send messages" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_messages.order_id) AND ((o.client_id = auth.uid()) OR (o.store_id IN ( SELECT s.id
           FROM public.stores s
          WHERE (s.owner_id = auth.uid())))))))));
END $$;


-- Name: addon_groups Platform admin can delete addon groups; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Platform admin can delete addon groups" ON public.addon_groups FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: addon_items Platform admin can delete addon items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Platform admin can delete addon items" ON public.addon_items FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: financial_transactions Platform admin can delete financial transactions; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Platform admin can delete financial transactions" ON public.financial_transactions FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: menu_sections Platform admin can delete menu sections; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Platform admin can delete menu sections" ON public.menu_sections FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: opening_hours Platform admin can delete opening hours; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete opening hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Platform admin can delete opening hours" ON public.opening_hours FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: product_addon_groups Platform admin can delete product addon links; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete product addon links' AND tablename = 'product_addon_groups') THEN
        CREATE POLICY "Platform admin can delete product addon links" ON public.product_addon_groups FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: products Platform admin can delete products; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete products' AND tablename = 'products') THEN
        CREATE POLICY "Platform admin can delete products" ON public.products FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: stores Platform admin can delete stores; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can delete stores' AND tablename = 'stores') THEN
        CREATE POLICY "Platform admin can delete stores" ON public.stores FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: financial_transactions Platform admin can insert financial transactions; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can insert financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Platform admin can insert financial transactions" ON public.financial_transactions FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
END $$;


-- Name: pizza_borders Platform admin can manage all borders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can manage all borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Platform admin can manage all borders" ON public.pizza_borders TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
END $$;


-- Name: app_links Platform admin can manage app_links; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can manage app_links' AND tablename = 'app_links') THEN
        CREATE POLICY "Platform admin can manage app_links" ON public.app_links TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
END $$;


-- Name: banners Platform admin can manage banners; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can manage banners' AND tablename = 'banners') THEN
        CREATE POLICY "Platform admin can manage banners" ON public.banners TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
END $$;


-- Name: store_balances Platform admin can read all balances; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all balances' AND tablename = 'store_balances') THEN
        CREATE POLICY "Platform admin can read all balances" ON public.store_balances FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: drivers Platform admin can read all drivers; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all drivers' AND tablename = 'drivers') THEN
        CREATE POLICY "Platform admin can read all drivers" ON public.drivers FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: financial_transactions Platform admin can read all financial transactions; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Platform admin can read all financial transactions" ON public.financial_transactions FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: loyalty_points Platform admin can read all loyalty; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all loyalty' AND tablename = 'loyalty_points') THEN
        CREATE POLICY "Platform admin can read all loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: order_items Platform admin can read all order items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Platform admin can read all order items" ON public.order_items FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: orders Platform admin can read all orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all orders' AND tablename = 'orders') THEN
        CREATE POLICY "Platform admin can read all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: profiles Platform admin can read all profiles; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all profiles' AND tablename = 'profiles') THEN
        CREATE POLICY "Platform admin can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: stores Platform admin can read all stores; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all stores' AND tablename = 'stores') THEN
        CREATE POLICY "Platform admin can read all stores" ON public.stores FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
END $$;


-- Name: profiles Platform admin can update all profiles; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can update all profiles' AND tablename = 'profiles') THEN
        CREATE POLICY "Platform admin can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
END $$;


-- Name: store_balances Platform admin can update balances; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can update balances' AND tablename = 'store_balances') THEN
        CREATE POLICY "Platform admin can update balances" ON public.store_balances FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
END $$;


-- Name: financial_transactions Platform admin can update financial transactions; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can update financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Platform admin can update financial transactions" ON public.financial_transactions FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
END $$;


-- Name: user_roles Prevent self role assignment; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Prevent self role assignment' AND tablename = 'user_roles') THEN
        CREATE POLICY "Prevent self role assignment" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (((user_id <> auth.uid()) AND public.is_platform_admin(auth.uid())));
END $$;


-- Name: order_items Store drivers can read linked order items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can read linked order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Store drivers can read linked order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_items.order_id) AND (sd.driver_user_id = auth.uid())))));
END $$;


-- Name: order_messages Store drivers can read linked order messages; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can read linked order messages' AND tablename = 'order_messages') THEN
        CREATE POLICY "Store drivers can read linked order messages" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_messages.order_id) AND (sd.driver_user_id = auth.uid())))));
END $$;


-- Name: stores Store drivers can read linked stores; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can read linked stores' AND tablename = 'stores') THEN
        CREATE POLICY "Store drivers can read linked stores" ON public.stores FOR SELECT TO authenticated USING ((id IN ( SELECT store_drivers.store_id
   FROM public.store_drivers
  WHERE (store_drivers.driver_user_id = auth.uid()))));
END $$;


-- Name: orders Store drivers can see linked store orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can see linked store orders' AND tablename = 'orders') THEN
        CREATE POLICY "Store drivers can see linked store orders" ON public.orders FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id)))) AND ((driver_id = auth.uid()) OR (assigned_driver_id = auth.uid()) OR ((assigned_driver_id IS NULL) AND (driver_id IS NULL)) OR ((driver_id IS NOT NULL) AND (driver_id = auth.uid())))));
END $$;


-- Name: order_messages Store drivers can send messages on linked orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can send messages on linked orders' AND tablename = 'order_messages') THEN
        CREATE POLICY "Store drivers can send messages on linked orders" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_messages.order_id) AND (sd.driver_user_id = auth.uid()))))));
END $$;


-- Name: orders Store drivers can update linked store orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can update linked store orders' AND tablename = 'orders') THEN
        CREATE POLICY "Store drivers can update linked store orders" ON public.orders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id)))));
END $$;


-- Name: store_secrets Store owner can insert own secrets; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owner can insert own secrets' AND tablename = 'store_secrets') THEN
        CREATE POLICY "Store owner can insert own secrets" ON public.store_secrets FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: store_secrets Store owner can read own secrets; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owner can read own secrets' AND tablename = 'store_secrets') THEN
        CREATE POLICY "Store owner can read own secrets" ON public.store_secrets FOR SELECT TO authenticated USING (((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid())));
END $$;


-- Name: store_secrets Store owner can update own secrets; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owner can update own secrets' AND tablename = 'store_secrets') THEN
        CREATE POLICY "Store owner can update own secrets" ON public.store_secrets FOR UPDATE TO authenticated USING (((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid())));
END $$;


-- Name: addon_groups Store owners can delete addon groups; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can delete addon groups" ON public.addon_groups FOR DELETE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: addon_items Store owners can delete addon items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can delete addon items" ON public.addon_items FOR DELETE TO authenticated USING ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: addon_items Store owners can delete addon items via store; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete addon items via store' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can delete addon items via store" ON public.addon_items FOR DELETE TO authenticated USING ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid()))))));
END $$;


-- Name: pizza_borders Store owners can delete own borders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Store owners can delete own borders" ON public.pizza_borders FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: opening_hours Store owners can delete own hours; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Store owners can delete own hours" ON public.opening_hours FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: menu_sections Store owners can delete own menu sections; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Store owners can delete own menu sections" ON public.menu_sections FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: products Store owners can delete own products; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own products' AND tablename = 'products') THEN
        CREATE POLICY "Store owners can delete own products" ON public.products FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: store_drivers Store owners can delete own store drivers; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own store drivers' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Store owners can delete own store drivers" ON public.store_drivers FOR DELETE TO authenticated USING (public.is_store_owner(auth.uid(), store_id));
END $$;


-- Name: product_addon_groups Store owners can delete product addon links; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete product addon links' AND tablename = 'product_addon_groups') THEN
        CREATE POLICY "Store owners can delete product addon links" ON public.product_addon_groups FOR DELETE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: addon_groups Store owners can delete store addon groups; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete store addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can delete store addon groups" ON public.addon_groups FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: pizza_borders Store owners can insert own borders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert own borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Store owners can insert own borders" ON public.pizza_borders FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: opening_hours Store owners can insert own hours; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert own hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Store owners can insert own hours" ON public.opening_hours FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: products Store owners can insert own products; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert own products' AND tablename = 'products') THEN
        CREATE POLICY "Store owners can insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: store_drivers Store owners can insert own store drivers; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert own store drivers' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Store owners can insert own store drivers" ON public.store_drivers FOR INSERT TO authenticated WITH CHECK (public.is_store_owner(auth.uid(), store_id));
END $$;


-- Name: product_addon_groups Store owners can insert product addon links; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert product addon links' AND tablename = 'product_addon_groups') THEN
        CREATE POLICY "Store owners can insert product addon links" ON public.product_addon_groups FOR INSERT TO authenticated WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: addon_groups Store owners can insert store addon groups; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert store addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can insert store addon groups" ON public.addon_groups FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: addon_groups Store owners can manage addon groups; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can manage addon groups" ON public.addon_groups FOR INSERT TO authenticated WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: addon_items Store owners can manage addon items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can manage addon items" ON public.addon_items FOR INSERT TO authenticated WITH CHECK ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: addon_items Store owners can manage addon items via store; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage addon items via store' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can manage addon items via store" ON public.addon_items FOR INSERT TO authenticated WITH CHECK ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid()))))));
END $$;


-- Name: banners Store owners can manage own banners; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage own banners' AND tablename = 'banners') THEN
        CREATE POLICY "Store owners can manage own banners" ON public.banners TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: loyalty_config Store owners can manage own config; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage own config' AND tablename = 'loyalty_config') THEN
        CREATE POLICY "Store owners can manage own config" ON public.loyalty_config TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: coupons Store owners can manage own coupons; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage own coupons' AND tablename = 'coupons') THEN
        CREATE POLICY "Store owners can manage own coupons" ON public.coupons TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: menu_sections Store owners can manage own menu sections; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage own menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Store owners can manage own menu sections" ON public.menu_sections FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: driver_locations Store owners can read driver location for their orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read driver location for their orders' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Store owners can read driver location for their orders" ON public.driver_locations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.stores s ON ((o.store_id = s.id)))
  WHERE ((o.id = driver_locations.order_id) AND (s.owner_id = auth.uid())))));
END $$;


-- Name: profiles Store owners can read linked driver profiles; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read linked driver profiles' AND tablename = 'profiles') THEN
        CREATE POLICY "Store owners can read linked driver profiles" ON public.profiles FOR SELECT TO authenticated USING ((user_id IN ( SELECT sd.driver_user_id
   FROM (public.store_drivers sd
     JOIN public.stores s ON ((sd.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: store_balances Store owners can read own balance; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own balance' AND tablename = 'store_balances') THEN
        CREATE POLICY "Store owners can read own balance" ON public.store_balances FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: compliance_alerts Store owners can read own compliance alerts; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own compliance alerts' AND tablename = 'compliance_alerts') THEN
        CREATE POLICY "Store owners can read own compliance alerts" ON public.compliance_alerts FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: financial_transactions Store owners can read own financial transactions; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Store owners can read own financial transactions" ON public.financial_transactions FOR SELECT TO authenticated USING ((store_id IN ( SELECT s.id
   FROM public.stores s
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: store_plans Store owners can read own plan; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own plan' AND tablename = 'store_plans') THEN
        CREATE POLICY "Store owners can read own plan" ON public.store_plans FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: plan_change_requests Store owners can read own plan requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own plan requests' AND tablename = 'plan_change_requests') THEN
        CREATE POLICY "Store owners can read own plan requests" ON public.plan_change_requests FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: store_drivers Store owners can read own store drivers; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own store drivers' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Store owners can read own store drivers" ON public.store_drivers FOR SELECT TO authenticated USING (public.is_store_owner(auth.uid(), store_id));
END $$;


-- Name: stores Store owners can read own stores; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own stores' AND tablename = 'stores') THEN
        CREATE POLICY "Store owners can read own stores" ON public.stores FOR SELECT TO authenticated USING ((owner_id = auth.uid()));
END $$;


-- Name: fcm_tokens Store owners can read store fcm tokens; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store fcm tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Store owners can read store fcm tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: loyalty_points Store owners can read store loyalty; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store loyalty' AND tablename = 'loyalty_points') THEN
        CREATE POLICY "Store owners can read store loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: order_items Store owners can read store order items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Store owners can read store order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.stores s ON ((o.store_id = s.id)))
  WHERE ((o.id = order_items.order_id) AND (s.owner_id = auth.uid())))));
END $$;


-- Name: orders Store owners can read store orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store orders' AND tablename = 'orders') THEN
        CREATE POLICY "Store owners can read store orders" ON public.orders FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: order_ratings Store owners can read store ratings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store ratings' AND tablename = 'order_ratings') THEN
        CREATE POLICY "Store owners can read store ratings" ON public.order_ratings FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: plan_change_requests Store owners can request plan changes; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can request plan changes' AND tablename = 'plan_change_requests') THEN
        CREATE POLICY "Store owners can request plan changes" ON public.plan_change_requests FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: addon_groups Store owners can update addon groups; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can update addon groups" ON public.addon_groups FOR UPDATE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid())))) WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: addon_items Store owners can update addon items; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can update addon items" ON public.addon_items FOR UPDATE TO authenticated USING ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid())))) WITH CHECK ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
END $$;


-- Name: addon_items Store owners can update addon items via store; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update addon items via store' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can update addon items via store" ON public.addon_items FOR UPDATE TO authenticated USING ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid())))))) WITH CHECK ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid()))))));
END $$;


-- Name: pizza_borders Store owners can update own borders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Store owners can update own borders" ON public.pizza_borders FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: opening_hours Store owners can update own hours; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Store owners can update own hours" ON public.opening_hours FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: menu_sections Store owners can update own menu sections; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Store owners can update own menu sections" ON public.menu_sections FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: products Store owners can update own products; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own products' AND tablename = 'products') THEN
        CREATE POLICY "Store owners can update own products" ON public.products FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: stores Store owners can update own store; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own store' AND tablename = 'stores') THEN
        CREATE POLICY "Store owners can update own store" ON public.stores FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
END $$;


-- Name: refund_requests Store owners can update refund requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Store owners can update refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.stores
  WHERE ((stores.id = refund_requests.store_id) AND (stores.owner_id = auth.uid())))));
END $$;


-- Name: addon_groups Store owners can update store addon groups; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update store addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can update store addon groups" ON public.addon_groups FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: orders Store owners can update store orders; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update store orders' AND tablename = 'orders') THEN
        CREATE POLICY "Store owners can update store orders" ON public.orders FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: refund_requests Store owners can view store refund requests; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can view store refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Store owners can view store refund requests" ON public.refund_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.stores
  WHERE ((stores.id = refund_requests.store_id) AND (stores.owner_id = auth.uid())))));
END $$;


-- Name: store_driver_earnings Store owners see store driver earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners see store driver earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Store owners see store driver earnings" ON public.store_driver_earnings FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: store_driver_earnings Store owners update store driver earnings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners update store driver earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Store owners update store driver earnings" ON public.store_driver_earnings FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
END $$;


-- Name: user_active_devices Users can delete own device; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own device' AND tablename = 'user_active_devices') THEN
        CREATE POLICY "Users can delete own device" ON public.user_active_devices FOR DELETE TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: onesignal_players Users can delete own players; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own players' AND tablename = 'onesignal_players') THEN
        CREATE POLICY "Users can delete own players" ON public.onesignal_players FOR DELETE TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: fcm_tokens Users can delete own tokens; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Users can delete own tokens" ON public.fcm_tokens FOR DELETE TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: coupon_uses Users can insert own coupon uses; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own coupon uses' AND tablename = 'coupon_uses') THEN
        CREATE POLICY "Users can insert own coupon uses" ON public.coupon_uses FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: user_active_devices Users can insert own device; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own device' AND tablename = 'user_active_devices') THEN
        CREATE POLICY "Users can insert own device" ON public.user_active_devices FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: onesignal_players Users can insert own players; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own players' AND tablename = 'onesignal_players') THEN
        CREATE POLICY "Users can insert own players" ON public.onesignal_players FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: order_ratings Users can insert own ratings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own ratings' AND tablename = 'order_ratings') THEN
        CREATE POLICY "Users can insert own ratings" ON public.order_ratings FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: terms_acceptance Users can insert own terms acceptance; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own terms acceptance' AND tablename = 'terms_acceptance') THEN
        CREATE POLICY "Users can insert own terms acceptance" ON public.terms_acceptance FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: fcm_tokens Users can insert own tokens; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Users can insert own tokens" ON public.fcm_tokens FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: saved_addresses Users can manage own addresses; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own addresses' AND tablename = 'saved_addresses') THEN
        CREATE POLICY "Users can manage own addresses" ON public.saved_addresses TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: coupon_uses Users can read own coupon uses; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own coupon uses' AND tablename = 'coupon_uses') THEN
        CREATE POLICY "Users can read own coupon uses" ON public.coupon_uses FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: user_active_devices Users can read own device; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own device' AND tablename = 'user_active_devices') THEN
        CREATE POLICY "Users can read own device" ON public.user_active_devices FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: loyalty_points Users can read own loyalty; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own loyalty' AND tablename = 'loyalty_points') THEN
        CREATE POLICY "Users can read own loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: onesignal_players Users can read own players; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own players' AND tablename = 'onesignal_players') THEN
        CREATE POLICY "Users can read own players" ON public.onesignal_players FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: order_ratings Users can read own ratings; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own ratings' AND tablename = 'order_ratings') THEN
        CREATE POLICY "Users can read own ratings" ON public.order_ratings FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: user_roles Users can read own roles; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: terms_acceptance Users can read own terms acceptance; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own terms acceptance' AND tablename = 'terms_acceptance') THEN
        CREATE POLICY "Users can read own terms acceptance" ON public.terms_acceptance FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: fcm_tokens Users can read own tokens; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Users can read own tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: user_active_devices Users can update own device; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own device' AND tablename = 'user_active_devices') THEN
        CREATE POLICY "Users can update own device" ON public.user_active_devices FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: onesignal_players Users can update own players; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own players' AND tablename = 'onesignal_players') THEN
        CREATE POLICY "Users can update own players" ON public.onesignal_players FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: fcm_tokens Users can update own tokens; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Users can update own tokens" ON public.fcm_tokens FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
END $$;


-- Name: user_wallet Users can view own wallet; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own wallet' AND tablename = 'user_wallet') THEN
        CREATE POLICY "Users can view own wallet" ON public.user_wallet FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: wallet_transactions Users can view own wallet transactions; Type: POLICY; Schema: public; Owner: -

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own wallet transactions' AND tablename = 'wallet_transactions') THEN
        CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING ((user_id = auth.uid()));
END $$;


-- Name: addon_groups; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;

-- Name: addon_items; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.addon_items ENABLE ROW LEVEL SECURITY;

-- Name: admin_settings; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Name: app_links; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.app_links ENABLE ROW LEVEL SECURITY;

-- Name: archived_accounts; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.archived_accounts ENABLE ROW LEVEL SECURITY;

-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Name: compliance_alerts; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

-- Name: coupon_uses; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Name: driver_balances; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.driver_balances ENABLE ROW LEVEL SECURITY;

-- Name: driver_earnings; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

-- Name: driver_locations; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Name: drivers; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Name: emergency_fund; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.emergency_fund ENABLE ROW LEVEL SECURITY;

-- Name: fcm_tokens; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Name: financial_transactions; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Name: loyalty_config; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;

-- Name: loyalty_points; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- Name: menu_sections; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;

-- Name: moderator_earnings; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.moderator_earnings ENABLE ROW LEVEL SECURITY;

-- Name: moderator_referrals; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.moderator_referrals ENABLE ROW LEVEL SECURITY;

-- Name: moderators; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;

-- Name: neighborhood_fees; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.neighborhood_fees ENABLE ROW LEVEL SECURITY;

-- Name: onesignal_players; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.onesignal_players ENABLE ROW LEVEL SECURITY;

-- Name: opening_hours; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Name: order_messages; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Name: order_ratings; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Name: page_views; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Name: partner_payouts; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

-- Name: payout_history; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.payout_history ENABLE ROW LEVEL SECURITY;

-- Name: pizza_borders; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.pizza_borders ENABLE ROW LEVEL SECURITY;

-- Name: plan_change_requests; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;

-- Name: platform_partners; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.platform_partners ENABLE ROW LEVEL SECURITY;

-- Name: product_addon_groups; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;

-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Name: refund_requests; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- Name: saved_addresses; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

-- Name: store_balances; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.store_balances ENABLE ROW LEVEL SECURITY;

-- Name: store_driver_earnings; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.store_driver_earnings ENABLE ROW LEVEL SECURITY;

-- Name: store_drivers; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.store_drivers ENABLE ROW LEVEL SECURITY;

-- Name: store_plans; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.store_plans ENABLE ROW LEVEL SECURITY;

-- Name: store_secrets; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.store_secrets ENABLE ROW LEVEL SECURITY;

-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Name: terms_acceptance; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Name: user_active_devices; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.user_active_devices ENABLE ROW LEVEL SECURITY;

-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Name: user_wallet; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.user_wallet ENABLE ROW LEVEL SECURITY;

-- Name: wallet_transactions; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Name: withdrawal_requests; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;



-- PostgreSQL database dump


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;