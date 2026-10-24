/**
 * Aba "Notificações" — toggles por etapa do pedido + auto-resposta.
 */
import { Zap, MessageCircle, Gauge, AlertTriangle } from "lucide-react";

interface Props {
  storeSlug: string;
  notifyAccepted: boolean;
  setNotifyAccepted: (v: boolean) => void;
  notifyReady: boolean;
  setNotifyReady: (v: boolean) => void;
  notifyOutDelivery: boolean;
  setNotifyOutDelivery: (v: boolean) => void;
  notifyDelivered: boolean;
  setNotifyDelivered: (v: boolean) => void;
  notifyCancelled: boolean;
  setNotifyCancelled: (v: boolean) => void;
  autoReply: boolean;
  setAutoReply: (v: boolean) => void;
  // Teto diário de envios: base é o teto da idade do número; o override
  // (string vazia = sem override) só aumenta o limite, até 500.
  baseDailyLimit: number;
  dailyLimitOverride: string;
  setDailyLimitOverride: (v: string) => void;
}

const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
  <button type="button" onClick={onChange} aria-pressed={value}>
    <div className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}>
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? "left-5" : "left-0.5"}`} />
    </div>
  </button>
);

export default function WhatsAppNotifications({
  storeSlug,
  notifyAccepted, setNotifyAccepted,
  notifyReady, setNotifyReady,
  notifyOutDelivery, setNotifyOutDelivery,
  notifyDelivered, setNotifyDelivered,
  notifyCancelled, setNotifyCancelled,
  autoReply, setAutoReply,
  baseDailyLimit,
  dailyLimitOverride, setDailyLimitOverride,
}: Props) {
  // Limite efetivo: maior entre o teto da idade e o override, travado em 500.
  const parsedOverride = dailyLimitOverride.trim() === "" ? null : Number(dailyLimitOverride);
  const overrideValid =
    parsedOverride !== null && Number.isFinite(parsedOverride) &&
    parsedOverride > baseDailyLimit && parsedOverride <= 500;
  const effectiveDailyLimit = overrideValid
    ? Math.min(Math.max(baseDailyLimit, Math.floor(parsedOverride as number)), 500)
    : baseDailyLimit;
  const overrideError =
    dailyLimitOverride.trim() === "" ? null
    : parsedOverride === null || !Number.isFinite(parsedOverride)
      ? "Digite um número válido."
      : parsedOverride <= baseDailyLimit
        ? `Precisa ser maior que o limite atual (${baseDailyLimit} por dia).`
        : parsedOverride > 500
          ? "O máximo é 500 envios por dia."
          : null;
  const items = [
    { label: "Pedido aceito / em preparo", emoji: "✅", value: notifyAccepted, set: setNotifyAccepted, desc: "Quando o lojista aceita o pedido" },
    { label: "Saiu para entrega", emoji: "🛵", value: notifyOutDelivery, set: setNotifyOutDelivery, desc: "Motoboy a caminho" },
    { label: "Cancelado", emoji: "❌", value: notifyCancelled, set: setNotifyCancelled, desc: "Aviso quando cancelar o pedido" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Notificações por etapa</p>
            <p className="text-[11px] text-muted-foreground">Cada mudança de status dispara uma mensagem ao cliente.</p>
          </div>
        </div>

        <div className="divide-y divide-border/60 -mx-4 px-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2.5">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <span className="text-base shrink-0">{item.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
                </div>
              </div>
              <Toggle value={item.value} onChange={() => item.set(!item.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Limite diário de envios</p>
            <p className="text-[11px] text-muted-foreground">Quantas mensagens o WhatsApp da loja pode enviar por dia.</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Limite atual da loja: <strong className="text-foreground">{effectiveDailyLimit} envios por dia</strong>
          {overrideValid ? " (aumentado por você)" : " (limite do aquecimento do número)"}.
          O limite sobe sozinho com o tempo de uso do número.
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="daily-limit-override" className="text-xs font-bold text-foreground shrink-0">
            Aumentar para
          </label>
          <input
            id="daily-limit-override"
            type="number"
            inputMode="numeric"
            min={baseDailyLimit + 1}
            max={500}
            step={1}
            value={dailyLimitOverride}
            onChange={(e) => setDailyLimitOverride(e.target.value)}
            placeholder={String(baseDailyLimit)}
            className="w-24 rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-bold text-foreground outline-none focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">envios por dia (máx. 500)</span>
        </div>
        {overrideError && (
          <p className="text-[11px] font-bold text-red-600 dark:text-red-400">{overrideError}</p>
        )}
        {!overrideError && (
          <p className="text-[11px] text-muted-foreground">
            Deixe em branco para manter o limite do aquecimento. Só vale número maior que {baseDailyLimit}.
          </p>
        )}

        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
            <strong>Atenção:</strong> aumentar o limite acima do aquecimento natural aumenta o risco de o
            WhatsApp bloquear o número da loja, principalmente em número novo. O limite sobe sozinho
            com o tempo de uso — só aumente se a loja realmente precisa enviar mais mensagens por dia.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Resposta automática</p>
          </div>
          <Toggle value={autoReply} onChange={() => setAutoReply(!autoReply)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Quando um cliente manda mensagem e o bot guiado não assume a conversa, o sistema envia <strong>uma única resposta</strong> com saudação + link do cardápio e some. Nada de bate-papo — o objetivo é levar o cliente ao cardápio o mais rápido possível. Com o bot guiado ativo, é ele quem conduz o pedido no WhatsApp; esta resposta automática só aparece quando o bot não responde.
        </p>
        {autoReply && (
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">🛡️ Modo antibanimento ativo</p>
            <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-1 list-disc pl-4">
              <li><strong>1 resposta por cliente a cada 16h.</strong> Depois disso, o sistema fica em silêncio (não responde de novo).</li>
              <li><strong>Uma mensagem só</strong> quando o bot guiado não assume: saudação + link <code className="text-[10px] bg-muted px-1 py-0.5 rounded">itasuper.com.br/{storeSlug}</code> no mesmo envio. Sem "digite 1 para…".</li>
              <li><strong>Cliente digita PARAR</strong> → é adicionado à lista de opt-out e nunca mais recebe resposta automática.</li>
              <li>Fora do horário: envia 1 aviso de "fechado" com o link do cardápio e o próximo horário de abertura.</li>
            </ul>
            <p className="text-[10px] text-muted-foreground/80 leading-relaxed border-t border-emerald-500/15 pt-2">
              Por que assim? Chip pessoal do WhatsApp queima quando dispara muita mensagem. Falando pouco, seu número dura meses; falando muito, some em 2-4 semanas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}