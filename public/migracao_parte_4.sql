
-- Name: financial_transactions Platform admin can insert financial transactions; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can insert financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Platform admin can insert financial transactions" ON public.financial_transactions FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: pizza_borders Platform admin can manage all borders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can manage all borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Platform admin can manage all borders" ON public.pizza_borders TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: app_links Platform admin can manage app_links; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can manage app_links' AND tablename = 'app_links') THEN
        CREATE POLICY "Platform admin can manage app_links" ON public.app_links TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: banners Platform admin can manage banners; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can manage banners' AND tablename = 'banners') THEN
        CREATE POLICY "Platform admin can manage banners" ON public.banners TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: store_balances Platform admin can read all balances; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all balances' AND tablename = 'store_balances') THEN
        CREATE POLICY "Platform admin can read all balances" ON public.store_balances FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: drivers Platform admin can read all drivers; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all drivers' AND tablename = 'drivers') THEN
        CREATE POLICY "Platform admin can read all drivers" ON public.drivers FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: financial_transactions Platform admin can read all financial transactions; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Platform admin can read all financial transactions" ON public.financial_transactions FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: loyalty_points Platform admin can read all loyalty; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all loyalty' AND tablename = 'loyalty_points') THEN
        CREATE POLICY "Platform admin can read all loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: order_items Platform admin can read all order items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Platform admin can read all order items" ON public.order_items FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: orders Platform admin can read all orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all orders' AND tablename = 'orders') THEN
        CREATE POLICY "Platform admin can read all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: profiles Platform admin can read all profiles; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all profiles' AND tablename = 'profiles') THEN
        CREATE POLICY "Platform admin can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: stores Platform admin can read all stores; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can read all stores' AND tablename = 'stores') THEN
        CREATE POLICY "Platform admin can read all stores" ON public.stores FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: profiles Platform admin can update all profiles; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can update all profiles' AND tablename = 'profiles') THEN
        CREATE POLICY "Platform admin can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: store_balances Platform admin can update balances; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can update balances' AND tablename = 'store_balances') THEN
        CREATE POLICY "Platform admin can update balances" ON public.store_balances FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: financial_transactions Platform admin can update financial transactions; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platform admin can update financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Platform admin can update financial transactions" ON public.financial_transactions FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
    END IF;
-- END


-- Name: user_roles Prevent self role assignment; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Prevent self role assignment' AND tablename = 'user_roles') THEN
        CREATE POLICY "Prevent self role assignment" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (((user_id <> auth.uid()) AND public.is_platform_admin(auth.uid())));
    END IF;
-- END


-- Name: order_items Store drivers can read linked order items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can read linked order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Store drivers can read linked order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_items.order_id) AND (sd.driver_user_id = auth.uid())))));
    END IF;
-- END


-- Name: order_messages Store drivers can read linked order messages; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can read linked order messages' AND tablename = 'order_messages') THEN
        CREATE POLICY "Store drivers can read linked order messages" ON public.order_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_messages.order_id) AND (sd.driver_user_id = auth.uid())))));
    END IF;
-- END


-- Name: stores Store drivers can read linked stores; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can read linked stores' AND tablename = 'stores') THEN
        CREATE POLICY "Store drivers can read linked stores" ON public.stores FOR SELECT TO authenticated USING ((id IN ( SELECT store_drivers.store_id
   FROM public.store_drivers
  WHERE (store_drivers.driver_user_id = auth.uid()))));
    END IF;
-- END


-- Name: orders Store drivers can see linked store orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can see linked store orders' AND tablename = 'orders') THEN
        CREATE POLICY "Store drivers can see linked store orders" ON public.orders FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id)))) AND ((driver_id = auth.uid()) OR (assigned_driver_id = auth.uid()) OR ((assigned_driver_id IS NULL) AND (driver_id IS NULL)) OR ((driver_id IS NOT NULL) AND (driver_id = auth.uid())))));
    END IF;
-- END


-- Name: order_messages Store drivers can send messages on linked orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can send messages on linked orders' AND tablename = 'order_messages') THEN
        CREATE POLICY "Store drivers can send messages on linked orders" ON public.order_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.store_drivers sd ON ((sd.store_id = o.store_id)))
  WHERE ((o.id = order_messages.order_id) AND (sd.driver_user_id = auth.uid()))))));
    END IF;
-- END


-- Name: orders Store drivers can update linked store orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store drivers can update linked store orders' AND tablename = 'orders') THEN
        CREATE POLICY "Store drivers can update linked store orders" ON public.orders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.store_drivers sd
  WHERE ((sd.driver_user_id = auth.uid()) AND (sd.store_id = orders.store_id)))));
    END IF;
-- END


-- Name: store_secrets Store owner can insert own secrets; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owner can insert own secrets' AND tablename = 'store_secrets') THEN
        CREATE POLICY "Store owner can insert own secrets" ON public.store_secrets FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: store_secrets Store owner can read own secrets; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owner can read own secrets' AND tablename = 'store_secrets') THEN
        CREATE POLICY "Store owner can read own secrets" ON public.store_secrets FOR SELECT TO authenticated USING (((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid())));
    END IF;
-- END


-- Name: store_secrets Store owner can update own secrets; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owner can update own secrets' AND tablename = 'store_secrets') THEN
        CREATE POLICY "Store owner can update own secrets" ON public.store_secrets FOR UPDATE TO authenticated USING (((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))) OR public.is_platform_admin(auth.uid())));
    END IF;
-- END


-- Name: addon_groups Store owners can delete addon groups; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can delete addon groups" ON public.addon_groups FOR DELETE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_items Store owners can delete addon items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can delete addon items" ON public.addon_items FOR DELETE TO authenticated USING ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_items Store owners can delete addon items via store; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete addon items via store' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can delete addon items via store" ON public.addon_items FOR DELETE TO authenticated USING ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid()))))));
    END IF;
-- END


-- Name: pizza_borders Store owners can delete own borders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Store owners can delete own borders" ON public.pizza_borders FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: opening_hours Store owners can delete own hours; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Store owners can delete own hours" ON public.opening_hours FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: menu_sections Store owners can delete own menu sections; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Store owners can delete own menu sections" ON public.menu_sections FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: products Store owners can delete own products; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own products' AND tablename = 'products') THEN
        CREATE POLICY "Store owners can delete own products" ON public.products FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: store_drivers Store owners can delete own store drivers; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete own store drivers' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Store owners can delete own store drivers" ON public.store_drivers FOR DELETE TO authenticated USING (public.is_store_owner(auth.uid(), store_id));
    END IF;
-- END


-- Name: product_addon_groups Store owners can delete product addon links; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete product addon links' AND tablename = 'product_addon_groups') THEN
        CREATE POLICY "Store owners can delete product addon links" ON public.product_addon_groups FOR DELETE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_groups Store owners can delete store addon groups; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can delete store addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can delete store addon groups" ON public.addon_groups FOR DELETE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: pizza_borders Store owners can insert own borders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert own borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Store owners can insert own borders" ON public.pizza_borders FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: opening_hours Store owners can insert own hours; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert own hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Store owners can insert own hours" ON public.opening_hours FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: products Store owners can insert own products; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert own products' AND tablename = 'products') THEN
        CREATE POLICY "Store owners can insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: store_drivers Store owners can insert own store drivers; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert own store drivers' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Store owners can insert own store drivers" ON public.store_drivers FOR INSERT TO authenticated WITH CHECK (public.is_store_owner(auth.uid(), store_id));
    END IF;
-- END


-- Name: product_addon_groups Store owners can insert product addon links; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert product addon links' AND tablename = 'product_addon_groups') THEN
        CREATE POLICY "Store owners can insert product addon links" ON public.product_addon_groups FOR INSERT TO authenticated WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_groups Store owners can insert store addon groups; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can insert store addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can insert store addon groups" ON public.addon_groups FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_groups Store owners can manage addon groups; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can manage addon groups" ON public.addon_groups FOR INSERT TO authenticated WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_items Store owners can manage addon items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage addon items' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can manage addon items" ON public.addon_items FOR INSERT TO authenticated WITH CHECK ((group_id IN ( SELECT ag.id
   FROM ((public.addon_groups ag
     JOIN public.products p ON ((ag.product_id = p.id)))
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_items Store owners can manage addon items via store; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage addon items via store' AND tablename = 'addon_items') THEN
        CREATE POLICY "Store owners can manage addon items via store" ON public.addon_items FOR INSERT TO authenticated WITH CHECK ((group_id IN ( SELECT addon_groups.id
   FROM public.addon_groups
  WHERE (addon_groups.store_id IN ( SELECT stores.id
           FROM public.stores
          WHERE (stores.owner_id = auth.uid()))))));
    END IF;
-- END


-- Name: banners Store owners can manage own banners; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage own banners' AND tablename = 'banners') THEN
        CREATE POLICY "Store owners can manage own banners" ON public.banners TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: loyalty_config Store owners can manage own config; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage own config' AND tablename = 'loyalty_config') THEN
        CREATE POLICY "Store owners can manage own config" ON public.loyalty_config TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: coupons Store owners can manage own coupons; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage own coupons' AND tablename = 'coupons') THEN
        CREATE POLICY "Store owners can manage own coupons" ON public.coupons TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: menu_sections Store owners can manage own menu sections; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can manage own menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Store owners can manage own menu sections" ON public.menu_sections FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: driver_locations Store owners can read driver location for their orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read driver location for their orders' AND tablename = 'driver_locations') THEN
        CREATE POLICY "Store owners can read driver location for their orders" ON public.driver_locations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.stores s ON ((o.store_id = s.id)))
  WHERE ((o.id = driver_locations.order_id) AND (s.owner_id = auth.uid())))));
    END IF;
-- END


-- Name: profiles Store owners can read linked driver profiles; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read linked driver profiles' AND tablename = 'profiles') THEN
        CREATE POLICY "Store owners can read linked driver profiles" ON public.profiles FOR SELECT TO authenticated USING ((user_id IN ( SELECT sd.driver_user_id
   FROM (public.store_drivers sd
     JOIN public.stores s ON ((sd.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: store_balances Store owners can read own balance; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own balance' AND tablename = 'store_balances') THEN
        CREATE POLICY "Store owners can read own balance" ON public.store_balances FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: compliance_alerts Store owners can read own compliance alerts; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own compliance alerts' AND tablename = 'compliance_alerts') THEN
        CREATE POLICY "Store owners can read own compliance alerts" ON public.compliance_alerts FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: financial_transactions Store owners can read own financial transactions; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own financial transactions' AND tablename = 'financial_transactions') THEN
        CREATE POLICY "Store owners can read own financial transactions" ON public.financial_transactions FOR SELECT TO authenticated USING ((store_id IN ( SELECT s.id
   FROM public.stores s
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: store_plans Store owners can read own plan; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own plan' AND tablename = 'store_plans') THEN
        CREATE POLICY "Store owners can read own plan" ON public.store_plans FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: plan_change_requests Store owners can read own plan requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own plan requests' AND tablename = 'plan_change_requests') THEN
        CREATE POLICY "Store owners can read own plan requests" ON public.plan_change_requests FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: store_drivers Store owners can read own store drivers; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own store drivers' AND tablename = 'store_drivers') THEN
        CREATE POLICY "Store owners can read own store drivers" ON public.store_drivers FOR SELECT TO authenticated USING (public.is_store_owner(auth.uid(), store_id));
    END IF;
-- END


-- Name: stores Store owners can read own stores; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read own stores' AND tablename = 'stores') THEN
        CREATE POLICY "Store owners can read own stores" ON public.stores FOR SELECT TO authenticated USING ((owner_id = auth.uid()));
    END IF;
-- END


-- Name: fcm_tokens Store owners can read store fcm tokens; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store fcm tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Store owners can read store fcm tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: loyalty_points Store owners can read store loyalty; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store loyalty' AND tablename = 'loyalty_points') THEN
        CREATE POLICY "Store owners can read store loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: order_items Store owners can read store order items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Store owners can read store order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.stores s ON ((o.store_id = s.id)))
  WHERE ((o.id = order_items.order_id) AND (s.owner_id = auth.uid())))));
    END IF;
-- END


-- Name: orders Store owners can read store orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store orders' AND tablename = 'orders') THEN
        CREATE POLICY "Store owners can read store orders" ON public.orders FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: order_ratings Store owners can read store ratings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can read store ratings' AND tablename = 'order_ratings') THEN
        CREATE POLICY "Store owners can read store ratings" ON public.order_ratings FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: plan_change_requests Store owners can request plan changes; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can request plan changes' AND tablename = 'plan_change_requests') THEN
        CREATE POLICY "Store owners can request plan changes" ON public.plan_change_requests FOR INSERT TO authenticated WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_groups Store owners can update addon groups; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can update addon groups" ON public.addon_groups FOR UPDATE TO authenticated USING ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid())))) WITH CHECK ((product_id IN ( SELECT p.id
   FROM (public.products p
     JOIN public.stores s ON ((p.store_id = s.id)))
  WHERE (s.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: addon_items Store owners can update addon items; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
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
    END IF;
-- END


-- Name: addon_items Store owners can update addon items via store; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
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
    END IF;
-- END


-- Name: pizza_borders Store owners can update own borders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own borders' AND tablename = 'pizza_borders') THEN
        CREATE POLICY "Store owners can update own borders" ON public.pizza_borders FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: opening_hours Store owners can update own hours; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own hours' AND tablename = 'opening_hours') THEN
        CREATE POLICY "Store owners can update own hours" ON public.opening_hours FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: menu_sections Store owners can update own menu sections; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own menu sections' AND tablename = 'menu_sections') THEN
        CREATE POLICY "Store owners can update own menu sections" ON public.menu_sections FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: products Store owners can update own products; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own products' AND tablename = 'products') THEN
        CREATE POLICY "Store owners can update own products" ON public.products FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: stores Store owners can update own store; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update own store' AND tablename = 'stores') THEN
        CREATE POLICY "Store owners can update own store" ON public.stores FOR UPDATE TO authenticated USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
    END IF;
-- END


-- Name: refund_requests Store owners can update refund requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Store owners can update refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.stores
  WHERE ((stores.id = refund_requests.store_id) AND (stores.owner_id = auth.uid())))));
    END IF;
-- END


-- Name: addon_groups Store owners can update store addon groups; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update store addon groups' AND tablename = 'addon_groups') THEN
        CREATE POLICY "Store owners can update store addon groups" ON public.addon_groups FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: orders Store owners can update store orders; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can update store orders' AND tablename = 'orders') THEN
        CREATE POLICY "Store owners can update store orders" ON public.orders FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: refund_requests Store owners can view store refund requests; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners can view store refund requests' AND tablename = 'refund_requests') THEN
        CREATE POLICY "Store owners can view store refund requests" ON public.refund_requests FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.stores
  WHERE ((stores.id = refund_requests.store_id) AND (stores.owner_id = auth.uid())))));
    END IF;
-- END


-- Name: store_driver_earnings Store owners see store driver earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners see store driver earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Store owners see store driver earnings" ON public.store_driver_earnings FOR SELECT TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: store_driver_earnings Store owners update store driver earnings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store owners update store driver earnings' AND tablename = 'store_driver_earnings') THEN
        CREATE POLICY "Store owners update store driver earnings" ON public.store_driver_earnings FOR UPDATE TO authenticated USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid())))) WITH CHECK ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.owner_id = auth.uid()))));
    END IF;
-- END


-- Name: user_active_devices Users can delete own device; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own device' AND tablename = 'user_active_devices') THEN
        CREATE POLICY "Users can delete own device" ON public.user_active_devices FOR DELETE TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: onesignal_players Users can delete own players; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own players' AND tablename = 'onesignal_players') THEN
        CREATE POLICY "Users can delete own players" ON public.onesignal_players FOR DELETE TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: fcm_tokens Users can delete own tokens; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Users can delete own tokens" ON public.fcm_tokens FOR DELETE TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: coupon_uses Users can insert own coupon uses; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own coupon uses' AND tablename = 'coupon_uses') THEN
        CREATE POLICY "Users can insert own coupon uses" ON public.coupon_uses FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: user_active_devices Users can insert own device; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own device' AND tablename = 'user_active_devices') THEN
        CREATE POLICY "Users can insert own device" ON public.user_active_devices FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: onesignal_players Users can insert own players; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own players' AND tablename = 'onesignal_players') THEN
        CREATE POLICY "Users can insert own players" ON public.onesignal_players FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: order_ratings Users can insert own ratings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own ratings' AND tablename = 'order_ratings') THEN
        CREATE POLICY "Users can insert own ratings" ON public.order_ratings FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: terms_acceptance Users can insert own terms acceptance; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own terms acceptance' AND tablename = 'terms_acceptance') THEN
        CREATE POLICY "Users can insert own terms acceptance" ON public.terms_acceptance FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: fcm_tokens Users can insert own tokens; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Users can insert own tokens" ON public.fcm_tokens FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: saved_addresses Users can manage own addresses; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own addresses' AND tablename = 'saved_addresses') THEN
        CREATE POLICY "Users can manage own addresses" ON public.saved_addresses TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: coupon_uses Users can read own coupon uses; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own coupon uses' AND tablename = 'coupon_uses') THEN
        CREATE POLICY "Users can read own coupon uses" ON public.coupon_uses FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: user_active_devices Users can read own device; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own device' AND tablename = 'user_active_devices') THEN
        CREATE POLICY "Users can read own device" ON public.user_active_devices FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: loyalty_points Users can read own loyalty; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own loyalty' AND tablename = 'loyalty_points') THEN
        CREATE POLICY "Users can read own loyalty" ON public.loyalty_points FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: onesignal_players Users can read own players; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own players' AND tablename = 'onesignal_players') THEN
        CREATE POLICY "Users can read own players" ON public.onesignal_players FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: order_ratings Users can read own ratings; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own ratings' AND tablename = 'order_ratings') THEN
        CREATE POLICY "Users can read own ratings" ON public.order_ratings FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: user_roles Users can read own roles; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own roles' AND tablename = 'user_roles') THEN
        CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: terms_acceptance Users can read own terms acceptance; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own terms acceptance' AND tablename = 'terms_acceptance') THEN
        CREATE POLICY "Users can read own terms acceptance" ON public.terms_acceptance FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: fcm_tokens Users can read own tokens; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Users can read own tokens" ON public.fcm_tokens FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: user_active_devices Users can update own device; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own device' AND tablename = 'user_active_devices') THEN
        CREATE POLICY "Users can update own device" ON public.user_active_devices FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: onesignal_players Users can update own players; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own players' AND tablename = 'onesignal_players') THEN
        CREATE POLICY "Users can update own players" ON public.onesignal_players FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'profiles') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: fcm_tokens Users can update own tokens; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own tokens' AND tablename = 'fcm_tokens') THEN
        CREATE POLICY "Users can update own tokens" ON public.fcm_tokens FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
    END IF;
-- END


-- Name: user_wallet Users can view own wallet; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own wallet' AND tablename = 'user_wallet') THEN
        CREATE POLICY "Users can view own wallet" ON public.user_wallet FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


