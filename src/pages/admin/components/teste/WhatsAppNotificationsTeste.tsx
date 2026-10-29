/**
 * TELA 5 — CÓPIA DE TESTE (/admin-teste) de WhatsAppNotifications.
 * Idêntica ao original, EXCETO:
 *  a. TOGGLES COM ESTADO VISÍVEL: cada interruptor mostra "Ligado" ou
 *     "Desligado" em texto ao lado do botão — o estado não depende só da
 *     cor/posição do botão.
 *  b. SALVAR PRÓPRIO: a seção recebe onSave/saving e renderiza seu botão
 *     "Salvar notificações" no rodapé (antes, o salvar ficava no
 *     orquestrador e valia para Notificações + Mensagens juntas).
 * Nenhum destino, campo ou fluxo muda: o salvar continua sendo o upsert
 * em store_whatsapp_config do WhatsAppSetupTeste.
 */
import { Zap, MessageCircle, AlertTriangle } from "lucide-react";

interface Props {
  /** Conexão WhatsApp ativa? Quando false, as preferências exibidas estão
   *  salvas mas nada é enviado — a tela precisa dizer isso. */
  connected?: boolean;
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
  /** Salvar próprio da seção (vem do WhatsAppSetupTeste). */
  onSave: () => void;
  saving: boolean;
}

const Toggle = ({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) => (
  <button type="button" onClick={onChange} aria-pressed={value} aria-label={`${label}: ${value ? "ligado" : "desligado"}`} className="flex items-center gap-2 shrink-0">
    <div className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}>
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? "left-5" : "left-0.5"}`} />
    </div>
    <span className={`text-xs font-bold ${value ? "text-primary" : "text-muted-foreground"}`}>{value ? "Ligado" : "Desligado"}</span>
  </button>
);

export default function WhatsAppNotificationsTeste({
  connected,
  storeSlug,
  notifyAccepted, setNotifyAccepted,
  notifyReady, setNotifyReady,
  notifyOutDelivery, setNotifyOutDelivery,
  notifyDelivered, setNotifyDelivered,
  notifyCancelled, setNotifyCancelled,
  autoReply, setAutoReply,
  onSave, saving,
}: Props) {
  const items = [
    { label: "Pedido aceito / em preparo", emoji: "✅", value: notifyAccepted, set: setNotifyAccepted, desc: "Quando o lojista aceita o pedido" },
    { label: "Saiu para entrega", emoji: "🛵", value: notifyOutDelivery, set: setNotifyOutDelivery, desc: "Motoboy a caminho" },
    { label: "Cancelado", emoji: "❌", value: notifyCancelled, set: setNotifyCancelled, desc: "Aviso quando cancelar o pedido" },
  ];

  return (
    <div className="space-y-4">
      {connected === false && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex items-start gap-2" role="status">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>WhatsApp desconectado.</strong> As preferências abaixo ficam salvas, mas nenhuma mensagem é enviada enquanto a conexão estiver caída. Reconecte na aba <strong>Conexão</strong> para voltar a notificar os clientes.
          </p>
        </div>
      )}
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
              <Toggle value={item.value} onChange={() => item.set(!item.value)} label={item.label} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Resposta automática</p>
          </div>
          <Toggle value={autoReply} onChange={() => setAutoReply(!autoReply)} label="Resposta automática" />
        </div>
        <p className="text-xs text-muted-foreground">
          Quando um cliente manda mensagem, o bot envia <strong>uma única resposta</strong> com saudação + link do cardápio e some. Nada de bate-papo — o objetivo é levar o cliente ao cardápio o mais rápido possível.
        </p>
        {autoReply && (
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">🛡️ Modo antibanimento ativo</p>
            <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-1 list-disc pl-4">
              <li><strong>1 resposta por cliente a cada 24h.</strong> Depois disso, o bot fica em silêncio (não responde de novo).</li>
              <li><strong>Ignora o 1º "oi".</strong> Só responde se o cliente mandar 2 mensagens em 10 minutos — filtra engano e cliente que desistiu.</li>
              <li><strong>Uma mensagem só:</strong> saudação + link <code className="text-[10px] bg-muted px-1 py-0.5 rounded">itasuper.com.br/{storeSlug}</code> no mesmo envio. Sem "digite 1 para…".</li>
              <li><strong>Cliente digita PARAR</strong> → é adicionado à lista de opt-out e nunca mais recebe resposta automática.</li>
              <li>Fora do horário: envia 1 aviso de "fechado" com o link do cardápio e o próximo horário de abertura.</li>
            </ul>
            <p className="text-[10px] text-muted-foreground/80 leading-relaxed border-t border-emerald-500/15 pt-2">
              Por que assim? Chip pessoal do WhatsApp queima quando dispara muita mensagem. Falando pouco, seu número dura meses; falando muito, some em 2-4 semanas.
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? "Salvando..." : "Salvar notificações"}
      </button>
    </div>
  );
}