import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useAttendantRequests — chamados de atendimento humano abertos da loja.
 *
 * Quando o cliente pede um atendente no bot do WhatsApp (menu, palavra
 * "atendente" ou uma falha que promete um humano), o bot grava uma linha
 * em `store_attendant_requests`. Este hook lista os chamados abertos,
 * assina o realtime para tocar o alerta na hora e baixa o chamado
 * quando o lojista marca "Já atendi".
 */

export interface AttendantRequest {
  id: string;
  store_id: string;
  phone: string;
  context: string;
  created_at: string;
  /** Nome do cliente no WhatsApp (push_name do log de entrada), quando há. */
  customer_name: string | null;
}

const CONTEXT_LABELS: Record<string, string> = {
  menu: "Pediu pra falar com um atendente no menu do WhatsApp.",
  palavra_chave: "Escreveu “atendente” no WhatsApp da loja.",
  pedido_atual: "Pediu um atendente sobre o pedido atual.",
  sem_cardapio: "O bot não tinha cardápio pra mostrar e chamou um atendente.",
  erro_pedido: "O bot não conseguiu concluir o pedido e chamou um atendente.",
  erro_pix: "O bot não conseguiu gerar o Pix e chamou um atendente.",
  erro_comprovante: "O bot não conseguiu registrar o comprovante e chamou um atendente.",
};

export function attendantContextLabel(context: string): string {
  return CONTEXT_LABELS[context] ?? "Pediu pra falar com um atendente no WhatsApp.";
}

/** Link direto pra conversa com o cliente no WhatsApp. */
export function attendantWaLink(phone: string): string {
  return `https://wa.me/${String(phone || "").replace(/\D/g, "")}`;
}

/** Telefone brasileiro em formato legível: (14) 99162-4997. */
export function formatAttendantPhone(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

async function fetchCustomerNames(
  storeId: string,
  phones: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(phones)];
  if (unique.length === 0) return names;
  const { data } = await (supabase.from("whatsapp_inbound_log" as any) as any)
    .select("phone, push_name, received_at")
    .eq("store_id", storeId)
    .in("phone", unique)
    .order("received_at", { ascending: false })
    .limit(200);
  for (const row of (data ?? []) as { phone: string; push_name: string | null }[]) {
    if (row.push_name && !names.has(row.phone)) names.set(row.phone, row.push_name);
  }
  return names;
}

export function useAttendantRequests(
  storeId?: string,
  onNewRequest?: () => void,
) {
  const [requests, setRequests] = useState<AttendantRequest[]>([]);
  const onNewRef = useRef(onNewRequest);
  onNewRef.current = onNewRequest;

  const load = useCallback(async () => {
    if (!storeId) {
      setRequests([]);
      return;
    }
    const { data } = await (supabase.from("store_attendant_requests" as any) as any)
      .select("id, store_id, phone, context, created_at")
      .eq("store_id", storeId)
      .is("resolved_at", null)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Omit<AttendantRequest, "customer_name">[];
    const names = await fetchCustomerNames(storeId, rows.map((r) => r.phone));
    setRequests(rows.map((r) => ({ ...r, customer_name: names.get(r.phone) ?? null })));
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`attendant-requests-rt-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "store_attendant_requests", filter: `store_id=eq.${storeId}` },
        (payload) => {
          const row = payload.new as Omit<AttendantRequest, "customer_name">;
          setRequests((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [...prev, { ...row, customer_name: null }];
          });
          onNewRef.current?.();
          void fetchCustomerNames(storeId, [row.phone]).then((names) => {
            const name = names.get(row.phone);
            if (!name) return;
            setRequests((prev) =>
              prev.map((r) => (r.id === row.id ? { ...r, customer_name: name } : r)),
            );
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "store_attendant_requests", filter: `store_id=eq.${storeId}` },
        (payload) => {
          const row = payload.new as { id: string; resolved_at: string | null };
          if (row.resolved_at) {
            setRequests((prev) => prev.filter((r) => r.id !== row.id));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId]);

  const resolve = useCallback(
    async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      await (supabase.from("store_attendant_requests" as any) as any)
        .update({ resolved_at: new Date().toISOString(), resolved_by: auth.user?.id ?? null })
        .eq("id", id)
        .is("resolved_at", null);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    },
    [],
  );

  return { requests, resolve, reload: load };
}
