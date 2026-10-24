/**
 * TELA 4 — Histórico de cobranças semanais (/admin-teste).
 *
 * Leitura apenas da tabela `store_repasse_history` (select *, mais
 * recentes primeiro, limit 50): uma linha por registro com data,
 * valor e status traduzido. Não emite cobrança, não altera nada —
 * a cobrança continua vivendo no bloco de repasse.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatBRL } from "@/lib/utils";
import {
  AdminCardTeste,
  AdminCardDescriptionTeste,
  AdminCardTitleTeste,
  AdminMoneyTeste,
} from "./AdminBaseTeste";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  charged: "Cobrança emitida",
  paid: "Pago",
  cancelled: "Cancelado",
};

interface Registro {
  id: string;
  created_at?: string | null;
  period_end?: string | null;
  total_amount?: number | null;
  repasse_amount?: number | null;
  amount?: number | null;
  status?: string | null;
}

function dataRegistro(r: Registro) {
  const iso = r.created_at ?? r.period_end ?? null;
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : format(d, "dd/MM/yyyy");
}

export default function FinanceHistoryTeste({ storeId }: { storeId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["financeiro-historico-teste", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_repasse_history")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Registro[];
    },
    enabled: !!storeId,
  });

  return (
    <AdminCardTeste
      id="financeiro-historico"
      className="scroll-mt-24 space-y-4"
    >
      <div>
        <AdminCardTitleTeste>Histórico de cobranças semanais</AdminCardTitleTeste>
        <AdminCardDescriptionTeste>
          As cobranças de repasse já registradas, da mais recente à mais
          antiga.
        </AdminCardDescriptionTeste>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Carregando histórico…
        </p>
      ) : isError ? (
        <p className="text-sm text-foreground">
          Não foi possível carregar o histórico de cobranças. Tente
          novamente.
        </p>
      ) : !data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum repasse registrado ainda. O primeiro repasse aparece aqui
          após a segunda-feira.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((r) => {
            const valor = Number(
              r.total_amount ?? r.repasse_amount ?? r.amount ?? 0,
            );
            const status = String(r.status ?? "");
            return (
              <li
                key={r.id}
                className="flex items-baseline justify-between gap-3 py-3"
              >
                <span className="text-sm text-foreground">
                  {dataRegistro(r)} · {STATUS_LABEL[status] ?? status}
                </span>
                <AdminMoneyTeste value={formatBRL(valor)} />
              </li>
            );
          })}
        </ul>
      )}
    </AdminCardTeste>
  );
}
