-- Item 17 (auditoria 40 itens, 23/11/2026) — fila de solicitações LGPD (art. 18).
--
-- Cria a tabela `lgpd_requests`: tipo do pedido, quem pediu, quando, prazo
-- de 15 dias corridos e status. O atendimento continua MANUAL (sem
-- automação de e-mail para o titular): o titular só REGISTRA o pedido pelo
-- perfil ("Meus dados") e o super-admin atende pela fila no JuridicoTab.
--
-- ATENÇÃO: esta migration VAI no PR mas NÃO foi aplicada no banco vivo.
-- A tela "Meus dados" e a fila do JuridicoTab só funcionam depois que ela
-- for aplicada (deploy da migration). Até lá, a query do perfil retorna
-- lista vazia e o insert devolve erro tratado com toast (sem quebrar a tela).

CREATE TABLE public.lgpd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Titular que fez o pedido (auth.uid() no momento do insert).
  user_id uuid NOT NULL,
  -- Tipo do pedido (art. 18 da LGPD). 'acesso'/'portabilidade' já são
  -- atendidos pelo download direto no perfil; os demais entram na fila.
  request_type text NOT NULL CHECK (request_type IN ('acesso', 'portabilidade', 'anonimizacao', 'correcao', 'eliminacao')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_atendimento', 'concluido', 'recusado')),
  -- Nome/e-mail do solicitante no momento do pedido (denormalizado para a
  -- fila não depender de join com profiles se a conta for excluída depois).
  requester_name text,
  requester_email text,
  -- Detalhes opcionais informados pelo titular.
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  -- Prazo legal de resposta: 15 dias corridos (art. 18, §2º da LGPD).
  due_at timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  handled_by uuid,
  handled_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lgpd_requests ENABLE ROW LEVEL SECURITY;

-- O titular vê e cria SOMENTE os próprios pedidos.
CREATE POLICY "Users can view own LGPD requests"
  ON public.lgpd_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own LGPD requests"
  ON public.lgpd_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- O super-admin (JuridicoTab) lê a fila inteira e atualiza o status.
CREATE POLICY "Admins can read LGPD requests"
  ON public.lgpd_requests FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can update LGPD requests"
  ON public.lgpd_requests FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE INDEX lgpd_requests_user_id_idx ON public.lgpd_requests (user_id);
CREATE INDEX lgpd_requests_status_due_at_idx ON public.lgpd_requests (status, due_at);
