/**
 * SupportAdminPanel — Aba de Suporte no SuperAdmin
 * Ver todos os tickets, métricas, gerenciar agentes, registrar quem atendeu o quê.
 */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MessageCircle, User, Store, Bike, Clock, CheckCircle2,
  AlertTriangle, Loader2, Search, UserPlus, X, TrendingUp,
  BarChart3, Users,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aberto:             { label: "Aberto",             color: "text-blue-500",    bg: "bg-blue-500/10" },
  em_atendimento:     { label: "Em atendimento",     color: "text-amber-500",   bg: "bg-amber-500/10" },
  aguardando_cliente: { label: "Aguardando cliente", color: "text-purple-500",  bg: "bg-purple-500/10" },
  resolvido:          { label: "Resolvido",          color: "text-emerald-500", bg: "bg-emerald-500/10" },
  fechado:            { label: "Fechado",            color: "text-muted-foreground", bg: "bg-muted/40" },
};

const ROLE_ICON: Record<string, any> = { cliente: User, lojista: Store, motoboy: Bike };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });

const SupportAdminPanel = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [agentEmail, setAgentEmail] = useState("");
  const [addingAgent, setAddingAgent] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  // ── Todos os tickets ──
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("support_tickets")
        .select(`
          id, ticket_number, subject, status, priority, category, user_role,
          created_at, updated_at, first_message, agent_id, resolved_at,
          profiles!support_tickets_user_id_fkey(full_name, email),
          agent:profiles!support_tickets_agent_id_fkey(full_name),
          stores(name)
        `)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      const { data } = await q;
      return (data || []) as any[];
    },
    refetchInterval: 30_000,
  });

  // ── Agentes de suporte ──
  const { data: agents = [], refetch: refetchAgents } = useQuery({
    queryKey: ["support-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, is_approved, created_at")
        .eq("role", "suporte" as any)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  // ── Métricas ──
  const metrics = useMemo(() => {
    const total = tickets.length;
    const abertos = tickets.filter(t => t.status === "aberto").length;
    const emAtendimento = tickets.filter(t => t.status === "em_atendimento").length;
    const resolvidos = tickets.filter(t => t.status === "resolvido").length;
    const semAgente = tickets.filter(t => !t.agent_id && t.status !== "fechado").length;

    // Tempo médio de resolução (em horas)
    const resolvedWithTime = tickets.filter(t => t.resolved_at && t.created_at);
    const avgResolveH = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((s, t) => s + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000, 0) / resolvedWithTime.length
      : 0;

    // Por agente
    const byAgent: Record<string, { name: string; count: number; resolved: number }> = {};
    tickets.forEach(t => {
      if (t.agent_id && t.agent) {
        const name = (t.agent as any)?.full_name || "Agente";
        if (!byAgent[t.agent_id]) byAgent[t.agent_id] = { name, count: 0, resolved: 0 };
        byAgent[t.agent_id].count++;
        if (t.status === "resolvido" || t.status === "fechado") byAgent[t.agent_id].resolved++;
      }
    });

    return { total, abertos, emAtendimento, resolvidos, semAgente, avgResolveH, byAgent };
  }, [tickets]);

  // ── Filtro de busca ──
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

  // ── Adicionar agente ──
  const addAgent = async () => {
    if (!agentEmail.trim()) return;
    setAddingAgent(true);
    try {
      // Buscar profile pelo email
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name, role")
        .eq("email", agentEmail.trim().toLowerCase())
        .maybeSingle();

      if (!profile) {
        toast.error("Usuário não encontrado. Ele precisa estar cadastrado na plataforma.");
        return;
      }

      // Atualizar role para suporte
      const { error } = await supabase
        .from("profiles")
        .update({ role: "suporte" as any, is_approved: true })
        .eq("user_id", profile.user_id);

      if (error) throw error;

      toast.success(`${profile.full_name || agentEmail} agora é agente de suporte.`);
      setAgentEmail("");
      setShowAddAgent(false);
      refetchAgents();
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar agente");
    } finally {
      setAddingAgent(false);
    }
  };

  // ── Remover agente ──
  const removeAgent = async (userId: string, name: string) => {
    await supabase.from("profiles").update({ role: "cliente" as any }).eq("user_id", userId);
    toast.success(`${name} removido dos agentes.`);
    refetchAgents();
  };

  return (
    <div className="space-y-5 p-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total",         value: metrics.total,          color: "text-foreground" },
          { label: "Abertos",       value: metrics.abertos,        color: "text-blue-500" },
          { label: "Em atendimento",value: metrics.emAtendimento,  color: "text-amber-500" },
          { label: "Resolvidos",    value: metrics.resolvidos,     color: "text-emerald-500" },
          { label: "Sem agente",    value: metrics.semAgente,      color: metrics.semAgente > 0 ? "text-red-500" : "text-muted-foreground" },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border/50 rounded-2xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">{m.label}</p>
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>
      {metrics.avgResolveH > 0 && (
        <p className="text-xs text-muted-foreground">
          ⏱ Tempo médio de resolução: <strong>{metrics.avgResolveH.toFixed(1)}h</strong>
        </p>
      )}

      {/* Desempenho por agente */}
      {Object.keys(metrics.byAgent).length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <p className="text-xs font-black text-foreground mb-3 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-primary" /> Desempenho por agente
          </p>
          <div className="space-y-2">
            {Object.values(metrics.byAgent).sort((a,b) => b.count - a.count).map((ag, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-primary">{i+1}</span>
                </div>
                <p className="flex-1 text-xs font-semibold text-foreground">{ag.name}</p>
                <span className="text-[11px] text-muted-foreground">{ag.count} total</span>
                <span className="text-[11px] text-emerald-500 font-bold">{ag.resolved} resolvidos</span>
                <div className="w-20 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/70 rounded-full"
                    style={{ width: ag.count > 0 ? `${(ag.resolved/ag.count)*100}%` : "0%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestão de agentes */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" /> Agentes de Suporte ({agents.length})
          </p>
          <button onClick={() => setShowAddAgent(!showAddAgent)}
            className="flex items-center gap-1.5 text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg active:scale-95 transition-transform">
            <UserPlus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>

        {showAddAgent && (
          <div className="flex gap-2 mb-3">
            <input
              value={agentEmail}
              onChange={e => setAgentEmail(e.target.value)}
              placeholder="Email do usuário cadastrado..."
              className="flex-1 bg-muted/40 border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={e => e.key === "Enter" && addAgent()}
            />
            <button onClick={addAgent} disabled={addingAgent}
              className="bg-primary text-primary-foreground text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
              {addingAgent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Adicionar"}
            </button>
          </div>
        )}

        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum agente cadastrado</p>
        ) : (
          <div className="space-y-2">
            {agents.map((ag: any) => (
              <div key={ag.user_id} className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{ag.full_name || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{ag.email}</p>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ag.is_approved ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                  {ag.is_approved ? "Ativo" : "Pendente"}
                </span>
                <button onClick={() => removeAgent(ag.user_id, ag.full_name || ag.email)}
                  className="w-6 h-6 rounded-lg hover:bg-red-500/10 flex items-center justify-center">
                  <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista completa de tickets */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..." className="w-full bg-muted/40 pl-8 pr-3 py-2 text-xs rounded-xl border border-border/50 focus:outline-none" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-muted/40 border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none">
            <option value="todos">Todos os status</option>
            <option value="aberto">Abertos</option>
            <option value="em_atendimento">Em atendimento</option>
            <option value="aguardando_cliente">Aguardando cliente</option>
            <option value="resolvido">Resolvidos</option>
            <option value="fechado">Fechados</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => {
              const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.aberto;
              const RoleIcon = ROLE_ICON[t.user_role] || User;
              const isExp = expandedTicket === t.id;
              return (
                <div key={t.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                  <button className="w-full text-left px-4 py-3 flex items-start gap-3"
                    onClick={() => setExpandedTicket(isExp ? null : t.id)}>
                    <RoleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-foreground">{t.subject}</p>
                        <span className="text-[10px] text-muted-foreground">#{String(t.ticket_number).padStart(4,"0")}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {(t.profiles as any)?.full_name || "Usuário"} · {(t.profiles as any)?.email}
                        </span>
                        {t.agent ? (
                          <span className="text-[11px] text-primary font-bold">→ {(t.agent as any)?.full_name}</span>
                        ) : (
                          <span className="text-[11px] text-red-400 font-bold">Sem agente</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(t.updated_at)}</span>
                      </div>
                    </div>
                  </button>
                  {isExp && (
                    <div className="px-4 pb-3 border-t border-border/30 pt-2">
                      <p className="text-xs text-muted-foreground">{t.first_message}</p>
                      {t.stores && (
                        <p className="text-[11px] text-muted-foreground mt-1">Loja: {(t.stores as any)?.name}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">Categoria: {t.category} · Prioridade: {t.priority}</p>
                      <p className="text-[11px] text-muted-foreground">Aberto em: {formatDate(t.created_at)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportAdminPanel;
