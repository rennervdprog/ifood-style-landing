-- Trava anti-duplicidade de caixa: só uma sessão 'open' por loja.
-- O código (usePdvSession.openSession) já trata o erro 23505, mas o índice
-- único parcial nunca existiu — sem ele, duas abas criam dois caixas abertos.
-- (Auditoria PDV 2026-10-13, item 2.2)

CREATE UNIQUE INDEX IF NOT EXISTS pdv_sessions_one_open_per_store
  ON public.pdv_sessions (store_id)
  WHERE status = 'open';
