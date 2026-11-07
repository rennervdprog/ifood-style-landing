import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { brl } from "@/components/finance/financeExport";

/* ─────────────────────────────────────────────────────────────
 * Fase 5 do pacote Repasse — cobranças com falha visíveis.
 *
 * Até aqui, uma cobrança de financial_transactions com status
 * "failed" (PIX expirado ou recusado pelo gateway) não aparecia
 * em NENHUMA tela: em 07/11/2026 eram 20 cobranças, R$ 1.877,28.
 * A falha NÃO apaga a dívida — o valor continua no saldo da loja
 * e volta na próxima cobrança. Este cartão é só visibilidade:
 * sem botão de reemitir ou apagar (reemissão é decisão da Fase 6).
 *
 * Lojas de teste (nome contém "sandbox") começam escondidas,
 * com uma chave para mostrar — mesmo comportamento da prévia
 * aprovada pelo Renner em 07/11/2026.
 * ─────────────────────────────────────────────────────────── */

interface FailedCharge {
  id: string;
  reference_code: string;
  amount: number;
  created_at: string;
  store_name: string;
  is_test: boolean;
}

function familyLabel(ref: string): string {
  if (ref.startsWith("#REP-")) return "Repasse";
  if (ref.startsWith("#MENS-")) return "Mensalidade";
  if (ref.startsWith("#ASSIN-")) return "Assinatura";
  if (ref.startsWith("#FAT-")) return "Fatura legada";
  if (ref.startsWith("TAXA-")) return "Taxa legada";
  if (ref.startsWith("pay_")) return "Pagamento legado";
  return "Cobrança";
}

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

const FailedChargesCard = () => {
  const [showTests, setShowTests] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["failed-charges-platform"],
    queryFn: async () => {
      const { data: rows, error } = await (supabase as any)
        .from("financial_transactions")
        .select("id, reference_code, amount, created_at, stores(name)")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (rows || []).map((r: any) => ({
        id: r.id,
        reference_code: String(r.reference_code || ""),
        amount: Number(r.amount || 0),
        created_at: r.created_at,
        store_name: r.stores?.name || "Loja removida",
        is_test: /sandbox/i.test(r.stores?.name || ""),
      })) as FailedCharge[];
    },
    staleTime: 30_000,
  });

  const all = data || [];
  const visible = useMemo(
    () => (showTests ? all : all.filter((c) => !c.is_test)),
    [all, showTests],
  );
  const totalVisible = visible.reduce((s, c) => s + c.amount, 0);
  const testCount = all.filter((c) => c.is_test).length;

  if (isLoading) return null;

  return (
    <Card className="border-destructive/40">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="font-bold text-foreground">Cobranças com falha</h3>
          {all.length > 0 ? (
            <Badge variant="destructive" className="text-[11px]">
              {visible.length} {visible.length === 1 ? "cobrança" : "cobranças"} · {brl(totalVisible)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] gap-1">
              <CheckCircle2 className="w-3 h-3" /> Nenhuma
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          PIX expirado ou recusado pelo gateway. O valor não some: continua no saldo da loja e
          volta na próxima cobrança — esta lista é só para acompanhar, da mais recente para a mais antiga.
        </p>

        {testCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
            <Switch checked={showTests} onCheckedChange={setShowTests} />
            Incluir lojas de teste (sandbox) — {testCount} {testCount === 1 ? "cobrança" : "cobranças"}
          </label>
        )}

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            ✅ Nenhuma cobrança com falha{showTests ? "" : " em lojas reais"}.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {visible.map((c) => (
              <div
                key={c.id}
                className={`py-2.5 flex items-start justify-between gap-3 ${c.is_test ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {c.store_name}
                    {c.is_test && (
                      <Badge variant="secondary" className="text-[9px] ml-2 align-middle">
                        TESTE
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px] ml-2 align-middle">
                      {familyLabel(c.reference_code)}
                    </Badge>
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono break-all">
                    {c.reference_code}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    <span className="text-destructive font-semibold">{ageLabel(c.created_at)}</span>
                  </p>
                </div>
                <span className="text-sm font-black tabular-nums shrink-0">{brl(c.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FailedChargesCard;
