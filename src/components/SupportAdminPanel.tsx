import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MessageCircle, User, Store, Bike, Loader2, Search,
  UserPlus, X, BarChart3, Users, ChevronDown, ChevronRight,
  Clock, TrendingUp, AlertCircle, CheckCircle2,
} from "lucide-react";

const STATUS: Record<string, { label: string; color: string; badge: string }> = {
  aberto:             { label: "Aberto",           color: "text-blue-600",     badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  em_atendimento:     { label: "Em atendimento",   color: "text-amber-600",    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  aguardando_cliente: { label: "Aguardando",       color: "text-purple-600",   badge: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400" },
  resolvido:          { label: "Resolvido",        color: "text-emerald-600",  badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  fechado:            { label: "Fechado",          color: "text-muted-foreground", badge: "bg-muted/60 text-muted-foreground" },
};

const ROLE: Record<string, { icon: any; color: string }> = {
  cliente: { icon: User,  color: "text-blue-500" },
  lojista: { icon: Store, color: "text-orange-500" },
  motoboy: { icon: Bike,  color: "text-purple-500" },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const SupportAdminPanel = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [agentEmail, setAgentEmail] = useState("");
  const [addingAgent, setAddingAgent] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"tickets" | "agents">("tickets");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-tickets", statusFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("support_tickets")
        .select(`id,ticket_number,subject,status,priority,category,user_role,
                 created_at,updated_at,first_message,agent_id,resolved_at,
                 profiles!support_tickets_user_id_fkey(full_name,email),
                 agent:profiles!support_tickets_agent_id_fkey(full_name),
                 stores(name)`)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      const { data } = await q;
      return (data || []) as any[];
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: agents = [], refetch: refetchAgents } = useQuery({
    queryKey: ["support-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,full_name,email,is_approved,created_at")
        .eq("role", "suporte" as any)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    staleTime: 30000,
  });

  const metrics = useMemo(() => {
    const total      = tickets.length;
    const abertos    = tickets.filter(t => t.status === "aberto").length;
    const atendimento= tickets.filter(t => t.status === "em_atendimento").length;
    const resolvidos = tickets.filter(t => t.status === "resolvido").length;
    const semAgente  = tickets.filter(t => !t.agent_id && !["fechado","resolvido"].includes(t.status)).length;

    const resolvedWithTime = tickets.filter(t => t.resolved_at && t.created_at);
    const avgH = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((s, t) =>
          s + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000, 0
        ) / resolvedWithTime.length
      : 0;

    const byAgent: Record<string, { name: string; count: number; resolved: number }> = {};
    tickets.forEach(t => {
      if (t.agent_id && t.agent) {
        const name = (t.agent as any)?.full_name || "Agente";
        if (!byAgent[t.agent_id]) byAgent[t.agent_id] = { name, count: 0, resolved: 0 };
        byAgent[t.agent_id].count++;
        if (["resolvido","fechado"].includes(t.status)) byAgent[t.agent_id].resolved++;
      }
    });

    return { total, abertos, atendimento, resolvidos, semAgente, avgH, byAgent };
  }, [tickets]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(t =>
      t.subject?.toLowerCase().includes(q) ||
      (t.profiles as any)?.full_name?.toLowerCase().includes(q) ||
      (t.agent as any)?.full_name?.toLowerCase().includes(q) ||
      String(t.ticket_number).includes(q)
    );
  }, [tickets, search]);

  const addAgent = async () => {
    if (!agentEmail.trim()) return;
    setAddingAgent(true);
    try {
      const { data: profile } = await supabase
        .from("profiles").select("user_id,full_name,role")
        .eq("email", agentEmail.trim().toLowerCase()).maybeSingle();
      if (!profile) { toast.error("Usuário não encontrado na plataforma."); return; }
      const { error } = await supabase.from("profiles")
        .update({ role: "suporte" as any, is_approved: true }).eq("user_id", profile.user_id);
      if (error) throw error;
      toast.success(`${profile.full_name || agentEmail} adicionado como agente.`);
      setAgentEmail(""); setShowAddAgent(false); refetchAgents();
    } catch (e: any) { toast.error(e.message || "Erro ao adicionar"); }
    finally { setAddingAgent(false); }
  };

  const removeAgent = async (userId: string, name: string) => {
    await supabase.from("profiles").update({ role: "cliente" as any }).eq("user_id", userId);
    toast.success(`${name} removido dos agentes.`);
    refetchAgents();
  };

  return (
    <div className="space-y-6 p-4 max-w-5xl">

      {/* ── MÉTRICAS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-foreground">Visão geral</h3>
          {metrics.avgH > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl">
              <Clock className="h-3.5 w-3.5" />
              <span>Resolução média: <strong className="text-foreground">{metrics.avgH.toFixed(1)}h</strong></span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {[
            { label: "Total",         value: metrics.total,       icon: MessageCircle, color: "text-foreground",     bg: "bg-card" },
            { label: "Abertos",       value: metrics.abertos,     icon: AlertCircle,   color: "text-blue-600",       bg: "bg-blue-50 dark:bg-blue-500/8" },
            { label: "Atendimento",   value: metrics.atendimento, icon: Clock,         color: "text-amber-600",      bg: "bg-amber-50 dark:bg-amber-500/8" },
            { label: "Resolvidos",    value: metrics.resolvidos,  icon: CheckCircle2,  color: "text-emerald-600",    bg: "bg-emerald-50 dark:bg-emerald-500/8" },
            { label: "Sem agente",    value: metrics.semAgente,   icon: AlertCircle,   color: metrics.semAgente > 0 ? "text-red-600" : "text-muted-foreground", bg: metrics.semAgente > 0 ? "bg-red-50 dark:bg-red-500/8" : "bg-card" },
          ].map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className={`${m.bg} border border-border/60 rounded-2xl p-3.5`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-muted-foreground font-semibold">{m.label}</p>
                  <Icon className={`h-3.5 w-3.5 ${m.color} opacity-70`} />
                </div>
                <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── DESEMPENHO POR AGENTE ── */}
      {Object.keys(metrics.byAgent).length > 0 && (
        <div className="bg-card border border-border/60 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black text-foreground">Desempenho por agente</h3>
          </div>
          <div className="space-y-3">
            {Object.values(metrics.byAgent).sort((a, b) => b.count - a.count).map((ag, i) => {
              const rate = ag.count > 0 ? (ag.resolved / ag.count) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm font-semibold text-foreground truncate">{ag.name}</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">{ag.count} tickets</span>
                    <span className="text-xs font-bold text-emerald-600">{ag.resolved} ✓</span>
                    <div className="w-24 h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${rate * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground w-8 text-right">
                      {(rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TABS: Tickets / Agentes ── */}
      <div>
        <div className="flex gap-1 border-b border-border/60 mb-4">
          {[
            { key: "tickets", label: `Tickets (${filtered.length})` },
            { key: "agents",  label: `Agentes (${agents.length})` },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveSection(tab.key as any)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
                activeSection === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── SEÇÃO TICKETS ── */}
        {activeSection === "tickets" && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar tickets..."
                  className="w-full bg-muted/40 pl-9 pr-4 py-2.5 text-sm rounded-2xl border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-muted/40 border border-border/60 rounded-2xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="todos">Todos</option>
                <option value="aberto">Abertos</option>
                <option value="em_atendimento">Em atendimento</option>
                <option value="aguardando_cliente">Aguardando cliente</option>
                <option value="resolvido">Resolvidos</option>
                <option value="fechado">Fechados</option>
              </select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(t => {
                  const st = STATUS[t.status] || STATUS.aberto;
                  const role = ROLE[t.user_role] || ROLE.cliente;
                  const RIcon = role.icon;
                  const isExp = expandedTicket === t.id;
                  return (
                    <div key={t.id} className="bg-card border border-border/60 rounded-2xl overflow-hidden">
                      <button className="w-full text-left px-4 py-3.5 flex items-center gap-3"
                        onClick={() => setExpandedTicket(isExp ? null : t.id)}>
                        <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                          <RIcon className={`h-3.5 w-3.5 ${role.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">{t.subject}</p>
                            <span className="text-[11px] text-muted-foreground">#{String(t.ticket_number).padStart(4,"0")}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {(t.profiles as any)?.full_name}
                            </span>
                            {t.agent ? (
                              <span className="text-xs font-bold text-primary">→ {(t.agent as any)?.full_name}</span>
                            ) : (
                              <span className="text-xs font-bold text-red-500">Sem agente</span>
                            )}
                            <span className="text-[11px] text-muted-foreground ml-auto">{fmtDate(t.updated_at)}</span>
                          </div>
                        </div>
                        {isExp
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                      </button>
                      {isExp && (
                        <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-1.5 bg-muted/20">
                          <p className="text-xs text-foreground/80 leading-relaxed">{t.first_message}</p>
                          <div className="flex flex-wrap gap-3 mt-2">
                            {t.stores && <span className="text-[11px] text-muted-foreground">Loja: {(t.stores as any)?.name}</span>}
                            <span className="text-[11px] text-muted-foreground">Categoria: {t.category}</span>
                            <span className="text-[11px] text-muted-foreground">Prioridade: {t.priority}</span>
                            <span className="text-[11px] text-muted-foreground">Aberto: {fmtDate(t.created_at)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum ticket encontrado</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SEÇÃO AGENTES ── */}
        {activeSection === "agents" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {agents.length === 0 ? "Nenhum agente cadastrado" : `${agents.length} agente${agents.length > 1 ? "s" : ""} ativo${agents.length > 1 ? "s" : ""}`}
              </p>
              <button onClick={() => setShowAddAgent(!showAddAgent)}
                className="flex items-center gap-2 text-sm font-bold bg-primary text-primary-foreground px-4 py-2 rounded-2xl active:scale-95 transition-transform">
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar agente
              </button>
            </div>

            {showAddAgent && (
              <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">Adicionar novo agente</p>
                <p className="text-xs text-muted-foreground">O usuário precisa ter conta na plataforma. Após adicionar, ele acessa /suporte com seu login.</p>
                <div className="flex gap-2">
                  <input value={agentEmail} onChange={e => setAgentEmail(e.target.value)}
                    placeholder="Email do usuário..."
                    onKeyDown={e => e.key === "Enter" && addAgent()}
                    className="flex-1 bg-background border border-border/60 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                  <button onClick={addAgent} disabled={addingAgent || !agentEmail.trim()}
                    className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-2xl text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2">
                    {addingAgent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Adicionar"}
                  </button>
                </div>
              </div>
            )}

            {agents.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum agente cadastrado</p>
                <p className="text-xs mt-1">Adicione agentes para atender os chamados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map((ag: any) => (
                  <div key={ag.user_id}
                    className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-4 py-3">
                    <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{ag.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{ag.email}</p>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl ${
                      ag.is_approved
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                    }`}>
                      {ag.is_approved ? "Ativo" : "Pendente"}
                    </span>
                    <button onClick={() => removeAgent(ag.user_id, ag.full_name || ag.email)}
                      className="w-8 h-8 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center transition-colors group">
                      <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportAdminPanel;
