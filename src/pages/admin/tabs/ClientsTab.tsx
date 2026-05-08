import { useState, useMemo } from "react";
import { Users, Heart, UserX, MapPinned, Search, AlertTriangle, ChevronUp, ChevronDown, Star } from "lucide-react";
import WhatsAppButton from "@/components/WhatsAppButton";
import { formatCurrency, formatBRL } from "@/lib/utils";
import { statusColors } from "../constants";

interface ClientsTabProps {
  clients: any[];
  clientFilter: string;
  setClientFilter: (f: any) => void;
  clientSearch: string;
  setClientSearch: (s: string) => void;
  store: any;
}

const ClientsTab = ({ clients, clientFilter, setClientFilter, clientSearch, setClientSearch, store }: ClientsTabProps) => {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    let list = clients;
    if (clientFilter === "loyal") list = list.filter(c => c.totalOrders >= 3);
    else if (clientFilter === "inactive") list = list.filter(c => c.daysSinceLastOrder >= 15);
    else if (clientFilter === "location") list = list.sort((a, b) => (a.neighborhood || "").localeCompare(b.neighborhood || ""));

    if (clientSearch.trim()) {
      const s = clientSearch.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(s) || 
        (c.neighborhood || "").toLowerCase().includes(s) || 
        (c.phone || "").includes(s)
      );
    }
    return list;
  }, [clients, clientFilter, clientSearch]);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: "all", label: "Todos", icon: Users },
          { key: "loyal", label: "Fiéis (3+)", icon: Heart },
          { key: "inactive", label: "Inativos 15d", icon: UserX },
          { key: "location", label: "Localização", icon: MapPinned },
        ].map(f => (
          <button key={f.key} onClick={() => setClientFilter(f.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              clientFilter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground"
            }`}>
            <f.icon className="h-3.5 w-3.5" /> {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
          placeholder="Buscar clientes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="space-y-2">
        {filteredClients.map(client => (
          <div key={client.clientId} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button onClick={() => setExpandedClient(expandedClient === client.clientId ? null : client.clientId)}
              className="w-full p-3 flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold">{client.name}</p>
                  <p className="text-[10px] text-muted-foreground">{client.neighborhood || "Sem bairro"}</p>
                </div>
              </div>
              {expandedClient === client.clientId ? <ChevronUp /> : <ChevronDown />}
            </button>
            {expandedClient === client.clientId && (
              <div className="p-3 border-t border-border bg-muted/20 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card p-2 rounded-lg text-center">
                    <p className="text-xs font-bold">{formatCurrency(client.totalSpent)}</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Gasto</p>
                  </div>
                  <div className="bg-card p-2 rounded-lg text-center">
                    <p className="text-xs font-bold">{client.totalOrders}</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Pedidos</p>
                  </div>
                  <div className="bg-card p-2 rounded-lg text-center">
                    <p className="text-xs font-bold">{client.daysSinceLastOrder}d</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Último</p>
                  </div>
                </div>
                {client.phone && (
                  <WhatsAppButton number={client.phone} label="Enviar Promoção" size="sm" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientsTab;