import { memo } from "react";
import { Users, Heart, UserX, MapPinned, Search, AlertTriangle, ChevronUp, ChevronDown, Star } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import WhatsAppButton from "@/components/WhatsAppButton";
import { statusColors } from "../constants";

export type ClientFilter = "all" | "loyal" | "inactive" | "location";

interface ClientsTabProps {
  clientFilter: ClientFilter;
  setClientFilter: (f: ClientFilter) => void;
  clientSearch: string;
  setClientSearch: (s: string) => void;
  filteredClients: any[];
  expandedClient: string | null;
  setExpandedClient: (id: string | null) => void;
  storeName?: string;
}

const ClientsTabImpl = ({
  clientFilter, setClientFilter, clientSearch, setClientSearch,
  filteredClients, expandedClient, setExpandedClient, storeName,
}: ClientsTabProps) => {
  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {([
          { key: "all" as ClientFilter, label: "Todos", icon: Users },
          { key: "loyal" as ClientFilter, label: "Fiéis (3+)", icon: Heart },
          { key: "inactive" as ClientFilter, label: "Inativos 15d", icon: UserX },
          { key: "location" as ClientFilter, label: "Localização", icon: MapPinned },
        ]).map(f => (
          <button key={f.key} onClick={() => setClientFilter(f.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              clientFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}>
            <f.icon className="h-3.5 w-3.5" /> {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
          placeholder="Buscar por nome, bairro ou telefone..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      {clientFilter === "inactive" && filteredClients.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            <span className="font-bold">{filteredClients.length} clientes</span> sem pedidos há 15+ dias
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-bold">Nenhum cliente encontrado</p>
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
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>{client.daysSinceLastOrder === 0 ? "Hoje" : `${client.daysSinceLastOrder}d atrás`}</span>
                    <span>•</span>
                    <span>{client.neighborhood || "—"}</span>
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
                    <p className="text-[10px] text-muted-foreground">Total Gasto</p>
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
                    <WhatsAppButton number={client.phone}
                      message={`Olá ${client.name}! Temos novidades no ${storeName}! 🍔`}
                      label="Promoção" size="sm" />
                    <WhatsAppButton number={client.phone}
                      message={`Olá ${client.name}! Sentimos sua falta no ${storeName}! 😊 Que tal pedir algo hoje?`}
                      label="Reativar" size="sm" />
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