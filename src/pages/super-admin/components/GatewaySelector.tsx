import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Provedores suportados pelo `payment-router`. */
export const GATEWAYS = [
  { id: "WOOVI", label: "Woovi", hint: "PIX (OpenPix)" },
  { id: "ABACATEPAY", label: "AbacatePay", hint: "PIX barato" },
  { id: "ASAAS", label: "Asaas", hint: "PIX + split" },
  { id: "MERCADO_PAGO", label: "Mercado Pago", hint: "PIX" },
  { id: "SIMULATED", label: "Simulado", hint: "Somente testes" },
] as const;

export type GatewayId = (typeof GATEWAYS)[number]["id"];

/**
 * Seletor do gateway de pagamento ativo da plataforma.
 * Persiste em `admin_settings.payment_gateway` = { provider: "<ID>" },
 * lido pelas edge functions (payment-router, mensalidade e repasse).
 */
const GatewaySelector = () => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: current, isLoading } = useQuery({
    queryKey: ["admin-payment-gateway"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "payment_gateway")
        .maybeSingle();
      if (error) throw error;
      const provider = (data?.value as { provider?: string } | null)?.provider;
      return (provider || "ASAAS").toUpperCase();
    },
  });

  const selectGateway = async (id: GatewayId) => {
    if (id === current) return;
    setSaving(id);
    try {
      const { error } = await supabase
        .from("admin_settings")
        .upsert({ key: "payment_gateway", value: { provider: id } }, { onConflict: "key" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-payment-gateway"] });
      toast.success(`Gateway ativo: ${GATEWAYS.find((g) => g.id === id)?.label}`);
    } catch (err) {
      console.error("[GatewaySelector] erro ao salvar:", err);
      toast.error("Não foi possível trocar o gateway.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-black text-foreground">Gateway de pagamento</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Define quem processa os PIX de mensalidade, comissão e pedidos. Troca imediata, sem perder o histórico.
      </p>

      {isLoading ? (
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {GATEWAYS.map((g) => {
            const active = current === g.id;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={active}
                disabled={!!saving}
                onClick={() => selectGateway(g.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all active:scale-95 disabled:opacity-60",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/40 hover:bg-muted"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{g.label}</span>
                  {saving === g.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : active ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground">{g.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default GatewaySelector;