/**
 * One-shot: cria RPCs de devolução de casquinhas no Supabase EXTERNO.
 * Após rodar com sucesso, esta função pode ser deletada.
 *
 * Cria:
 *   - register_empties_return(_order_id uuid, _returns jsonb)
 *       _returns = [{ returnable_group_id, qty }]
 *       Credita saldo em customer_empties + log em empties_movements.
 *
 *   - apply_order_empties_debit(_order_id uuid)
 *       Lê orders.metadata->'empties_exchange' (selecionado no checkout)
 *       e debita o saldo do cliente em customer_empties.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

const SQL = `
create or replace function public.register_empties_return(_order_id uuid, _returns jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _order record;
  _item jsonb;
  _gid uuid;
  _qty int;
begin
  select id, client_id, store_id, driver_id into _order
  from public.orders where id = _order_id;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  -- somente entregador do pedido, dono da loja ou admin
  if _order.driver_id is distinct from auth.uid()
     and not exists (select 1 from public.stores s where s.id = _order.store_id and s.owner_id = auth.uid())
     and not public.is_platform_admin(auth.uid())
  then
    raise exception 'Sem permissão para registrar devolução.';
  end if;

  for _item in select * from jsonb_array_elements(coalesce(_returns, '[]'::jsonb))
  loop
    _gid := (_item->>'returnable_group_id')::uuid;
    _qty := coalesce((_item->>'qty')::int, 0);
    if _gid is null or _qty <= 0 then continue; end if;

    insert into public.customer_empties (customer_id, store_id, returnable_group_id, qty, updated_at)
    values (_order.client_id, _order.store_id, _gid, _qty, now())
    on conflict (customer_id, store_id, returnable_group_id) do update
      set qty = public.customer_empties.qty + excluded.qty,
          updated_at = now();

    insert into public.empties_movements (customer_id, store_id, returnable_group_id, order_id, kind, qty, created_by)
    values (_order.client_id, _order.store_id, _gid, _order_id, 'returned', _qty, auth.uid());
  end loop;
end;
$$;

grant execute on function public.register_empties_return(uuid, jsonb) to authenticated, service_role;

create or replace function public.apply_order_empties_debit(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _order record;
  _exchange jsonb;
  _line jsonb;
  _gid uuid;
  _qty int;
  _balance int;
begin
  select id, client_id, store_id, metadata into _order
  from public.orders where id = _order_id;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  _exchange := coalesce(_order.metadata->'empties_exchange', '[]'::jsonb);
  if jsonb_array_length(_exchange) = 0 then return; end if;

  -- idempotente: se já houve débito para esse pedido, sai
  if exists (select 1 from public.empties_movements where order_id = _order_id and kind = 'charged') then
    return;
  end if;

  for _line in select * from jsonb_array_elements(_exchange)
  loop
    _gid := (_line->>'returnable_group_id')::uuid;
    _qty := coalesce((_line->>'qty')::int, 0);
    if _gid is null or _qty <= 0 then continue; end if;

    select qty into _balance from public.customer_empties
     where customer_id = _order.client_id and store_id = _order.store_id and returnable_group_id = _gid
     for update;
    _balance := coalesce(_balance, 0);
    if _balance < _qty then _qty := _balance; end if;
    if _qty <= 0 then continue; end if;

    update public.customer_empties
       set qty = qty - _qty, updated_at = now()
     where customer_id = _order.client_id and store_id = _order.store_id and returnable_group_id = _gid;

    insert into public.empties_movements (customer_id, store_id, returnable_group_id, order_id, kind, qty, created_by)
    values (_order.client_id, _order.store_id, _gid, _order_id, 'charged', _qty, _order.client_id);
  end loop;
end;
$$;

grant execute on function public.apply_order_empties_debit(uuid) to authenticated, service_role;
`;

async function runSql(query: string) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  return { status: r.status, body: await r.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // One-shot bootstrap: no auth (function will be deleted after running).
  const result = await runSql(SQL);
  return new Response(JSON.stringify(result, null, 2), { status: result.status === 200 || result.status === 201 ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});