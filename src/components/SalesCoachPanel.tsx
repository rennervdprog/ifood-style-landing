import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, Trash2, Copy, Check, User2, Bot } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "sales_coach_history_v1";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-coach`;

const STARTERS = [
  "Como abordar um lojista que ainda só usa iFood?",
  "Me dá 3 mensagens de WhatsApp pra primeiro contato.",
  "Vou colar a conversa, me ajude a responder.",
  "Como quebrar a objeção de preço?",
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
      className="opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-bold text-muted-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

const SalesCoachPanel = () => {
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

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
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next.slice(-20) }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        toast.error("Muitas requisições. Aguarde uns segundos.");
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("Créditos de IA esgotados. Adicione créditos no workspace.");
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        toast.error("Erro ao falar com o coach. Tente de novo.");
        setLoading(false);
        return;
      }

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
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsertAssistant(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("[SalesCoach] error:", e);
        toast.error("Erro inesperado. Tente de novo.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const clear = () => {
    if (loading) abortRef.current?.abort();
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    toast.success("Conversa limpa");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px] bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-black text-base text-foreground leading-tight">Coach de Vendas</h2>
            <p className="text-[11px] text-muted-foreground truncate">
              Cole a conversa com o lojista — eu te dou a próxima resposta.
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors px-2.5 py-1.5 rounded-lg hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="max-w-md space-y-1">
              <p className="font-black text-foreground">Pronto pra captar lojista?</p>
              <p className="text-sm text-muted-foreground">
                Me cole a conversa do WhatsApp (o que você mandou + o que o lojista respondeu) e eu monto a próxima resposta.
              </p>
            </div>
            <div className="grid gap-2 w-full max-w-md mt-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm px-3.5 py-2.5 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-primary/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                {m.role === "user" ? <User2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`flex-1 min-w-0 max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/60 text-foreground rounded-tl-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-li:my-0 prose-strong:text-foreground dark:prose-invert">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
                {m.role === "assistant" && m.content && <CopyBtn text={m.content} />}
              </div>
            </div>
          ))
        )}
        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3 bg-muted/20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder="Cole a conversa ou descreva a situação…"
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 max-h-40"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-primary text-primary-foreground rounded-xl p-3 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform flex-shrink-0"
            aria-label="Enviar"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground/70 mt-1.5 px-1">
          Enter envia • Shift+Enter quebra linha • Histórico salvo localmente
        </p>
      </div>
    </div>
  );
};

export default SalesCoachPanel;