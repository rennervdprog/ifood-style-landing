-- =====================================================================
-- RPC: store_bootstrap(slug)
-- Retorna em 1 round-trip tudo que a StorePage precisa para a primeira
-- pintura: store, hours, sections, products, owner_profile e contagem
-- de motoboys online. Reduz 6+ requisições sequenciais para 1.
--
-- Rodar este arquivo no Supabase EXTERNO (não no Lovable Cloud).
-- =====================================================================

create or replace function public.store_bootstrap(_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select *
    from public.stores
    where slug = _slug
       or id::text = _slug
    limit 1
  )
  select jsonb_build_object(
    'store', (select to_jsonb(s.*) from s),
    'hours', coalesce(
      (select jsonb_agg(to_jsonb(h.*))
       from public.opening_hours h
       where h.store_id = (select id from s)), '[]'::jsonb),
    'sections', coalesce(
      (select jsonb_agg(to_jsonb(sec.*) order by sec.sort_order)
       from public.menu_sections sec
       where sec.store_id = (select id from s)), '[]'::jsonb),
    'products', coalesce(
      (select jsonb_agg(to_jsonb(p.*))
       from public.products p
       where p.store_id = (select id from s)), '[]'::jsonb),
    'owner_profile', (
      select jsonb_build_object('id', pr.id, 'whatsapp_number', pr.whatsapp_number)
      from public.profiles pr
      where pr.user_id = (select owner_id from s)
    ),
    'online_drivers_count', coalesce(
      (select public.store_active_drivers_count((select id from s))), 0)
  );
$$;

grant execute on function public.store_bootstrap(text) to anon, authenticated;

-- Índices recomendados (idempotentes):
create index if not exists idx_products_store_avail
  on public.products (store_id, is_available);
create index if not exists idx_menu_sections_store_sort
  on public.menu_sections (store_id, sort_order);
create index if not exists idx_opening_hours_store
  on public.opening_hours (store_id);