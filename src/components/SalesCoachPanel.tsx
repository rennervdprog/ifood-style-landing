import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Send, Loader2, Trash2, Copy, Check,
  Bot, ChevronDown, ChevronUp, Store, RefreshCw,
  Utensils, ShoppingBag, Pizza, Coffee, Pill, Bike,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface LeadProfile {
  nome: string;
  categoria: string;
  sistema: string;
  cidade: string;
  obs: string;
}

const STORAGE_KEY = "sales_coach_history_v2";
const LEAD_KEY    = "sales_coach_lead_v2";
const CHAT_URL    = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-coach`;

const SISTEMAS = [
  { value: "ifood",        label: "iFood",            desc: "Paga 20-30% por pedido" },
  { value: "rappi",        label: "Rappi",            desc: "Paga 20-30% por pedido" },
  { value: "cardapioweb",  label: "Cardápio Web",     desc: "R$210/mês, pedido vai pro WhatsApp" },
  { value: "goomer",       label: "Goomer",           desc: "R$149-299/mês, sem app próprio" },
  { value: "anota_ai",     label: "Anota AI",         desc: "Automação WhatsApp, sem motoboy" },
  { value: "whatsapp",     label: "Só WhatsApp",      desc: "Manual, sem sistema" },
  { value: "nenhum",       label: "Nenhum",           desc: "Não faz delivery ainda" },
  { value: "menudino",     label: "MenuDino",         desc: "Grátis→WhatsApp manual / Premium R$45+/mês" },
  { value: "menudino",     label: "MenuDino",         desc: "Versão grátis: pedido vai pro WhatsApp" },
  { value: "outro",        label: "Outro",            desc: "" },
];

const CATEGORIAS = [
  { value: "restaurante",  label: "Restaurante",   icon: Utensils },
  { value: "lanches",      label: "Hamburguer/Lanches", icon: ShoppingBag },
  { value: "pizzas",       label: "Pizzaria",      icon: Pizza },
  { value: "cafeteria",    label: "Cafeteria/Açaí", icon: Coffee },
  { value: "farmacias",    label: "Farmácia",      icon: Pill },
  { value: "outro",        label: "Outro",         icon: Store },
];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          toast.success("Copiado!");
        } catch {
          toast.error("Não consegui copiar");
        }
      }}
      className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground opacity-70 hover:opacity-100 transition-opacity"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar resposta"}
    </button>
  );
}

const EMPTY_LEAD: LeadProfile = { nome: "", categoria: "restaurante", sistema: "ifood", cidade: "", obs: "" };

const SalesCoachPanel = () => {
  const [messages, setMessages] = useState<Msg[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Msg[]; } catch { return []; }
  });
  const [lead, setLead] = useState<LeadProfile>(() => {
    try { return JSON.parse(localStorage.getItem(LEAD_KEY) || "null") || EMPTY_LEAD; } catch { return EMPTY_LEAD; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(!lead.nome);
  const [leadSaved, setLeadSaved] = useState(!!lead.nome);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch {}
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(lead)); } catch {}
  }, [lead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sistemaInfo = SISTEMAS.find(s => s.value === lead.sistema);
  const catInfo     = CATEGORIAS.find(c => c.value === lead.categoria);

  // Monta o contexto do lead como primeiro sistema message
  const buildLeadContext = () => {
    if (!lead.nome) return "";
    const parts = [
      `LEAD: ${lead.nome}`,
      lead.cidade && `Cidade: ${lead.cidade}`,
      `Categoria: ${catInfo?.label || lead.categoria}`,
      `Sistema atual: ${sistemaInfo?.label || lead.sistema}${sistemaInfo?.desc ? ` (${sistemaInfo.desc})` : ""}`,
      lead.obs && `Observações: ${lead.obs}`,
    ].filter(Boolean);
    return `[Contexto do lead]\n${parts.join(" | ")}`;
  };

  const saveLead = () => {
    if (!lead.nome.trim()) { toast.error("Coloque o nome da loja."); return; }
    setLeadSaved(true);
    setShowLeadForm(false);
    // Se não tem histórico ainda, manda o contexto inicial automaticamente
    if (messages.length === 0) {
      send(`${buildLeadContext()}\n\nMe dê o melhor script de abertura para abordar esse lead pelo WhatsApp agora.`);
    } else {
      toast.success(`Lead ${lead.nome} salvo! O coach já tem o contexto.`);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      // Incluir contexto do lead em todas as mensagens se disponível
      const contextPrefix = leadSaved && messages.length === 0 ? [] : [];
      const payload = next.slice(-20);

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: payload, lead_context: leadSaved ? buildLeadContext() : undefined }),
        signal: controller.signal,
      });

      if (resp.status === 429) { toast.error("Muitas requisições. Aguarde."); setLoading(false); return; }
      if (!resp.ok || !resp.body) { toast.error("Erro ao falar com o coach."); setLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: rDone, value } = await reader.read();
        if (rDone) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim()) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsertAssistant(c);
          } catch { buffer = line + buffer; break; }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Erro inesperado.");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const clear = () => {
    if (loading) abortRef.current?.abort();
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    toast.success("Conversa limpa");
  };

  const resetLead = () => {
    setLead(EMPTY_LEAD);
    setLeadSaved(false);
    setShowLeadForm(true);
    clear();
  };

  const CatIcon = catInfo?.icon || Store;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">

      {/* ── FORMULÁRIO DE CONTEXTO DO LEAD ── */}
      <div className="border border-border rounded-2xl overflow-hidden mb-3">
        <button
          onClick={() => setShowLeadForm(!showLeadForm)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${leadSaved ? "bg-primary/10" : "bg-amber-500/10"}`}>
              {leadSaved ? <CatIcon className="h-4 w-4 text-primary" /> : <Store className="h-4 w-4 text-amber-500" />}
            </div>
            <div className="text-left">
              {leadSaved ? (
                <>
                  <p className="text-sm font-black text-foreground leading-tight">{lead.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {catInfo?.label} · {sistemaInfo?.label}{lead.cidade && ` · ${lead.cidade}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Configure o lead antes de começar</p>
                  <p className="text-[11px] text-muted-foreground">Nome da loja, sistema atual, categoria</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {leadSaved && (
              <button
                onClick={e => { e.stopPropagation(); resetLead(); }}
                className="text-[11px] text-muted-foreground hover:text-destructive font-bold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Novo lead
              </button>
            )}
            {showLeadForm ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {showLeadForm && (
          <div className="p-4 border-t border-border space-y-4 bg-card/50">
            {/* Nome e cidade */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1.5">Nome da loja *</label>
                <input value={lead.nome} onChange={e => setLead(l => ({ ...l, nome: e.target.value }))}
                  placeholder="Ex: Hamburgueria do Zé"
                  className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1.5">Cidade</label>
                <input value={lead.cidade} onChange={e => setLead(l => ({ ...l, cidade: e.target.value }))}
                  placeholder="Ex: Araruama RJ"
                  className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-2">Tipo de loja</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS.map(c => {
                  const Icon = c.icon;
                  const sel = lead.categoria === c.value;
                  return (
                    <button key={c.value} onClick={() => setLead(l => ({ ...l, categoria: c.value }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        sel ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground"
                      }`}>
                      <Icon className="h-3.5 w-3.5" /> {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sistema atual */}
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-2">Sistema que usa hoje</label>
              <div className="grid grid-cols-2 gap-2">
                {SISTEMAS.map(s => {
                  const sel = lead.sistema === s.value;
                  return (
                    <button key={s.value} onClick={() => setLead(l => ({ ...l, sistema: s.value }))}
                      className={`text-left px-3 py-2 rounded-xl border transition-all ${
                        sel ? "bg-primary/10 border-primary/30" : "bg-muted/40 border-border/60 hover:bg-muted/60"
                      }`}>
                      <p className={`text-xs font-bold ${sel ? "text-primary" : "text-foreground"}`}>{s.label}</p>
                      {s.desc && <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1.5">Observações extras (opcional)</label>
              <textarea value={lead.obs} onChange={e => setLead(l => ({ ...l, obs: e.target.value }))}
                placeholder="Ex: Já demonstrou interesse, perguntou sobre motoboy, tem 2 lojas..."
                rows={2}
                className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            <button onClick={saveLead}
              className="w-full h-11 bg-primary text-primary-foreground font-black rounded-xl text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" />
              {messages.length === 0 ? "Gerar script de abertura" : "Salvar e continuar conversa"}
            </button>
          </div>
        )}
      </div>

      {/* ── CHAT ── */}
      <div className="flex flex-col flex-1 bg-card rounded-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <p className="text-sm font-black text-foreground">Coach de Vendas ItaSuper</p>
          </div>
          {messages.length > 0 && (
            <button onClick={clear}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </button>
          )}
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="max-w-sm space-y-2">
                <p className="font-black text-foreground text-base">
                  {leadSaved ? `Pronto pra captar ${lead.nome}` : "Configure o lead acima"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {leadSaved
                    ? "Cole a resposta do lojista e eu monto a próxima mensagem para você."
                    : "Preencha nome da loja e sistema que usa para eu montar a abordagem ideal."}
                </p>
              </div>
              {leadSaved && (
                <div className="w-full max-w-sm space-y-2">
                  {[
                    "Me dá a mensagem de abertura ideal para esse lead",
                    `Como quebrar a objeção "já uso ${sistemaInfo?.label || "outro sistema"} e funciona"?`,
                    "Ele não respondeu há 2 dias. Me dá um follow-up irresistível.",
                    "Ele disse que vai pensar. Como fechar?",
                  ].map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="w-full text-left text-sm px-3.5 py-2.5 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-primary/30 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
              }`}>
                {m.role === "user" ? "EU" : <Bot className="h-4 w-4" />}
              </div>
              <div className={`flex-1 min-w-0 max-w-[88%] flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted/60 text-foreground rounded-tl-sm"
                }`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-foreground dark:prose-invert">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
                {m.role === "assistant" && m.content && <CopyBtn text={m.content} />}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Analisando...</span>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3 bg-muted/10 shrink-0">
          <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
              rows={2}
              placeholder={leadSaved ? `Cole o que ${lead.nome || "o lojista"} respondeu...` : "Configure o lead acima primeiro..."}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-40"
              disabled={loading || !leadSaved}
            />
            <button type="submit" disabled={loading || !input.trim() || !leadSaved}
              className="bg-primary text-primary-foreground rounded-xl p-3 disabled:opacity-40 active:scale-95 transition-transform shrink-0">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
          <p className="text-[10px] text-muted-foreground/60 mt-1 px-1">
            Enter envia · Shift+Enter quebra linha · Contexto salvo no navegador
          </p>
        </div>
      </div>
    </div>
  );
};

export default SalesCoachPanel;
