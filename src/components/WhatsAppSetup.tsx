/**
 * WhatsAppSetup — orquestrador com abas Conexão / Notificações / Mensagens.
 * Carrega a config uma vez e distribui para os filhos.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Link2, Bell, MessageSquareText } from "lucide-react";
import WhatsAppConnection from "./whatsapp/WhatsAppConnection";
import WhatsAppNotifications from "./whatsapp/WhatsAppNotifications";
import WhatsAppTemplates from "./whatsapp/WhatsAppTemplates";

interface Props {
  storeId: string;
  storeSlug: string;
  storeName: string;
  expectedPhone?: string | null;
}

const EVOLUTION_URL = "";

type TabKey = "connection" | "notifications" | "templates";

export default function WhatsAppSetup({ storeId, storeSlug, storeName, expectedPhone }: Props) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("connection");
  const [templates, setTemplates] = useState<Record<string, string>>({});

  const [notifyAccepted, setNotifyAccepted] = useState(true);
  const [notifyReady, setNotifyReady] = useState(true);
  const [notifyOutDelivery, setNotifyOutDelivery] = useState(true);
  const [notifyDelivered, setNotifyDelivered] = useState(true);
  const [notifyCancelled, setNotifyCancelled] = useState(true);
  const [autoReply, setAutoReply] = useState(true);

  const loadConfig = useCallback(async () => {
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
      setTemplates((data.message_templates as Record<string, string>) || {});
    }
  }, [storeId]);

  useEffect(() => {
    setLoading(true);
    loadConfig().finally(() => setLoading(false));
    // Auto-sincroniza status real com Evolution ao abrir a aba
    (async () => {
      try {
        await supabase.functions.invoke("store-whatsapp-sync-status", { body: { store_id: storeId } });
        await loadConfig();
      } catch (e) {
        console.warn("[WhatsAppSetup] sync-status falhou", e);
      }
    })();
  }, [loadConfig]);

  // Realtime — reflete conexão/desconexão em tempo real
  useEffect(() => {
    const doSync = async () => {
      try {
        await supabase.functions.invoke("store-whatsapp-sync-status", { body: { store_id: storeId } });
      } catch { /* ignore */ }
      await loadConfig();
    };
    const channel = supabase
      .channel(`store-wa-cfg-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_whatsapp_config", filter: `store_id=eq.${storeId}` },
        () => { loadConfig(); },
      )
      .subscribe((status) => {
        // Ao (re)conectar o socket, força um refresh para pegar mudanças perdidas offline.
        if (status === "SUBSCRIBED") loadConfig();
      });
    // Ao voltar pra aba, ressincroniza com Evolution + reload.
    const onVisible = () => {
      if (document.visibilityState === "visible") doSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [storeId, loadConfig]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: typeof Link2 }[] = [
    { key: "connection", label: "Conexão", icon: Link2 },
    { key: "notifications", label: "Notificações", icon: Bell },
    { key: "templates", label: "Mensagens", icon: MessageSquareText },
  ];

  return (
    <div className="space-y-4">
      {/* Abas internas */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl border border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "connection" && (
        <WhatsAppConnection
          storeId={storeId}
          storeName={storeName}
          expectedPhone={expectedPhone}
          config={config}
          reload={loadConfig}
        />
      )}

      {tab === "notifications" && (
        <WhatsAppNotifications
          storeSlug={storeSlug}
          notifyAccepted={notifyAccepted} setNotifyAccepted={setNotifyAccepted}
          notifyReady={notifyReady} setNotifyReady={setNotifyReady}
          notifyOutDelivery={notifyOutDelivery} setNotifyOutDelivery={setNotifyOutDelivery}
          notifyDelivered={notifyDelivered} setNotifyDelivered={setNotifyDelivered}
          notifyCancelled={notifyCancelled} setNotifyCancelled={setNotifyCancelled}
          autoReply={autoReply} setAutoReply={setAutoReply}
        />
      )}

      {tab === "templates" && (
        <WhatsAppTemplates
          storeName={storeName}
          templates={templates}
          setTemplates={setTemplates}
        />
      )}

      {/* Botão salvar — sticky no rodapé visual */}
      {tab !== "connection" && (
        <button
          onClick={saveConfig}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 sticky bottom-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      )}
    </div>
  );
}
