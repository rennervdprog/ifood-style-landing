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
  Circle, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

const STATUSES = [
  { value: "aberto",             label: "Aberto",          color: "text-blue-600",        dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  { value: "em_atendimento",     label: "Em atendimento",  color: "text-amber-600",       dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  { value: "aguardando_cliente", label: "Aguardando",      color: "text-purple-600",      dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400" },
  { value: "resolvido",          label: "Resolvido",       color: "text-emerald-600",     dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  { value: "fechado",            label: "Fechado",         color: "text-muted-foreground", dot: "bg-muted-foreground", badge: "bg-muted/60 text-muted-foreground" },
] as const;

const ROLE: Record<string, { icon: any; label: string; color: string }> = {
  cliente: { icon: User,  label: "Cliente",  color: "text-blue-500" },
  lojista: { icon: Store, label: "Lojista",  color: "text-orange-500" },
  motoboy: { icon: Bike,  label: "Motoboy",  color: "text-purple-500" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const fmtShort = (iso: string) => {
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 1) return "agora";
  if (m < 60) return `${Math.floor(m)}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
};

const SupportAgentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<"list" | "chat">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("aberto,em_atendimento,aguardando_cliente");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ── Auth ──
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["agent-me", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("full_name, role, is_approved").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  useEffect(() => {
    if (!agentLoading && agent && (agent.role as string) !== "suporte") {
      toast.error("Acesso restrito."); navigate("/");
    }
  }, [agent, agentLoading, navigate]);

  // ── Tickets ──
  const statusArr = filter.split(",").filter(Boolean);
  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["agent-tickets", filter],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("support_tickets")
        .select(`id,ticket_number,subject,status,priority,category,user_role,
                 created_at,updated_at,first_message,agent_id,
                 profiles!support_tickets_user_id_fkey(full_name,email),
                 stores(name)`)
        .in("status", statusArr)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // ── Mensagens ──
  const { data: messages = [], refetch: refetchMsgs } = useQuery({
    queryKey: ["agent-msgs", selectedId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("support_messages")
        .select(`id,content,is_agent,is_internal,created_at,
                 profiles!support_messages_sender_id_fkey(full_name)`)
        .eq("ticket_id", selectedId!)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!selectedId,
    staleTime: 5000,
  });

  const selected = tickets.find(t => t.id === selectedId);

  const openTicket = (id: string) => { setSelectedId(id); setView("chat"); };
  const goBack = () => { setView("list"); setSelectedId(null); };

  // ── Realtime ──
  useEffect(() => {
    const ch = supabase.channel("agent-rt")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "support_tickets" }, () => refetchTickets());
    subscribeWithRejoin(ch);
    return () => cleanupChannel(ch);
  }, [refetchTickets]);

  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase.channel(`agent-msg-${selectedId}`)
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public", table: "support_messages",
        filter: `ticket_id=eq.${selectedId}`,
      }, () => refetchMsgs());
    subscribeWithRejoin(ch);
    return () => cleanupChannel(ch);
  }, [selectedId, refetchMsgs]);

  useEffect(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages]);

  // ── Ações ──
  const claim = async (id: string) => {
    await (supabase as any).from("support_tickets")
      .update({ agent_id: user!.id, status: "em_atendimento" }).eq("id", id);
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

  const sendMsg = async () => {
    if (!msg.trim() || !selectedId) return;
    setSending(true);
    try {
      await (supabase as any).from("support_messages").insert({
        ticket_id: selectedId, sender_id: user!.id,
        is_agent: true, is_internal: isInternal, content: msg.trim(),
      });
      if (!isInternal) {
        await (supabase as any).from("support_tickets")
          .update({ status: "aguardando_cliente" })
          .eq("id", selectedId).eq("status", "em_atendimento");
      }
      setMsg(""); refetchMsgs(); refetchTickets();
    } catch { toast.error("Erro ao enviar"); }
    finally { setSending(false); }
  };

  // ── Filtro ──
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
    total:      tickets.length,
  }), [tickets]);

  if (agentLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );

  // ════════════════════════════════════════════
  // TOPBAR
  // ════════════════════════════════════════════
  const Topbar = () => (
    <div className="h-14 bg-background border-b border-border/60 flex items-center px-4 gap-3 shrink-0">
      {view === "chat" ? (
        <button onClick={goBack}
          className="w-9 h-9 rounded-2xl bg-muted/60 flex items-center justify-center lg:hidden active:scale-90 transition-transform">
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : (
        <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {view === "chat" && selected ? (
          <>
            <p className="text-sm font-bold text-foreground truncate">{selected.subject}</p>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUSES.find(s => s.value === selected.status)?.dot}`} />
              <p className={`text-[11px] font-semibold ${STATUSES.find(s => s.value === selected.status)?.color}`}>
                {STATUSES.find(s => s.value === selected.status)?.label}
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-foreground">Central de Suporte</p>
            <p className="text-[11px] text-muted-foreground">{agent?.full_name}</p>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {counts.abertos > 0 && (
          <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full">{counts.abertos}</span>
        )}
        {counts.aguardando > 0 && (
          <span className="text-[10px] font-black bg-purple-500 text-white px-2 py-0.5 rounded-full">{counts.aguardando}</span>
        )}
        <button onClick={() => signOut()}
          className="w-9 h-9 rounded-2xl bg-muted/60 flex items-center justify-center active:scale-90 transition-transform">
          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════
  // LISTA DE TICKETS
  // ════════════════════════════════════════════
  const TicketList = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filtros */}
      <div className="px-4 pt-3 pb-3 space-y-3 border-b border-border/60 shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por assunto ou cliente..."
            className="w-full bg-muted/40 pl-9 pr-4 py-2.5 text-sm rounded-2xl border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {[
            { key: "aberto,em_atendimento,aguardando_cliente", label: "Ativos", count: counts.total },
            { key: "aberto",             label: "Abertos",    count: counts.abertos },
            { key: "aguardando_cliente", label: "Aguardando", count: counts.aguardando },
            { key: "resolvido,fechado",  label: "Resolvidos", count: 0 },
          ].map(f => {
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all ${
                  active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border/60"
                }`}>
                {f.label}
                {f.count > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-foreground/10 text-foreground"}`}>
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {ticketsLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {!ticketsLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">Nenhum ticket aqui</p>
          </div>
        )}
        {filtered.map(t => {
          const st = STATUSES.find(s => s.value === t.status);
          const role = ROLE[t.user_role] || ROLE.cliente;
          const RIcon = role.icon;
          const isSelected = selectedId === t.id;
          const isMine = t.agent_id === user?.id;
          return (
            <button key={t.id} onClick={() => openTicket(t.id)}
              className={`w-full text-left px-4 py-4 border-b border-border/40 transition-colors ${
                isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/20 active:bg-muted/40"
              }`}>
              <div className="flex items-start gap-3">
                {/* Avatar role */}
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 bg-muted/60 mt-0.5`}>
                  <RIcon className={`h-4 w-4 ${role.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground leading-snug truncate">{t.subject}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">{fmtShort(t.updated_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {(t.profiles as any)?.full_name} · #{String(t.ticket_number).padStart(4, "0")}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {st && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>
                        {st.label}
                      </span>
                    )}
                    {!t.agent_id && (
                      <span className="text-[11px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">
                        Sem agente
                      </span>
                    )}
                    {isMine && (
                      <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">
                        Meu
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-2" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ════════════════════════════════════════════
  // CHAT
  // ════════════════════════════════════════════
  const TicketChat = () => {
    if (!selected) return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="w-16 h-16 rounded-3xl bg-muted/40 flex items-center justify-center">
          <MessageCircle className="h-7 w-7 opacity-30" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium">Selecione um ticket para atender</p>
      </div>
    );

    const role = ROLE[selected.user_role] || ROLE.cliente;
    const RIcon = role.icon;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Info do ticket */}
        <div className="px-4 py-3 border-b border-border/60 shrink-0 space-y-2.5 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
              <RIcon className={`h-3.5 w-3.5 ${role.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {role.label} · {(selected.profiles as any)?.full_name}
              </p>
              {(selected.profiles as any)?.email && (
                <p className="text-[10px] text-muted-foreground truncate">{(selected.profiles as any).email}</p>
              )}
            </div>
            {!selected.agent_id ? (
              <button onClick={() => claim(selected.id)}
                className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-xl active:scale-95 transition-transform shrink-0">
                Assumir
              </button>
            ) : selected.agent_id === user?.id ? (
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl shrink-0">✓ Meu</span>
            ) : null}
          </div>

          {/* Status selector */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {STATUSES.filter(s => s.value !== "fechado").map(s => (
              <button key={s.value}
                onClick={() => updateStatus(s.value)}
                disabled={updatingStatus}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 border transition-all ${
                  selected.status === s.value ? `${s.badge} border-current` : "bg-muted/40 text-muted-foreground border-border/60"
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map(m => {
            const isAgent = m.is_agent;
            const isNote = m.is_internal;
            return (
              <div key={m.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                {!isAgent && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-auto mb-0.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[75%] flex flex-col gap-1 ${isAgent ? "items-end" : "items-start"}`}>
                  {isNote && (
                    <div className="flex items-center gap-1 px-1">
                      <StickyNote className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] font-bold text-amber-600">Nota interna</span>
                    </div>
                  )}
                  {!isAgent && (
                    <span className="text-[10px] font-semibold text-muted-foreground px-1">
                      {(m.profiles as any)?.full_name || "Cliente"}
                    </span>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 ${
                    isNote
                      ? "bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-br-sm"
                      : isAgent
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted/60 text-foreground rounded-bl-sm"
                  }`}>
                    <p className={`text-sm leading-relaxed ${isNote ? "text-amber-800 dark:text-amber-200" : ""}`}>
                      {m.content}
                    </p>
                  </div>
                  <span className={`text-[10px] text-muted-foreground px-1 ${isAgent ? "text-right" : ""}`}>
                    {fmt(m.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Input */}
        {selected.status !== "fechado" && (
          <div className="px-4 pt-3 pb-4 border-t border-border/60 shrink-0 space-y-2">
            {/* Toggle nota */}
            <button onClick={() => setIsInternal(!isInternal)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                isInternal
                  ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                  : "bg-muted/40 text-muted-foreground border-border/60"
              }`}>
              <StickyNote className="h-3.5 w-3.5" />
              {isInternal ? "Nota interna — só agentes veem" : "Resposta ao cliente"}
            </button>

            <div className={`flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all ${
              isInternal ? "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20" : "bg-muted/40 border-border/60"
            }`}>
              <textarea value={msg} onChange={e => setMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                placeholder={isInternal ? "Nota interna..." : "Responda ao cliente..."}
                rows={2}
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50" />
              <button onClick={sendMsg} disabled={!msg.trim() || sending}
                className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-90 transition-transform mb-0.5">
                {sending ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" /> : <Send className="h-3.5 w-3.5 text-white" />}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen max-h-screen bg-background flex flex-col overflow-hidden">
      <Topbar />

      {/* Mobile */}
      <div className="flex-1 overflow-hidden lg:hidden">
        {view === "list" ? <TicketList /> : <TicketChat />}
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <div className="w-[340px] shrink-0 border-r border-border/60 overflow-hidden">
          <TicketList />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <TicketChat />
        </div>
      </div>
    </div>
  );
};

export default SupportAgentDashboard;
