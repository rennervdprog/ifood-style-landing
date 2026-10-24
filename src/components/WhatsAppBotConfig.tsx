import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Loader2, Save } from "lucide-react";

interface Props { storeId: string; storeName: string; }

const DEFAULT_TRIGGERS = ["oi", "olá", "ola", "cardápio", "cardapio", "menu", "pedido", "quero pedir", "boa noite", "bom dia", "boa tarde"];
const DEFAULT_ESCAPE = ["atendente", "humano", "pessoa", "falar", "ajuda"];

export default function WhatsAppBotConfig({ storeId, storeName }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [triggers, setTriggers] = useState<string>(DEFAULT_TRIGGERS.join(", "));
  const [escapes, setEscapes] = useState<string>(DEFAULT_ESCAPE.join(", "));
  const [pix, setPix] = useState(true);
  const [cash, setCash] = useState(true);
  const [card, setCard] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("whatsapp_bot_config" as any)
        .select("*").eq("store_id", storeId).maybeSingle();
      if (data) {
        setEnabled(!!(data as any).enabled);
        setWelcome((data as any).welcome_message || "");
        setTriggers(((data as any).trigger_keywords || DEFAULT_TRIGGERS).join(", "));
        setEscapes(((data as any).escape_keywords || DEFAULT_ESCAPE).join(", "));
        const methods = (data as any).accepted_payment_methods || ["pix", "cash", "card"];
        setPix(methods.includes("pix"));
        setCash(methods.includes("cash"));
        setCard(methods.includes("card"));
      }
      setLoading(false);
    })();
  }, [storeId]);

  const save = async () => {
    setSaving(true);
    try {
      const methods = [pix && "pix", cash && "cash", card && "card"].filter(Boolean) as string[];
      if (enabled && methods.length === 0) {
        toast.error("Selecione ao menos uma forma de pagamento.");
        setSaving(false);
        return;
      }
      const payload = {
        store_id: storeId,
        enabled,
        welcome_message: welcome.trim() || null,
        trigger_keywords: triggers.split(",").map(s => s.trim()).filter(Boolean),
        escape_keywords: escapes.split(",").map(s => s.trim()).filter(Boolean),
        accepted_payment_methods: methods,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("whatsapp_bot_config" as any)
        .upsert(payload, { onConflict: "store_id" });
      if (error) throw error;
      toast.success(enabled ? "Bot ativado!" : "Configuração salva.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Bot de Menu Guiado</h3>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-4 w-4" />
          <span className="text-sm font-bold">{enabled ? "Ativo" : "Inativo"}</span>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Quando ativo, o bot responde automaticamente palavras-gatilho e conduz o cliente pelo menu, adicionais e pagamento — o pedido cai direto no seu painel. Se o cliente digitar uma palavra de escape, o bot para e você assume a conversa.
      </p>

      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground">Mensagem de boas-vindas</label>
        <textarea
          value={welcome} onChange={e => setWelcome(e.target.value)}
          placeholder={`Olá! 👋 Aqui é o atendimento automático da ${storeName}. Vamos fazer seu pedido?`}
          rows={3}
          className="w-full text-sm bg-muted rounded-lg px-3 py-2 border border-border"
        />
        <p className="text-[10px] text-muted-foreground">Use {"{loja}"} para inserir o nome da loja automaticamente.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground">Palavras-gatilho (separadas por vírgula)</label>
        <input
          value={triggers} onChange={e => setTriggers(e.target.value)}
          className="w-full text-sm bg-muted rounded-lg px-3 py-2 border border-border"
        />
        <p className="text-[10px] text-muted-foreground">O bot só inicia quando o cliente enviar uma dessas palavras.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground">Palavras de escape (chamam atendente)</label>
        <input
          value={escapes} onChange={e => setEscapes(e.target.value)}
          className="w-full text-sm bg-muted rounded-lg px-3 py-2 border border-border"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground">Formas de pagamento aceitas no bot</label>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={pix} onChange={e => setPix(e.target.checked)} /> Pix</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={cash} onChange={e => setCash(e.target.checked)} /> Dinheiro</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={card} onChange={e => setCard(e.target.checked)} /> Cartão na entrega</label>
        </div>
      </div>

      <button
        onClick={save} disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar configuração
      </button>
    </div>
  );
}