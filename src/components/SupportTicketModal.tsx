import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeWithRejoin, cleanupChannel } from "@/lib/realtimeChannel";
import {
  X, Plus, Send, Loader2, MessageCircle, ChevronRight,
  CheckCircle2, Package, CreditCard, Truck, Settings,
  ChevronLeft, AlertTriangle, HelpCircle, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "pedido",     label: "Pedido",      icon: Package,       color: "text-orange-500",  bg: "bg-orange-500/10 border-orange-500/20" },
  { value: "pagamento",  label: "Pagamento",   icon: CreditCard,    color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/20" },
  { value: "entrega",    label: "Entrega",     icon: Truck,         color: "text-purple-500",  bg: "bg-purple-500/10 border-purple-500/20" },
  { value: "conta",      label: "Minha conta", icon: Settings,      color: "text-slate-500",   bg: "bg-slate-500/10 border-slate-500/20" },
  { value: "tecnico",    label: "Técnico",     icon: AlertTriangle, color: "text-red-500",     bg: "bg-red-500/10 border-red-500/20" },
  { value: "financeiro", label: "Financeiro",  icon: CreditCard,    color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { value: "outro",      label: "Outro",       icon: HelpCircle,    color: "text-muted-foreground", bg: "bg-muted/40 border-border" },
] as const;

const STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  aberto:             { label: "Aberto",           color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-500/10",      dot: "bg-blue-500" },
  em_atendimento:     { label: "Em atendimento",   color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-500/10",    dot: "bg-amber-500 animate-pulse" },
  aguardando_cliente: { label: "Aguardando você",  color: "text-purple-600",  bg: "bg-purple-50 dark:bg-purple-500/10",  dot: "bg-purple-500 animate-pulse" },
  resolvido:          { label: "Resolvido",        color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10",dot: "bg-emerald-500" },
  fechado:            { label: "Fechado",          color: "text-muted-foreground", bg: "bg-muted/30",                    dot: "bg-muted-foreground" },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const fmtRelative = (iso: string) => {
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 1) return "agora";
  if (m < 60) return `${Math.floor(m)}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  userRole: "cliente" | "lojista" | "motoboy";
  storeId?: string;
  storeName?: string;
}

export const SupportTicketModal = ({ open, onClose, userRole, storeId }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<"list" | "new" | "chat">("list");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ category: "outro", subject: "", message: "" });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets" as any)
        .select("id,ticket_number,subject,status,category,created_at,updated_at,first_message")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
    enabled: !!user && open,
    refetchInterval: open ? 30000 : false,
  });

  const { data: messages = [], refetch: refetchMsgs } = useQuery({
    queryKey: ["ticket-msgs", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_messages" as any)
        .select("id,content,is_agent,created_at")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!ticketId && view === "chat",
  });

  const selected = tickets.find(t => t.id === ticketId);
  const pendingReply = tickets.filter(t => t.status === "aguardando_cliente").length;

  useEffect(() => {
    if (!ticketId || view !== "chat") return;
    const ch = supabase.channel(`tm-${ticketId}`)
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `ticket_id=eq.${ticketId}`,
      }, () => { refetchMsgs(); queryClient.invalidateQueries({ queryKey: ["my-tickets"] }); });
    subscribeWithRejoin(ch);
    return () => cleanupChannel(ch);
  }, [ticketId, view, refetchMsgs, queryClient]);

  useEffect(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages]);

  useEffect(() => {
    if (!open) { setView("list"); setTicketId(null); }
  }, [open]);

  const openTicket = (id: string) => { setTicketId(id); setView("chat"); };
  const goList = () => { setView("list"); setTicketId(null); };

  const createTicket = async () => {
    if (!form.subject.trim() || !form.message.trim()) { toast.error("Preencha assunto e mensagem."); return; }
    setSending(true);
    try {
      const { data: t, error } = await supabase
        .from("support_tickets" as any)
        .insert({ user_id: user!.id, user_role: userRole, store_id: storeId || null,
          category: form.category, subject: form.subject.trim(),
          first_message: form.message.trim().slice(0, 200), status: "aberto", priority: "normal" })
        .select("id").single();
      if (error) throw error;
      await supabase.from("support_messages" as any).insert({
        ticket_id: (t as any).id, sender_id: user!.id, is_agent: false, is_internal: false,
        content: form.message.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      setForm({ category: "outro", subject: "", message: "" });
      setTicketId((t as any).id);
      setView("chat");
      toast.success("Chamado aberto! Responderemos em breve.");
    } catch (e: any) { toast.error(e.message || "Erro ao abrir chamado"); }
    finally { setSending(false); }
  };

  const sendMsg = async () => {
    if (!msg.trim() || !ticketId) return;
    setSending(true);
    try {
      await supabase.from("support_messages" as any).insert({
        ticket_id: ticketId, sender_id: user!.id, is_agent: false, is_internal: false, content: msg.trim(),
      });
      setMsg(""); refetchMsgs();
    } catch { toast.error("Erro ao enviar"); }
    finally { setSending(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-md h-[100dvh] sm:h-[85vh] sm:max-h-[720px] bg-background rounded-t-[28px] sm:rounded-[24px] flex flex-col overflow-hidden shadow-2xl border border-border/50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >

        {/* ── HEADER ── */}
        <div className="shrink-0 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}>
          {/* drag handle mobile */}
          <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {view !== "list" && (
              <button onClick={view === "new" ? goList : goList}
                className="w-9 h-9 rounded-2xl bg-muted/60 flex items-center justify-center active:scale-90 transition-transform shrink-0">
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {view === "list" && (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-foreground truncate">Suporte</h2>
                    {pendingReply > 0 && (
                      <span className="text-[10px] sm:text-[11px] font-black bg-purple-500 text-white px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                        {pendingReply} nova{pendingReply > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Como podemos ajudar?</p>
                </>
              )}
              {view === "new" && (
                <>
                  <h2 className="text-base font-black text-foreground truncate">Novo chamado</h2>
                  <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Descreva o problema</p>
                </>
              )}
              {view === "chat" && selected && (
                <>
                  <h2 className="text-sm font-black text-foreground truncate">{selected.subject}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS[selected.status]?.dot}`} />
                    <span className={`text-[11px] font-bold truncate ${STATUS[selected.status]?.color}`}>
                      {STATUS[selected.status]?.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">· #{String(selected.ticket_number).padStart(4, "0")}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {view === "list" && (
                <button onClick={() => setView("new")}
                  className="flex items-center gap-1 sm:gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-2.5 sm:px-3.5 py-2 rounded-2xl active:scale-95 transition-transform">
                  <Plus className="h-3.5 w-3.5" /> <span className="hidden xs:inline">Novo</span><span className="xs:hidden sr-only">Novo</span><span aria-hidden className="xs:hidden">Novo</span>
                </button>
              )}
              <button onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-muted/60 flex items-center justify-center active:scale-90 transition-transform">
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* ── LISTA ── */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}

            {!isLoading && tickets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center">
                  <MessageCircle className="h-9 w-9 text-primary" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground text-base">Nenhum chamado</p>
                  <p className="text-sm text-muted-foreground mt-1">Precisa de ajuda? Estamos aqui.</p>
                </div>
                <button onClick={() => setView("new")}
                  className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl text-sm active:scale-95 transition-transform">
                  Abrir chamado
                </button>
              </div>
            )}

            {tickets.length > 0 && (
              <div className="space-y-2">
                {tickets.map(t => {
                  const st = STATUS[t.status] || STATUS.aberto;
                  const cat = CATEGORIES.find(c => c.value === t.category);
                  const isPending = t.status === "aguardando_cliente";
                  return (
                    <button key={t.id} onClick={() => openTicket(t.id)}
                      className={`w-full text-left rounded-2xl border transition-all active:scale-[0.98] ${
                        isPending
                          ? "bg-purple-50 dark:bg-purple-500/5 border-purple-200 dark:border-purple-500/20"
                          : "bg-card border-border/60 hover:border-primary/30 hover:bg-muted/20"
                      }`}>
                      <div className="p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cat?.bg}`}>
                          {cat && <cat.icon className={`h-4 w-4 ${cat.color}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <p className="text-sm font-bold text-foreground leading-snug truncate">{t.subject}</p>
                            <span className="text-[11px] text-muted-foreground shrink-0">{fmtRelative(t.updated_at)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate leading-relaxed">{t.first_message}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                              {st.label}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── NOVO TICKET ── */}
        {view === "new" && (
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
            {/* Categoria */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-3">Qual o assunto?</p>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                {CATEGORIES.map(c => {
                  const sel = form.category === c.value;
                  return (
                    <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                      className={`flex items-center gap-2 sm:gap-2.5 p-3 sm:p-3.5 rounded-2xl border text-left transition-all active:scale-[0.97] min-w-0 ${
                        sel ? `${c.bg} border-current` : "bg-card border-border/60 hover:bg-muted/30"
                      }`}>
                      <c.icon className={`h-4 w-4 shrink-0 ${sel ? c.color : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold truncate ${sel ? c.color : "text-foreground"}`}>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assunto */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Assunto</p>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Resuma o problema em uma frase"
                maxLength={100}
                className="w-full bg-muted/40 border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all" />
            </div>

            {/* Mensagem */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">Descreva o problema</p>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Quanto mais detalhes, mais rápido resolvemos..."
                rows={5}
                className="w-full bg-muted/40 border border-border/60 rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all resize-none" />
            </div>

            <button onClick={createTicket} disabled={sending || !form.subject.trim() || !form.message.trim()}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {sending ? "Enviando..." : "Abrir chamado"}
            </button>
          </div>
        )}

        {/* ── CHAT ── */}
        {view === "chat" && selected && (
          <>
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">Aguardando resposta da equipe...</div>
              )}
              {messages.map(m => {
                const isMe = !m.is_agent;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mr-2 mt-auto mb-0.5">
                        <MessageCircle className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className={`max-w-[82%] sm:max-w-[78%] min-w-0 ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      {!isMe && <span className="text-[10px] font-bold text-primary pl-1">Suporte ItaSuper</span>}
                      <div className={`rounded-2xl px-4 py-2.5 ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted/60 text-foreground rounded-bl-sm"
                      }`}>
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.content}</p>
                      </div>
                      <span className={`text-[10px] text-muted-foreground px-1 ${isMe ? "text-right" : ""}`}>
                        {fmtDate(m.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {["fechado", "resolvido"].includes(selected.status) ? (
              <div className="px-4 py-4 border-t border-border/50 shrink-0">
                <div className="flex items-center justify-center gap-2 bg-emerald-500/8 rounded-2xl py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-semibold text-emerald-600 text-center">
                    Chamado {selected.status} — obrigado pelo contato!
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-3 sm:px-4 pt-3 pb-4 sm:pb-5 border-t border-border/50 shrink-0">
                <div className="flex items-end gap-2 bg-muted/40 border border-border/60 rounded-2xl px-3 py-2 min-w-0">
                  <textarea value={msg} onChange={e => setMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                    placeholder="Digite sua mensagem..."
                    rows={1}
                    className="flex-1 min-w-0 bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50 max-h-32" />
                  <button onClick={sendMsg} disabled={!msg.trim() || sending}
                    className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-90 transition-transform mb-0.5">
                    {sending ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" /> : <Send className="h-3.5 w-3.5 text-white" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SupportTicketModal;
