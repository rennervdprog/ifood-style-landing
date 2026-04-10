
INSERT INTO public.store_balances (store_id, comissao_pendente, pending_commission, repasse_pendente, updated_at)
VALUES ('e142e377-ec8d-4e63-b80f-cdb5c9c561a5', 0, 0, 2, now())
ON CONFLICT (store_id) DO UPDATE SET
  repasse_pendente = store_balances.repasse_pendente + 2,
  updated_at = now();
