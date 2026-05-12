/**
 * SupportTicketModal
 * Modal de abertura de ticket e visualização/resposta de tickets existentes.
 * Usado por: lojistas (AdminDashboardV2), motoboys (DriverDashboardV2), clientes (ClientHome)
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/utils";
import { subscribeWithRejoin, cleanupChannel } from "@/lib/realtimeChannel";
import {
  X, Plus, Send, Loader2, MessageCircle, ChevronRight,
  CheckCircle2, Clock, AlertTriangle, HelpCircle, Package,
  CreditCard, Truck, Settings, ChevronLeft, Circle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "pedido",      label: "Problema com pedido",   icon: Package },
  { value: "pagamento",   label: "Pagamento / cobrança",  icon: CreditCard },
  { value: "entrega",     label: "Entrega",               icon: Truck },
  { value: "conta",       label: "Minha conta",           icon: Settings },
  { value: "tecnico",     label: "Problema técnico",      icon: AlertTriangle },
  { value: "financeiro",  label: "Financeiro",            icon: CreditCard },
  { value: "outro",       label: "Outro assunto",         icon: HelpCircle },
] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  aberto:             { label: "Aberto",             color: "text-blue-500",    dot: "bg-blue-500" },
  em_atendimento:     { label: "Em atendimento",     color: "text-amber-500",   dot: "bg-amber-500 animate-pulse" },
  aguardando_cliente: { label: "Aguardando você",    color: "text-purple-500",  dot: "bg-purple-500 animate-pulse" },
  resolvido:          { label: "Resolvido",          color: "text-emerald-500", dot: "bg-emerald-500" },
  fechado:            { label: "Fechado",            color: "text-muted-foreground", dot: "bg-muted-foreground" },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  userRole: "cliente" | "lojista" | "motoboy";
  storeId?: string;
  storeName?: string;
}

export const SupportTicketModal = ({ open, onClose, userRole, storeId, storeName }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<"list" | "detail" | "new">("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Formulário de novo ticket
  const [form, setForm] = useState({ category: "outro" as string, subject: "", message: "" });

  // ── Tickets do usuário ──
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["my-support-tickets", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets" as any)
        .select("id, ticket_number, subject, status, priority, category, created_at, updated_at, first_message")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
    enabled: !!user && open,
    refetchInterval: open ? 30_000 : false,
  });

  // ── Mensagens do ticket selecionado ──
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["support-messages", selectedTicketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_messages" as any)
        .select("id, content, is_agent, is_internal, created_at, sender_id")
        .eq("ticket_id", selectedTicketId!)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!selectedTicketId && view === "detail",
  });

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  // Realtime para mensagens
  useEffect(() => {
    if (!selectedTicketId || view !== "detail") return;
    const ch = supabase.channel(`support-msg-${selectedTicketId}`)
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `ticket_id=eq.${selectedTicketId}`,
      }, () => {
        refetchMessages();
        queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
      });
    subscribeWithRejoin(ch);
    return () => cleanupChannel(ch);
  }, [selectedTicketId, view, refetchMessages, queryClient]);

  // Scroll para baixo quando chegam mensagens
  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  // ── Criar ticket ──
  const createTicket = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error("Preencha o assunto e a mensagem.");
      return;
    }
    setSending(true);
    try {
      const { data: ticket, error } = await supabase
        .from("support_tickets" as any)
        .insert({
          user_id: user!.id,
          user_role: userRole,
          store_id: storeId || null,
          category: form.category,
          subject: form.subject.trim(),
          first_message: form.message.trim().slice(0, 200),
          status: "aberto",
          priority: "normal",
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("support_messages" as any).insert({
        ticket_id: (ticket as any).id,
        sender_id: user!.id,
        is_agent: false,
        is_internal: false,
        content: form.message.trim(),
      });

      queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
      setForm({ category: "outro", subject: "", message: "" });
      setSelectedTicketId((ticket as any).id);
      setView("detail");
      toast.success("Ticket aberto! Nossa equipe responderá em breve.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao abrir ticket");
    } finally {
      setSending(false);
    }
  };

  // ── Enviar mensagem ──
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicketId) return;
    setSending(true);
    try {
      await supabase.from("support_messages" as any).insert({
        ticket_id: selectedTicketId,
        sender_id: user!.id,
        is_agent: false,
        is_internal: false,
        content: newMessage.trim(),
      });
      setNewMessage("");
      refetchMessages();
    } catch (e: any) {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg h-[90vh] sm:h-[80vh] bg-background rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border shrink-0">
          {view !== "list" && (
            <button onClick={() => { setView("list"); setSelectedTicketId(null); }}
              className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1">
            <p className="text-sm font-black text-foreground">
              {view === "list" ? (
                <span className="flex items-center gap-2">
                  Meus Chamados
                  {tickets.filter(t => t.status === "aguardando_cliente").length > 0 && (
                    <span className="text-[10px] font-black bg-purple-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                      {tickets.filter(t => t.status === "aguardando_cliente").length}
                    </span>
                  )}
                </span>
              ) : view === "new" ? "Abrir Chamado" : `#${String(selectedTicket?.ticket_number || "").padStart(4, "0")}`}
            </p>
            {view === "detail" && selectedTicket && (
              <p className={`text-[11px] font-bold ${STATUS_CONFIG[selectedTicket.status]?.color}`}>
                {STATUS_CONFIG[selectedTicket.status]?.label}
              </p>
            )}
          </div>
          {view === "list" && (
            <button onClick={() => setView("new")}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-transform">
              <Plus className="h-3.5 w-3.5" /> Novo
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── LISTA DE TICKETS ── */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {ticketsLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
            {!ticketsLoading && tickets.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageCircle className="h-8 w-8 text-primary" />
                </div>
                <p className="font-bold text-foreground">Nenhum chamado aberto</p>
                <p className="text-sm text-muted-foreground">Precisa de ajuda? Abra um chamado e nossa equipe responde.</p>
                <button onClick={() => setView("new")}
                  className="bg-primary text-primary-foreground text-sm font-bold px-6 py-2.5 rounded-xl mt-2 active:scale-95 transition-transform">
                  Abrir primeiro chamado
                </button>
              </div>
            )}
            {tickets.map(t => {
              const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.aberto;
              const cat = CATEGORY_OPTIONS.find(c => c.value === t.category);
              return (
                <button key={t.id}
                  onClick={() => { setSelectedTicketId(t.id); setView("detail"); }}
                  className="w-full text-left bg-card border border-border/50 rounded-2xl p-3.5 hover:border-primary/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-foreground truncate">{t.subject}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">#{String(t.ticket_number).padStart(4,"0")}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.first_message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-bold ${st.color}`}>{st.label}</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">{cat?.label || t.category}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(t.updated_at)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── NOVO TICKET ── */}
        {view === "new" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Categoria */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Categoria</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map(c => {
                  const Icon = c.icon;
                  const sel = form.category === c.value;
                  return (
                    <button key={c.value}
                      onClick={() => setForm(f => ({ ...f, category: c.value }))}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${sel ? "border-primary bg-primary/8" : "border-border/50 bg-card"}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${sel ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold ${sel ? "text-primary" : "text-foreground"}`}>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assunto */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Assunto</p>
              <input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Descreva o problema em poucas palavras"
                maxLength={100}
                className="w-full bg-muted/40 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Mensagem */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Mensagem</p>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Descreva com detalhes o que aconteceu..."
                rows={5}
                className="w-full bg-muted/40 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <button
              onClick={createTicket}
              disabled={sending || !form.subject.trim() || !form.message.trim()}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Abrindo..." : "Abrir Chamado"}
            </button>
          </div>
        )}

        {/* ── DETALHE / CHAT ── */}
        {view === "detail" && selectedTicket && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => {
                const isMe = !m.is_agent;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                      isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border/50 rounded-bl-md"
                    }`}>
                      {!isMe && (
                        <p className="text-[10px] font-black text-primary mb-1">Suporte ItaSuper</p>
                      )}
                      <p className="text-sm leading-relaxed">{m.content}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {formatDate(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de resposta — só se não fechado/resolvido */}
            {!["fechado", "resolvido"].includes(selectedTicket.status) ? (
              <div className="p-3 border-t border-border shrink-0 flex items-end gap-2">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Digite sua mensagem..."
                  rows={2}
                  className="flex-1 bg-muted/40 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
                  {sending ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Send className="h-4 w-4 text-white" />}
                </button>
              </div>
            ) : (
              <div className="p-3 border-t border-border shrink-0 text-center">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Este chamado está {STATUS_CONFIG[selectedTicket.status]?.label.toLowerCase()}.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SupportTicketModal;
