/**
 * Aba "Conexão" — status, QR Code (com polling automático) e guia passo a passo.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Loader2, RefreshCw, Info, ChevronDown, ChevronUp, Shield } from "lucide-react";
import WhatsAppStatusCard from "./WhatsAppStatusCard";

interface Props {
  storeId: string;
  storeName: string;
  expectedPhone?: string | null;
  config: any;
  reload: () => Promise<void>;
}

const onlyDigits = (v?: string | null) => String(v || "").replace(/\D/g, "");
const samePhone = (a?: string | null, b?: string | null) => {
  const left = onlyDigits(a).replace(/^55/, "");
  const right = onlyDigits(b).replace(/^55/, "");
  return !!left && !!right && left === right;
};

// Fases de aquecimento (P0 — mesmas do edge function evolution-send-message)
const phaseFor = (days: number) => {
  if (days < 7)  return { label: "Semana 1 (aquecimento)", limit: 20 };
  if (days < 14) return { label: "Semana 2", limit: 50 };
  if (days < 28) return { label: "Semanas 3-4", limit: 100 };
  if (days < 56) return { label: "Mês 2", limit: 150 };
  return { label: "Mês 3+ (chip maduro)", limit: 200 };
};

const STEPS = [
  { step: 1, title: 'Clique em "Gerar QR Code"', desc: "Um QR aparece logo abaixo.", icon: "📱" },
  { step: 2, title: "Abra o WhatsApp no celular", desc: "Toque nos 3 pontinhos no canto superior direito.", icon: "💬" },
  { step: 3, title: '"Dispositivos conectados"', desc: 'Depois em "Conectar um dispositivo".', icon: "🔗" },
  { step: 4, title: "Aponte a câmera pro QR", desc: "Conecta automaticamente em segundos.", icon: "📷" },
  { step: 5, title: "Pronto!", desc: "Cada mudança de status do pedido dispara uma mensagem automática.", icon: "✅" },
];

export default function WhatsAppConnection({ storeId, storeName, expectedPhone, config, reload }: Props) {
  const [qrLoading, setQrLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const pollRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const status: "connected" | "connecting" | "disconnected" =
    config?.status === "connected" ? "connected" : config?.status === "connecting" ? "connecting" : "disconnected";

  const connectedPhone = onlyDigits(config?.phone_number);
  const expectedStorePhone = onlyDigits(expectedPhone);
  const phoneMismatch =
    status === "connected" && !!connectedPhone && !!expectedStorePhone && !samePhone(connectedPhone, expectedStorePhone);

  const getQrCode = async (forceReconnect = false) => {
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-qr-code", {
        body: { store_id: storeId, force_reconnect: forceReconnect },
      });
      if (error) throw error;
      if (data?.qr_code) {
        // A edge function já faz upsert em store_whatsapp_config com service role.
        // Só recarregamos o config local; falha aqui NÃO deve virar erro pro usuário.
        try { await reload(); } catch (e) { console.warn("[evolution-qr-code] reload falhou", e); }
        setCountdown(60);
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else {
        toast.error("Servidor não retornou QR Code. Tente novamente.");
      }
    } catch (err: any) {
      let detail = "";
      try {
        if (err instanceof FunctionsHttpError) {
          const body = await err.context.json().catch(() => null);
          detail = body?.error
            ? (typeof body.error === "string" ? body.error : JSON.stringify(body.error))
            : "";
        }
      } catch {}
      toast.error(detail ? `QR Code: ${detail}` : "Erro ao gerar QR Code. Verifique a configuração do servidor.");
      console.error("[evolution-qr-code]", err, detail);
    }
    setQrLoading(false);
  };

  // Polling automático a cada 3s enquanto está em "connecting"
  useEffect(() => {
    if (status !== "connecting") {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = window.setInterval(() => {
      reload();
    }, 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [status, reload]);

  // Countdown de 60s do QR
  useEffect(() => {
    if (status !== "connecting" || !config?.qr_code) {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = null;
      return;
    }
    setCountdown(60);
    countdownRef.current = window.setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
    };
  }, [status, config?.qr_code]);

  // Toast de sucesso quando conectar
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== "connected" && status === "connected") {
      toast.success("🎉 WhatsApp conectado com sucesso!");
    }
    prevStatusRef.current = status;
  }, [status]);

  return (
    <div className="space-y-4">
      <WhatsAppStatusCard
        status={status}
        storeName={storeName}
        connectedPhone={connectedPhone}
        expectedPhone={expectedStorePhone}
        phoneMismatch={phoneMismatch}
        connectedAt={config?.connected_at}
        onPrimaryAction={() => getQrCode(status !== "disconnected")}
        primaryLoading={qrLoading}
      />

      {/* Saúde do chip — só faz sentido quando está conectado */}
      {status === "connected" && config?.connected_at && (() => {
        const days = Math.floor((Date.now() - new Date(config.connected_at).getTime()) / 86_400_000);
        const phase = phaseFor(days);
        const nextThreshold = days < 7 ? 7 : days < 14 ? 14 : days < 28 ? 28 : days < 56 ? 56 : null;
        const daysToNext = nextThreshold ? Math.max(0, nextThreshold - days) : 0;
        return (
          <div className="rounded-2xl border border-border p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-bold text-foreground flex-1">Saúde do chip</p>
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                {days === 0 ? "Novo" : `${days}d`}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-muted-foreground">{phase.label}</p>
              <p className="text-xs font-bold text-foreground">Até <span className="text-primary">{phase.limit}</span> msgs/dia</p>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (phase.limit / 200) * 100)}%` }}
              />
            </div>
            {nextThreshold ? (
              <p className="text-[10px] text-muted-foreground">
                Faltam <strong>{daysToNext} dia{daysToNext !== 1 ? "s" : ""}</strong> para desbloquear a próxima fase e aumentar o limite diário.
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Chip totalmente maduro — limite máximo liberado. Mantenha o bot enxuto (1 msg/24h por cliente) e ele dura meses.
              </p>
            )}
          </div>
        );
      })()}

      {/* QR Code visível durante "connecting" */}
      {status === "connecting" && config?.qr_code && (
        <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-border">
          <p className="text-xs font-bold text-foreground">Escaneie com seu WhatsApp</p>
          <div className="relative">
            <img
              src={config.qr_code.startsWith("data:") ? config.qr_code : `data:image/png;base64,${config.qr_code}`}
              alt="QR Code WhatsApp"
              className="w-52 h-52 object-contain"
            />
            {countdown <= 10 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                expirando…
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Verificando conexão automaticamente…
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            QR expira em <span className="font-bold text-foreground">{countdown}s</span>. Se expirar, gere outro.
          </p>
          <button onClick={reload} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
            <RefreshCw className="h-3 w-3" /> Verificar agora
          </button>
        </div>
      )}

      {/* Guia passo a passo */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center gap-2.5 px-4 py-3 bg-blue-500/5 text-left hover:bg-blue-500/10 transition-colors"
        >
          <Info className="h-4 w-4 text-blue-500 shrink-0" />
          <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex-1">Como conectar o WhatsApp</p>
          {showGuide ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showGuide && (
          <div className="px-4 py-3 space-y-3 bg-card/50">
            {STEPS.map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
                  {item.step}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>{item.icon}</span> {item.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1 space-y-1">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                ⚠️ Use um número de WhatsApp <strong>exclusivo da loja</strong>. Não use seu número pessoal — ele ficará conectado neste painel.
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Para proteger o chip de banimento, o sistema aplica intervalos automáticos, dedupe de 24h por cliente e limite diário progressivo: semana 1: 20/dia · semana 2: 50/dia · 3ª–4ª: 100/dia · mês 2: 150/dia · mês 3+: 200/dia.
              </p>
            </div>
          </div>
        )}
      </div>

      {qrLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando QR Code…
        </div>
      )}
    </div>
  );
}