/**
 * Background Runner — Motoboy
 *
 * Roda periodicamente em background nativo (Android JobScheduler, iOS BGTask).
 * Contexto isolado: SEM acesso ao DOM, React, Supabase SDK ou localStorage do app.
 * Tem `fetch`, `CapacitorKV` (key-value persistido) e `CapacitorNotifications`.
 *
 * Fluxo:
 *   1. Lê do KV: SUPABASE_URL, SUPABASE_KEY, USER_ID, LINKED_STORE_IDS, ONLINE,
 *      LAST_SEEN_ORDER_IDS.
 *   2. Se motoboy está online e tem lojas vinculadas, busca pedidos disponíveis
 *      (status=pronto_para_entrega, driver_id IS NULL) das lojas vinculadas.
 *   3. Se há pedido novo (id não estava em LAST_SEEN_ORDER_IDS), dispara uma
 *      notificação local "🔔 Novo pedido disponível!" — fora do app, igual push.
 *   4. Persiste a lista de IDs vistos para não notificar duas vezes.
 */
/**
 * Evento `setState` — chamado pelo app a cada mudança de online/offline,
 * vínculo de loja ou login. Atualiza o KV usado pelo `checkForOrders`.
 */
addEventListener('setState', (resolve, _reject, args) => {
  try {
    if (args && typeof args === 'object') {
      if (typeof args.SUPABASE_URL === 'string') CapacitorKV.set('SUPABASE_URL', args.SUPABASE_URL);
      if (typeof args.SUPABASE_KEY === 'string') CapacitorKV.set('SUPABASE_KEY', args.SUPABASE_KEY);
      if (typeof args.USER_ID === 'string') CapacitorKV.set('USER_ID', args.USER_ID);
      if (typeof args.LINKED_STORE_IDS === 'string') CapacitorKV.set('LINKED_STORE_IDS', args.LINKED_STORE_IDS);
      if (typeof args.ONLINE === 'string') CapacitorKV.set('ONLINE', args.ONLINE);
      if (args.RESET === true) {
        CapacitorKV.set('USER_ID', '');
        CapacitorKV.set('LINKED_STORE_IDS', '');
        CapacitorKV.set('ONLINE', '0');
        CapacitorKV.set('LAST_SEEN_ORDER_IDS', '');
      }
    }
    resolve();
  } catch (e) {
    resolve();
  }
});

addEventListener('checkForOrders', async (resolve, reject, args) => {
  try {
    const supabaseUrl = CapacitorKV.get('SUPABASE_URL');
    const supabaseKey = CapacitorKV.get('SUPABASE_KEY');
    const userId = CapacitorKV.get('USER_ID');
    const linkedStoresRaw = CapacitorKV.get('LINKED_STORE_IDS') || '';
    const isOnline = CapacitorKV.get('ONLINE') === '1';
    const lastSeenRaw = CapacitorKV.get('LAST_SEEN_ORDER_IDS') || '';

    if (!supabaseUrl || !supabaseKey || !userId || !isOnline) {
      resolve();
      return;
    }

    const linkedStoreIds = linkedStoresRaw.split(',').filter(Boolean);
    if (linkedStoreIds.length === 0) {
      resolve();
      return;
    }

    const inFilter = `(${linkedStoreIds.map((id) => `"${id}"`).join(',')})`;
    const url =
      `${supabaseUrl}/rest/v1/orders` +
      `?select=id,store_id` +
      `&store_id=in.${inFilter}` +
      `&status=eq.pronto_para_entrega` +
      `&driver_id=is.null` +
      `&order=created_at.asc` +
      `&limit=20`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      resolve();
      return;
    }

    const orders = await res.json();
    const currentIds = (orders || []).map((o) => o.id);
    const lastSeen = lastSeenRaw.split(',').filter(Boolean);
    const newOnes = currentIds.filter((id) => !lastSeen.includes(id));

    if (newOnes.length > 0) {
      try {
        CapacitorNotifications.schedule([
          {
            id: Math.floor(Date.now() / 1000) % 2147483647,
            title: '🔔 Novo pedido disponível!',
            body:
              newOnes.length === 1
                ? 'Toque para abrir e aceitar a entrega.'
                : `${newOnes.length} novos pedidos esperando.`,
            sound: 'default',
          },
        ]);
      } catch (e) {
        // ignore
      }
    }

    CapacitorKV.set('LAST_SEEN_ORDER_IDS', currentIds.join(','));
    resolve();
  } catch (err) {
    resolve();
  }
});