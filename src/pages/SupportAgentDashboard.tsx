/**
 * SupportAgentDashboard — Painel do Agente de Suporte ItaSuper
 * Mobile-first: lista de tickets → toque → chat em tela cheia
 * Desktop: sidebar + chat lado a lado (lg:)
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { subscribeWithRejoin, cleanupChannel } from "@/lib/realtimeChannel";
import { toast } from "sonner";
import {
  MessageCircle, Send, Loader2, LogOut, ChevronRight,
  User, Store, Bike, Search, StickyNote, ArrowLeft,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "aberto",             label: "Aberto",            color: "text-blue-500",        dot: "bg-blue-500" },
  { value: "em_atendimento",     label: "Em atendimento",    color: "text-amber-500",       dot: "bg-amber-500 animate-pulse" },
  { value: "aguardando_cliente", label: "Aguard. cliente",   color: "text-purple-500",      dot: "bg-purple-500 animate-pulse" },
  { value: "resolvido",          label: "Resolvido",         color: "text-emerald-500",     dot: "bg-emerald-500" },
  { value: "fechado",            label: "Fechado",           color: "text-muted-foreground", dot: "bg-muted-foreground" },
] as const;

const ROLE_ICON: Record<string, any> = { cliente: User, lojista: Store, motoboy: Bike };
const ROLE_LABEL: Record<string, string> = { cliente: "Cliente", lojista: "Lojista", motoboy: "Motoboy" };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const fmtShort = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const min = (now.getTime() - d.getTime()) / 60000;
  if (min < 1) return "agora";
  if (min < 60) return `${Math.floor(min)}min`;
  if (min < 1440) return `${Math.floor(min / 60)}h`;
  return `${Math.floor(min / 1440)}d`;
};

const SupportAgentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("aberto,em_atendimento,aguardando_cliente");
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const { data: agentProfile, isLoading: agentLoading } = useQuery({
    queryKey: ["agent-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("full_name, role, is_approved").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!agentLoading && agentProfile && agentProfile.role !== "suporte") {
      toast.error("Acesso restrito a agentes de suporte.");
      navigate("/");
    }
  }, [agentProfile, agentLoading, navigate]);

  const statusArray = statusFilter.split(",").filter(Boolean);

  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["agent-tickets", statusFilter],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("support_tickets")
        .select(`id, ticket_number, subject, status, priority, category, user_role,
                 created_at, updated_at, first_message, agent_id,
                 profiles!support_tickets_user_id_fkey(full_name, email),
                 stores(name)`)
        .in("status", statusArray)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["agent-messages", selectedId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("support_messages")
        .select(`id, content, is_agent, is_internal, created_at,
                 profiles!support_messages_sender_id_fkey(full_name)`)
        .eq("ticket_id", selectedId!)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!selectedId,
    staleTime: 5_000,
  });

  const selectedTicket = tickets.find(t => t.id === selectedId);

  const openTicket = (id: string) => { setSelectedId(id); setMobileView("chat"); };
  const goBack = () => { setMobileView("list"); setSelectedId(null); };

  useEffect(() => {
    const ch = supabase.channel("agent-tickets-rt")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "support_tickets" },
        () => refetchTickets());
    subscribeWithRejoin(ch);
    return () => cleanupChannel(ch);
  }, [refetchTickets]);

  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase.channel(`agent-msg-${selectedId}`)
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `ticket_id=eq.${selectedId}`,
      }, () => refetchMessages());
    subscribeWithRejoin(ch);
    return () => cleanupChannel(ch);
  }, [selectedId, refetchMessages]);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  const claimTicket = async (ticketId: string) => {
    await (supabase as any).from("support_tickets")
      .update({ agent_id: user!.id, status: "em_atendimento" }).eq("id", ticketId);
    refetchTickets();
    toast.success("Ticket atribuído a você.");
  };

  const updateStatus = async (status: string) => {
    if (!selectedId) return;
    setUpdatingStatus(true);
    await (supabase as any).from("support_tickets").update({
      status,
      ...(status === "resolvido" ? { resolved_at: new Date().toISOString() } : {}),
      ...(status === "fechado"   ? { closed_at:   new Date().toISOString() } : {}),
    }).eq("id", selectedId);
    queryClient.invalidateQueries({ queryKey: ["agent-tickets"] });
    setUpdatingStatus(false);
    toast.success("Status atualizado.");
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    try {
      await (supabase as any).from("support_messages").insert({
        ticket_id: selectedId, sender_id: user!.id,
        is_agent: true, is_internal: isInternal, content: newMessage.trim(),
      });
      if (!isInternal) {
        await (supabase as any).from("support_tickets")
          .update({ status: "aguardando_cliente" })
          .eq("id", selectedId).eq("status", "em_atendimento");
      }
      setNewMessage(""); refetchMessages(); refetchTickets();
    } catch { toast.error("Erro ao enviar"); }
    finally { setSending(false); }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(t =>
      t.subject?.toLowerCase().includes(q) ||
      (t.profiles as any)?.full_name?.toLowerCase().includes(q) ||
      String(t.ticket_number).includes(q)
    );
  }, [tickets, search]);

  const counts = useMemo(() => ({
    abertos:    tickets.filter(t => t.status === "aberto").length,
    aguardando: tickets.filter(t => t.status === "aguardando_cliente").length,
  }), [tickets]);

  if (agentLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  // ── Topbar ──────────────────────────────────────────────────────────────────
  const topbar = (
    <div className="h-14 border-b border-border bg-background flex items-center px-4 gap-3 shrink-0">
      {mobileView === "chat" ? (
        <button onClick={goBack}
          className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center lg:hidden active:scale-95">
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : (
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <MessageCircle className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-foreground truncate">
          {mobileView === "chat" && selectedTicket
            ? `#${String(selectedTicket.ticket_number).padStart(4,"0")} — ${selectedTicket.subject}`
            : "Central de Suporte"}
        </p>
        {mobileView === "chat" && selectedTicket ? (
          <p className={`text-[10px] font-bold ${STATUS_OPTIONS.find(s => s.value === selectedTicket.status)?.color}`}>
            {STATUS_OPTIONS.find(s => s.value === selectedTicket.status)?.label}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">{agentProfile?.full_name}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {counts.abertos > 0 && (
          <span className="text-[10px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{counts.abertos}</span>
        )}
        {counts.aguardando > 0 && (
          <span className="text-[10px] font-black bg-purple-500 text-white px-1.5 py-0.5 rounded-full">{counts.aguardando}</span>
        )}
        <button onClick={() => signOut()}
          className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center ml-1">
          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );

  // ── Lista de tickets ─────────────────────────────────────────────────────────
  const ticketList = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 space-y-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tickets..."
            className="w-full bg-muted/40 pl-8 pr-3 py-2.5 text-sm rounded-xl border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {[
            { key: "aberto,em_atendimento,aguardando_cliente", label: "Ativos" },
            { key: "aberto",             label: counts.abertos > 0    ? `Abertos (${counts.abertos})`       : "Abertos" },
            { key: "aguardando_cliente", label: counts.aguardando > 0 ? `Aguardando (${counts.aguardando})` : "Aguardando" },
            { key: "resolvido,fechado",  label: "Resolvidos" },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border whitespace-nowrap shrink-0 transition-colors ${
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border"
              }`}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {ticketsLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {!ticketsLoading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum ticket</p>
          </div>
        )}
        {filtered.map(t => {
          const st = STATUS_OPTIONS.find(s => s.value === t.status);
          const RoleIcon = ROLE_ICON[t.user_role] || User;
          return (
            <button key={t.id} onClick={() => openTicket(t.id)}
              className={`w-full text-left px-4 py-4 border-b border-border/30 active:bg-muted/50 transition-colors ${
                selectedId === t.id ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/20"
              }`}>
              <div className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${st?.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground leading-tight">{t.subject}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{fmtShort(t.updated_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {(t.profiles as any)?.full_name} · #{String(t.ticket_number).padStart(4,"0")}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <RoleIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className={`text-[11px] font-bold ${st?.color}`}>{st?.label}</span>
                    {!t.agent_id && <span className="text-[10px] text-red-400 font-bold ml-auto">Sem agente</span>}
                    {t.agent_id === user?.id && <span className="text-[10px] text-primary font-bold ml-auto">Meu</span>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const ticketChat = selectedTicket ? (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Info + ações */}
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {(() => { const I = ROLE_ICON[selectedTicket.user_role] || User; return <I className="h-3.5 w-3.5 shrink-0" />; })()}
          <span className="truncate">{ROLE_LABEL[selectedTicket.user_role]} · {(selectedTicket.profiles as any)?.full_name}</span>
          {selectedTicket.stores && <span>· {(selectedTicket.stores as any)?.name}</span>}
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedTicket.status} onChange={e => updateStatus(e.target.value)}
            disabled={updatingStatus}
            className="flex-1 text-xs font-bold bg-muted/40 border border-border/50 rounded-xl px-3 py-2 focus:outline-none">
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {!selectedTicket.agent_id ? (
            <button onClick={() => claimTicket(selectedTicket.id)}
              className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-xl active:scale-95 transition-transform shrink-0">
              Atribuir a mim
            </button>
          ) : selectedTicket.agent_id === user?.id ? (
            <span className="text-xs font-bold text-primary shrink-0 px-1">✓ Meu</span>
          ) : null}
        </div>
      </div>
      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => {
          const isAgent = m.is_agent, isNote = m.is_internal;
          return (
            <div key={m.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                isNote ? "bg-amber-500/10 border border-amber-500/30 rounded-br-md"
                : isAgent ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border/50 rounded-bl-md"
              }`}>
                {isNote && <p className="text-[10px] font-black text-amber-600 flex items-center gap-1 mb-1"><StickyNote className="h-3 w-3" /> Nota interna</p>}
                {!isAgent && <p className="text-[10px] font-black text-primary mb-1">{(m.profiles as any)?.full_name || "Usuário"}</p>}
                <p className={`text-sm leading-relaxed ${isNote ? "text-amber-900 dark:text-amber-200" : ""}`}>{m.content}</p>
                <p className={`text-[10px] mt-1 ${isAgent && !isNote ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{fmt(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      {selectedTicket.status !== "fechado" && (
        <div className="p-3 border-t border-border shrink-0 space-y-2">
          <button onClick={() => setIsInternal(!isInternal)}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-colors ${
              isInternal ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "bg-muted/40 text-muted-foreground border-border"
            }`}>
            <StickyNote className="h-3 w-3" />
            {isInternal ? "Nota interna (só agentes)" : "Resposta ao cliente"}
          </button>
          <div className="flex items-end gap-2">
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={isInternal ? "Nota interna..." : "Responder ao cliente..."}
              rows={2}
              className={`flex-1 bg-muted/40 border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                isInternal ? "border-amber-500/30" : "border-border/50"
              }`} />
            <button onClick={sendMessage} disabled={!newMessage.trim() || sending}
              className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
              {sending ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Send className="h-4 w-4 text-white" />}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center space-y-2">
        <MessageCircle className="h-12 w-12 mx-auto opacity-20" />
        <p className="text-sm font-medium">Selecione um ticket</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen max-h-screen bg-background flex flex-col overflow-hidden">
      {topbar}
      {/* Mobile: uma tela por vez */}
      <div className="flex-1 overflow-hidden lg:hidden">
        {mobileView === "list" ? ticketList : ticketChat}
      </div>
      {/* Desktop: sidebar + chat */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 border-r border-border overflow-hidden">{ticketList}</div>
        <div className="flex-1 overflow-hidden">{ticketChat}</div>
      </div>
    </div>
  );
};

export default SupportAgentDashboard;
