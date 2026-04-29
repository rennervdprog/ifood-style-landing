import React, { useState } from "react";
import { Users, Heart, UserX, MapPinned, Search, ChevronUp, ChevronDown, Star } from "lucide-react";
import { useAdmin } from "../AdminContext";
import { formatBRL } from "@/lib/utils";
import WhatsAppButton from "@/components/WhatsAppButton";
import { statusColors } from "@/lib/orderStatus";

const ClientsTab = () => {
  const { clientAnalytics, store } = useAdmin();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const filteredClients = clientAnalytics.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                         (c.neighborhood || "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "loyal") return c.totalOrders >= 3;
    if (filter === "inactive") return c.daysSinceLastOrder >= 15;
    return true;
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: "all", label: "Todos", icon: Users },
          { key: "loyal", label: "Fiéis (3+)", icon: Heart },
          { key: "inactive", label: "Inativos 15d+", icon: UserX },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filter === f.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground"
            }`}>
            <f.icon className="h-3.5 w-3.5" /> {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar clientes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="space-y-2">
        {filteredClients.map(client => (
          <div key={client.clientId} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button onClick={() => setExpandedClient(expandedClient === client.clientId ? null : client.clientId)}
              className="w-full p-3 flex items-center justify-between hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{client.name}</p>
                  <p className="text-[10px] text-muted-foreground">{client.totalOrders} pedidos • {client.neighborhood || "—"}</p>
                </div>
              </div>
              {expandedClient === client.clientId ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {expandedClient === client.clientId && (
              <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-muted/50 rounded-xl p-2.5">
                    <p className="text-sm font-black text-foreground">{formatBRL(client.totalSpent)}</p>
                    <p className="text-[10px] text-muted-foreground">Total Gasto</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-2.5">
                    <p className="text-sm font-black text-foreground">{formatBRL(client.ticketMedio)}</p>
                    <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
                  </div>
                </div>
                {client.phone && (
                  <WhatsAppButton number={client.phone} message={`Olá ${client.name}! Temos novidades no ${store?.name}! 🍔`} label="Enviar Promoção" size="sm" />
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
