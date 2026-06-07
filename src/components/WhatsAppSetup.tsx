/**
 * WhatsAppSetup — configuração do WhatsApp via Evolution API
 * Substitui o ZapiConfig anterior
 * Guia passo a passo para o lojista conectar o número
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Smartphone, CheckCircle2, XCircle, Loader2, RefreshCw,
  MessageCircle, QrCode, Info, ChevronDown, ChevronUp, Zap, Edit3, RotateCcw
} from "lucide-react";

interface Props {
  storeId: string;
  storeSlug: string;
  storeName: string;
  expectedPhone?: string | null;
}

// A URL real do Evolution fica no secret EVOLUTION_API_URL (server-side).
// Aqui guardamos apenas um marcador, sobrescrito pelo backend quando o QR é gerado.
const EVOLUTION_URL = "";

// Templates padrão por status (mesmas mensagens do orderNotifications.ts).
// Placeholders disponíveis: {storeName} {clientName} {orderId} {total} {pin} {address} {items}
const DEFAULT_TEMPLATES: Record<string, { label: string; emoji: string; template: string }> = {
  preparando: {
    label: "Pedido aceito / em preparo",
    emoji: "✅",
    template:
      "✅ *{storeName}* informa: Seu pedido foi aceito! 🍔\n\n{items}\n\n💰 Total: {total}\nPedido: #{orderId}\n🔑 *PIN de Segurança: {pin}*",
  },
  pronto_para_entrega: {
    label: "Pedido pronto para entrega",
    emoji: "📦",
    template:
      "📦 Olá {clientName}! Seu pedido da *{storeName}* está *PRONTO*! 🎉\n\nJá está em rota de entrega!\n\n🔑 *CÓDIGO DE ENTREGA: {pin}*\nInforme ao motoboy somente na entrega.",
  },
  saiu_entrega: {
    label: "Saiu para entrega",
    emoji: "🛵",
    template:
      "🛵 *{storeName}* informa: Seu pedido #{orderId} saiu para entrega! 🚀\nEndereço: {address}\n\n🔑 *PIN: {pin}*",
  },
  entregue: {
    label: "Pedido entregue",
    emoji: "🍽️",
    template:
      "✅ *{storeName}* informa: Seu pedido #{orderId} foi entregue! Bom apetite! 🍽️",
  },
  cancelado: {
    label: "Pedido cancelado",
    emoji: "❌",
    template:
      "❌ *{storeName}* informa: Seu pedido #{orderId} foi cancelado.\n\nDesculpe o transtorno! 🙏",
  },
};

const onlyDigits = (value?: string | null) => String(value || "").replace(/\D/g, "");
const samePhone = (a?: string | null, b?: string | null) => {
  const left = onlyDigits(a).replace(/^55/, "");
  const right = onlyDigits(b).replace(/^55/, "");
  return !!left && !!right && left === right;
};

export default function WhatsAppSetup({ storeId, storeSlug, storeName, expectedPhone }: Props) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Record<string, string>>({});

  // Toggles de notificação
  const [notifyAccepted, setNotifyAccepted] = useState(true);
  const [notifyReady, setNotifyReady] = useState(true);
  const [notifyOutDelivery, setNotifyOutDelivery] = useState(true);
  const [notifyDelivered, setNotifyDelivered] = useState(true);
  const [notifyCancelled, setNotifyCancelled] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [autoReplyMsg, setAutoReplyMsg] = useState("Olá! 😊 Acesse nosso cardápio e faça seu pedido:");

  useEffect(() => {
    loadConfig();
  }, [storeId]);

  const loadConfig = async () => {
    setLoading(true);
    const { data: raw } = await (supabase as any)
      .from("store_whatsapp_config" as any)
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();
    const data: any = raw;

    if (data) {
      setConfig(data);
      setNotifyAccepted(data.notify_order_accepted ?? true);
      setNotifyReady(data.notify_order_ready ?? true);
      setNotifyOutDelivery(data.notify_order_out_delivery ?? true);
      setNotifyDelivered(data.notify_order_delivered ?? true);
      setNotifyCancelled(data.notify_order_cancelled ?? true);
      setAutoReply(data.auto_reply_enabled ?? true);
      setAutoReplyMsg(data.auto_reply_message ?? "Olá! 😊 Acesse nosso cardápio e faça seu pedido:");
      setTemplates((data.message_templates as Record<string, string>) || {});
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    const payload = {
      store_id: storeId,
      evolution_api_url: config?.evolution_api_url ?? EVOLUTION_URL,
      evolution_instance_name: config?.evolution_instance_name ?? `store-${storeId.slice(0, 8)}`,
      notify_order_accepted: notifyAccepted,
      notify_order_ready: notifyReady,
      notify_order_out_delivery: notifyOutDelivery,
      notify_order_delivered: notifyDelivered,
      notify_order_cancelled: notifyCancelled,
      auto_reply_enabled: autoReply,
      auto_reply_message: autoReplyMsg,
      message_templates: templates,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (supabase as any)
      .from("store_whatsapp_config")
      .upsert(payload, { onConflict: "store_id" });

    if (error) {
      toast.error("Erro ao salvar configuração.");
    } else {
      toast.success("Configurações salvas!");
      loadConfig();
    }
    setSaving(false);
  };

  const getQrCode = async (forceReconnect = false) => {
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-qr-code", {
        body: { store_id: storeId, force_reconnect: forceReconnect },
      });
      if (error) throw error;
      if (data?.qr_code) {
        await (supabase as any)
          .from("store_whatsapp_config")
          .update({ qr_code: data.qr_code, status: "connecting" })
          .eq("store_id", storeId);
        loadConfig();
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      }
    } catch (e: any) {
      toast.error("Erro ao gerar QR Code. Verifique a configuração do servidor.");
    }
    setQrLoading(false);
  };

  const isConnected = config?.status === "connected";
  const isConnecting = config?.status === "connecting";
  const connectedPhone = onlyDigits(config?.phone_number);
  const expectedStorePhone = onlyDigits(expectedPhone);
  const phoneMismatch = isConnected && connectedPhone && expectedStorePhone && !samePhone(connectedPhone, expectedStorePhone);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Status da conexão */}
      <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${
        isConnected
          ? "bg-emerald-500/8 border-emerald-500/20"
          : isConnecting
          ? "bg-amber-500/8 border-amber-500/20"
          : "bg-muted/40 border-border"
      }`}>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          isConnected ? "bg-emerald-500" : isConnecting ? "bg-amber-500 animate-pulse" : "bg-muted-foreground"
        }`} />
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">
            {isConnected ? "WhatsApp conectado ✅" : isConnecting ? "Aguardando escaneamento..." : "WhatsApp não conectado"}
          </p>
          {isConnected && config?.phone_number && (
            <p className="text-xs text-muted-foreground">Teste enviando mensagem para +{config.phone_number}</p>
          )}
          {phoneMismatch && (
            <p className="text-[11px] font-semibold text-destructive mt-1">
              Atenção: este WhatsApp conectado não é o número cadastrado da loja (+{expectedStorePhone}).
            </p>
          )}
          {!isConnected && !isConnecting && (
            <p className="text-xs text-muted-foreground">Conecte seu WhatsApp para enviar notificações automáticas</p>
          )}
        </div>
        {isConnected && (
          <MessageCircle className="h-4 w-4 text-emerald-500 shrink-0" />
        )}
      </div>

      {phoneMismatch && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3">
          <p className="text-xs font-bold text-destructive">Número conectado diferente</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            As respostas automáticas só funcionam para mensagens enviadas ao número realmente conectado aqui: +{connectedPhone}.
            Para usar +{expectedStorePhone}, desconecte e escaneie o QR Code com esse WhatsApp.
          </p>
          <button
            type="button"
            onClick={() => getQrCode(true)}
            disabled={qrLoading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
          >
            {qrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
            Conectar número correto
          </button>
        </div>
      )}

      {isConnected && !phoneMismatch && (
        <button
          type="button"
          onClick={() => getQrCode(true)}
          disabled={qrLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground disabled:opacity-60"
        >
          {qrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
          Reconectar outro número
        </button>
      )}

      {/* Guia passo a passo */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center gap-2.5 px-4 py-3 bg-blue-500/5 text-left hover:bg-blue-500/8 transition-colors"
        >
          <Info className="h-4 w-4 text-blue-500 shrink-0" />
          <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex-1">Como conectar o WhatsApp</p>
          {showGuide ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showGuide && (
          <div className="px-4 py-3 space-y-3 bg-card/50">
            {[
              {
                step: "1",
                title: "Clique em \"Gerar QR Code\"",
                desc: "Um QR Code vai aparecer na tela abaixo.",
                icon: "📱",
              },
              {
                step: "2",
                title: "Abra o WhatsApp no seu celular",
                desc: "Toque nos 3 pontinhos no canto superior direito.",
                icon: "💬",
              },
              {
                step: "3",
                title: "Toque em \"Dispositivos conectados\"",
                desc: "Depois em \"Conectar um dispositivo\".",
                icon: "🔗",
              },
              {
                step: "4",
                title: "Aponte a câmera pro QR Code",
                desc: "O WhatsApp vai conectar automaticamente em segundos.",
                icon: "📷",
              },
              {
                step: "5",
                title: "Pronto!",
                desc: "Seus clientes vão receber notificações automáticas pelo WhatsApp.",
                icon: "✅",
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <span className="text-lg shrink-0">{item.icon}</span>
                <div>
                  <p className="text-xs font-bold text-foreground">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                ⚠️ Use um número de WhatsApp exclusivo para a loja. Não use seu número pessoal principal — o WhatsApp ficará conectado neste painel.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* QR Code */}
      {!isConnected && (
        <div className="space-y-3">
          <button
            onClick={() => getQrCode(false)}
            disabled={qrLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {qrLoading ? "Gerando QR Code..." : isConnecting ? "Recarregar QR Code" : "Gerar QR Code para conectar"}
          </button>

          {config?.qr_code && isConnecting && (
            <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-border">
              <p className="text-xs font-bold text-foreground">Escaneie com seu WhatsApp</p>
              <img
                src={config.qr_code.startsWith("data:") ? config.qr_code : `data:image/png;base64,${config.qr_code}`}
                alt="QR Code WhatsApp"
                className="w-48 h-48 object-contain"
              />
              <p className="text-[10px] text-muted-foreground text-center">
                O QR Code expira em 60 segundos. Se expirar, clique em "Recarregar".
              </p>
              <button onClick={loadConfig} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <RefreshCw className="h-3 w-3" /> Verificar conexão
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notificações automáticas */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-foreground">Notificações automáticas</p>
        </div>
        <p className="text-xs text-muted-foreground">Quais mensagens enviar automaticamente para o cliente:</p>

        {[
          { label: "✅ Pedido aceito / em preparo", value: notifyAccepted, set: setNotifyAccepted },
          { label: "📦 Pedido pronto para entrega", value: notifyReady, set: setNotifyReady },
          { label: "🛵 Pedido saiu para entrega", value: notifyOutDelivery, set: setNotifyOutDelivery },
          { label: "🍽️ Pedido entregue", value: notifyDelivered, set: setNotifyDelivered },
          { label: "❌ Pedido cancelado", value: notifyCancelled, set: setNotifyCancelled },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => item.set(!item.value)}
            className="w-full flex items-center justify-between py-1.5"
          >
            <span className="text-xs text-foreground">{item.label}</span>
            <div className={`relative w-10 h-5 rounded-full transition-colors ${item.value ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${item.value ? "left-5" : "left-0.5"}`} />
            </div>
          </button>
        ))}
      </div>

      {/* Auto-resposta */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Resposta automática</p>
          </div>
          <button type="button" onClick={() => setAutoReply(!autoReply)}>
            <div className={`relative w-10 h-5 rounded-full transition-colors ${autoReply ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${autoReply ? "left-5" : "left-0.5"}`} />
            </div>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Quando um cliente mandar mensagem no seu WhatsApp, responde automaticamente com uma saudação humanizada.
        </p>
        {autoReply && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 space-y-1">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
              🛡️ Modo anti-bloqueio ativo
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Para evitar banimento do WhatsApp, o sistema agora usa <strong>5 saudações rotativas</strong> automáticas
              (variando por horário: bom dia/tarde/noite) e <strong>só envia o link do cardápio</strong> ({`itasuper.com.br/${storeSlug}`})
              quando o cliente confirma interesse (ex: "sim", "quero", "cardápio"). Isso reduz o risco de spam e mantém o número seguro.
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Janela de resposta: segue o horário de funcionamento cadastrado da loja. Clientes que respondem "PARAR" entram em lista de exclusão.
            </p>
          </div>
        )}
      </div>

      {/* Botão salvar */}
      {/* Personalização de mensagens */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="w-full flex items-center gap-2.5 px-4 py-3 bg-primary/5 text-left hover:bg-primary/8 transition-colors"
        >
          <Edit3 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Personalizar mensagens</p>
            <p className="text-[11px] text-muted-foreground">Edite os textos enviados em cada status do pedido</p>
          </div>
          {showTemplates ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showTemplates && (
          <div className="px-4 py-3 space-y-4 bg-card/50">
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg px-3 py-2">
              <p className="text-[11px] text-blue-700 dark:text-blue-400 font-bold mb-1">📌 Variáveis disponíveis</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <code>{"{storeName}"}</code> nome da loja · <code>{"{clientName}"}</code> nome do cliente · <code>{"{orderId}"}</code> número do pedido · <code>{"{total}"}</code> valor · <code>{"{pin}"}</code> PIN de entrega · <code>{"{address}"}</code> endereço · <code>{"{items}"}</code> itens
              </p>
            </div>

            {Object.entries(DEFAULT_TEMPLATES).map(([statusKey, info]) => {
              const value = templates[statusKey] ?? info.template;
              const isCustom = templates[statusKey] !== undefined && templates[statusKey] !== info.template;
              return (
                <div key={statusKey} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>{info.emoji}</span> {info.label}
                      {isCustom && <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">EDITADO</span>}
                    </label>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...templates };
                          delete next[statusKey];
                          setTemplates(next);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" /> Restaurar padrão
                      </button>
                    )}
                  </div>
                  <textarea
                    value={value}
                    onChange={(e) => setTemplates({ ...templates, [statusKey]: e.target.value })}
                    rows={4}
                    className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              );
            })}

            <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                💡 Use *texto* para <strong>negrito</strong> no WhatsApp. Quebras de linha funcionam normalmente.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Botão salvar */}
      <button
        onClick={saveConfig}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>
    </div>
  );
}
