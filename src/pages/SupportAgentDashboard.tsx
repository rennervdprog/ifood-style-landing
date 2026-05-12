/**
 * SupportAgentDashboard — Painel do Agente de Suporte ItaSuper
 * Rota: /suporte
 * Role: suporte (is_approved = true)
 *
 * Features:
 * - Lista de todos os tickets com filtros e contadores
 * - Chat em tempo real com o cliente
 * - Notas internas (só agentes veem)
 * - Atribuir ticket a si mesmo
 * - Alterar status e prioridade
 * - Ver perfil do usuário (role, loja, pedidos)
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
  User, Store, Bike, Clock, CheckCircle2, AlertTriangle,
  Circle, Filter, Search, RefreshCw, Lock, Unlock,
  StickyNote, ChevronDown, Bell, MoreVertical,
} from "lucide-react";

// ─── Tipos e constantes ───────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "aberto",             label: "Aberto",             color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/20" },
  { value: "em_atendimento",     label: "Em atendimento",     color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20" },
  { value: "aguardando_cliente", label: "Aguardando cliente", color: "text-purple-500",  bg: "bg-purple-500/10 border-purple-500/20" },
  { value: "resolvido",          label: "Resolvido",          color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { value: "fechado",            label: "Fechado",            color: "text-muted-foreground", bg: "bg-muted/40 border-border" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "baixa",   label: "Baixa",   color: "text-muted-foreground" },
  { value: "normal",  label: "Normal",  color: "text-blue-500" },
  { value: "alta",    label: "Alta",    color: "text-amber-500" },
  { value: "urgente", label: "Urgente", color: "text-red-500" },
] as const;

const ROLE_ICON: Record<string, any> = { cliente: User, lojista: Store, motoboy: Bike };
const ROLE_LABEL: Record<string, string> = { cliente: "Cliente", lojista: "Lojista", motoboy: "Motoboy" };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const formatDateShort = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = (now.getTime() - d.getTime()) / 60000;
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${Math.floor(diffMin)}min`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return `${Math.floor(diffMin / 1440)}d`;
};

// ─── SupportAgentDashboard ────────────────────────────────────────────────────

const SupportAgentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("aberto,em_atendimento,aguardando_cliente");
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ── Verificar role ──
  const { data: agentProfile, isLoading: agentLoading } = useQuery({
    queryKey: ["agent-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role, is_approved, avatar_url")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!agentLoading && agentProfile && agentProfile.role !== "suporte") {
      toast.error("Acesso restrito a agentes de suporte.");
      navigate("/");
    }
  }, [agentProfile, agentLoading, navigate]);

  // ── Tickets ──
  const statusArray = statusFilter.split(",").filter(Boolean);
  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["agent-tickets", statusFilter],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("support_tickets")
        .select(`
          id, ticket_number, subject, status, priority, category, user_role,
          created_at, updated_at, first_message, agent_id,
          profiles!support_tickets_user_id_fkey(full_name, email),
          stores(name)
        `)
        .in("status", statusArray)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
    refetchInterval: 30_000,
  });

  // ── Mensagens ──
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["agent-messages", selectedId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("support_messages")
        .select("id, content, is_agent, is_internal, created_at, sender_id, profiles!support_messages_sender_id_fkey(full_name)")
        .eq("ticket_id", selectedId!)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!selectedId,
  });

  const selectedTicket = tickets.find(t => t.id === selectedId);

  // ── Realtime ──
  useEffect(() => {
    const ch = supabase.channel("agent-tickets-rt")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "support_tickets" }, () => {
        refetchTickets();
      });
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

  // ── Filtro de busca ──
  const filtered = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(t =>
      t.subject?.toLowerCase().includes(q) ||
      (t.profiles as any)?.full_name?.toLowerCase().includes(q) ||
      String(t.ticket_number).includes(q)
    );
  }, [tickets, search]);

  // ── Atribuir a mim ──
  const claimTicket = async (ticketId: string) => {
    await (supabase as any).from("support_tickets").update({
      agent_id: user!.id,
      status: "em_atendimento",
    }).eq("id", ticketId);
    refetchTickets();
    toast.success("Ticket atribuído a você.");
  };

  // ── Alterar status ──
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

  // ── Enviar mensagem ──
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    try {
      await (supabase as any).from("support_messages").insert({
        ticket_id: selectedId,
        sender_id: user!.id,
        is_agent: true,
        is_internal: isInternal,
        content: newMessage.trim(),
      });
      if (!isInternal) {
        await (supabase as any).from("support_tickets").update({ status: "aguardando_cliente" })
          .eq("id", selectedId).eq("status", "em_atendimento");
      }
      setNewMessage("");
      refetchMessages();
      refetchTickets();
    } catch {
      toast.error("Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  // ── Contadores ──
  const counts = useMemo(() => ({
    aberto: tickets.filter(t => t.status === "aberto").length,
    em_atendimento: tickets.filter(t => t.status === "em_atendimento").length,
    aguardando_cliente: tickets.filter(t => t.status === "aguardando_cliente").length,
  }), [tickets]);

  if (agentLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Topbar */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
          <MessageCircle className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-foreground">Central de Suporte</p>
          <p className="text-[10px] text-muted-foreground">{agentProfile?.full_name || "Agente"}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {counts.aberto > 0 && (
            <span className="text-[10px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{counts.aberto}</span>
          )}
          {counts.aguardando_cliente > 0 && (
            <span className="text-[10px] font-black bg-purple-500 text-white px-1.5 py-0.5 rounded-full">{counts.aguardando_cliente}</span>
          )}
        </div>
        <button onClick={() => signOut()} className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
          <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR: Lista de tickets ── */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col overflow-hidden">
          {/* Filtros de status */}
          <div className="p-3 space-y-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tickets..."
                className="w-full bg-muted/40 pl-8 pr-3 py-2 text-xs rounded-xl border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {[
                { key: "aberto,em_atendimento,aguardando_cliente", label: "Ativos" },
                { key: "aberto", label: `Abertos ${counts.aberto > 0 ? `(${counts.aberto})` : ""}` },
                { key: "aguardando_cliente", label: "Aguardando" },
                { key: "resolvido,fechado", label: "Resolvidos" },
              ].map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${statusFilter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {ticketsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
            {filtered.map(t => {
              const st = STATUS_OPTIONS.find(s => s.value === t.status);
              const RoleIcon = ROLE_ICON[t.user_role] || User;
              const isSelected = t.id === selectedId;
              const isMine = t.agent_id === user?.id;
              const pr = PRIORITY_OPTIONS.find(p => p.value === t.priority);
              return (
                <button key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-3 py-3 border-b border-border/30 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30"}`}>
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5">
                      <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-foreground truncate">{t.subject}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatDateShort(t.updated_at)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {(t.profiles as any)?.full_name || "Usuário"} · #{String(t.ticket_number).padStart(4,"0")}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {st && <span className={`text-[10px] font-bold ${st.color}`}>{st.label}</span>}
                        {t.priority !== "normal" && pr && (
                          <span className={`text-[10px] font-bold ${pr.color}`}>· {pr.label}</span>
                        )}
                        {isMine && <span className="text-[10px] text-primary font-bold ml-auto">Meu</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {!ticketsLoading && filtered.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-xs">Nenhum ticket</p>
              </div>
            )}
          </div>
        </div>

        {/* ── ÁREA PRINCIPAL: Ticket selecionado ── */}
        {selectedTicket ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header do ticket */}
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-foreground">{selectedTicket.subject}</p>
                  <span className="text-[10px] text-muted-foreground">#{String(selectedTicket.ticket_number).padStart(4,"0")}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {/* Status selector */}
                  <select
                    value={selectedTicket.status}
                    onChange={e => updateStatus(e.target.value)}
                    disabled={updatingStatus}
                    className="text-[11px] font-bold bg-transparent border border-border/50 rounded-lg px-2 py-1 focus:outline-none"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {/* Perfil do usuário */}
                  <span className="text-[11px] text-muted-foreground">
                    {ROLE_LABEL[selectedTicket.user_role]} · {(selectedTicket.profiles as any)?.full_name}
                  </span>
                  {selectedTicket.stores && (
                    <span className="text-[11px] text-muted-foreground">· {(selectedTicket.stores as any)?.name}</span>
                  )}
                </div>
              </div>
              {/* Atribuir */}
              {!selectedTicket.agent_id && (
                <button onClick={() => claimTicket(selectedTicket.id)}
                  className="text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl active:scale-95 transition-transform shrink-0">
                  Atribuir a mim
                </button>
              )}
              {selectedTicket.agent_id === user?.id && (
                <span className="text-[11px] font-bold text-primary shrink-0">✓ Seu ticket</span>
              )}
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => {
                const isAgent = m.is_agent;
                const isIntNote = m.is_internal;
                return (
                  <div key={m.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                      isIntNote
                        ? "bg-amber-500/10 border border-amber-500/30 rounded-br-md"
                        : isAgent
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-card border border-border/50 rounded-bl-md"
                    }`}>
                      {isIntNote && (
                        <p className="text-[10px] font-black text-amber-600 flex items-center gap-1 mb-1">
                          <StickyNote className="h-3 w-3" /> Nota interna
                        </p>
                      )}
                      {!isAgent && (
                        <p className="text-[10px] font-black text-primary mb-1">
                          {(m.profiles as any)?.full_name || "Usuário"}
                        </p>
                      )}
                      {isAgent && !isIntNote && (
                        <p className="text-[10px] text-primary-foreground/70 mb-1">
                          {(m.profiles as any)?.full_name || "Agente"}
                        </p>
                      )}
                      <p className={`text-sm leading-relaxed ${isIntNote ? "text-amber-900 dark:text-amber-200" : ""}`}>
                        {m.content}
                      </p>
                      <p className={`text-[10px] mt-1 ${isAgent && !isIntNote ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {formatDate(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {!["fechado"].includes(selectedTicket.status) && (
              <div className="p-3 border-t border-border shrink-0 space-y-2">
                {/* Toggle nota interna */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsInternal(!isInternal)}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${isInternal ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "bg-muted/40 text-muted-foreground border-border"}`}>
                    <StickyNote className="h-3 w-3" />
                    {isInternal ? "Nota interna" : "Resposta ao cliente"}
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {isInternal ? "Só agentes veem" : "Cliente receberá notificação"}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={isInternal ? "Adicionar nota interna..." : "Responder ao cliente..."}
                    rows={2}
                    className={`flex-1 bg-muted/40 border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      isInternal ? "border-amber-500/30 focus:ring-amber-500/20" : "border-border/50"
                    }`}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
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
              <p className="text-sm font-medium">Selecione um ticket para atender</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportAgentDashboard;