-- Name: wallet_transactions Users can view own wallet transactions; Type: POLICY; Schema: public; Owner: -

-- DO BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own wallet transactions' AND tablename = 'wallet_transactions') THEN
        CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING ((user_id = auth.uid()));
    END IF;
-- END


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
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.stores VALUES ('66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'Bbburger', 'lanches', NULL, true, 0.0, '2026-04-14 14:46:23.242486+00', '5e53b885-05f3-4cfd-9a52-d5c1f4457f3b', 'ativo', false, 'bbburger', 'Rua Julieta Antunes Almeida Oliveira', NULL, NULL, 'Núcleo Habitacional Nova América', NULL, 'Itatinga', 'SP', '18694046', 'own', 0, NULL, NULL, '{"zapi_enabled": false, "pizza_price_mode": "maior", "pizza_half_enabled": false}', 6, false, false, NULL, NULL, false, '{lanches}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('77d96f88-c440-4c13-b547-11a6ae2240a1', 'Teste Restaurante', 'restaurante', NULL, true, 0.0, '2026-04-11 22:25:27.540778+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'ativo', false, 'test-teste-restaurante-d27e', NULL, NULL, NULL, NULL, NULL, 'Itatinga', 'SP', NULL, 'own', 3, NULL, NULL, '{"zapi_enabled": false, "pizza_price_mode": "maior", "pizza_half_enabled": false}', 6, false, false, NULL, NULL, false, '{restaurante}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('7bcc5fc0-d45c-4c81-86db-7d55f4d4e122', 'Teste Farmcias', 'farmacias', NULL, true, 0.0, '2026-04-13 19:24:39.267486+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'ativo', false, 'test-teste-farmcias-0cf7', NULL, NULL, NULL, NULL, NULL, 'Itatinga', 'SP', NULL, 'own', 0, NULL, NULL, '{}', 6, false, false, NULL, NULL, false, '{farmacias}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('fbff1580-ce82-4798-a96f-f149c69166b3', 'DiasBurguer', 'lanches', NULL, true, 0.0, '2026-04-08 08:45:53.858195+00', 'ba9ce4c7-7133-45d5-8c2f-454914b7da38', 'ativo', false, 'diasburguer', 'Rua São Francisco', NULL, NULL, 'Centro', NULL, 'itatinga', 'SP', '18690000', 'own', 3, '2acbd9af-fe7a-4e03-b790-3e571c350304', 'a89f6c43-c3df-485a-85e4-c8e0571c50e0', '{"pizza_price_mode": "maior", "pizza_half_enabled": false}', 6, false, false, NULL, NULL, false, '{lanches}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Nata Lanches', 'lanches', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/927289c1-9e81-463a-b950-9b83d4d505e5/logo_1775240666951.jpg', true, 4.0, '2026-04-03 18:07:41.47696+00', '927289c1-9e81-463a-b950-9b83d4d505e5', 'ativo', false, 'natalanches', 'Rua Sergipe', '621', NULL, 'Vila São Domingos', NULL, 'Itatinga', 'SP', '18691005', 'own', 3, NULL, NULL, '{}', 6, false, false, NULL, NULL, false, '{lanches}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('e577573d-4139-415d-b49d-d6a50e1d393b', 'Teste Pizzas', 'pizzas', NULL, true, 0.0, '2026-04-07 14:13:13.169353+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'ativo', false, 'test-teste-pizzas-6d39', NULL, NULL, NULL, NULL, NULL, 'Itatinga', 'SP', NULL, 'own', 0, NULL, NULL, '{"pizza_config": {"sizes": ["Brotinho", "Média", "Família", "Grande"], "flavors": [{"id": "2ba57154-698e-45c9-b18c-bb01b8c37c4f", "name": "Calabresa", "prices": {"Grande": 7990, "Média": 5990, "Brotinho": 3290, "Família": 12290}}, {"id": "998cf552-d782-4aaf-b4ea-7c9823d0f8da", "name": "Mussarela", "prices": {"Grande": 7490, "Média": 5990, "Brotinho": 3290, "Família": 14900}}]}, "pizza_price_mode": "maior", "pizza_half_enabled": true}', 2.5, false, false, NULL, NULL, false, '{pizzas}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Santos Massas', 'pizzas', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/050ed159-cfd4-4de5-9e9e-fcc54bf519f8/logo_santos_massas.jpg', true, 0.0, '2026-04-18 21:42:41.699319+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'ativo', false, 'test-teste-pizzas-9c07', NULL, NULL, NULL, NULL, NULL, 'Itatinga', 'SP', NULL, 'own', 0, NULL, NULL, '{"zapi_enabled": false, "pizza_price_mode": "maior", "pizza_half_enabled": false}', 0, false, false, NULL, NULL, false, '{pizzas}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('7cd86219-bb0b-4635-801c-9ee8596c6215', 'TesteMensal', 'pizzas', NULL, true, 0.0, '2026-04-09 18:52:56.671167+00', '137c9a05-75db-4077-acff-17d9ed508c29', 'ativo', false, NULL, 'Rua São Francisco', NULL, NULL, 'Centro', NULL, 'itatinga', 'SP', '18690081', 'own', 0, 'b85ab927-971d-4986-9179-816d2b516361', '2eb8f993-03df-4af4-9657-7ee7dda9a7df', '{}', 6, false, false, NULL, NULL, false, '{pizzas}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('477b9f42-d4c7-4cdf-a24b-fac59212f6d1', 'Teste Sobremesas', 'sobremesas', NULL, true, 0.0, '2026-04-09 15:59:33.512913+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'ativo', false, 'test-teste-sobremesas-77d5', NULL, NULL, NULL, NULL, NULL, 'Itatinga', 'SP', NULL, 'own', 0, NULL, NULL, '{}', 6, false, false, NULL, NULL, false, '{sobremesas}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('f667fc5c-48d2-4b05-a370-b28720161009', 'Teste Esfihas', 'esfihas', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/66a2f79c-9276-4fe8-8201-4a59b3960bed/logo_1776305271048.png', true, 0.0, '2026-04-16 01:48:54.164312+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'ativo', false, 'test-teste-esfihas-6ff5', NULL, NULL, NULL, NULL, NULL, 'Itatinga', 'SP', NULL, 'own', 0, NULL, NULL, '{"zapi_enabled": false, "pizza_price_mode": "maior", "pizza_half_enabled": false}', 6, false, false, NULL, NULL, false, '{esfihas}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Jessica Cakes', 'docerias', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/66a2f79c-9276-4fe8-8201-4a59b3960bed/logo_1776435476293.jpg', true, 0.0, '2026-04-17 13:52:40.632594+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'ativo', false, 'test-teste-docerias-d60b', NULL, NULL, NULL, NULL, NULL, 'Itatinga', 'SP', NULL, 'own', 3, NULL, NULL, '{"zapi_enabled": false, "pizza_price_mode": "maior", "pizza_half_enabled": false}', 6, false, false, NULL, NULL, false, '{docerias}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'ItaSuper Pizzaria', 'pizzas', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/logo_1775742396187.png', true, 5.0, '2026-04-09 13:45:13.67122+00', '6becbb34-0fd2-4f6b-ba60-46bc058c15e6', 'ativo', false, 'campanario-pizzaria', 'Rua São Francisco', '635', NULL, 'Centro', NULL, 'itatinga', 'SP', '18690081', 'own', 12, NULL, NULL, '{"zapi_enabled": false, "pizza_price_mode": "maior", "pizza_half_enabled": true}', 6, false, false, NULL, NULL, false, '{pizzas,lanches,restaurante}') ON CONFLICT DO NOTHING;
INSERT INTO public.stores VALUES ('00f1814d-703d-4ac1-898d-d53188903aeb', 'AnaDelivery', 'restaurante', NULL, true, 0.0, '2026-04-24 17:16:36.577244+00', 'acefbf75-9e70-473e-b8ae-c6fb170c886e', 'ativo', false, NULL, 'Rua Capitão João Braz', '37', NULL, 'Centro', NULL, 'Pardinho', 'SP', '18640029', 'own', 0, NULL, NULL, '{}', 6, false, false, NULL, NULL, false, '{restaurante}') ON CONFLICT DO NOTHING;


-- Data for Name: menu_sections; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.menu_sections VALUES ('e2fcea76-3fbc-4f00-a2b3-3041a3403066', '477b9f42-d4c7-4cdf-a24b-fac59212f6d1', 'Destaques', 0, '2026-04-09 15:59:33.512913+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('2d7cb792-d7d2-4b31-b8ec-121f56c0b263', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Lanches', 0, '2026-04-04 01:57:12.092249+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('464ef4d7-4221-4e9f-91a3-2569e7fa9220', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Bebidas', 1, '2026-04-04 01:51:11.986093+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('e00b12b6-c5c2-4c94-be75-69ae4897b7d5', '7bcc5fc0-d45c-4c81-86db-7d55f4d4e122', 'Destaques', 0, '2026-04-13 19:24:39.267486+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('ba3c74fb-d999-4809-86b3-36a3333a0c26', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'Frango', 2, '2026-04-14 23:10:24.048115+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('c5807567-cc03-45e5-be51-5e0c598183ff', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'Hot Dog', 3, '2026-04-14 23:10:24.376829+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('794b714b-9331-49cd-a196-763b6123e49f', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'Lanches na Baguete', 4, '2026-04-14 23:10:25.197074+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('a1357a38-b652-4a13-8313-8743ef16768f', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'Porções', 5, '2026-04-14 23:10:25.470045+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('08613cfd-c39c-4655-a77d-ce25bcb17af7', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'Hambúrguer ', 1, '2026-04-14 23:10:23.686731+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('61bbbe54-946a-4f8a-93f2-86ddbd0985fb', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Pizzas Tradicionais', 0, '2026-04-07 16:16:23.543985+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('cea97ba5-acee-4b0b-a1a2-d0f1d7c89447', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Pizzas Especiais', 1, '2026-04-07 16:16:23.543985+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('a83e6bb4-2525-4ce8-ba2c-e6d0beab6f92', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Pizzas Doces', 2, '2026-04-07 16:16:23.543985+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('288e3c7f-9330-45b6-ba61-df3c66c3b109', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Bebidas', 3, '2026-04-07 16:16:23.543985+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('c3078d60-9571-4037-b6a9-5cfc0552ca8e', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'Especiais', 5, '2026-04-14 23:20:03.100746+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('a1b2c3d4-0001-4000-8000-000000000001', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Esfihas Salgadas', 0, '2026-04-16 02:03:35.613081+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('dc71653c-1abb-4f6b-8be4-78f4b95b8493', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Destaques', 0, '2026-04-17 13:52:40.632594+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('6bd57136-ef16-4a60-a9b1-b95997b8ced9', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Combos Café', 1, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('d6caabfb-f4ac-4392-8111-5e6c9881c6d3', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolos de Pote (220ml)', 2, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('e89163b4-b8cb-448e-b288-97547f466d86', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Novidade', 3, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('93ff2075-9aa3-4f64-bef3-18f30f151950', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Copo da Felicidade', 4, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('e3c3eddb-23a0-4599-8c97-4d45ed055276', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brigadeiros', 5, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('c2ecadb9-817e-4883-a914-87ca3651921b', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brownies', 6, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('9112448e-4308-436f-82ed-db1482d6b3d4', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coxinhas e Bombons Banhados', 7, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('564bea98-00a7-4caf-878d-f5209ffe06cb', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolos Vulcão', 8, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('701dec21-4f1b-4a4b-9f18-0e398611a71a', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Queridinhos Jéssica Cakes', 9, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('78903ad8-14da-47a8-96dd-48aa429d2583', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho Gourmet (150g)', 10, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('5b7d77fa-e46d-4aa3-b8de-792a1a410531', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Açaí e Sobremesas', 11, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('c716c531-adc2-47a6-99f1-d4afde267266', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Lanches na Chapa', 12, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('dd3dea13-b0f0-4774-be28-ac8a20670e6b', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Salgados', 13, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('ee6d3b85-0334-45b2-8b2a-decfd36b6fc0', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bebidas', 14, '2026-04-17 13:55:24.236079+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('db2b900e-369f-4ae8-8230-66dc0cf3dc2b', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Pizzas Doces', 1, '2026-04-09 13:48:06.645682+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('75578792-0084-441b-97b0-fa20e4287a24', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Refrigerantes e Água', 2, '2026-04-09 14:48:06.287207+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('716b6a95-0b54-4653-96d9-7c61a22e684a', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Pizzas Salgadas', 0, '2026-04-09 13:48:06.230095+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('46650fec-2840-4b2b-838d-6cb298c8bace', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Sucos Integrais e Naturais', 3, '2026-04-09 14:48:05.975926+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('89a04c77-c263-492d-a3b7-db17581586ca', 'fbff1580-ce82-4798-a96f-f149c69166b3', 'X-Tudo', 1, '2026-04-08 14:15:26.965084+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('654f1cc4-d8dd-46ba-920b-f2a3f1fb9032', 'fbff1580-ce82-4798-a96f-f149c69166b3', 'Refrigerantes', 2, '2026-04-08 14:31:03.48388+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('f7cba88a-b0e9-4a26-9b57-b490a397d611', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Vinhos', 3, '2026-04-18 21:48:05.271107+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('6428911a-1a10-4764-a50a-34cb28a9753e', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Pizzas Doces', 1, '2026-04-18 21:48:05.271107+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('5b831351-bb95-4703-a14d-6af9325bb7bc', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Cervejas', 4, '2026-04-18 21:48:05.271107+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('96e88631-20be-4b4f-9cbe-59f9efcd8775', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Long Neck', 5, '2026-04-18 21:48:05.271107+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('22bc9730-12e3-4b26-b355-86de6a5f3091', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Refrigerantes', 2, '2026-04-18 21:48:05.271107+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('8b04df45-f30b-48ac-becb-06ce5c958176', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Pizzas Salgadas', 0, '2026-04-18 21:48:05.271107+00') ON CONFLICT DO NOTHING;
INSERT INTO public.menu_sections VALUES ('c73a4ba3-4e46-4b52-8d40-1c8ea6e8354a', '77d96f88-c440-4c13-b547-11a6ae2240a1', 'Prato Do Dia', 0, '2026-04-11 22:25:27.540778+00') ON CONFLICT DO NOTHING;


-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.products VALUES ('5af9c4cd-a7da-4f5f-abe2-966e50dae2ec', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'U2', 28.00, 'Hambúrguer especial de calabresa, queijo prato,bacon,alface americana e picles.', NULL, true, '2026-04-14 23:23:57.150888+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a0e75b66-37f9-4a49-8355-5b8d1c4a7c8c', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Baianinha', 5.99, 'Calabresa ralada, mussarela, tomate em cubos, cebola fatiada, pimenta e ovo', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('92ea4f5b-3d6d-4220-b6a3-17bcea4b37d1', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Bauru', 5.85, 'Presunto ralado, mussarela ralada, tomate em cubos e orégano', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2b71bfa8-7a46-4e0e-8f68-87c8aeff9902', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Caipira', 5.90, 'Frango, bacon, catupiry, milho e alho frito', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('cb15e64a-9f92-408e-8899-4f20392b18f0', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Caipira III', 5.99, 'Frango, catupiry, milho, bacon, champignon e alho frito', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('9ee4e057-1a54-4002-853d-9620449da8ce', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Caipira IV', 5.99, 'Frango, cream cheese, bacon e milho', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1830d888-23f9-4ae2-95f2-72a01f17d58d', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Carne Moída', 5.85, 'Carne moída, cebola em cubos e tomate em cubos', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a21031df-0a9a-4772-ab74-616df8152192', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Canadense', 5.99, 'Lombo, palmito, mussarela, cebola, tomate cereja e catupiry', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('6201934f-2658-4594-867f-c31c13c7418b', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Calabresa com Bacon', 5.99, 'Calabresa, bacon e mussarela', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c6f6bb1c-b832-46c6-a6d6-84b724cb33d2', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Calabresa Especial', 5.99, 'Calabresa ralada, mussarela, tomate, catupiry e orégano', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b2793efa-3581-4af6-9b1b-b6e466f9c057', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Calabresa Especial c/ Bacon', 6.20, 'Calabresa ralada, cebola, mussarela, catupiry, bacon, tomate e orégano', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('3fbbdbd6-729e-4185-8b40-b521b8a5f91b', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Calabresa Fatiada', 5.50, 'Mussarela, calabresa fatiada, cebola fatiada, tomate e cheiro verde', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('8b1bd760-a313-4037-86c2-35bbdef1d152', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Calabresa Ralada', 5.65, 'Calabresa ralada e cebola em cubos', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('8796b417-97b4-4158-972f-dda9b0850f42', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Brócolis c/ Atum', 6.60, 'Mussarela, brócolis, atum, catupiry, alho frito e tomate seco', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('fa5ec5fd-7556-4ac4-bfad-0fbf9952c16a', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Brócolis c/ Filé Mignon', 6.99, 'Brócolis, filé mignon, mussarela, catupiry, alho frito e tomate seco', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('73a81ead-3369-48aa-89a1-0ae7d32eda29', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Brócolis Completa', 5.85, 'Brócolis, bacon, mussarela, alho frito e catupiry', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('04f6e36d-e521-40c6-91ff-f1ac873f0be7', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Brócolis Simples', 5.25, 'Brócolis, mussarela e alho frito', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('267ec1db-26ee-4785-86a3-730a46960df3', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Caprese', 7.20, 'Mussarela, tomate em rodela, parmesão, pesto de azeitona preta', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4a1ed1fb-d4a3-448e-89ed-2ee5a98fcf85', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Teste 22', 1.00, NULL, NULL, true, '2026-04-03 18:24:15.887818+00', NULL, '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1cf26d4e-daba-4967-b039-f649a33ac798', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Caprichosa', 5.99, 'Mussarela, bacon, cream cheese, tomate e manjericão', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('3d01c496-1057-49a0-8baa-3e82680f5d34', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Coca Cola 2L', 14.00, NULL, NULL, true, '2026-04-04 01:52:22.42302+00', '464ef4d7-4221-4e9f-91a3-2569e7fa9220', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('cfa93788-c6a9-4cb5-bd58-5f9e0712ad7c', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Fanta Uva 2L', 12.00, NULL, NULL, true, '2026-04-04 01:52:38.121828+00', '464ef4d7-4221-4e9f-91a3-2569e7fa9220', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('660c5ea1-0fb6-47bb-9c01-a63d16a7fab6', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Sprite 2L', 11.00, NULL, NULL, true, '2026-04-04 01:55:31.927258+00', '464ef4d7-4221-4e9f-91a3-2569e7fa9220', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('40f9cfd3-e354-4258-8d4a-815e1b057395', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Fanta Laranja', 12.00, NULL, NULL, true, '2026-04-04 01:56:35.157318+00', '464ef4d7-4221-4e9f-91a3-2569e7fa9220', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('35fc0a88-f4bc-41cc-a1d7-5f630624d5e4', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Cachorro Quente', 25.00, NULL, NULL, true, '2026-04-04 01:57:35.479801+00', '2d7cb792-d7d2-4b31-b8ec-121f56c0b263', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1d7cb167-521f-4ed4-b175-2670547a7047', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'X-Tudo', 36.00, NULL, NULL, true, '2026-04-04 01:58:01.809294+00', '2d7cb792-d7d2-4b31-b8ec-121f56c0b263', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0756deeb-97d1-4557-b9e7-cbfaef3d99c6', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'X-Bacon', 32.00, NULL, NULL, true, '2026-04-04 01:58:20.509292+00', '2d7cb792-d7d2-4b31-b8ec-121f56c0b263', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f233c394-972b-48ff-b852-4a593c6fa317', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'X-Calabresa', 30.00, NULL, NULL, true, '2026-04-04 01:58:40.174683+00', '2d7cb792-d7d2-4b31-b8ec-121f56c0b263', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b0abc231-2611-43e6-8568-fdfd96843414', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'Coca Cola', 17.00, NULL, NULL, true, '2026-04-05 23:56:11.114081+00', NULL, '{"drink_type": "Refrigerante", "is_beverage": true, "drink_volume": "2L"}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('6ce7f9c3-fb84-48b8-bebe-003f59787aa0', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Caprichosa de Frango', 5.99, 'Mussarela, frango, cream cheese, tomate, orégano e manjericão', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b5222454-4aba-4321-915a-ba0f31302f8c', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Caprichosa de Frango Especial', 6.20, 'Mussarela, frango, milho, champignon, cebola, tomate e cream cheese', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('83aae82c-b0d3-4f5e-9da0-f0f9b110cead', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Catubacon', 5.99, 'Catupiry e bacon', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a8581da0-2ece-499b-aca4-d1cac1698183', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Catubacon c/ Champignon', 6.20, 'Catupiry, bacon e champignon', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('bc91b1be-6193-43ce-b9b8-912a3cfee560', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Champignon', 5.85, 'Mussarela, champignon, catupiry e azeitona preta', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('203d36eb-20e8-4e21-82d9-ad4df12dde9e', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Champignon Especial', 5.85, 'Mussarela, champignon, catupiry e bacon', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f702ee63-4e92-4b6f-80e5-cc1033a34113', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Champilombo', 5.85, 'Mussarela, lombo, catupiry, champignon, bacon e tomate em cubos', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1ab50e7b-7c1d-460f-8612-0da02d7e10cd', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Filé c/ 3 Queijos', 6.99, 'Mussarela, filé, catupiry e gorgonzola', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('556b6bd0-5f0e-437d-9391-187638e45569', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Filé c/ Bacon', 6.20, 'Mussarela, filé, bacon e catupiry', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('3143f949-6c2a-4e26-a4ab-ce53ded01e1a', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Coca Cola', 15.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('001dddd6-88a4-4576-b8e0-99cd14c4db3e', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Coca Cola Zero', 15.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f31628cf-2573-4345-b2f8-4cf0fea8ad89', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Antártica', 12.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('47ac10f7-dc8c-49b5-aa45-7d8c5f470788', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Antártica Zero', 12.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('bd74774e-b5d5-4e40-a35a-8f7f038b6f4d', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Sprite', 12.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('be49c787-2519-43a4-a9cc-9445ea97e802', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Fanta', 12.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d0080291-4170-4846-a1ab-7396134c4e31', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Vieira', 10.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('057451bb-ebc8-4be3-9518-0e4dd18799b4', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Coca Lata', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('20f0342e-a752-4cb2-80eb-6e33e18904b2', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Calabresa', 0.00, 'Calabresa, cebola, azeitona, orégano', NULL, true, '2026-04-07 16:16:23.543985+00', '61bbbe54-946a-4f8a-93f2-86ddbd0985fb', '{"pizza_sizes": {"broto": 25.90, "media": 39.90, "grande": 49.90, "familia": 64.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('220b5c59-9600-47ae-9c21-31921ead914a', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Mussarela', 0.00, 'Mussarela, tomate, orégano', NULL, true, '2026-04-07 16:16:23.543985+00', '61bbbe54-946a-4f8a-93f2-86ddbd0985fb', '{"pizza_sizes": {"broto": 23.90, "media": 37.90, "grande": 47.90, "familia": 59.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4fd6feb5-bc30-4bb9-bc67-400e2eabb769', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Margherita', 0.00, 'Mussarela, tomate, manjericão fresco', NULL, true, '2026-04-07 16:16:23.543985+00', '61bbbe54-946a-4f8a-93f2-86ddbd0985fb', '{"pizza_sizes": {"broto": 27.90, "media": 42.90, "grande": 52.90, "familia": 67.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('584b3033-5377-4c48-9696-6baa23c3a326', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Portuguesa', 0.00, 'Presunto, ovo, cebola, azeitona, mussarela', NULL, true, '2026-04-07 16:16:23.543985+00', '61bbbe54-946a-4f8a-93f2-86ddbd0985fb', '{"pizza_sizes": {"broto": 28.90, "media": 43.90, "grande": 54.90, "familia": 69.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c7c9b076-509b-4d87-a9bf-1d8095b05a80', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Frango com Catupiry', 0.00, 'Frango desfiado, catupiry, milho', NULL, true, '2026-04-07 16:16:23.543985+00', 'cea97ba5-acee-4b0b-a1a2-d0f1d7c89447', '{"pizza_sizes": {"broto": 29.90, "media": 45.90, "grande": 56.90, "familia": 72.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('92ba5a81-100c-4d86-84d4-fc6cef9ba534', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Quatro Queijos', 0.00, 'Mussarela, provolone, parmesão, gorgonzola', NULL, true, '2026-04-07 16:16:23.543985+00', 'cea97ba5-acee-4b0b-a1a2-d0f1d7c89447', '{"pizza_sizes": {"broto": 31.90, "media": 48.90, "grande": 59.90, "familia": 76.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('95f1bc2a-c47f-42df-bdb1-5ea849a3658f', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Bacon Supreme', 0.00, 'Bacon, mussarela, catupiry, cebola caramelizada', NULL, true, '2026-04-07 16:16:23.543985+00', 'cea97ba5-acee-4b0b-a1a2-d0f1d7c89447', '{"pizza_sizes": {"broto": 32.90, "media": 49.90, "grande": 61.90, "familia": 79.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2d9c962f-5c1b-4531-b433-3e483fe0bf9d', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Chocolate com Morango', 0.00, 'Chocolate ao leite, morangos frescos', NULL, true, '2026-04-07 16:16:23.543985+00', 'a83e6bb4-2525-4ce8-ba2c-e6d0beab6f92', '{"pizza_sizes": {"broto": 28.90, "media": 44.90, "grande": 55.90, "familia": 69.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('60177bb1-2482-4248-a50a-8c8a9c0016af', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Romeu e Julieta', 0.00, 'Goiabada cascão, mussarela', NULL, true, '2026-04-07 16:16:23.543985+00', 'a83e6bb4-2525-4ce8-ba2c-e6d0beab6f92', '{"pizza_sizes": {"broto": 26.90, "media": 41.90, "grande": 51.90, "familia": 65.90}}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('18df760d-fcd0-4fed-95cf-940db31b2b5e', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Coca-Cola 2L', 12.00, '', NULL, true, '2026-04-07 16:16:23.543985+00', '288e3c7f-9330-45b6-ba61-df3c66c3b109', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1abf81f7-38e4-4665-b864-fd91314e1a69', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Guaraná 2L', 10.00, '', NULL, true, '2026-04-07 16:16:23.543985+00', '288e3c7f-9330-45b6-ba61-df3c66c3b109', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('20cef49c-1a03-4148-944b-1857e2bb5769', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'Coca-Cola 350ml', 6.00, '', NULL, true, '2026-04-07 16:16:23.543985+00', '288e3c7f-9330-45b6-ba61-df3c66c3b109', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7091ebb5-50e3-421f-8e5a-e8cf824f8783', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolo de Pote de Brigadeiro', 15.50, NULL, 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/66a2f79c-9276-4fe8-8201-4a59b3960bed/products/1776773514039.jpg', true, '2026-04-17 13:55:24.236079+00', 'd6caabfb-f4ac-4392-8111-5e6c9881c6d3', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('6cd120ec-1dbf-404f-add0-6a936dd24cb5', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolo de Pote de Leite Ninho com Nutella', 15.50, NULL, 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/66a2f79c-9276-4fe8-8201-4a59b3960bed/products/1776773568463.jpg', true, '2026-04-17 13:55:24.236079+00', 'd6caabfb-f4ac-4392-8111-5e6c9881c6d3', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ce46597d-2f51-4a73-a995-12511fbef048', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolo de Pote de Leite Ninho com Morango (Massa Chocolate)', 15.50, NULL, 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/66a2f79c-9276-4fe8-8201-4a59b3960bed/products/1776773557471.jpg', true, '2026-04-17 13:55:24.236079+00', 'd6caabfb-f4ac-4392-8111-5e6c9881c6d3', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('79274bbf-f7e2-4171-ae33-e1522f223b72', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'NIRVANA', 30.00, 'Hambúrguer especial, queijo prato, catupiry e bacon.', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('6d259c3f-7176-46c1-80bd-4d3b9086e6f9', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', '1 Misto + 1 Cappuccino', 28.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '6bd57136-ef16-4a60-a9b1-b95997b8ced9', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2a300e01-25e7-41eb-a20e-7e2a5024f798', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', '6 Mini Pão de Requeijão Recheado + 1 Chocolate Quente', 21.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '6bd57136-ef16-4a60-a9b1-b95997b8ced9', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('896ef328-9026-4a1f-8660-a98fafcf749a', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', '1 Tostadinho + Cappuccino', 24.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '6bd57136-ef16-4a60-a9b1-b95997b8ced9', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('dfd47f89-917c-4c16-95a1-7ce6a2cb633b', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolo de Pote Brigadeiro com Morango', 15.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'd6caabfb-f4ac-4392-8111-5e6c9881c6d3', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b9402fbb-d726-446e-90e5-14068f8783be', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolo de Pote de Doce de Leite com Nozes', 15.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'd6caabfb-f4ac-4392-8111-5e6c9881c6d3', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ff2e0227-bd57-47fe-bfe4-fa7222e7d8bf', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolo de Pote de Leite Ninho com Morango (Massa Branca)', 15.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'd6caabfb-f4ac-4392-8111-5e6c9881c6d3', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('cb516bc5-1487-4a86-9f0e-6da10fcbf795', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolo de Pote de Prestígio', 15.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'd6caabfb-f4ac-4392-8111-5e6c9881c6d3', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d1378ac2-39f3-4805-bbd5-6a833e650616', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Folhado de Morango', 12.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e89163b4-b8cb-448e-b288-97547f466d86', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ceb605a5-155d-4d4d-938a-de25b382bbaf', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', '6 Mini Pão de Queijo', 7.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e89163b4-b8cb-448e-b288-97547f466d86', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0a868a06-cb24-42af-a827-7b6ea9d8e882', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Cappuccino Gelado', 10.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e89163b4-b8cb-448e-b288-97547f466d86', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('8c3d6ac6-aefc-4c27-b4fd-8a7299e282bb', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Chocolate Quente 240ml', 16.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e89163b4-b8cb-448e-b288-97547f466d86', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('852754f7-7f12-468d-899f-c16a9c7404ee', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Chocolate Quente 240ml + 6 Mini Pão de Queijo', 19.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e89163b4-b8cb-448e-b288-97547f466d86', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('dfadb4d0-bbff-4626-8f59-cbae96c012dc', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Copo Brownie Supreme', 21.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '93ff2075-9aa3-4f64-bef3-18f30f151950', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('46a80523-229e-4f35-bd53-2e2dd3587ece', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Copo Duo', 21.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '93ff2075-9aa3-4f64-bef3-18f30f151950', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b153d910-01a2-4370-b7f7-666d36b9dc0f', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Copo Uva Supremo', 21.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '93ff2075-9aa3-4f64-bef3-18f30f151950', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ea4708d7-3509-41eb-8a24-8934a9c418d1', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Copo Supremo de Morango', 21.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '93ff2075-9aa3-4f64-bef3-18f30f151950', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('376d89e9-bbe9-4a91-be17-0f1ae485875b', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Combos de Copos com Morango', 21.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '93ff2075-9aa3-4f64-bef3-18f30f151950', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0e4dd235-ac8d-40d3-9112-f1745bcd62b2', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Leite Ninho 20g', 4.25, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('201ea5ab-ba90-49eb-b25e-0201d67be68d', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Leite Ninho com Nutella 20g', 4.25, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2e1e92cd-e8b0-4cc6-9c25-bda8dee18bb8', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brigadeiro Tradicional 20g', 4.25, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('accf3e7d-d23b-4f54-8681-df2c64918fa4', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brigadeiro de Ferrero Rocher 20g', 4.25, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('31ae7cf4-b838-4c6f-b7db-3f4b50e15872', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brigadeiro Dark 20g', 4.25, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0c33fbf0-ebf6-4c2f-9d3c-4206431bd8d7', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brulée 20g', 4.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('70f762e5-c518-4411-a1c9-a6ad4250ab28', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Copo Ninhotella com Morango', 21.00, NULL, 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/66a2f79c-9276-4fe8-8201-4a59b3960bed/products/1776773624803.jpg', true, '2026-04-17 13:55:24.236079+00', '93ff2075-9aa3-4f64-bef3-18f30f151950', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b7bffcf0-abe0-45bc-a716-eb967be79dae', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Copo de Maracujá', 21.00, NULL, 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/66a2f79c-9276-4fe8-8201-4a59b3960bed/products/1776773651221.jpg', true, '2026-04-17 13:55:24.236079+00', '93ff2075-9aa3-4f64-bef3-18f30f151950', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1a23717d-12a4-4662-93ed-d27cbe80da2a', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Copo Ninhotella com Uva', 21.00, NULL, 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/66a2f79c-9276-4fe8-8201-4a59b3960bed/products/1776773684141.jpg', true, '2026-04-17 13:55:24.236079+00', '93ff2075-9aa3-4f64-bef3-18f30f151950', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ec192196-2abf-4f9e-b136-e814766a0c36', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'QUEEN', 24.00, 'Hambúrguer especial, queijo prato, alface e tomate.', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('935f4ce1-0de3-496f-8ab8-186aaecb7b45', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Beijinho 20g', 4.25, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e6630742-043a-4d8f-bb7c-0315396b3d08', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brigadeiro de Chocolate 60g', 9.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ae9e960c-b83e-4eb0-bb45-da2e3bf7cc4d', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brigadeiro de Kinder 50g', 10.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'e3c3eddb-23a0-4599-8c97-4d45ed055276', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('57f03420-9067-4ef1-80b6-e6e4e0da3149', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brownie Supremo de Kinder 180g', 22.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c2ecadb9-817e-4883-a914-87ca3651921b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d146541d-feae-42ba-8a30-3d22290689ca', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Quadradinho de Brownie Recheado', 12.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c2ecadb9-817e-4883-a914-87ca3651921b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f3c450fc-64c7-4d34-b674-2ddb4efba5f0', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brownie Supremo de Ninho 300g', 25.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c2ecadb9-817e-4883-a914-87ca3651921b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4185eaa9-85fa-4176-82d6-0fb0dd6da702', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Brownie Puro', 8.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c2ecadb9-817e-4883-a914-87ca3651921b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('45eeab81-9923-4af2-8637-38b1d377f58a', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Trio de Brownie', 24.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c2ecadb9-817e-4883-a914-87ca3651921b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('6c5a63be-1f7a-43f1-b0ac-29176ffca837', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coxinha de Brigadeiro com Morango', 12.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '9112448e-4308-436f-82ed-db1482d6b3d4', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b0b4130f-a42c-42e5-bc09-7b3cd08ed483', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coxinha de Brigadeiro com Morango e Nutella', 14.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '9112448e-4308-436f-82ed-db1482d6b3d4', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c092c812-548e-4952-9742-adb09f1f29af', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coxinha de Ferrero Rocher', 14.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '9112448e-4308-436f-82ed-db1482d6b3d4', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('493f3d98-694a-4243-b398-79509cadd606', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bombom de Leite Ninho com Morango Banhado', 14.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '9112448e-4308-436f-82ed-db1482d6b3d4', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a5bf73db-f50e-4970-8ba5-b68be4400b3f', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coxinha de Leite Ninho com Nutella', 12.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '9112448e-4308-436f-82ed-db1482d6b3d4', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('46d7a11c-3cd0-4983-bd4a-1bd79805cf27', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Charuto de Kinder', 13.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '9112448e-4308-436f-82ed-db1482d6b3d4', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('edc9649d-afa6-44a4-a6f6-06bd5713cd63', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Mini Vulcão de Cenoura', 19.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '564bea98-00a7-4caf-878d-f5209ffe06cb', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a9be26aa-7f41-49ab-82a5-2d65eaf4e1e0', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bolo de Cenoura G', 52.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '564bea98-00a7-4caf-878d-f5209ffe06cb', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('9ff52292-502c-414d-b8bb-b3c05399b36f', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Mini Vulcão de Leite Ninho com Nutella 350g', 21.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '564bea98-00a7-4caf-878d-f5209ffe06cb', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1ef80769-4920-4991-8851-a2ed21d0ffca', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Mini Vulcão de Brigadeiro com Morango 350g', 19.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '564bea98-00a7-4caf-878d-f5209ffe06cb', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('bbf03d50-da36-43f3-80ad-b41660aeb9c2', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Mini Vulcão de Brigadeiro 350g', 19.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '564bea98-00a7-4caf-878d-f5209ffe06cb', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b98a6823-ca9d-4944-91f3-55feb0e962bf', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bombom de Leite Ninho com Morango no Pote', 15.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '701dec21-4f1b-4a4b-9f18-0e398611a71a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d872ef1c-aa10-48a1-8086-c9d6f003f436', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Bombom de Leite Ninho com Uva no Pote', 15.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '701dec21-4f1b-4a4b-9f18-0e398611a71a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('71978ae2-5f42-4281-9c44-e29ea0b9dc6e', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Espetinho de Morango com Chocolate', 10.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '701dec21-4f1b-4a4b-9f18-0e398611a71a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('53f8d58f-16ab-4e6f-bce0-f687582bf6e9', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Espetinho de Morango Recheado 200g', 19.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '701dec21-4f1b-4a4b-9f18-0e398611a71a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('6452f172-c9e5-4b01-9e7e-e82a8ea7e457', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Cookies de Nutella 150g', 17.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '701dec21-4f1b-4a4b-9f18-0e398611a71a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f784b603-c346-4e0d-95a0-0da24ee8fd99', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Pudim de Leite Condensado', 12.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '701dec21-4f1b-4a4b-9f18-0e398611a71a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('cc38992d-e331-4a17-a5c1-112deafd45c8', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Cones Trufados', 10.00, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '701dec21-4f1b-4a4b-9f18-0e398611a71a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('44043e69-aa9c-4979-8ecc-c757c9f38862', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Trio de Coxinhas', 28.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '701dec21-4f1b-4a4b-9f18-0e398611a71a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f0ba0b37-4597-4b53-8188-c64d7c9db9db', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho de Pudim', 9.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '78903ad8-14da-47a8-96dd-48aa429d2583', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d597c041-092a-475f-b65b-f7263c35a27c', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho Maracujá com Chocolate', 9.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '78903ad8-14da-47a8-96dd-48aa429d2583', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e2637559-3957-4f62-9ff8-2cd25731222c', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho de Torta de Limão com Chocolate Branco', 9.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '78903ad8-14da-47a8-96dd-48aa429d2583', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a55c3eae-53e6-4ec7-b1a1-ddbb53c6e39f', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho de Sensação', 9.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '78903ad8-14da-47a8-96dd-48aa429d2583', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('03e2f1d2-2d14-412d-bc3b-6e269a253d92', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho de Ninho com Nutella', 9.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '78903ad8-14da-47a8-96dd-48aa429d2583', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f984120b-8868-47b3-bab3-e48a9b2fa9ee', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho de Açaí com Chocolate Branco', 9.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '78903ad8-14da-47a8-96dd-48aa429d2583', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2fefbf79-7218-436a-a6ad-aefda3e7b383', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho de Doce de Leite com Paçoca', 9.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '78903ad8-14da-47a8-96dd-48aa429d2583', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('202051c0-0c5b-45b2-a1e9-e3ce807d1ec1', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Geladinho Chocolate com Brownie', 9.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '78903ad8-14da-47a8-96dd-48aa429d2583', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e9c20e30-7ed7-43a0-b223-8a93dff9192a', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Açaí na Hamburgueira', 23.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '5b7d77fa-e46d-4aa3-b8de-792a1a410531', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('762f7314-ed9d-4e14-9ffa-3f28aa1806f7', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Açaí no Copo', 19.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', '5b7d77fa-e46d-4aa3-b8de-792a1a410531', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('85ffa945-6fc4-48e0-9e53-7aa811d44b71', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Misto Bacon Requeijão', 23.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c716c531-adc2-47a6-99f1-d4afde267266', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('dc90c499-fbbf-40a3-b3d3-c397d71551d2', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Misto Requeijão', 18.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c716c531-adc2-47a6-99f1-d4afde267266', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0f4a04ad-83d2-4fde-a92c-9f0187f78e33', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Misto Quente', 15.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c716c531-adc2-47a6-99f1-d4afde267266', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ad3c7cc6-4f48-45e8-8430-111c293bc7a9', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Tostadinho', 15.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'c716c531-adc2-47a6-99f1-d4afde267266', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('21c99d9a-06da-4595-b687-3fbdd6fee481', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Combo 6 Mini Salgados + Refrigerante + Molho', 19.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'dd3dea13-b0f0-4774-be28-ac8a20670e6b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('27f60f13-394b-43e8-9fb1-4374044ece4c', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coxinha de Costela Requeijão', 15.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'dd3dea13-b0f0-4774-be28-ac8a20670e6b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a55ea728-0371-4be6-8388-3b75ca0dc8ee', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coxinha de Frango Gratinada', 25.90, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'dd3dea13-b0f0-4774-be28-ac8a20670e6b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('3897da9d-2adc-4c35-9e4f-4da07e472231', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coca Cola Zero 200ml', 3.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'ee6d3b85-0334-45b2-8b2a-decfd36b6fc0', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('8d3e6b87-9f16-4a32-8a26-89d933cd9075', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'Coca Cola Tradicional', 3.50, NULL, NULL, true, '2026-04-17 13:55:24.236079+00', 'ee6d3b85-0334-45b2-8b2a-decfd36b6fc0', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('cc2f2f87-c879-4685-9bdb-a617abeb3495', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Coca Lata Zero', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('5396617d-bd0d-43d9-8977-d018832a7b45', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Antártica Lata', 5.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b4d7ecb0-e340-4638-9cd0-80927d8b4ae8', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Fanta Lata', 5.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('920e055b-dcd1-486a-8cf7-cb303f7ab383', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Sprite Lata', 5.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0c06dc48-bfe3-4a72-b9d7-80a252e02773', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Schweppes', 5.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('72327923-3146-4194-a73a-4b9a3620e840', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Tônica', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '22bc9730-12e3-4b26-b355-86de6a5f3091', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c5e8c900-bb64-4296-a52c-449a70ba48a1', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Pergola', 35.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', 'f7cba88a-b0e9-4a26-9b57-b490a397d611', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('3a239436-b4ca-49b0-a50c-8440bc85a116', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Girola', 35.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', 'f7cba88a-b0e9-4a26-9b57-b490a397d611', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1473f9e4-c017-4f50-b0bf-2d7d7321f3e5', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-BURGUER', 16.00, 'Hambúrguer e queijo prato.', NULL, true, '2026-04-14 23:10:26.106031+00', '08613cfd-c39c-4655-a77d-ce25bcb17af7', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4245ea0a-a4b5-438f-beee-d0a5dbbd29fc', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-EGG', 18.00, 'Hambúrguer, queijo prato e ovo.', NULL, true, '2026-04-14 23:10:26.106031+00', '08613cfd-c39c-4655-a77d-ce25bcb17af7', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b56b1fec-56fb-4af4-a1da-d2d2927f9486', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-SALADA', 18.00, 'Hambúrguer, queijo prato, alface e tomate.', NULL, true, '2026-04-14 23:10:26.106031+00', '08613cfd-c39c-4655-a77d-ce25bcb17af7', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f82384a7-b57e-4dd6-b989-576800c83204', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-EGG SALADA', 20.00, 'Hambúrguer, queijo prato, ovo, alface e tomate.', NULL, true, '2026-04-14 23:10:26.106031+00', '08613cfd-c39c-4655-a77d-ce25bcb17af7', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d9e5a66c-082c-4b8f-a99a-a6625ea58633', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-CALABRESA', 20.00, 'Hambúrguer, queijo prato e calabresa.', NULL, true, '2026-04-14 23:10:26.106031+00', '08613cfd-c39c-4655-a77d-ce25bcb17af7', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('742015db-5125-4fe0-b0d5-45eacfc0450a', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-BACON', 20.00, 'Hambúrguer, queijo prato e bacon.', NULL, true, '2026-04-14 23:10:26.106031+00', '08613cfd-c39c-4655-a77d-ce25bcb17af7', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4890cc6b-fd4d-402e-990f-6ce2b3ab9d7b', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-FRANGO', 20.00, 'Frango, queijo prato e tomate.', NULL, true, '2026-04-14 23:10:26.106031+00', 'ba3c74fb-d999-4809-86b3-36a3333a0c26', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('03feae69-d669-4d40-9b75-fdac9b3d6a1a', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-FRANGO SALADA', 22.00, 'Frango, queijo prato, alface e tomate.', NULL, true, '2026-04-14 23:10:26.106031+00', 'ba3c74fb-d999-4809-86b3-36a3333a0c26', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('68706557-1d54-465b-85f9-25633a758d5c', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-FRANGO CATUPIRY', 24.00, 'Frango, queijo prato, catupiry e tomate.', NULL, true, '2026-04-14 23:10:26.106031+00', 'ba3c74fb-d999-4809-86b3-36a3333a0c26', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a01da560-2542-4c04-ad3a-10b49014df08', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'SIMPLES', 10.00, 'Salsicha, molho de tomate, maionese, ketchup e mostarda.', NULL, true, '2026-04-14 23:10:26.106031+00', 'c5807567-cc03-45e5-be51-5e0c598183ff', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('01e234f2-e5a8-4df2-a9f2-2559fda67770', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'ESPECIAL', 16.00, 'Salsicha, molho de tomate, queijo prato, batata palha, milho verde, maionese, ketchup e mostarda.', NULL, true, '2026-04-14 23:10:26.106031+00', 'c5807567-cc03-45e5-be51-5e0c598183ff', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('52ad9a1b-5c58-462b-bfb4-a79d23877b9d', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'BACON', 20.00, 'Salsicha, molho de tomate, queijo prato, batata palha, bacon, maionese, ketchup e mostarda.', NULL, true, '2026-04-14 23:10:26.106031+00', 'c5807567-cc03-45e5-be51-5e0c598183ff', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f8644550-97bc-45b4-ae1d-08e83356d773', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'MISTO QUENTE', 16.00, 'Presunto e queijo prato.', NULL, true, '2026-04-14 23:10:26.106031+00', '794b714b-9331-49cd-a196-763b6123e49f', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('8fba42c2-2535-4095-834c-b060d71e6d16', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'BAURU', 18.00, 'Presunto, queijo prato e tomate.', NULL, true, '2026-04-14 23:10:26.106031+00', '794b714b-9331-49cd-a196-763b6123e49f', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('752b454d-6e99-4aa4-948e-0984feb7e13e', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'PAULISTA', 26.00, 'Carne bovina, queijo prato e tomate.', NULL, true, '2026-04-14 23:10:26.106031+00', '794b714b-9331-49cd-a196-763b6123e49f', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('3a0af590-8688-4e24-b05a-7d44f001bbcc', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'SALAME', 20.00, 'Salame fatiado e limão.', NULL, true, '2026-04-14 23:10:26.106031+00', 'a1357a38-b652-4a13-8313-8743ef16768f', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('62a6a56a-457d-45ff-9a45-ee62fb6c9ba5', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'BATATA FRITA', 20.00, 'Batata frita (sem óleo).', NULL, true, '2026-04-14 23:10:26.106031+00', 'a1357a38-b652-4a13-8313-8743ef16768f', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('85305513-903f-4e69-9d94-7c43b9650eb0', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'BATATA COMPLETA', 30.00, 'Batata frita (sem óleo), bacon, queijo e cheddar.', NULL, true, '2026-04-14 23:10:26.106031+00', 'a1357a38-b652-4a13-8313-8743ef16768f', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1d501bd0-f1fa-4754-90a3-0a66bed7579e', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'CALABRESA', 26.00, 'Calabresa, cebola e pão.', NULL, true, '2026-04-14 23:10:26.106031+00', 'a1357a38-b652-4a13-8313-8743ef16768f', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('28d26d26-2d76-406f-8b52-b0a95d3f4aed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'CARNE', 30.00, 'Carne bovina, cebola e pão.', NULL, true, '2026-04-14 23:10:26.106031+00', 'a1357a38-b652-4a13-8313-8743ef16768f', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d29a583a-2fb8-43f5-b568-ab9ba65cb72a', 'fbff1580-ce82-4798-a96f-f149c69166b3', 'CocaCola', 7.99, NULL, NULL, true, '2026-04-08 14:30:48.578291+00', '654f1cc4-d8dd-46ba-920b-f2a3f1fb9032', '{"drink_type": "Refrigerante", "is_beverage": true, "drink_volume": "350ml"}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7fcc9879-7b51-49a8-8b9e-225a25358dbb', 'fbff1580-ce82-4798-a96f-f149c69166b3', 'X-Tudo', 37.90, NULL, NULL, true, '2026-04-08 14:15:27.884734+00', '89a04c77-c263-492d-a3b7-db17581586ca', '{"bread_types": ["Tradicional"], "lanche_type": "X-Tudo", "patty_weight": "150g", "meat_doneness": ["mal passado", "Ao Ponto"]}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4a10c353-7438-48cd-9a37-4ae8867eb1fa', 'fbff1580-ce82-4798-a96f-f149c69166b3', 'Cachorro quente', 6.00, NULL, NULL, true, '2026-04-08 19:18:32.208493+00', NULL, '{"patty_weight": "150g"}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2882ec76-a2ce-4e44-a4cb-0029757a7bd0', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', '3 queijos', 67.00, 'Molho, mussarela, requeijão cremoso, parmesão, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1b997cc8-41b3-49eb-814c-feb45f7ad6ad', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', '4 queijos', 69.00, 'Molho, mussarela, requeijão cremoso, parmesão, gorgonzola, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('54ddf251-e7dd-4113-956e-71b7b3534367', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Atum', 64.00, 'Molho, mussarela, atum, cebola, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ccf89955-9e2d-45e6-b0b2-173ddd47e006', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Baiana', 64.00, 'Molho, calabresa, mussarela, cebola, ovo, pimenta calabresa, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f85c8b22-9568-4007-9642-d30498a0178d', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Bauru', 56.00, 'Molho, mussarela, presunto, tomate, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('8a80b204-071c-4d40-b4cb-6d7f7750701b', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Brócolis', 76.00, 'Molho, mussarela, brócolis, bacon, alho frito crocante, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f21bc9d1-8e7b-4316-821a-d85869745d37', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Calabresa', 56.00, 'Molho, calabresa, cebola, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a04247bb-f9bf-483c-a550-9760b3999a7b', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Carne seca', 82.00, 'Molho, mussarela, carne seca desfiada, requeijão cremoso, cebola, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d5a771a8-ae91-4ae3-a073-57d9af0f2726', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Carne Seca Supreme', 93.00, 'Molho, mussarela, carne seca, cream cheese, gorgonzola, cebola, orégano e azeitonas', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c3c87d5e-8091-4948-bd17-fdc47660982e', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Costela', 82.00, 'Molho, mussarela, costela desfiada, requeijão cremoso, pimenta biquinho, cebola, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a63e3597-ab4e-4895-bc6c-1cd499daca48', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'X-BACON SALADA', 22.00, 'Hambúrguer, queijo prato, bacon, alface e tomate.', NULL, true, '2026-04-14 23:10:26.106031+00', '08613cfd-c39c-4655-a77d-ce25bcb17af7', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('562dacdf-5cc4-41a8-b2b4-b3c49ebc3820', 'f667fc5c-48d2-4b05-a370-b28720161009', '2 Queijos', 5.90, 'Mussarela e catupiry', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7e192cef-bc93-4838-a48e-1aa29bfe4101', 'f667fc5c-48d2-4b05-a370-b28720161009', '3 Queijos de Parmesão', 6.20, 'Mussarela, catupiry e parmesão', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('9604e6ae-684a-48e4-9b3c-4af934228fa4', 'f667fc5c-48d2-4b05-a370-b28720161009', '3 Queijos (Gorgonzola)', 6.30, 'Mussarela, gorgonzola e catupiry', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d5fd0773-9310-4f01-938e-9b98a8c75154', 'f667fc5c-48d2-4b05-a370-b28720161009', '4 Queijos', 6.50, 'Mussarela, catupiry, gorgonzola e parmesão', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('72da59de-fd15-4092-be8a-088d523542c7', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Catumilho', 6.00, 'Catupiry e milho', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('00f560a9-3792-48d5-9323-13982979e9b6', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Abobrinha', 5.95, 'Mussarela, abobrinha, parmesão, catupiry, alho frito, tomate seco e alcaparras', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e71abea6-9cc5-4584-b4ef-a35bee3af139', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Creme de Queijo', 5.90, 'Creme de queijo e cheiro verde', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('98ad0da8-4d88-4741-bdf7-611da47dccec', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Creme de Queijo c/ Bacon', 6.20, 'Cheddar e mussarela', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('00b80908-00c3-416e-bca7-d4a70178a865', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Alho Frito', 5.50, 'Mussarela e alho frito', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c8837fba-5c1d-4227-a80b-a5dec1371b17', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Alho Frito c/ Catupiry', 5.65, 'Mussarela, alho frito e catupiry', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4ae8dd17-9974-4705-9971-922e97e04bf9', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Alho Frito Especial', 5.75, 'Mussarela, alho frito, catupiry, tomate e orégano', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('92bb42ae-6f7a-45c3-8010-983011d5eacd', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Atum', 5.99, 'Atum, cebola fatiada e tomate em cubos', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('76ea6133-792c-449c-a18f-211d969b24e3', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Atum c/ Alcaparras', 6.50, 'Mussarela, atum, cebola, catupiry, tomate seco e alcaparras', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d0631a66-89fb-4ae1-bd8f-11564540b1aa', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Costela Supreme', 93.00, 'Molho, mussarela, costela, requeijão cremoso, gorgonzola, cebola, pimenta biquinho, azeitona e orégano', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0df32697-8c40-4da0-a96a-9d302deca55e', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Filé Mignon', 93.00, 'Molho, mussarela, filé mignon, requeijão cremoso, cheddar cremoso, bacon, cebolinha, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c9657a9f-5f37-4351-a024-dcea0d6fea90', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Filé Mignon ao Funghi', 93.00, 'Molho, mussarela, filé mignon, bacon, requeijão cremoso, champignon, azeitona e orégano', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('55bbc87e-40d3-4a6a-b7e5-85a510f3a07d', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Frango com Palmito', 66.00, 'Molho, frango, requeijão cremoso, mussarela, palmito, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('71db70ba-f737-4492-9d78-aba42a473a79', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Frango Especial', 68.00, 'Molho, frango, requeijão cremoso, mussarela, bacon, milho, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('fda1f89f-453a-4c8c-af32-6dbd8afa6036', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Frango Simples', 64.00, 'Molho, frango, requeijão cremoso, mussarela, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2fce8a23-bc5b-469f-a9d5-878a7fbdc876', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Lombo', 68.00, 'Molho, mussarela, lombo canadense, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d91760b2-c6c7-42a3-b9dc-a5c76bb8ba0d', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Lombo canadense', 78.00, 'Molho, mussarela, lombo canadense, requeijão cremoso, bacon, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e695514b-d172-4f9f-a150-d846858e081e', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Margueritta', 64.00, 'Molho, mussarela, parmesão, manjericão fresco, tomate cereja', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('5fc553f3-58ed-4fac-9cd1-f3541639f390', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Mussarela', 56.00, 'Molho, mussarela, tomate, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c9fdc748-d8fb-4a64-940a-43e59dfb0287', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Palmito', 68.00, 'Molho, mussarela, palmito, bacon, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2f57ee19-9d6e-4efe-b2fc-ce9132cf883e', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Pepperoni', 62.00, 'Molho, mussarela, Pepperoni (Salame seco, defumado e picante), orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('fed6221a-e1c0-45c2-8fd6-8778bf880083', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Portuguesa', 56.00, 'Molho, mussarela, presunto, cebola, ovo, ervilha, milho, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c77a4c6b-1015-45ae-a497-f7c127654cfb', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Rúcula', 82.00, 'Molho, mussarela, requeijão cremoso, parmesão, rúcula, tomate seco, azeite de oliva, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a75cb25e-f139-4f95-8af7-c8084518795c', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Sabores da Casa 1', 68.00, 'Molho, calabresa, lombo canadense, bacon, alho frito crocante, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('40c5a3f0-625d-4aaa-9b5d-479042df4b18', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Sabores da Casa 2', 76.00, 'Molho, calabresa, mussarela, requeijão cremoso, bacon, milho, cebola, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('26695246-bdc6-4215-8ced-a1b971375646', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Siciliana', 65.00, 'Molho, mussarela, champignon, bacon, azeitona e orégano', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0b17deef-acc1-4216-8993-8f1f0cf69530', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Toscana (Calabresa com Mussarela)', 62.00, 'Molho, calabresa, mussarela, cebola, orégano e azeitona', NULL, true, '2026-04-09 13:48:07.119895+00', '716b6a95-0b54-4653-96d9-7c61a22e684a', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b8370646-c633-4b3a-8989-59749c681744', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Banana nevada', 60.00, 'creme de leite, banana, canela e chocolate branco', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7f9d9710-12e2-46aa-af57-a1655a8dea13', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Brigadeiro', 54.00, 'creme de leite, brigadeiro artesanal e granulado', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4e3af0b3-ca12-40eb-a1dc-30099a3aca90', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Chocolate Duplo', 63.00, 'creme de leite, chocolate com avelã e chocolate branco', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c7ed3517-15a3-4562-9a25-1aabc2ed1fb5', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Mineirinha', 68.00, 'creme de leite, mussarela, banana, canela e doce de leite cremoso', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7a261188-07c8-45e6-9904-5b761a16caef', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Pizza Kids', 63.00, 'creme de leite, chocolate com avelã e confetes de chocolate', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('8834aee8-93e3-4f9c-8850-6813db392812', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Prestigio', 54.00, 'creme de leite, brigadeiro artesanal, coco ralado e pedaços de prestigio', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0ac773de-6cd0-4e00-ad20-1b6603f7ca1e', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Romeu e Julieta', 57.00, 'creme de leite, mussarela e goiabada', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('bd15767c-9fc9-4a41-8f50-6e10387ebfba', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Sensação', 69.00, 'creme de leite, brigadeiro artesanal, granulado e morangos frescos', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('66c6f06a-3f50-4907-a89c-1329db401d02', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Snickers', 68.00, 'creme de leite, chocolate avelã, doce de leite, amendoim e pedaços de snickers', NULL, true, '2026-04-09 13:48:07.119895+00', 'db2b900e-369f-4ae8-8230-66dc0cf3dc2b', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1f0ad427-d415-42aa-bfb7-16e954ab0a98', '77d96f88-c440-4c13-b547-11a6ae2240a1', 'Marmita P', 21.00, 'Arroz, Feijão, batata frita, parmegiana', NULL, true, '2026-04-23 15:08:06.815687+00', 'c73a4ba3-4e46-4b52-8d40-1c8ea6e8354a', '{"is_daily_menu": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('f4db541e-22a2-4990-95eb-3f227edbe018', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Coca Cola Lata', 6.00, 'Coca cola lata 350ml.', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746194925.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('ee21f748-f18d-4b24-8585-fba955a22d3a', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Coca Cola Zero Lata', 6.00, 'Coca cola zero 350ml.', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746225049.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b642abfc-cdcc-4a99-848e-7ba73e2f0f5c', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Guaraná Vieira 2l', 10.00, 'Guaraná Vieira 2l', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746330318.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('3e05065b-35d9-4a72-9de6-540d1f5dff40', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Suco Natural Maracujá', 15.00, 'Jarra 1l suco da polpa da fruta natural.', NULL, true, '2026-04-09 14:48:06.60205+00', '46650fec-2840-4b2b-838d-6cb298c8bace', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('404015d3-4a86-4f09-b7e0-879a95545221', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Fanta Laranja Lata', 6.00, 'Fanta laranja lata 350ml.', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746256186.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b2c9f1b0-3032-4c09-aeed-27c4f2176a1b', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Suco Natural Abacaxi com Hortelã', 15.00, 'Jarra 1l suco da polpa da fruta natural.', NULL, true, '2026-04-09 14:48:06.60205+00', '46650fec-2840-4b2b-838d-6cb298c8bace', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c4aa2fe1-8d6e-4cda-8de9-53080dec1d17', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Suco Natural Abacaxi', 15.00, 'Jarra 1l suco da polpa da fruta natural.', NULL, true, '2026-04-09 14:48:06.60205+00', '46650fec-2840-4b2b-838d-6cb298c8bace', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('144de58e-a655-4aec-99fa-a6999e85bb3a', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Suco Natural Manga', 15.00, 'Jarra 1l suco da polpa da fruta natural.', NULL, true, '2026-04-09 14:48:06.60205+00', '46650fec-2840-4b2b-838d-6cb298c8bace', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('cb72a16b-c292-4a27-bbb2-2247e36701b2', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Suco Natural Maracujá com Manga', 15.00, 'Jarra 1l suco da polpa da fruta natural.', NULL, true, '2026-04-09 14:48:06.60205+00', '46650fec-2840-4b2b-838d-6cb298c8bace', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('31c158dd-5c76-4c9f-903a-58fb777f0d60', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Suco Uva 100% 900ml', 14.00, 'Marca pode ser diferente da anunciada, de acordo com disponibilidade do fornecedor.', NULL, true, '2026-04-09 14:48:06.60205+00', '46650fec-2840-4b2b-838d-6cb298c8bace', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('aded7e31-21b8-4d29-9e92-7c247a67d8cd', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Água com Gás', 4.00, 'Água gaseificada 500ml.', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746171460.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e1c9a29e-218a-44de-815d-271e9f4f0080', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Coca Cola 2l', 16.00, 'Coca cola 2l.', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746184495.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('36024a01-f8c0-4072-8320-eda9c73e5ee8', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Fanta Laranja 2l', 14.00, 'Fanta laranja 2l.', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746236707.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e45df5fa-f612-4353-b5db-b1887e3578d7', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Guaraná Antártica 1l', 8.00, '1 litro.', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746341781.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('0f281663-4514-4708-ac41-27b541072974', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Sprite 2l', 14.00, '2 litros.', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746267622.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e9002944-b4de-43b4-8724-c3810d80dc7c', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'Coca Cola Zero 2l', 16.00, 'Coca Cola Zero 2l', 'https://lktzrqjvqoojlrhqnxuz.supabase.co/storage/v1/object/public/store-assets/6becbb34-0fd2-4f6b-ba60-46bc058c15e6/products/1775746205253.png', true, '2026-04-09 14:48:06.60205+00', '75578792-0084-441b-97b0-fa20e4287a24', '{"is_beverage": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('e00f33fd-c6ec-4d49-99c3-d382ed28f56b', '77d96f88-c440-4c13-b547-11a6ae2240a1', 'Marmita M', 23.00, 'Arroz, Feijão, batata frita, parmegiana', NULL, true, '2026-04-23 15:08:53.93995+00', 'c73a4ba3-4e46-4b52-8d40-1c8ea6e8354a', '{"is_daily_menu": true}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('5d84c631-6c6c-4fb5-9e03-ae58bb0650c4', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'LOS POLLOS HERMANOS', 28.00, 'Hambúrguer especial de frango, queijo prato, bacon, alface americana e cebola roxa', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d14deda4-8f7a-4833-a926-8ab1aee17811', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'STONES', 25.00, 'Hambúrguer especial de pernil, queijo prato e cebola agridoce.', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('bf142c98-4921-4e5e-a21b-bc6f6a6cfce7', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'METALLICA', 24.00, 'Hambúrguer especial de bacon, queijo prato e tomate.', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('412b0cc9-e137-426f-859a-e52a5934e345', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'OASIS', 30.00, 'Hambúrguer especial vegetariano (mandioquinha, batata doce, cenoura e abobrinha), queijo prato, cheddar, ovo, alface americana e picles.', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('deb04401-76a5-443b-bc2d-f75c391fe110', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'KISS', 32.00, 'Frango desfiado, queijo prato, catupiry, bacon, calabresa e milho.勾,name:', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('571d570c-f558-4856-ac8e-aec0d58165c7', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'DEAD FISH', 34.00, 'Hamburguer especial de tilapia, queijo prato, gorgonzola, alface americana e cebola roxa.勾,name:', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7c6ee560-e8ae-4863-9d37-28ed0b12f9e5', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'RED HOT CHILI PEPPERS', 28.00, 'Hambúrguer especial picante, queijo prato, bacon, alface americana e picles.', NULL, true, '2026-04-14 23:20:03.70007+00', 'c3078d60-9571-4037-b6a9-5cfc0552ca8e', '{"is_beverage": false}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('cc4688ef-40b7-493c-b285-cab6ba3bb6f9', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Atum Cremoso', 5.99, 'Creme com atum, cebola, tomate e cheiro verde', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2de6145a-0394-45be-8fe3-deb65cc828fb', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Atum II', 6.20, 'Atum, cebola fatiada, tomate seco, catupiry e mussarela', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c2c57c95-4906-41c3-9a2a-d031e3601073', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Atum III', 6.25, 'Mussarela, atum, cebola, cream cheese, bacon e tomate seco', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('87c4d1dc-a3c9-45b6-baac-9d113a0dfb8d', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Americana', 5.99, 'Lombo, mussarela, catupiry e bacon', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('a4f60baa-3585-4554-9c83-5a10fbf0e2a0', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Bacon', 5.75, 'Bacon e mussarela', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('46924eda-ff8e-4675-9b83-a67402bd6347', 'f667fc5c-48d2-4b05-a370-b28720161009', 'Baconmilho', 5.75, 'Mussarela, milho, catupiry, bacon e alho frito', NULL, true, '2026-04-16 02:03:35.613081+00', 'a1b2c3d4-0001-4000-8000-000000000001', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('3c988632-48a3-461f-9a0a-7622bed5adca', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Girola Seco', 35.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', 'f7cba88a-b0e9-4a26-9b57-b490a397d611', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c580f0c5-8d4b-4130-9b08-045bf06346d0', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Sangue de Boi', 25.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', 'f7cba88a-b0e9-4a26-9b57-b490a397d611', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d23090d0-b495-4be0-a9f3-4962dab4932d', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Sangue de Boi Seco', 25.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', 'f7cba88a-b0e9-4a26-9b57-b490a397d611', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4583d1fb-36b2-4515-be87-635ded506aa6', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Palmeiras', 20.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', 'f7cba88a-b0e9-4a26-9b57-b490a397d611', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7e56f387-7a80-45a0-b715-821e097389d1', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Chopp Vinho', 15.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', 'f7cba88a-b0e9-4a26-9b57-b490a397d611', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('5327899c-c0de-4221-8fd8-540c3a00de38', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Skol', 5.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4c71b299-d33d-4751-84f3-a50a4b9efe2f', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Antárctica', 5.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('06b0a8de-120a-4ecf-b7e9-035746a818b3', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Brahma', 5.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('17f2187a-bd96-4ee6-bbfe-8cd793162c38', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Brahma Zero', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('88821d41-0503-4241-af41-dd7d43124516', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Original', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('810ff837-760c-4043-8cc4-a42e81e115a0', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Budweiser', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d60e5956-acdc-49a3-a55c-8fb9052ed5a7', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Heineken', 8.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c0cc655a-c2eb-4945-abcf-d87fabd187a5', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Amstel', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('d5de9537-8dc6-47bc-bdaa-b55599e148de', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Caracu', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2d00da82-981d-4467-b0a8-a8f48f5c21de', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Malzbier', 6.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '5b831351-bb95-4703-a14d-6af9325bb7bc', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7dceda53-ebd7-403d-b4ab-1465e781d805', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Corona', 10.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '96e88631-20be-4b4f-9cbe-59f9efcd8775', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4e0407f9-8878-42b8-b190-2c08b5fac695', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Heineken Long Neck', 10.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '96e88631-20be-4b4f-9cbe-59f9efcd8775', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('42be12c6-73bb-43e7-8e4d-6b1675e1bdeb', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Budweiser Long Neck', 8.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '96e88631-20be-4b4f-9cbe-59f9efcd8775', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('fd10406f-2b1c-466a-b675-62e8028c862c', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Stella Artois', 8.00, '', NULL, true, '2026-04-18 21:48:50.466837+00', '96e88631-20be-4b4f-9cbe-59f9efcd8775', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('387531f3-889e-4da9-a7bd-4d189fb210db', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Mussarela', 50.00, 'molho, mussarela, tomate e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('4f0b3eff-def2-4ca4-b698-2b8360d39774', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Calabresa', 50.00, 'molho, calabresa, cebola, mussarela e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c50aae17-6623-4dcb-8f76-cc18c42d9566', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Bauru', 50.00, 'molho, presunto, mussarela e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('62165952-dd44-4c3d-b928-9996820d2866', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Napolitana', 50.00, 'molho, mussarela, parmesão, tomate e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('5cdfd9cc-5155-4fc7-bfe8-4ace6d32fcfd', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Alho Frito', 50.00, 'molho, mussarela, alho frito e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('dde63465-9250-4a9d-b726-2533d7508318', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Calabresa Cremosa', 55.00, 'molho, calabresa, catupiry, condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('2f56035c-6260-4b89-8657-4e3c92511940', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Cremosinha', 60.00, 'molho, mussarela, calabresa picada, tomate, ovos, catupiry e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('7d34a2b9-7fe3-4fe7-9eba-04c9d4d29009', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Vegetariana', 60.00, 'molho, mussarela, brócolis, palmito, milho, ervilha, champignon e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('6e6fbfc2-f5ac-4064-b46d-c3b638504ad4', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Portuguesa', 60.00, 'molho, mussarela, presunto, ervilha, milho, ovos, palmito e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('010afc22-70a2-4b83-8665-7d311848afbe', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Frango c/ Bacon', 65.00, 'molho, mussarela, frango temperado, catupiry, bacon e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('12dce1cc-98e7-480b-ab7e-b638272b907f', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Atum c/ Cebola', 65.00, 'molho, mussarela, atum, cebola e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('170ff299-d7dc-4f39-8470-ef49685080eb', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Brócolis c/ Bacon', 70.00, 'molho, mussarela, brócolis, bacon, alho frito e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('abf20491-c226-47c1-89f7-1120bf97c7a4', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Baianinha', 70.00, 'molho, mussarela, calabresa picada, ovos, tomate, cebola roxa, pimenta e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('9f1f02cb-a856-4126-837f-9d9d0cc43ea7', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Lombo Canadense', 70.00, 'molho, mussarela, lombo, catupiry, bacon e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('bdccb9d3-a409-438c-90e0-6a1dcb02ac31', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', '4 Queijos', 80.00, 'molho, mussarela, parmesão, catupiry, gorgonzola e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('c723df6e-2af5-4efa-b156-d8dbeb9da446', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Pepperoni', 80.00, 'molho, mussarela, pepperoni, azeitona e orégano.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('78732a7c-3290-40d8-b653-897901bb1fb8', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Costela', 80.00, 'molho, mussarela, costela desfiada, cebola, catupiry e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('5fc01fa5-04e1-4e0c-826f-175faae7a852', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Carne Seca c/ Biquinho', 80.00, 'molho, carne seca, cebola, catupiry, pimenta biquinho e condimentos.', NULL, true, '2026-04-18 21:48:50.466837+00', '8b04df45-f30b-48ac-becb-06ce5c958176', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('62b41863-f4c5-4d64-9a5e-266d16953949', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Romeu e Julieta', 40.00, 'Mussarela e goiabada.', NULL, true, '2026-04-18 21:48:50.466837+00', '6428911a-1a10-4764-a50a-34cb28a9753e', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('76bf6f40-b828-44ab-a01a-fda2ce5a4dea', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Brigadeiro', 40.00, 'Chocolate e granulado.', NULL, true, '2026-04-18 21:48:50.466837+00', '6428911a-1a10-4764-a50a-34cb28a9753e', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1fa1ae5f-52e1-4564-b7e9-3b63900c9a91', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Chocolate c/ Confeti', 40.00, 'Chocolate e confetis.', NULL, true, '2026-04-18 21:48:50.466837+00', '6428911a-1a10-4764-a50a-34cb28a9753e', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1ffa2174-fdba-4384-aa6f-69ad57d2d12a', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Sonho de Valsa', 45.00, 'Chocolate ao leite e sonho de valsa.', NULL, true, '2026-04-18 21:48:50.466837+00', '6428911a-1a10-4764-a50a-34cb28a9753e', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('b462a59c-5a46-47d8-b99a-8d38f14e2f64', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Dois Amores', 40.00, 'Chocolate branco e chocolate preto.', NULL, true, '2026-04-18 21:48:50.466837+00', '6428911a-1a10-4764-a50a-34cb28a9753e', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('08f30583-2031-48a5-81ef-78344770176e', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Banana Nevada', 40.00, 'Creme de leite, chocolate branco, banana, canela em pó.', NULL, true, '2026-04-18 21:48:50.466837+00', '6428911a-1a10-4764-a50a-34cb28a9753e', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('10e85ea9-c4be-4ec6-bf6b-948154e12bc3', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Nutella c/ Morango', 45.00, 'Creme de leite, nutella, morangos frescos.', NULL, true, '2026-04-18 21:48:50.466837+00', '6428911a-1a10-4764-a50a-34cb28a9753e', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('1c2b97f4-03d6-43c3-abe8-2bf891924193', '050ed159-cfd4-4de5-9e9e-fcc54bf519f8', 'Ouro Branco', 45.00, 'Chocolate branco e ouro branco.', NULL, true, '2026-04-18 21:48:50.466837+00', '6428911a-1a10-4764-a50a-34cb28a9753e', '{}') ON CONFLICT DO NOTHING;
INSERT INTO public.products VALUES ('601f2c1e-0513-4991-bc9e-ecda9aa49220', '77d96f88-c440-4c13-b547-11a6ae2240a1', 'Marmita G', 25.00, 'Arroz, Feijão, batata frita, parmegiana', NULL, true, '2026-04-23 15:09:47.447062+00', 'c73a4ba3-4e46-4b52-8d40-1c8ea6e8354a', '{"is_daily_menu": true}') ON CONFLICT DO NOTHING;


-- Data for Name: addon_groups; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.addon_groups VALUES ('4e6609c4-de75-4d7b-99de-fea8535d81b9', NULL, 'Adicionais', 0, 3, 1, '2026-04-03 20:57:26.838975+00', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('82b5b534-56c7-4e7b-b831-fcb747d1c3e8', NULL, 'Adicionais', 0, 99, 1, '2026-04-14 23:28:38.184558+00', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('b2758dc6-cf59-4e59-bc6e-287a9e0b92b3', NULL, 'Tipo de pao', 0, 1, 2, '2026-04-15 00:00:35.954599+00', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('d63d0323-31a1-4ded-9b1b-792e92001e7e', NULL, 'Hambúrgueres Especiais', 0, 99, 2, '2026-04-15 00:21:12.01067+00', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('bb7290f2-ebb1-4cfb-aad4-bce85a4b78b3', NULL, 'Tipo de Pão', 1, 1, 3, '2026-04-15 15:17:18.771467+00', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('423894fe-4366-4776-8fd7-39da016a2de6', NULL, 'Molhos', 1, 1, 2, '2026-04-15 23:27:52.158398+00', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('f0d289e2-8caf-4761-a1a6-7ac687aed4f9', NULL, 'Adicionais', 0, 12, 1, '2026-04-16 02:06:35.501339+00', 'f667fc5c-48d2-4b05-a370-b28720161009', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('ad6f0e89-6473-480b-be27-39e03ad3e031', NULL, 'Borda', 0, 2, 1, '2026-04-17 14:03:48.520585+00', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('7b1ca892-4587-4068-ae03-5536f9cfe48e', NULL, 'Sabores', 0, 1, 3, '2026-04-17 14:07:44.882281+00', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', false) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('46e1967e-185b-4395-8035-7373b94af81f', NULL, 'Tamanho', 1, 1, 2, '2026-04-21 18:29:08.744801+00', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', true) ON CONFLICT DO NOTHING;
INSERT INTO public.addon_groups VALUES ('d8f48ccc-c77f-419d-89b2-dc902186f478', NULL, 'Tamanho', 1, 1, 2, '2026-04-17 14:04:30.368006+00', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', true) ON CONFLICT DO NOTHING;


-- Data for Name: addon_items; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.addon_items VALUES ('2b9bd75a-2289-4bd8-a870-825401bd46e7', '4e6609c4-de75-4d7b-99de-fea8535d81b9', 'Bacon', 5, 0, '2026-04-04 01:49:15.67642+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('d3c861d4-b2f7-4146-a27e-2be3adaa6b60', '4e6609c4-de75-4d7b-99de-fea8535d81b9', 'Salada', 5, 0, '2026-04-04 01:49:22.757445+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('21b1d4f5-11dd-47b1-b71e-86648201d3d5', '4e6609c4-de75-4d7b-99de-fea8535d81b9', 'Cheddar', 5, 0, '2026-04-04 01:50:02.901078+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('f9380293-bd00-4d6e-b8ed-fe57e4edcdb8', '4e6609c4-de75-4d7b-99de-fea8535d81b9', 'Ovo', 5, 0, '2026-04-04 01:50:26.880291+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('0167b6e7-ed58-470f-b99b-c6e13d9044d1', '4e6609c4-de75-4d7b-99de-fea8535d81b9', 'Ana Claudia', 2, 0, '2026-04-04 02:03:01.242654+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('24cee896-1d0d-4dc2-b13c-15ab6cb12f41', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Hambúrguer', 4, 0, '2026-04-14 23:32:15.988647+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('28e9f333-3f28-4448-b8ee-20052b6bfb8c', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Bacon', 4, 0, '2026-04-14 23:32:31.525024+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('ec563b78-9ff5-49ce-b33f-6c77a35dd92b', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Calabresa', 4, 0, '2026-04-14 23:32:59.204937+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('976de44c-9229-4946-a52a-0802ab9ffef2', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Frango', 4, 0, '2026-04-14 23:33:15.825768+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('43c4b5bb-912d-454e-a718-6683bb6ce93a', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Queijo prato', 4, 0, '2026-04-14 23:33:27.757765+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('3ad52884-ab19-4757-943e-3fd492240d42', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Catupiry', 4, 0, '2026-04-14 23:33:40.518274+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('0aba3892-7b20-45fa-a648-94227dcfde74', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Cheddar', 4, 0, '2026-04-14 23:33:51.730036+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('1a21ad29-f543-4e8a-bde1-96a1682561f9', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Gorgonzola', 5, 0, '2026-04-14 23:34:04.792702+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('9c391b76-6212-42b6-9b36-24060caf43b0', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Presunto', 4, 0, '2026-04-14 23:34:16.852774+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('7e6de86e-23ff-4d15-b379-c42d73f27647', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Salsicha', 3, 0, '2026-04-14 23:34:24.068048+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('10faf62d-9c26-4f17-8e51-50a62e71fa0d', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Cebola agridoce', 3, 0, '2026-04-14 23:34:55.878711+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('0f4eed80-574a-49c2-9a22-71b98753b2ec', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Ovo', 2, 0, '2026-04-14 23:35:07.261073+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('6daeba7f-e2d3-4b0b-ae02-09d1b4950ad5', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Milho verde', 2, 0, '2026-04-14 23:35:21.244776+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('58a1bb57-170e-4e88-9ed1-c35e14aadfb7', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Batata palha', 2, 0, '2026-04-14 23:35:31.822222+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('ea46ad04-4ad0-41fa-8c8b-0a9e5f9bfa9e', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Salada', 2, 0, '2026-04-14 23:35:45.003482+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('60e70c99-7432-465c-8c56-5b0b73ff9c8e', '82b5b534-56c7-4e7b-b831-fcb747d1c3e8', 'Picles', 2, 0, '2026-04-14 23:35:57.542622+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('792a3587-8d75-4317-ad4a-231afb7a7b2f', '423894fe-4366-4776-8fd7-39da016a2de6', 'Molho branco', 2, 2, '2026-04-15 23:27:52.758464+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('17bd618e-e68a-43b6-a7ab-f82509575216', '46e1967e-185b-4395-8035-7373b94af81f', '200ml', 21, 1, '2026-04-21 18:29:09.156112+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('8051b356-8440-4790-aa8d-f6fd02085838', '46e1967e-185b-4395-8035-7373b94af81f', '300ml', 24, 2, '2026-04-21 18:29:09.156112+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('2364de79-7f6b-48f3-8f2c-69ac9630fc31', 'b2758dc6-cf59-4e59-bc6e-287a9e0b92b3', 'Brioche', 0, 0, '2026-04-15 00:00:48.631175+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('60310edb-0009-4182-a21a-aea324f225ec', 'b2758dc6-cf59-4e59-bc6e-287a9e0b92b3', 'Francês', 0, 0, '2026-04-15 00:01:12.338918+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('13446a15-bf07-4f91-96a4-b91f58f71f0e', 'd63d0323-31a1-4ded-9b1b-792e92001e7e', 'Especial Carne', 12, 0, '2026-04-15 00:24:14.207541+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('86aaf02f-0499-41c8-bd9b-714e0dc7c8e6', 'd63d0323-31a1-4ded-9b1b-792e92001e7e', 'Especial Bacon', 12, 0, '2026-04-15 00:24:33.644641+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('e9bec310-3fca-4a91-b7a2-73c72935b2e5', 'd63d0323-31a1-4ded-9b1b-792e92001e7e', 'Especial Calabresa', 12, 0, '2026-04-15 00:24:51.774174+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('27cbfa9a-42f0-470a-b92d-f6033840f544', 'd63d0323-31a1-4ded-9b1b-792e92001e7e', 'Especial Picante', 12, 0, '2026-04-15 00:25:20.664123+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('e26a66e3-9616-4581-9391-cfa9dbdd9793', 'd63d0323-31a1-4ded-9b1b-792e92001e7e', 'Especial Frango', 12, 0, '2026-04-15 00:25:38.954966+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('640bfd3e-fa33-4764-8674-6836f32ecec3', 'd63d0323-31a1-4ded-9b1b-792e92001e7e', 'Especial Pernil Suíno', 12, 0, '2026-04-15 00:25:57.979503+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('cffd5bc5-196f-40fa-8121-8edda0d62fb4', 'd63d0323-31a1-4ded-9b1b-792e92001e7e', 'Especial Vegetariano', 12, 0, '2026-04-15 00:26:11.904428+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('c6228ec6-7f9b-4f37-b640-ba3fd6cfce91', 'd63d0323-31a1-4ded-9b1b-792e92001e7e', 'Especial Tilápia', 16, 0, '2026-04-15 00:26:45.027805+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('822bf9fe-ec63-4993-b13e-607d0062e334', 'bb7290f2-ebb1-4cfb-aad4-bce85a4b78b3', 'Tradicional', 0, 1, '2026-04-15 15:17:19.238841+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('283352ba-8cfe-4f4b-ae03-401585399bf6', 'bb7290f2-ebb1-4cfb-aad4-bce85a4b78b3', 'Brioche', 0, 2, '2026-04-15 15:17:19.238841+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('bab6a82f-0c67-457e-8b30-c86c4a80da0b', '423894fe-4366-4776-8fd7-39da016a2de6', 'Molho verde', 1, 1, '2026-04-15 23:27:52.758464+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('83f7730e-a855-4a5e-a1ed-a2a2a03a33fa', 'f0d289e2-8caf-4761-a1a6-7ac687aed4f9', 'Alho frito', 2, 1, '2026-04-16 02:06:36.03671+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('12a52eb3-026a-4476-8c27-38beb0909efc', 'f0d289e2-8caf-4761-a1a6-7ac687aed4f9', 'Bacon', 2, 2, '2026-04-16 02:06:36.03671+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('98057a60-977b-434e-a7a7-0305b8810f98', 'f0d289e2-8caf-4761-a1a6-7ac687aed4f9', 'Catupiry', 2, 3, '2026-04-16 02:06:36.03671+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('78018320-5e93-4e3f-a036-091f12ba0a63', 'f0d289e2-8caf-4761-a1a6-7ac687aed4f9', 'Cheddar', 2, 4, '2026-04-16 02:06:36.03671+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('85bb578d-84cd-4427-968c-9281931d3271', 'f0d289e2-8caf-4761-a1a6-7ac687aed4f9', 'Cream chease', 2, 5, '2026-04-16 02:06:36.03671+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('d5a37672-cb28-4d32-a3cd-f83bf37ea5b5', 'f0d289e2-8caf-4761-a1a6-7ac687aed4f9', 'Mussarela', 2, 6, '2026-04-16 02:06:36.03671+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('e576510b-9fe6-4fc5-937f-7e8ea85588ec', 'f0d289e2-8caf-4761-a1a6-7ac687aed4f9', 'Milho', 2, 7, '2026-04-16 02:06:36.03671+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('6542d78a-9755-449e-b8c6-0d869236a297', 'ad6f0e89-6473-480b-be27-39e03ad3e031', 'Nutella', 3, 1, '2026-04-17 14:03:48.905002+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('2c45705d-1438-460f-835e-cf3de2e2d1af', 'ad6f0e89-6473-480b-be27-39e03ad3e031', 'Chantilly', 3, 2, '2026-04-17 14:03:48.905002+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('0faa1e48-78b6-4be1-999d-abb4e9161d26', 'd8f48ccc-c77f-419d-89b2-dc902186f478', '200ml', 21, 1, '2026-04-17 14:04:30.695503+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('08ab3ada-6bec-4c3a-a52d-c959747a5837', 'd8f48ccc-c77f-419d-89b2-dc902186f478', '300ml', 26, 2, '2026-04-17 14:04:30.695503+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('39bf3ab1-2054-47b3-8902-133909c07196', '7b1ca892-4587-4068-ae03-5536f9cfe48e', '2 Brownie supremo:', 38, 1, '2026-04-17 14:07:45.4018+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('893eeb31-1dcc-47a2-a6b8-171d8f6d92ef', '7b1ca892-4587-4068-ae03-5536f9cfe48e', '2 Copo da felicidade Ninhotella com morango:', 38, 2, '2026-04-17 14:07:45.4018+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('ac12d3fc-c8ed-44aa-a76c-5093d94b5dd2', '7b1ca892-4587-4068-ae03-5536f9cfe48e', '2 Duo:', 38, 3, '2026-04-17 14:07:45.4018+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('70872357-ab7e-4b88-b24d-06396955b10f', '7b1ca892-4587-4068-ae03-5536f9cfe48e', '2 Morango supreme:', 38, 4, '2026-04-17 14:07:45.4018+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('51f3524e-303c-496c-a64a-6f0075edf12a', '7b1ca892-4587-4068-ae03-5536f9cfe48e', '3 Duo:', 51, 5, '2026-04-17 14:07:45.4018+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('36b18d64-d701-4124-9387-ab716f74d0c4', '7b1ca892-4587-4068-ae03-5536f9cfe48e', '3 Brownie supremo:', 51, 6, '2026-04-17 14:07:45.4018+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('19b510e6-e5b7-46ea-a673-446d9f0b1aa8', '7b1ca892-4587-4068-ae03-5536f9cfe48e', '3 Morango supreme:', 51, 7, '2026-04-17 14:07:45.4018+00') ON CONFLICT DO NOTHING;
INSERT INTO public.addon_items VALUES ('43baf5ce-4e5f-4e32-9914-6823bc942c99', '7b1ca892-4587-4068-ae03-5536f9cfe48e', '3 Ninhotella:', 51, 8, '2026-04-17 14:07:45.4018+00') ON CONFLICT DO NOTHING;


-- Data for Name: admin_settings; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.admin_settings VALUES ('221c2412-3280-49f8-8fc6-4eb8b493a6f1', 'payout_modes', '{"store_payout": "manual", "driver_payout": "manual", "admin_commission": "manual"}', '2026-04-03 17:23:13.287+00') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_settings VALUES ('cff6ce1d-0fed-4285-b5de-66e985d82f3f', 'payout_schedule', '{"enabled": true, "day_of_week": 3}', '2026-04-03 17:23:54.455+00') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_settings VALUES ('e2255a67-5c86-4cad-a027-7117031a2866', 'payment_gateway', '{"provider": "ASAAS"}', '2026-04-03 21:31:01.601+00') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_settings VALUES ('ff3f8e29-9736-4678-8eaf-6286b69c4ade', 'withdrawal_limits', '{"min_amount": 5, "max_per_week": 1}', '2026-04-03 21:48:10.193+00') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_settings VALUES ('bfb6b3c9-6df5-4971-8335-b9d85533816d', 'loyalty_config', '{"points_per_order": 1, "reward_threshold": 10, "reward_discount_percent": 10}', '2026-04-03 22:36:34.161881+00') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_settings VALUES ('96769b6f-933b-4e6e-8fc3-46d3e5abfd5c', 'first_order_coupon', '{"code": "PRIMEIRA10", "enabled": true, "discount_type": "percentage", "discount_value": 10}', '2026-04-03 22:36:34.161881+00') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_settings VALUES ('6e560d35-9d1f-4b49-a029-0363d63c4007', 'min_payout_amount', '100', '2026-04-10 10:24:26.713611+00') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_settings VALUES ('bc81d18a-5e75-400d-bcf2-149ef29a147e', 'delivery_fee_config', '{"city_fee": 5, "city_name": "Itatinga", "rural_per_km": 1.2, "platform_split": 2, "rural_base_fee": 12}', '2026-04-10 13:54:27.902985+00') ON CONFLICT DO NOTHING;
INSERT INTO public.admin_settings VALUES ('41474d6a-8368-4328-8cb0-5f8d431bd47e', 'store_driver_platform_cut', '{"amount": 2}', '2026-04-17 01:02:25.188502+00') ON CONFLICT DO NOTHING;


-- Data for Name: app_links; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.app_links VALUES ('c10b91df-babc-4033-a627-5db4ff5f4ffb', 'Fazer um Pedido', 'Veja todas as lojas disponíveis', '/', 'ShoppingBag', false, true, true, 10, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('ea8b2c11-7809-4639-96e2-9ed7032aa95d', 'Cadastrar minha Loja', 'Cadastro 100% grátis • Sem mensalidade', '/cadastro-lojista', 'Store', false, true, true, 20, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('05fe35ea-b344-406c-aa89-ba46d3d04b6c', 'Quero ser Entregador', 'Faça entregas e ganhe por corrida', '/cadastro-entregador', 'Bike', false, false, true, 30, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('f4ea084b-249c-4406-ad43-c3c03bf8f840', 'Plano Apoiador (Vitalício)', 'Apoie o app por R$ 130 — apenas 10 vagas', '/planos', 'Heart', false, false, true, 40, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('5b35a7a2-1a8a-41f6-aba3-a82647e6d32e', 'Criar minha Conta', 'Acesse promoções e cupons exclusivos', '/auth', 'UserPlus', false, false, true, 50, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('409c4ef1-deae-422f-9081-3df81f3b2f93', 'Baixar o App', 'Disponível para Android', 'https://play.google.com/store/apps/details?id=app.lovable.e8d28aded6334d74be2161c8dbe24765', 'Smartphone', true, false, true, 60, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('9480496a-dd26-45cb-8185-872623201804', 'Instagram @itasuper', NULL, 'https://instagram.com/itasuper', 'Instagram', true, false, true, 70, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('1117e956-e557-451b-81a8-0213c4b95ae4', 'Falar no WhatsApp', 'Suporte e dúvidas', 'https://wa.me/5514998765432', 'MessageCircle', true, false, true, 80, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('d372f1b8-775d-4719-ab41-6cd726b97c1e', 'Termos de Uso', NULL, '/termos-de-uso', 'FileText', false, false, true, 90, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;
INSERT INTO public.app_links VALUES ('29b913c0-84dd-4077-985f-d5f9a0e09bad', 'Política de Privacidade', NULL, '/politica-de-privacidade', 'Shield', false, false, true, 100, '2026-04-18 08:37:30.779237+00', '2026-04-18 08:37:30.779237+00') ON CONFLICT DO NOTHING;


-- Data for Name: archived_accounts; Type: TABLE DATA; Schema: public; Owner: -



-- Data for Name: banners; Type: TABLE DATA; Schema: public; Owner: -



-- Data for Name: compliance_alerts; Type: TABLE DATA; Schema: public; Owner: -



-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.coupons VALUES ('a421970b-4a6c-4d4d-9043-aee7f032a221', '5OFF', NULL, 'fixed', 5, 0, NULL, 0, true, false, NULL, '2026-04-03 15:10:14.187241+00', NULL) ON CONFLICT DO NOTHING;


-- Data for Name: coupon_uses; Type: TABLE DATA; Schema: public; Owner: -



-- Data for Name: driver_balances; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.driver_balances VALUES ('a1c4a6ca-20f5-44a9-b78c-38ea69bfb77a', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 11.0, 0, 11.0, '2026-04-06 01:45:33.209369+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_balances VALUES ('c024e72e-f15b-4961-a1ce-c77f4e8684bc', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 78, 36, 0, '2026-04-22 00:45:12.215693+00') ON CONFLICT DO NOTHING;


-- Data for Name: driver_earnings; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.driver_earnings VALUES ('e0bd9c07-0a06-4a22-811f-924332fb5ab3', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '4bf31210-55f2-4827-8408-5a293b709c8a', 5.5, 'pago_loja', '2026-04-04 00:03:51.997321+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('a96a0432-cc23-4209-b0e0-ea2194986d8c', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'bf8d6d94-fff2-4866-aa39-496ceeac70f4', 5.5, 'pago_loja', '2026-04-06 01:44:11.781029+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('bb08c3d3-20d8-4593-9a10-ae40e0453ea3', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 'ee8a305e-5288-4d77-a54b-94c7117d3574', 4, 'waiting_store_settlement', '2026-04-12 12:26:50.239878+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('d5c9644a-68db-43ed-8613-ed55a5f0852f', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '1545fe9b-c500-405a-9e1b-cd260dffb130', 4, 'waiting_store_settlement', '2026-04-12 12:31:17.064443+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('497f1655-2f84-4994-9efd-5ae913cca7af', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '3dc19319-94b3-41d6-8132-4f65a70d6b53', 4, 'waiting_store_settlement', '2026-04-14 15:55:57.724932+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('535398d6-324c-41cc-894d-7976d2487b7e', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '4e21aec0-4de7-4f9c-8420-2cfa72bdab9c', 4, 'waiting_store_settlement', '2026-04-14 22:20:45.292159+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('f6984bbc-63c4-499a-8e2d-aa2ddb0c5fdf', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '7858058a-fa4a-46bf-8063-26301bf8983c', 4, 'waiting_store_settlement', '2026-04-15 01:38:09.12761+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('e80ce9e5-5a11-4191-86ee-63f4de7d0278', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '0b1baf1d-98c5-43ef-af37-2b956bd12c03', 0, 'waiting_store_settlement', '2026-04-15 02:18:47.889092+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('24a1bcae-1968-44d0-b443-310a7de70e37', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '108c8373-2d7d-409b-a81a-0d1defd84344', 0, 'waiting_store_settlement', '2026-04-15 15:45:45.548815+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('76aea7ae-687d-4a3a-a28e-955c4c109773', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '90d96ab6-fdb4-4984-a9d8-42b730021945', 0, 'waiting_store_settlement', '2026-04-15 15:50:13.88197+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('862cee14-f22a-43f6-b9c5-864a1af96970', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '438365c0-c0a6-411b-9908-b9d07504000b', 0, 'pendente', '2026-04-15 16:50:14.853893+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('afb0f2a0-ada2-4e34-9ecc-ebae7297e723', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '0c35d6b6-53ad-4935-a635-d1d35a325b3f', 8, 'pendente', '2026-04-18 18:46:00.782407+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('fc853c0f-6702-4d37-ba00-d7db623fce65', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '21a92392-6e8f-4c4e-8eec-6db08f4c18c0', 5, 'pendente', '2026-04-18 18:59:49.092743+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('a3f134e5-39e3-4047-8980-482c519df253', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '729e8a3b-d08b-4ce6-8026-ff9250c27fd8', 0, 'pendente', '2026-04-21 20:34:33.594586+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('8b0d4fb1-d6c2-4c86-a335-5c607c383941', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '35c46862-108f-4391-9984-3b5d2ace5155', 3, 'pendente', '2026-04-22 00:39:58.047604+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('8c458638-d4e2-461d-9be9-e096e580053e', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 'b2d39235-52f0-4b02-8722-52721d10cb10', 14, 'pendente', '2026-04-22 00:40:18.895232+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('06fd076a-4e6d-4c9c-88e6-121e332103b1', '901e44d6-fc0e-487b-af03-f6460a2d60fa', '4acfa4fc-5806-4097-8ddc-36d8a65612ae', 14, 'pendente', '2026-04-22 00:41:13.756929+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings VALUES ('b06e8e77-5910-4d79-8507-bddb67730a8a', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 'a3471d4d-52e0-46c0-b788-07e37f3bb478', 14, 'pendente', '2026-04-22 00:45:12.215693+00') ON CONFLICT DO NOTHING;


-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.orders VALUES ('2f34cc77-d098-4a7a-83fa-00be7feec2a1', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 68, 5.5, 73.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 13:34:50.91761+00', NULL, 8.16, '7420', NULL, false, 0, false, '3886', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('56a3d026-a105-4798-a639-7f092c1d2c1d', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 36, 5.5, 41.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 13:30:12.075727+00', NULL, 4.32, '2075', NULL, false, 0, false, '2928', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('a39bdddf-cea4-426e-879d-0e6b202c50c9', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 25, 5.5, 30.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 13:24:49.530138+00', NULL, 3, '6973', NULL, false, 0, false, '4805', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('4bf31210-55f2-4827-8408-5a293b709c8a', '927289c1-9e81-463a-b950-9b83d4d505e5', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'finalizado', 1, 5.5, 6.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-03 23:14:24.721635+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 0.12, '5948', '2026-04-04 00:03:51.997321+00', false, 0, true, '6578', true, true, '9587', NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('4d465c22-5aae-4afd-b20a-a5f77707ca87', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 68, 5.5, 73.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 12:41:19.575625+00', NULL, 8.16, '8120', NULL, false, 0, false, '3655', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('b2d39235-52f0-4b02-8722-52721d10cb10', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67, 14, 81, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-21 23:46:25.088911+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '0194', '2026-04-22 00:40:18.895232+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('bf8d6d94-fff2-4866-aa39-496ceeac70f4', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'finalizado', 73, 5.5, 78.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-05 22:06:27.847675+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 8.76, '6415', '2026-04-06 01:44:11.781029+00', false, 0, true, '1049', true, false, '8358', NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('7e332fee-4d9b-4a86-8990-15ed66dcb7d7', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 74, 5, 79, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-10 08:08:12.08208+00', NULL, 0.00, '0931', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('88418451-997a-4b3f-b3d0-66cb2c6451c3', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 74, 5, 79, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-10 08:08:56.002419+00', NULL, 0.00, '0461', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('64e58f6d-3f39-4aaa-99da-c8efe0f5896e', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 74, 5, 79, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-10 08:13:12.03059+00', NULL, 0.00, '9995', NULL, true, 100, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('0b22dc33-c1a2-49ce-9426-c8ca1457a054', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 74, 5, 79, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-10 08:13:30.493147+00', NULL, 0.00, '3028', NULL, true, 100, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('b37491d4-7654-4ab0-bf3e-88532e32ea9e', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 25, 5.5, 30.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 22:12:47.658018+00', NULL, 3, '5082', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('1d5ef50d-4c44-4e9c-accd-82721ee1f478', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 32, 5.5, 37.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 14:17:09.403767+00', NULL, 3.84, '9244', NULL, false, 0, false, '0206', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('11f1dbae-9309-4888-a6b6-a662e3d29aec', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 32, 5.5, 37.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 11:58:30.933638+00', NULL, 3.84, '9568', NULL, false, 0, false, '7698', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('54683798-c2ab-445c-b7e4-c5670cff18fe', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 153, 5.5, 158.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 11:53:11.453992+00', NULL, 18.36, '2080', NULL, true, 200, false, '3532', false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('c21a0ec6-ae33-4708-be69-ac999ddcecc8', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 32, 5.5, 37.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 02:52:32.236547+00', NULL, 3.84, '2636', NULL, false, 0, false, '6168', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('4fd62c56-e0dc-4142-a42b-975544515f55', '927289c1-9e81-463a-b950-9b83d4d505e5', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 25, 5.5, 30.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 17:49:50.082592+00', NULL, 3, '3012', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('6cdda93d-016d-4889-b3e4-6e89c948c4a6', '6becbb34-0fd2-4f6b-ba60-46bc058c15e6', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 98, 5, 103, 'cartao', 'Centro', 'Rua São Francisco, 635', '2026-04-10 08:16:06.484646+00', NULL, 0.00, '2697', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('98b42c63-9f06-40c0-bf04-022e57b68a89', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67, 2, 69, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 12:35:09.557209+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '6681', NULL, false, 0, false, NULL, false, true, NULL, NULL, true, -23.1013515, -48.6170412, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('3e4dbf5f-984f-4135-af3b-e572b7d6589d', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 70, 4, 74, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 16:37:43.524142+00', NULL, 0.00, '7456', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, -23.138606, -48.4468522, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('45ced352-0722-4da5-b6e0-3bcc1b1dea1a', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'fbff1580-ce82-4798-a96f-f149c69166b3', 'finalizado', 6, 3, 9, 'pix', 'Centro', 'Rua São Francisco, 635', '2026-04-08 20:07:08.350959+00', NULL, 0.90, '3350', '2026-04-08 20:33:45.822+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('e94075a4-9157-40c2-81fc-c53242be6ee2', '1d33caaf-2aaf-4ac4-a41e-b94508e0ed50', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 22, 0, 22, 'dinheiro', 'Terras de São José', 'Avenida Dona Tita Paixão, 1237', '2026-04-18 17:02:57.03179+00', NULL, 1.10, '7404', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('73e3971c-afe8-4394-8db5-6d575825e818', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 64.00, 5.00, 69.00, 'pix', 'Vila Rica', 'Rua F, 600 - Vila Rica', '2026-04-11 14:15:27.608723+00', NULL, 0.00, '0742', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('19b290e2-758e-4876-8723-4598a7824e1e', '37909bb0-03b4-46dc-917d-c17fadaca33c', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 24, 0, 24, 'dinheiro', 'Núcleo Habitacional Nova América', 'Rua Julieta Antunes Almeida Oliveira, 72, Casa, Ref: Próximo ao bar da Roh', '2026-04-16 21:30:28.894737+00', NULL, 1.20, '0269', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('d205aeb8-4e51-4562-9412-137c523c76da', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 69.00, 5.00, 74.00, 'pix', 'Vila Nova', 'Rua B, 200 - Vila Nova', '2026-04-11 14:15:27.608723+00', NULL, 0.00, '0588', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('b80d1312-d625-440c-a6ef-f10d1f5a0baf', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 64.00, 5.00, 69.00, 'dinheiro', 'Jardim Europa', 'Rua I, 900 - Jardim Europa', '2026-04-11 14:15:27.608723+00', NULL, 0.00, '3655', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('09f75b10-47d0-4d49-9b3d-d82cab08d163', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67.00, 5.00, 72.00, 'dinheiro', 'Centro', 'Rua A, 100 - Centro', '2026-04-11 14:15:27.608723+00', NULL, 0.00, '3745', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('09c2b85e-0ae6-4b7c-bada-38980bbd8215', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 69.00, 5.00, 74.00, 'cartao', 'Centro', 'Rua H, 800 - Centro', '2026-04-11 14:15:27.608723+00', NULL, 0.00, '9752', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('256327a2-e2cf-4d50-b37c-3c2b594a14e9', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 32, 5.5, 37.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 02:44:29.97551+00', NULL, 3.84, '3337', NULL, false, 0, false, '4175', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('2c73be08-696d-4759-97c8-ee004b09b5cb', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 68, 5.5, 73.5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-06 13:41:02.864771+00', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 8.16, '5072', NULL, false, 0, false, '6681', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('518101c4-1d1d-4b71-9bd8-6acf7d53bc70', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 81, 5, 86, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-10 08:14:22.980852+00', NULL, 0.00, '4149', NULL, true, 100, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('cf5ed3c3-b9f1-46cd-bf09-7bdabe643eab', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 73, 5, 78, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-10 08:20:12.506876+00', NULL, 0.00, '3969', NULL, false, 0, false, NULL, false, false, '8703', NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('53c8a00c-23a9-4b76-9989-1f01e7b4581e', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e577573d-4139-415d-b49d-d6a50e1d393b', 'cancelado', 0, 5, 5, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-08 16:23:51.864038+00', NULL, 0.00, '7383', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('73136c29-c952-47ac-b6c8-af69848b5b4f', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 69, 4, 73, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 12:45:03.883921+00', NULL, 0.00, '8166', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, -23.1276757, -48.4731513, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('5794aa50-4be7-40d9-ac92-2e05e8bc4d5a', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'cancelado', 37, 3, 40, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-07 16:22:19.844462+00', NULL, 5.55, '1326', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('b91d5367-fbbf-4846-95fe-15e811f105c0', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 98, 6, 104, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-10 13:09:22.273803+00', NULL, 0.00, '8334', '2026-04-10 13:11:46.285305+00', true, 150, false, NULL, false, false, '1705', NULL, true, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('df5f1d03-a683-42b3-a898-2279d28a6b58', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 72, 5, 77, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-10 09:49:20.460268+00', NULL, 0.00, '6581', NULL, true, 100, false, NULL, false, false, '1276', NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('ce46a1a8-e013-4437-8a83-d4bb283c4529', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67.00, 5.00, 72.00, 'dinheiro', 'Centro', 'Rua das Flores, 123 - Centro', '2026-04-11 16:27:44.55103+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '1234', '2026-04-11 17:15:34.955364+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('308a6fec-4620-47fc-9ce6-5235b51b7c68', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 69.00, 5.00, 74.00, 'dinheiro', 'Santa Cruz', 'Rua E, 500 - Santa Cruz', '2026-04-11 14:15:27.608723+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '5163', '2026-04-11 17:15:34.955364+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('ec925cee-2fcb-4777-b06e-71839bbee8ad', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67.00, 5.00, 72.00, 'pix', 'São José', 'Rua J, 1000 - São José', '2026-04-11 14:15:27.608723+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '7996', '2026-04-11 17:15:34.955364+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('9dec4881-59ba-4401-89c4-c82e6d448d17', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67.00, 5.00, 72.00, 'dinheiro', 'Boa Vista', 'Rua G, 700 - Boa Vista', '2026-04-11 14:15:27.608723+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '6306', '2026-04-11 17:15:34.955364+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('f13fa720-dae2-4e54-b5e4-1616fdaf71b9', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 64.00, 5.00, 69.00, 'cartao', 'Vila Nova', 'Rua São Paulo, 789 - Vila Nova', '2026-04-11 16:27:44.55103+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '9012', '2026-04-11 17:15:34.955364+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('665038fb-ebad-47c1-b9c3-64dbceb14bdd', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67.00, 5.00, 72.00, 'dinheiro', 'Centro', 'Rua XV de Novembro, 123 - Centro, 18690-000', '2026-04-11 17:15:47.832076+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '5623', '2026-04-11 17:18:05.781521+00', true, 100, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('3e7fc2bb-294f-467d-9d9e-c3d3e899873b', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 69.00, 5.00, 74.00, 'pix', 'Jardim', 'Av Brasil, 456 - Jardim', '2026-04-11 16:27:44.55103+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '5678', '2026-04-11 17:15:34.955364+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('26cd1287-32f8-4c69-9deb-cb8913496383', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67.00, 4.00, 71.00, 'dinheiro', 'Centro', 'Rua Teste 123, Centro - Itatinga/SP', '2026-04-11 17:05:31.56083+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '5443', '2026-04-11 17:05:59.509104+00', true, 100.00, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('4acfa4fc-5806-4097-8ddc-36d8a65612ae', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 68, 14, 82, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-22 00:14:14.635621+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '5390', '2026-04-22 00:41:13.756929+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('a3037fec-fe51-4122-b520-852429f22839', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 64.00, 5.00, 69.00, 'dinheiro', 'Jardim', 'Rua C, 300 - Jardim', '2026-04-11 14:15:27.608723+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '8475', '2026-04-11 17:15:34.955364+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('bfe1e0e7-8ef8-49ef-9259-47f3f9c5932a', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67.00, 5.00, 72.00, 'cartao', 'Centro', 'Rua D, 400 - Centro', '2026-04-11 14:15:27.608723+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '1417', '2026-04-11 17:15:34.955364+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('0c35d6b6-53ad-4935-a635-d1d35a325b3f', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67, 8, 75, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-18 18:36:49.156442+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '0458', '2026-04-18 18:46:00.782407+00', false, 0, false, NULL, false, true, NULL, NULL, false, -23.1384588, -48.4478759, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('997ec784-c861-46b6-b90a-b4ba8e7f7ba4', '5adc5911-cca3-4cd7-85e6-374917d07a39', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 56, 6, 62, 'dinheiro', 'Vila São João', 'Rua José Bonifácio, 530 - Vila São João, Itatinga - SP', '2026-04-16 09:47:39.230806+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '6844', '2026-04-16 09:49:09.528828+00', true, 80, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('3dc19319-94b3-41d6-8132-4f65a70d6b53', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67, 4, 71, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-13 19:05:53.345095+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '3127', '2026-04-14 15:55:57.724932+00', false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('108c8373-2d7d-409b-a81a-0d1defd84344', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'finalizado', 52, 0, 52, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 15:42:42.876335+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 2.60, '2742', '2026-04-15 15:45:45.548815+00', false, 0, false, NULL, false, false, NULL, NULL, false, -23.1048864, -48.6178383, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('7858058a-fa4a-46bf-8063-26301bf8983c', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 87, 4, 91, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-13 19:14:29.719839+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '3876', '2026-04-15 01:38:09.12761+00', false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('dfb918d7-94c3-4987-b5e3-dac1dd8dd103', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 69, 4, 73, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 13:07:16.979498+00', NULL, 0.00, '2911', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, -23.1386047, -48.4469522, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('21a92392-6e8f-4c4e-8eec-6db08f4c18c0', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 68, 5, 73, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-18 18:57:48.711476+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '1049', '2026-04-18 18:59:49.092743+00', false, 0, false, NULL, false, true, NULL, NULL, false, -23.1383304, -48.4478323, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('a3471d4d-52e0-46c0-b788-07e37f3bb478', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 68, 14, 82, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-22 00:43:53.071825+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '6799', '2026-04-22 00:45:12.215693+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('4b87ece7-bc50-49e0-8f9e-9e25c930e96b', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 36, 0, 36, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 15:36:35.560606+00', NULL, 1.80, '7904', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, -23.1048197, -48.6179063, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('7e18db33-57af-4f9e-abd2-0371cbbc6d40', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 36, 0, 36, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 15:32:05.091236+00', NULL, 1.80, '0533', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, -23.1049608, -48.6177896, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('ef416e41-07bc-4600-95b7-7f5ff040d678', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 56, 0, 56, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 01:34:12.851919+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 2.80, '2597', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, -23.059268, -48.5926264, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('d5b9d06c-e43f-4dfb-8dd8-e01bbb22c131', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 69.00, 5.00, 74.00, 'pix', 'Vila Nova', 'Rua das Flores, 456 - Vila Nova, 18690-100', '2026-04-11 17:15:47.832076+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '0845', '2026-04-11 17:18:05.781521+00', false, NULL, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('1bd27051-0b78-4792-981d-79c387574e62', '6a31ec8b-3e4e-40b4-a4ff-6ae5f75ea102', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67, 5, 72, 'pix', 'Centro', 'Rua Coronel Luciano, 245 - Centro, Itatinga - SP', '2026-04-16 09:47:37.297958+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '4332', '2026-04-16 09:49:09.528828+00', false, NULL, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('20409cc3-25d3-4862-9b30-e5475cf07caa', '4f962953-1af8-427d-8681-d30405fb994b', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 64, 7, 71, 'pix', 'Jardim Pedra Branca', 'Rua das Primaveras, 120 - Jardim Pedra Branca, Itatinga - SP', '2026-04-16 09:47:40.772821+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '6185', '2026-04-16 09:49:09.528828+00', false, NULL, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('528e1b70-b19d-4732-90cf-e1fecdb8d61b', '73adfa0a-506f-43fd-8109-d3efa14507fe', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 82, 8, 90, 'dinheiro', 'Vila Canaã', 'Rua dos Ipês, 88 - Vila Canaã, Itatinga - SP', '2026-04-16 09:47:42.013329+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '0357', '2026-04-16 09:49:09.528828+00', true, 100, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('071a9ec3-f5e3-45d3-91d1-5b11486273f1', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 67, 4, 71, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 14:25:23.91099+00', NULL, 0.00, '8908', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, -23.1383418, -48.4477693, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('a0e5de22-dc8e-413f-aa83-1c09dccd1db3', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'saiu_entrega', 69, 14, 83, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-25 17:07:55.222865+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '8775', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('f258a1ac-c6a5-4237-a200-a60c4f434139', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 64.00, 5.00, 69.00, 'dinheiro', 'Jardim', 'Av. Brasil, 789 - Jardim, 18690-200', '2026-04-11 17:15:47.832076+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '0280', '2026-04-11 17:18:05.781521+00', true, 80, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('76287169-2ca8-4595-9c3b-f420b292a92f', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 56.00, 5.00, 61.00, 'cartao', 'Santa Cruz', 'Rua São Paulo, 321 - Santa Cruz, 18690-300', '2026-04-11 17:15:47.832076+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '1668', '2026-04-11 17:18:05.781521+00', false, NULL, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('3c2fff62-e3cd-4afa-a1f6-965c2ac539aa', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 64.00, 5.00, 69.00, 'dinheiro', 'São José', 'Rua Tiradentes, 654 - São José, 18690-400', '2026-04-11 17:15:47.832076+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '0264', '2026-04-11 17:18:05.781521+00', true, 80, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('0389002c-0b8b-4549-9f00-334b54bf3fb4', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 30, 0, 30, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 16:29:50.250151+00', NULL, 1.50, '7422', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, -23.1048806, -48.6178546, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('d869915a-2602-4b43-a329-99818f1acab1', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 56, 4, 60, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-13 01:26:05.116451+00', NULL, 0.00, '7892', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('94109d43-b46b-490c-870d-67b79f801a20', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 69, 4, 73, 'cartao', 'Centro', 'Rua São Francisco, 635', '2026-04-13 12:53:21.188404+00', NULL, 0.00, '6600', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('1fc64483-055c-4a1b-b47d-3b49cef2e0c9', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 93, 4, 97, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-13 00:51:51.732671+00', NULL, 0.00, '8445', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('d1c82126-6734-4e83-afdc-32696b1fdb97', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67, 4, 71, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 20:08:43.029619+00', NULL, 0.00, '6500', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('bb6a42f4-98a0-40bc-bc66-de8100b3c6e8', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 74, 4, 78, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 19:26:46.588471+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '1188', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('ee8a305e-5288-4d77-a54b-94c7117d3574', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 72, 4, 76, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 12:21:19.934217+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '0603', '2026-04-12 12:26:50.239878+00', false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('7ec44576-c245-4917-a27d-41e28cc94061', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 74, 4, 78, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 15:00:01.028074+00', NULL, 0.00, '8413', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('ca61442f-8fb1-4d6c-a52a-34cfcb86d31b', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 87, 4, 91, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 14:42:16.150159+00', NULL, 0.00, '4727', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('78066066-4627-4795-abfb-3056c1c0d998', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 56, 4, 60, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 12:47:50.017433+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '0173', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('724839a5-d7a5-451b-b734-f17a5c16f836', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 67, 4, 71, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 12:45:15.189186+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '9929', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('fdad9c38-0662-44f3-86f8-16f9691c4a6f', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 69, 4, 73, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 12:42:16.015257+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '4373', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('ec0bc528-a9d4-413e-ac18-c623ef55b9cb', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 64, 4, 68, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 12:37:03.080054+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '8182', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('0251cda0-c139-4f65-ac30-66efde0c346d', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 69, 4, 73, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 12:33:26.790028+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '8922', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('1545fe9b-c500-405a-9e1b-cd260dffb130', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67, 4, 71, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-12 12:27:26.670201+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '5451', '2026-04-12 12:31:17.064443+00', false, 0, false, NULL, false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('cfee80ea-43a4-46f0-8e08-6a19bf70db53', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 56, 5, 61, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 00:36:53.146827+00', NULL, 2.80, '8579', NULL, false, 0, false, '0986', false, false, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('3183d21b-7b40-4188-a4b8-c2bf058440f3', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 73, 0, 73, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 16:04:24.248262+00', NULL, 3.65, '1059', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, -23.1048852, -48.6176944, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('3c30b04c-3d82-4963-a190-2002540aefe2', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'cancelado', 40, 0, 40, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 16:18:08.271481+00', NULL, 2.00, '0165', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, -23.1047391, -48.6180091, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('438365c0-c0a6-411b-9908-b9d07504000b', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'finalizado', 24, 0, 24, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 16:45:53.270326+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 1.20, '7480', '2026-04-15 16:50:14.853893+00', false, 0, false, NULL, false, false, NULL, NULL, false, -23.1049087, -48.6180185, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('183a3355-9418-4e60-80d4-f75e2af669e9', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'f667fc5c-48d2-4b05-a370-b28720161009', 'cancelado', 20.2, 0, 20.2, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 02:12:40.718504+00', NULL, 1.01, '7431', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, -23.1048705, -48.6178467, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('91f9dd29-559a-4d6a-b2d2-89ac5b081579', '876ffde2-cdc0-4578-8cc4-48bb0279de71', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 56, 9, 65, 'pix', 'Jardim Marajoara', 'Rua Benedito Alves, 310 - Jardim Marajoara, Itatinga - SP', '2026-04-16 09:47:43.23581+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '8651', '2026-04-16 09:49:09.528828+00', false, NULL, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('4e21aec0-4de7-4f9c-8420-2cfa72bdab9c', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 69, 4, 73, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-14 11:45:45.717573+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '4987', '2026-04-14 22:20:45.292159+00', false, 0, false, NULL, false, false, NULL, NULL, false, -23.1013515, -48.6170412, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('90d96ab6-fdb4-4984-a9d8-42b730021945', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'finalizado', 20, 0, 20, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 15:48:21.25894+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 1.00, '4088', '2026-04-15 15:50:13.88197+00', false, 0, false, NULL, false, false, NULL, NULL, false, -23.1049564, -48.6180339, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('0b1baf1d-98c5-43ef-af37-2b956bd12c03', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'finalizado', 36, 0, 36, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 02:11:46.066847+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 1.80, '4376', '2026-04-15 02:18:47.889092+00', false, 0, false, NULL, false, false, NULL, NULL, false, -23.1048683, -48.6178475, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('c39bd9dd-a49e-4bfa-9537-f15aef1df52e', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 67, 6, 73, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-17 15:55:32.006653+00', NULL, 0.00, '7055', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, -23.1049426, -48.6178274, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('35c46862-108f-4391-9984-3b5d2ace5155', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'finalizado', 67, 3, 70, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-21 14:50:30.9826+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, '7343', '2026-04-22 00:39:58.047604+00', false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('b5c3e4ae-360c-411e-be20-522df1489a31', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 67, 4, 71, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-15 16:34:27.263217+00', NULL, 0.00, '8505', NULL, false, 0, false, NULL, false, false, NULL, NULL, false, -23.1050442, -48.6173357, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('60684a78-58a4-400b-b826-ac9c914af5d2', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 64, 4, 68, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 16:10:51.975242+00', NULL, 0.00, '0868', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, -23.1386127, -48.4469214, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('054b19ec-88b4-4113-b7eb-e66a736740d3', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 56, 4, 60, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 16:09:42.022612+00', NULL, 0.00, '2104', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, -23.1386239, -48.4469481, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('47cab294-191e-403d-a87a-170964eac0fa', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 67, 4, 71, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-16 16:08:36.314008+00', NULL, 0.00, '7671', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, -23.1387181, -48.4468979, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('849da996-16ab-4c0f-bf46-709fc0508b37', 'eacb717f-f61d-4e58-af9b-4149541a68df', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 67.00, 6.00, 73.00, 'pix', 'Centro', 'Rua Sete de Setembro, 720 - Centro, Itatinga - SP', '2026-04-17 16:00:06.346603+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, NULL, NULL, false, 0, false, NULL, true, true, NULL, NULL, false, -23.1018, -48.6156, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('9ae31874-a576-4d96-bb2f-980402139750', '4f962953-1af8-427d-8681-d30405fb994b', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 64.00, 7.00, 71.00, 'dinheiro', 'Centro', 'Rua Renato Lopes de Oliveira, 180 - Centro, Itatinga - SP', '2026-04-17 16:00:06.346603+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, NULL, NULL, false, 0, false, NULL, true, true, NULL, NULL, false, -23.1014, -48.6142, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('16e1cb32-2886-4673-bed8-4fdea85a7feb', '6a31ec8b-3e4e-40b4-a4ff-6ae5f75ea102', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 67.00, 5.00, 72.00, 'dinheiro', 'Centro', 'Rua Coronel Eduardo Lopes de Oliveira, 410 - Centro, Itatinga - SP', '2026-04-17 16:00:06.346603+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, NULL, NULL, false, 0, false, NULL, true, true, NULL, NULL, false, -23.1024, -48.6135, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('5830efde-85c9-46b5-a326-f82af843144a', '5adc5911-cca3-4cd7-85e6-374917d07a39', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 69.00, 6.00, 75.00, 'pix', 'Centro', 'Rua José de Oliveira, 95 - Centro, Itatinga - SP', '2026-04-17 16:00:06.346603+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, NULL, NULL, false, 0, false, NULL, true, true, NULL, NULL, false, -23.10225, -48.6168, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('800bfe94-c531-4fcd-a0cd-b46b795b4a6d', '37909bb0-03b4-46dc-917d-c17fadaca33c', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 'cancelado', 134.00, 8.00, 142.00, 'cartao', 'Centro', 'Rua Antônio Prette, 240 - Centro, Itatinga - SP', '2026-04-17 16:00:06.346603+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 0.00, NULL, NULL, false, 0, false, NULL, true, true, NULL, NULL, false, -23.10125, -48.6151, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('729e8a3b-d08b-4ce6-8026-ff9250c27fd8', 'ba9ce4c7-7133-45d5-8c2f-454914b7da38', '70c8f384-a15a-4dfd-bfbc-30ebb9b7f678', 'finalizado', 22.5, 0, 22.5, 'dinheiro', 'Centro', 'Rua São Francisco, 742', '2026-04-21 18:44:18.355857+00', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 1.13, '1813', '2026-04-21 20:34:33.594586+00', true, 50, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.orders VALUES ('d5e6fdec-6819-4bfd-9ce4-48495c00231c', '66a2f79c-9276-4fe8-8201-4a59b3960bed', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', 'pendente', 24, 14, 38, 'dinheiro', 'Centro', 'Rua São Francisco, 635', '2026-04-25 17:07:56.396784+00', NULL, 1.44, '2159', NULL, false, 0, false, NULL, false, true, NULL, NULL, false, NULL, NULL, NULL) ON CONFLICT DO NOTHING;


-- Data for Name: driver_locations; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.driver_locations VALUES ('ba93e465-ce23-4302-a855-b5a1f36bcb0a', '66a2f79c-9276-4fe8-8201-4a59b3960bed', NULL, -23.139292, -48.44684, 62.935, 11.115074, 0.39163208, '2026-04-14 16:22:17.498+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_locations VALUES ('40e8c789-6389-435b-aea0-5e215030ea22', '6becbb34-0fd2-4f6b-ba60-46bc058c15e6', NULL, -23.1049748, -48.6178002, 16.424, 0, 310.83374, '2026-04-17 15:33:12.611+00') ON CONFLICT DO NOTHING;
INSERT INTO public.driver_locations VALUES ('33966266-4a5b-44e6-b589-3a1d68ff7800', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 'a0e5de22-dc8e-413f-aa83-1c09dccd1db3', -23.1384043, -48.447921, 39.308, 0.04233812, NULL, '2026-04-25 17:19:11.357+00') ON CONFLICT DO NOTHING;


-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.drivers VALUES ('75875da1-bddc-4a1f-bf11-f3712d0c8e3b', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 'Natalino', true, '2026-04-12 17:28:16.918269+00', true, 'itatinga') ON CONFLICT DO NOTHING;
INSERT INTO public.drivers VALUES ('9a5377ae-4555-4de5-b43e-7d4c6eafa3ec', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'Renner dias', true, '2026-03-30 20:43:17.670906+00', true, 'itatinga') ON CONFLICT DO NOTHING;


-- Data for Name: platform_partners; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.platform_partners VALUES ('b611c2db-a65b-461a-9352-d50e71e82ebb', 'Thiago Correia', 'thiagocorreia10092005@gmail.com', 30, 5, NULL, NULL, false, true, false, '2026-04-16 07:57:54.930744+00', '2026-04-16 07:57:54.930744+00') ON CONFLICT DO NOTHING;
INSERT INTO public.platform_partners VALUES ('1c28c47e-0694-4f3e-a591-b8315eebc157', 'Vinicius', 'vinivias13@gmail.com', 70, 5, NULL, NULL, true, true, false, '2026-04-16 07:57:54.930744+00', '2026-04-16 08:17:30.634532+00') ON CONFLICT DO NOTHING;


-- Data for Name: emergency_fund; Type: TABLE DATA; Schema: public; Owner: -



-- Data for Name: fcm_tokens; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.fcm_tokens VALUES ('c344aeac-4fa6-4c49-962d-908f3735b5d8', '901e44d6-fc0e-487b-af03-f6460a2d60fa', 'dojsCWh1Qp202-nz2tnhMv:APA91bEK6un-ZriqXg_PJzo9tgLPdi4QLloks95pfHpSuQBnAi4byEXDi_cKicXCzqdoSCAQ636OgylzeeUDfikh9RSF4GjlW4uZqvri-Z_tT3beYsgkHVM', 'itasuper:capacitor:android:6b56318c-bc7d-4bc6-8a2e-9c52651aedc7', '2026-04-25 17:09:39.409817+00', '2026-04-25 17:18:47.633+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.fcm_tokens VALUES ('81159e6b-cd67-47d8-91f6-5685633b24c5', '66a2f79c-9276-4fe8-8201-4a59b3960bed', 'eANFeRpSSSKMGxHxt2K51K:APA91bE2vl5g1DZPniVA0i8Ym4JVhZ_MZdf6u9dBAVDLBzJLxAJg0SPeMuCctQ_lJgmEl58Uqj1YqOeEvS_GPcXj7574AdPnpCoSftsl1LLVgInW1xHAi1U', 'itasuper:capacitor:android:45e50766-fb19-44c7-8e85-15e05ca8da30', '2026-04-25 17:04:50.618495+00', '2026-04-25 17:08:02.364+00', NULL) ON CONFLICT DO NOTHING;


-- Data for Name: financial_transactions; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.financial_transactions VALUES ('af83e2cd-ccf4-4cee-834b-93ef4c439f61', 'b243bdb4-45a9-46fc-8248-68dd6ba3e46c', 'commission_charge', '#FAT-A8589361', 11.1, 'failed', 'asaas', 'pay_0aunatoz51rz0eb5', NULL, '00020101021226800014br.gov.bcb.pix2558pix.asaas.com/qr/cobv/d63b1510-8211-4e58-9b95-5893a6280aa65204000053039865802BR5920Renner Vinicius Dias6008Itatinga61081869008162070503***63048269', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAcIAAAHCAQAAAABUY/ToAAADEElEQVR4Xu2USw7bQAxDs/P9b9RjZZeGj5QdFGhddFMFoOLMh+JjFjPO4/WP9ePxq/K3VfKuSt5VybsqeVcl7+q/kc8HdTyP1/m8v8/HIcu7qxl5nCVXk3Ywum2LohBYIF/OkotJqxz9E+zTecl4opbcT+blPUR5zDAxJb+O5GGnlxuWFvaS30G+MgKm6b22Q306Sy4mc+b4/vyZ21Hyd58F5FluHJw5fbl9PfS2f1pL7iUFqMs7jDkZk/MZk+SSe0nD9Jxy0smTQctXskWU3EvKY4Tv9RiAzkrmksvJbPEg22ELOzaocZTcS9LxVZjuQ0ePK0vfEv8Ic8nFpBoaJDOasdu6PUJJL7mYfMhv+urxNaxUHATZUnIxaeY9DzUpWUySfiRsybXkCT/8zNlj/5Cdjl5yMRnbIDYDOZZcntNbcjEpRoIqDUFOcmTa7pBYci3JyeO1CqIpdyLZzEktuZlEHTE7Z52IF6OW3EwCZPZzIljJeorxln7JvaSN+S9Wi0+272FSxlByP6kWmIxHLgQmXQRYKwZL7iXHDEaKVlYM2hKP2ZKbyeuUkadPoNncgfmW3Exyzvlj9q2QOAKYyPkzV5VcS9pFTxgNRxAjTKy2ZJRcTo41rADMrEyHGL7kYvIt0kSXSYTVpGBPRtCSe0kZcJ8hHsAJ9A0hJGLJxaQkDHFBJiJXwbcgbMn1pH0XqpO33ZnTQii5mRQwI352iiPA1rCeS24mtRQxXm/FnLjuxYSU/AbyMEzACwJJLiix0yu5mnzJpTamD5dMJDgVOcaSe0kduTacP0tHeZDsRP+IvyX3kt76CoQVI6uWgfCTqbnkZtK9CfHiDLrabEguuZh0x7LWeacpmfRqOyxVcjU5xQkLUxM7K5JzCZJdcjOp/lhQ09cIorjwk1ByMRm3ABAv8GQmOZRiSq4mZY9mqzWpClKD5wwo+QWkZk+wxDCl7JNY8jtI+cYNed4Gh9lAVsnF5Ms8Hhh5eOw2eYklV5M673Tdk+KBHCyJZVlyM/lPVfKuSt5VybsqeVcl7+rLyJ99oreDHOgmNgAAAABJRU5ErkJggg==', '00020101021226800014br.gov.bcb.pix2558pix.asaas.com/qr/cobv/d63b1510-8211-4e58-9b95-5893a6280aa65204000053039865802BR5920Renner Vinicius Dias6008Itatinga61081869008162070503***63048269', NULL, '{"expires_at": "2026-04-07T12:06:26.668Z", "store_name": "Nata Lanches", "description": "Comissão ItaSuper - Nata Lanches"}', '2026-04-07 12:01:26.668+00', '2026-04-09 06:04:35.224551+00') ON CONFLICT DO NOTHING;


-- Data for Name: loyalty_config; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.loyalty_config VALUES ('c2a0bb82-19db-42c0-ac12-3a23c17c0bb7', 'e142e377-ec8d-4e63-b80f-cdb5c9c561a5', false, 1, 50, 0.1, 20, '2026-04-10 16:59:02.263327+00', '2026-04-10 16:59:02.477+00') ON CONFLICT DO NOTHING;
INSERT INTO public.loyalty_config VALUES ('0faad2cc-df5c-408f-b640-52efd2d28b8a', '66129fdd-1f7e-42c8-b3c1-8d4c28b14106', false, 1, 50, 0.1, 20, '2026-04-14 15:16:56.852495+00', '2026-04-14 15:16:56.603+00') ON CONFLICT DO NOTHING;


-- Data for Name: loyalty_points; Type: TABLE DATA; Schema: public; Owner: -



-- Data for Name: moderators; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.moderators VALUES ('6b6bb925-e214-449b-a596-d0e893ab2f5f', NULL, 'Thiago', 'thiagocorreia10092005@gmail.com', NULL, 'MOD-YEZMU4', 40, 1, 2, true, '2026-04-16 00:43:03.886882+00', '2026-04-16 00:43:03.886882+00') ON CONFLICT DO NOTHING;


-- Data for Name: moderator_earnings; Type: TABLE DATA; Schema: public; Owner: -



-- Data for Name: moderator_referrals; Type: TABLE DATA; Schema: public; Owner: -
