// E2E: simula pedido pago → aceito → preparando → saiu → entregue.
// Verifica que store_driver_earnings.platform_cut acumulou corretamente
// segundo a RPC canônica compute_store_delivery_fee.
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"};
async function run(q:string){
  const ref=Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t=Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
    method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},
    body:JSON.stringify({query:q})
  });
  const text=await r.text();
  let body:any; try{body=JSON.parse(text);}catch{body=text;}
  return{status:r.status,body};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  const out:Record<string,unknown>={};

  // 1) Loja de teste
  out.store = await run(`
    SELECT id, name, slug, delivery_mode, own_delivery_fee, delivery_fee, platform_fee_split
    FROM public.stores WHERE slug='dudalanchesteste' LIMIT 1;`);
  const store=(out.store as any).body?.[0];
  if(!store) return new Response(JSON.stringify({error:"store not found",out}),{status:404,headers:{...cors,"Content-Type":"application/json"}});

  // 2) Fee esperado
  out.expected_fee = await run(`SELECT public.compute_store_delivery_fee('${store.id}'::uuid) AS fee;`);
  const feeInfo=(out.expected_fee as any).body?.[0]?.fee;

  // 3) Produto e cliente
  out.product = await run(`SELECT id, name, price FROM public.products WHERE store_id='${store.id}'::uuid AND is_available=true LIMIT 1;`);
  const product=(out.product as any).body?.[0];
  out.client = await run(`SELECT id FROM public.profiles WHERE role='cliente' LIMIT 1;`);
  const client=(out.client as any).body?.[0];
  if(!product||!client) return new Response(JSON.stringify({error:"missing product or client",out}),{status:404,headers:{...cors,"Content-Type":"application/json"}});

  const subtotal=Number(product.price);
  const custTotal=Number(feeInfo?.customer_total??0);
  const platCutExpected=Number(feeInfo?.platform_add_customer??0)+Number(feeInfo?.platform_add_payout_deduction??0);
  const total=subtotal+custTotal;

  // 4) Criar pedido pago
  out.order = await run(`
    INSERT INTO public.orders (
      store_id, customer_id, status, payment_status, payment_method,
      subtotal, delivery_fee, total, notes,
      customer_name, customer_phone, customer_address, delivery_mode
    ) VALUES (
      '${store.id}'::uuid, '${client.id}'::uuid, 'pending', 'paid', 'pix',
      ${subtotal}, ${custTotal}, ${total}, 'E2E test order',
      'E2E Cliente', '21999999999', 'Rua Teste, 123', '${store.delivery_mode}'
    ) RETURNING id, subtotal, delivery_fee, total, status, payment_status;`);
  const order=(out.order as any).body?.[0];
  if(!order) return new Response(JSON.stringify({error:"failed to create order",out}),{status:500,headers:{...cors,"Content-Type":"application/json"}});

  await run(`INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES ('${order.id}'::uuid, '${product.id}'::uuid, '${product.name.replace(/'/g,"''")}', 1, ${subtotal}, ${subtotal});`);

  // 5) Avançar fluxo
  out.accept = await run(`UPDATE public.orders SET status='accepted', accepted_at=now() WHERE id='${order.id}'::uuid RETURNING status;`);
  out.preparing = await run(`UPDATE public.orders SET status='preparing' WHERE id='${order.id}'::uuid RETURNING status;`);
  out.out_for_delivery = await run(`UPDATE public.orders SET status='out_for_delivery' WHERE id='${order.id}'::uuid RETURNING status;`);
  out.delivered = await run(`UPDATE public.orders SET status='delivered', delivered_at=now() WHERE id='${order.id}'::uuid RETURNING status;`);

  // 6) Verificar earnings (fonte da verdade do repasse)
  out.earnings = await run(`
    SELECT id, order_id, store_id, gross_amount, platform_cut, driver_amount, store_net_amount, delivery_fee, status
    FROM public.store_driver_earnings WHERE order_id='${order.id}'::uuid;`);
  out.store_balance = await run(`
    SELECT store_id, pending_balance, available_balance, total_earned
    FROM public.store_balances WHERE store_id='${store.id}'::uuid;`);

  out.expected = {
    subtotal, delivery_fee_customer: custTotal, total,
    platform_cut_expected: platCutExpected,
    fee_breakdown: feeInfo,
  };

  return new Response(JSON.stringify(out,null,2),{headers:{...cors,"Content-Type":"application/json"}});
});
