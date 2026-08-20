-- Defesa em profundidade: as RPCs de reserva de cobrança são internas.
-- Revoga explicitamente qualquer herança de EXECUTE para papéis de cliente.

REVOKE EXECUTE ON FUNCTION public.reserve_commission_charge_reservation(uuid, text, text, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_commission_charge_reservation(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_commission_charge_reservation(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_commission_charge_reservation(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_commission_charge_reservation(uuid, text, text, numeric, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_commission_charge_reservation(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_commission_charge_reservation(uuid, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_commission_charge_reservation(uuid, text) TO service_role;
