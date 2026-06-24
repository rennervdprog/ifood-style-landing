import { memo } from "react";
import {
  Users, Heart, UserX, MapPinned, Search, AlertTriangle, ChevronUp, ChevronDown, Star,
  Sparkles, Repeat, Crown, Clock, TrendingUp, Calendar, Download, ArrowUpDown,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import WhatsAppButton from "@/components/WhatsAppButton";
import { statusColors } from "../constants";

export type ClientFilter =
  | "all" | "new" | "weekly" | "vip" | "atrisk"
  | "inactive30" | "inactive45" | "inactive60" | "highticket" | "location";
export type ClientSort = "orders" | "spent" | "recent" | "inactive";

const SEGMENT_BADGE: Record<string, { label: string; cls: string }> = {
  vip:      { label: "VIP",       cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  weekly:   { label: "Semanal",   cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  new:      { label: "Novo",      cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  atrisk:   { label: "Em risco",  cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  inactive: { label: "Inativo",   cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
  active:   { label: "Ativo",     cls: "bg-muted text-muted-foreground" },
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", credito: "Crédito", debito: "Débito",
  cartao: "Cartão", vr: "VR", va: "VA",
};

const buildCampaignMessage = (client: any, storeName: string): string => {
  const first = (client.name || "").split(" ")[0] || "amigo(a)";
  switch (client.segment) {
    case "inactive":
      return `Oi ${first}! Sentimos sua falta no ${storeName} 😢 Que tal voltar com 15% OFF no seu próximo pedido? 🎁`;
    case "atrisk":
      return `Oi ${first}! Faz um tempo que você não pede no ${storeName}. Preparamos algo especial pra você hoje! 🍔`;
    case "vip":
    case "weekly":
      return `Oi ${first}! Obrigado por ser cliente fiel do ${storeName} 💛 Tem um brinde te esperando no próximo pedido!`;
    case "new":
      return `Oi ${first}! Que bom te ter como cliente do ${storeName} 🎉 Tem novidades no cardápio, dá uma olhada!`;
    default:
      return `Oi ${first}! Novidades no ${storeName} 🍔 Dá uma olhada no cardápio!`;
  }
};

const exportClientsCSV = (clients: any[], storeName: string) => {
  const header = ["Nome", "Telefone", "Bairro", "Pedidos", "Total Gasto", "Ticket Médio", "Último pedido (dias)", "Segmento"];
  const rows = clients.map(c => [
    c.name, c.phone || "", c.neighborhood || "", c.totalOrders,
    c.totalSpent.toFixed(2).replace(".", ","),
    c.ticketMedio.toFixed(2).replace(".", ","),
    c.daysSinceLastOrder,
    SEGMENT_BADGE[c.segment]?.label || c.segment,
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-${storeName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

interface ClientsTabProps {
  clientFilter: ClientFilter;
  setClientFilter: (f: ClientFilter) => void;
  clientSearch: string;
  setClientSearch: (s: string) => void;
  filteredClients: any[];
  expandedClient: string | null;
  setExpandedClient: (id: string | null) => void;
  storeName?: string;
  clientCounts?: {
    total: number; new: number; weekly: number; vip: number;
    atrisk: number; inactive30: number; inactive45: number; inactive60: number; highticket: number;
  };
  clientSort?: ClientSort;
  setClientSort?: (s: ClientSort) => void;
}

const ClientsTabImpl = ({
  clientFilter, setClientFilter, clientSearch, setClientSearch,
  filteredClients, expandedClient, setExpandedClient, storeName,
  clientCounts, clientSort = "orders", setClientSort,
}: ClientsTabProps) => {
  const counts = clientCounts || { total: 0, new: 0, weekly: 0, vip: 0, atrisk: 0, inactive30: 0, inactive45: 0, inactive60: 0, highticket: 0 };
  const totalInactive = counts.inactive30 + counts.inactive45 + counts.inactive60;

  const metricCards = [
    { key: "all" as ClientFilter,     label: "Total",       value: counts.total,    icon: Users,    cls: "from-primary/15 to-primary/5 text-primary" },
    { key: "weekly" as ClientFilter,  label: "Semanais",    value: counts.weekly,   icon: Repeat,   cls: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400" },
    { key: "atrisk" as ClientFilter,  label: "Em risco",    value: counts.atrisk,   icon: Clock,    cls: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400" },
    { key: "inactive30" as ClientFilter, label: "Inativos", value: totalInactive,   icon: UserX,    cls: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400" },
  ];

  const chips: { key: ClientFilter; label: string; icon: any; count?: number }[] = [
    { key: "all",        label: "Todos",         icon: Users,    count: counts.total },
    { key: "vip",        label: "VIP",           icon: Crown,    count: counts.vip },
    { key: "weekly",     label: "Semanais",      icon: Repeat,   count: counts.weekly },
    { key: "new",        label: "Novos 30d",     icon: Sparkles, count: counts.new },
    { key: "atrisk",     label: "Em risco 15-30d", icon: Clock,  count: counts.atrisk },
    { key: "inactive30", label: "Inativos 30d",  icon: UserX,    count: counts.inactive30 },
    { key: "inactive45", label: "Inativos 45d",  icon: UserX,    count: counts.inactive45 },
    { key: "inactive60", label: "Inativos 60d+", icon: UserX,    count: counts.inactive60 },
    { key: "highticket", label: "Alto ticket",   icon: TrendingUp, count: counts.highticket },
    { key: "location",   label: "Por bairro",    icon: MapPinned },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-3">
      {/* Mini-cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {metricCards.map(m => (
          <button key={m.key} onClick={() => setClientFilter(m.key)}
            className={`bg-gradient-to-br ${m.cls} border border-border rounded-2xl p-3 text-left transition-all hover:shadow-md ${
              clientFilter === m.key ? "ring-2 ring-primary/60" : ""
            }`}>
            <div className="flex items-center justify-between mb-1">
              <m.icon className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase opacity-70">{m.label}</span>
            </div>
            <p className="text-2xl font-black text-foreground">{m.value}</p>
          </button>
        ))}
      </div>

      {/* Chips de segmento */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {chips.map(f => (
          <button key={f.key} onClick={() => setClientFilter(f.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              clientFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}>
            <f.icon className="h-3.5 w-3.5" /> {f.label}
            {typeof f.count === "number" && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                clientFilter === f.key ? "bg-primary-foreground/20" : "bg-muted"
              }`}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Busca + ordenação + export */}
      <div className="flex gap-2 items-stretch">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
            placeholder="Buscar nome, bairro, telefone..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        {setClientSort && (
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <select value={clientSort} onChange={e => setClientSort(e.target.value as ClientSort)}
              className="appearance-none pl-8 pr-7 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="orders">Mais pedidos</option>
              <option value="spent">Maior gasto</option>
              <option value="recent">Mais recente</option>
              <option value="inactive">Mais inativo</option>
            </select>
          </div>
        )}
        <button onClick={() => exportClientsCSV(filteredClients, storeName || "loja")}
          disabled={filteredClients.length === 0}
          title="Exportar CSV"
          className="px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      {(clientFilter === "inactive30" || clientFilter === "inactive45" || clientFilter === "inactive60") && filteredClients.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            <span className="font-bold">{filteredClients.length} clientes</span> sem pedidos —
            envie uma campanha de reativação com cupom no WhatsApp.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-bold">
              {clientFilter === "atrisk" ? "Nenhum cliente em risco — bom trabalho!" :
               clientFilter === "inactive30" || clientFilter === "inactive45" || clientFilter === "inactive60" ? "Nenhum cliente inativo neste período" :
               "Nenhum cliente encontrado"}
            </p>
          </div>
        ) : filteredClients.map(client => (
          <div key={client.clientId} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button onClick={() => setExpandedClient(expandedClient === client.clientId ? null : client.clientId)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{client.name}</p>
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">{client.totalOrders}</span>
                    {(() => {
                      const b = SEGMENT_BADGE[client.segment] || SEGMENT_BADGE.active;
                      return (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${b.cls}`}>
                          {b.label}
                        </span>
                      );
                    })()}
                    {client.isHighTicket && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        Alto ticket
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>{client.daysSinceLastOrder === 0 ? "Hoje" : `${client.daysSinceLastOrder}d atrás`}</span>
                    <span>•</span>
                    <span>{client.neighborhood || "—"}</span>
                    {client.ordersLast30 > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{client.ordersLast30}/30d</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedClient === client.clientId ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {expandedClient === client.clientId && (
              <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                    <p className="text-sm font-black text-foreground">{formatCurrency(client.totalSpent)}</p>
                    <p className="text-[10px] text-muted-foreground">LTV</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                    <p className="text-sm font-black text-foreground">{formatCurrency(client.ticketMedio)}</p>
                    <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      <p className="text-xs font-black text-foreground truncate">{client.favProduct}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Favorito</p>
                  </div>
                </div>

                {/* Insights extras */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {client.avgFrequencyDays > 0 && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Frequência</p>
                      <p className="font-bold text-foreground">a cada {client.avgFrequencyDays}d</p>
                    </div>
                  )}
                  {client.nextOrderInDays !== null && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Próxima compra</p>
                      <p className={`font-bold ${client.nextOrderInDays < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                        {client.nextOrderInDays < 0 ? `Atrasada ${Math.abs(client.nextOrderInDays)}d` :
                         client.nextOrderInDays === 0 ? "Hoje" : `em ${client.nextOrderInDays}d`}
                      </p>
                    </div>
                  )}
                  {client.preferredPayment && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Pagamento preferido</p>
                      <p className="font-bold text-foreground">{PAYMENT_LABELS[client.preferredPayment] || client.preferredPayment}</p>
                    </div>
                  )}
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Cliente desde</p>
                    <p className="font-bold text-foreground">{client.daysSinceFirstOrder}d</p>
                  </div>
                  {client.cancelRate > 0 && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2 col-span-2">
                      <p className="text-[10px] text-muted-foreground">Taxa de cancelamento</p>
                      <p className={`font-bold ${client.cancelRate > 20 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                        {client.cancelRate.toFixed(0)}%
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">Últimos Pedidos</p>
                  <div className="space-y-1.5">
                    {client.orders.slice(0, 5).map((order: any) => {
                      const sc = statusColors[order.status] || statusColors.pendente;
                      return (
                        <div key={order.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                              {sc.label}
                            </span>
                            <span className="text-foreground font-medium">#{order.id.slice(0, 6).toUpperCase()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                            <span className="font-bold text-foreground">{formatBRL(Number(order.total_price))}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {client.phone && (
                  <div className="flex gap-2">
                    <WhatsAppButton
                      number={client.phone}
                      message={buildCampaignMessage(client, storeName || "nossa loja")}
                      label={
                        client.segment === "inactive" ? "Reativar c/ cupom" :
                        client.segment === "atrisk" ? "Reengajar" :
                        client.segment === "vip" || client.segment === "weekly" ? "Agradecer" :
                        client.segment === "new" ? "Boas-vindas" : "Mensagem"
                      }
                      size="sm"
                    />
                    <WhatsAppButton number={client.phone}
                      message={`Olá ${client.name}! Novidades no ${storeName}! 🍔`}
                      label="Promoção" size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ClientsTab = memo(ClientsTabImpl);
export default ClientsTab;