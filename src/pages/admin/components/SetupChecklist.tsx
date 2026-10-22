import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, ClipboardCheck, X } from "lucide-react";
import type { DashboardTab } from "../types";

export interface SetupStep {
  key: string;
  label: string;
  desc: string;
  tab: DashboardTab;
  done: boolean;
  urgente: boolean;
}

export interface SetupChecklistInput {
  imageUrl?: string | null;
  storeHours?: any[] | null;
  menuProductCount: number;
  deliveryMode?: string | null;
  maxDeliveryKm?: number | string | null;
  deliveryRadius?: number | string | null;
  estimatedDeliveryTime?: string | null;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
  whatsappConnected: boolean;
}

/**
 * Monta os passos do checklist "Configurar Loja" na ordem fixa exibida.
 * Sinais usados (todos já lidos pelo AdminDashboardV2, nenhuma query nova):
 * - logo: stores.image_url
 * - horários: existe horário e nem todo dia está fechado (regra do banner antigo)
 * - produtos: menuProductCount > 0
 * - entrega: delivery_mode = 'platform' (a plataforma entrega, nada a definir)
 *   OU raio definido (max_delivery_km/delivery_radius > 0 — as colunas de taxa
 *   têm default de banco, então não distinguem configuração) OU tempo estimado
 *   de entrega preenchido (estimated_delivery_time é NULL por padrão e só é
 *   gravado quando o lojista salva as configurações de entrega)
 * - entregador: hasLinkedDrivers (só entra na lista se isOwnDelivery;
 *   durante o carregamento não conta como pendente, igual ao banner antigo)
 * - WhatsApp: store_whatsapp_config.status === 'connected' (mesmo sinal da
 *   query store-evo-connected do dashboard)
 */
export function buildSetupSteps(input: SetupChecklistInput): SetupStep[] {
  const hoursDone =
    !!input.storeHours &&
    input.storeHours.length > 0 &&
    !(input.storeHours as any[]).every((h: any) => h.is_closed_all_day === true);
  const mode = input.deliveryMode ?? "own";
  const radiusKm = Number(input.maxDeliveryKm ?? input.deliveryRadius ?? 0) || 0;
  const deliveryDone =
    mode === "platform" ||
    radiusKm > 0 ||
    !!(input.estimatedDeliveryTime && String(input.estimatedDeliveryTime).trim());

  const steps: SetupStep[] = [
    {
      key: "logo",
      label: "Adicionar logo da loja",
      desc: "Uma boa foto aumenta a conversão de clientes",
      tab: "settings",
      done: !!input.imageUrl,
      urgente: false,
    },
    {
      key: "hours",
      label: "Configurar horários",
      desc: "Sem horários a loja aparece sempre fechada",
      tab: "hours",
      done: hoursDone,
      urgente: false,
    },
    {
      key: "menu",
      label: "Adicionar produtos",
      desc: "Seu cardápio está vazio — clientes não conseguem pedir",
      tab: "menu",
      done: input.menuProductCount > 0,
      urgente: true,
    },
    {
      key: "delivery",
      label: "Definir a entrega",
      desc: "Sem a entrega definida o cliente não consegue fechar o pedido",
      tab: "settings",
      done: deliveryDone,
      urgente: false,
    },
    ...(input.isOwnDelivery
      ? [
          {
            key: "driver",
            label: "Vincular entregador",
            desc: "Sem motoboy cadastrado clientes não conseguem pedir",
            tab: "drivers" as DashboardTab,
            done: input.hasLinkedDrivers || input.driversLoading,
            urgente: true,
          },
        ]
      : []),
    {
      key: "whatsapp",
      label: "Conectar o WhatsApp",
      desc: "Com o WhatsApp conectado o cliente recebe o link do cardápio e os avisos do pedido",
      tab: "settings",
      done: input.whatsappConnected,
      urgente: false,
    },
  ];
  return steps;
}

interface Props {
  storeId: string;
  steps: SetupStep[];
  onNavigate: (tab: DashboardTab) => void;
}

export default function SetupChecklist({ storeId, steps, onNavigate }: Props) {
  const storageKey = `setup-checklist-done:${storeId}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      /* localStorage indisponível */
    }
  }, [storageKey]);

  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const pending = steps.filter((s) => !s.done);

  // Se algo regredir (ex.: WhatsApp desconectar), o cartão completo volta
  // a aparecer mesmo que a linha de "loja pronta" tenha sido escondida.
  useEffect(() => {
    if (pending.length > 0 && dismissed) {
      setDismissed(false);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* localStorage indisponível */
      }
    }
  }, [pending.length, dismissed, storageKey]);

  if (total === 0) return null;

  if (pending.length === 0) {
    if (dismissed) return null;
    return (
      <div className="px-4 pt-4 pb-0">
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 p-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="flex-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            Sua loja está pronta pra vender
          </p>
          <button
            onClick={() => {
              setDismissed(true);
              try {
                localStorage.setItem(storageKey, "1");
              } catch {
                /* localStorage indisponível */
              }
            }}
            aria-label="Esconder aviso de loja pronta"
            className="p-1 rounded-lg text-emerald-600/70 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.round((doneCount / total) * 100);
  const temUrgente = pending.some((s) => s.urgente);
  const proximo = pending[0];

  return (
    <div className="px-4 pt-4 pb-0">
      <div
        className={`rounded-2xl border p-4 ${
          temUrgente
            ? "bg-amber-50 dark:bg-amber-500/8 border-amber-200 dark:border-amber-500/20"
            : "bg-blue-50 dark:bg-blue-500/8 border-blue-200 dark:border-blue-500/20"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              temUrgente
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
            }`}
          >
            {temUrgente ? <AlertTriangle className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-black ${
                temUrgente ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"
              }`}
            >
              {temUrgente ? "Configure para começar a receber pedidos" : "Complete a configuração da sua loja"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {doneCount} de {total} concluídos · {pct}%
            </p>
          </div>
        </div>

        <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        <p className="text-[11px] font-bold text-foreground mb-3">
          PRÓXIMO: <span className="text-primary">{proximo.label}</span>
        </p>

        <div className="space-y-2">
          {steps.map((step) =>
            step.done ? (
              <div
                key={step.key}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{step.label}</p>
              </div>
            ) : (
              <button
                key={step.key}
                onClick={() => onNavigate(step.tab)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98] ${
                  step.urgente
                    ? "bg-amber-100/70 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/15"
                    : "bg-blue-100/70 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black text-white ${
                    step.urgente ? "bg-amber-500" : "bg-blue-500"
                  }`}
                >
                  {step.urgente ? "!" : <ArrowRight className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-bold ${
                      step.urgente ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{step.desc}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
