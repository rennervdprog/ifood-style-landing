
-- Add new status to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'aguardando_pagamento' BEFORE 'pendente';

-- Add cancelled status for admin cleanup
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelado' AFTER 'finalizado';
