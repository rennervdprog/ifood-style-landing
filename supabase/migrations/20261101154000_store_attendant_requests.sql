-- Chamados de atendimento humano: o bot do WhatsApp grava uma linha
-- quando promete um atendente ao cliente (menu "Falar com atendente",
-- palavra de escape ou falha que chama um humano). O painel da loja
-- exibe os chamados abertos em Avisos, com realtime.
create table if not exists public.store_attendant_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  phone text not null,
  context text not null default 'menu',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index if not exists store_attendant_requests_open_idx
  on public.store_attendant_requests (store_id, resolved_at, created_at desc);
alter table public.store_attendant_requests enable row level security;
create policy attendant_owner_read on public.store_attendant_requests for select using (
  exists (select 1 from public.stores s where s.id = store_attendant_requests.store_id and s.owner_id = (select auth.uid()))
  or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::app_role)
);
create policy attendant_owner_update on public.store_attendant_requests for update using (
  exists (select 1 from public.stores s where s.id = store_attendant_requests.store_id and s.owner_id = (select auth.uid()))
  or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::app_role)
) with check (
  exists (select 1 from public.stores s where s.id = store_attendant_requests.store_id and s.owner_id = (select auth.uid()))
  or exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'::app_role)
);
alter publication supabase_realtime add table public.store_attendant_requests;
