-- Item 2 (auditoria 40 itens) — REVOKE do acesso anonimo as funcoes
-- SECURITY DEFINER internas. DRAFT — NAO APLICAR sem a palavra do Renner.
--
-- O que esta migration faz:
--   * REVOKE EXECUTE ... FROM anon, PUBLIC em funcoes internas (admin,
--     repasse/cobranca, afiliados, splits/taxas, PDV, motoboy, lojista).
--   * Todas as 146 funcoes anon-executaveis tem GRANT explicito para
--     authenticated e service_role (conferido no banco vivo em 23/11/2026);
--     o REVOKE tira SO o acesso anonimo (sem sessao). Usuario logado e
--     edge functions (service_role) continuam funcionando.
--   * O REVOKE FROM PUBLIC e necessario ALÉM do FROM anon: 112 das 146
--     tem EXECUTE concedido a PUBLIC, e o grant PUBLIC alcanca o anon.
--     Revogar so FROM anon deixaria essas 112 ainda executaveis por anon.
--   * Funcoes de trigger: o Postgres NAO checa EXECUTE quando a funcao
--     dispara como trigger (so na chamada direta via RPC). O REVOKE
--     bloqueia a chamada direta e NAO quebra o disparo do trigger.
--   * get_expiring_products era a UNICA SECURITY DEFINER do schema public
--     sem search_path fixo — esta migration fixa search_path = public nela.
--
-- O que esta migration NAO faz (fica para os proximos lotes):
--   * Nao revoga as funcoes publicas de verdade (vitrine, checkout de
--     convidado, cadastro, analytics) nem os helpers usados em policies
--     RLS (has_role, is_store_owner, etc. — 139 policies os referenciam).
--   * Nao cria policies nas 6 tabelas com RLS e zero policies (ver
--     INVENTARIO_ITEM2.md — decisao tabela a tabela ainda pendente).
--   * Nao altera nenhuma edge function nem as funcoes kds,
--     resolve-delivery-address, terms-compliance-check e
--     finance-reconcile-snapshot (fora do escopo deste lote).

REVOKE EXECUTE ON FUNCTION public._reseller_lock_store_on_activation() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accrue_moderator_earnings() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_approve_partner(_profile_user_id uuid, _approved boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order(_order_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_cleanup_duplicate_withdrawals() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_test_store(_name text, _category store_category, _plan_type text, _store_type text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_partner(_profile_user_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_store(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_store_type(_store_id uuid, _store_type text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_plan_template(p_id uuid, p_monthly_fee numeric, p_revenue_threshold numeric, p_commission_rate numeric, p_description text, p_platform_fee_included boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.affiliate_credit_cancel_on_reversal() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.affiliate_credit_from_paid_invoice() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.alert_negative_store_balance() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apparel_adjust_stock(_variant_id uuid, _delta numeric, _reason text, _ref_order_id uuid, _note text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apparel_create_product_with_variants(_store_id uuid, _name text, _base_price numeric, _category text, _image_url text, _description text, _variants jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apparel_create_product_with_variants(_store_id uuid, _name text, _price numeric, _section_id uuid, _image_url text, _variants jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apparel_list_credits(_store_id uuid, _phone text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apparel_touch_customer(_store_id uuid, _phone text, _name text, _preferred_size text, _amount numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_plan_change(_request_id uuid, _admin_notes text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_order_delivery_fee() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_order_item_price() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_loyalty_points() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_whatsapp_rate_limit(_store_id uuid, _phone text, _window_minutes integer, _max_messages integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_refused_pix_proofs() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_pix_proof(p_order_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_accept_order(_order_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_accept_orders_batch(_order_ids uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_confirm_store_return(_order_id uuid, _settlement_code text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_depart_route(_order_ids uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_finish_delivery(_order_id uuid, _pin text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_presence_heartbeat() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.driver_validate_collection(_order_id uuid, _code text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_free_delivery_threshold() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_order_driver_availability() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_client_status_push() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_lojista_has_store() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_stale_pending_orders() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_auto_approve() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_store_auto_approve() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_delivery_pin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_asaas_split_for_order(_store_id uuid, _subtotal numeric, _delivery_fee numeric, _payment_method text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_delivery_contacts(_order_ids uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_driver_history_stores(p_store_ids uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_expiring_products(_store_id uuid, _days integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_fixed_plan_platform_split(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_order_store_owner(p_order_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_receivables() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_store_commission_rate(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_store_platform_fee_charge(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_store_platform_split(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_matriz_flag() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_order_cash_transaction() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_order_status_chat_message() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.legal_documents_enforce_single_current() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(_action text, _target_type text, _target_id uuid, _details jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins_new_approval() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_driver_delivery_available() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_guest_order_status() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_whatsapp() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_zapi() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_order_sync() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_record_sync() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_add_tab_item(_tab_id uuid, _product_id uuid, _name text, _quantity numeric, _unit_price numeric, _addons jsonb, _observations text, _metadata jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_assert_store_owner(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_cancel_sale(_order_id uuid, _pin text, _reason text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_close_tab(_tab_id uuid, _session_id uuid, _payments jsonb, _pdv_discount numeric, _commission_rate numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_list_operators(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_open_tab(_store_id uuid, _table_id uuid, _code text, _customer_name text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_set_operator_active(_store_id uuid, _id uuid, _active boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_transfer_tab(_tab_id uuid, _new_table_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_upsert_operator(_store_id uuid, _id uuid, _name text, _pin text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_upsert_operator(_store_id uuid, _id uuid, _name text, _pin text, _role text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_verify_manager_pin(_store_id uuid, _pin text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pdv_verify_operator_pin(_store_id uuid, _pin text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_driver_protected_fields_update() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_network_self_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_role_self_change() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_writes_on_matriz() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_loyalty_points(_order_id uuid, _store_id uuid, _points_to_use integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_store_rating_aggregates(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refuse_pix_proof(p_order_id uuid, p_reason text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_empties_return(_order_id uuid, _returns jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_plan_change(_request_id uuid, _admin_notes text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_due_affiliate_credits() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_repasse_charge(_store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_essencial_upgrade(_response text, _store_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_motoboy_profiles(_search text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_order_delivered_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_pix_direct_proof_deadline() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.store_assign_order_driver(_order_id uuid, _driver_user_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_repasse_paid() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_cleanup_pdv_addon_on_plan_change() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_ticket_on_message() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_refresh_store_aggregates() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_restore_stock_on_order_cancel() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_out_of_stock_flag() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_store_rating() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_driver_directory_preference(_city text, _is_listed boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.use_wallet_balance(_user_id uuid, _amount numeric, _order_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_order_item_before_insert() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_order_prices() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_order_subtotal() FROM anon, PUBLIC;

-- Unica SECURITY DEFINER sem search_path fixo (conferido em 23/11/2026):
ALTER FUNCTION public.get_expiring_products(uuid, integer) SET search_path = public;

-- Verificacao pos-aplicacao (rodar no banco vivo, so leitura):
--   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
--   WHERE n.nspname = 'public' AND p.prosecdef AND a.privilege_type = 'EXECUTE'
--     AND (a.grantee::regrole::text = 'anon' OR a.grantee = 0);  -- esperado: 0
--   -- e confirmar que authenticated/service_role seguem com EXECUTE nas mesmas.
