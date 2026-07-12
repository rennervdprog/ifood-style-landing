import { useState, useMemo } from "react";
import { MapPin, Store, X, Eye } from "lucide-react";

const CidadesTab = ({ stores }: { stores: any[] | undefined }) => {
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const PLATFORM_CITIES = ["itatinga"];

  const cityData = useMemo(() => {
    if (!stores) return [];
    const map = new Map<string, { stores: any[]; displayName: string }>();
    stores.forEach((s: any) => {
      const rawCity = s.address_city || "Itatinga";
      const key = rawCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
      if (!map.has(key)) {
        map.set(key, { stores: [], displayName: rawCity });
      }
      map.get(key)!.stores.push(s);
    });
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => b.stores.length - a.stores.length);
  }, [stores]);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-1">Cidades Cadastradas</h3>
        <p className="text-xs text-muted-foreground mb-4">{cityData.length} cidades com lojas registradas</p>
        
        <div className="space-y-3">
          {cityData.map((c) => {
            const isPlatform = PLATFORM_CITIES.includes(c.key);
            const activeStores = c.stores.filter((s: any) => s.status === "ativo").length;
            const isExpanded = expandedCity === c.key;
            return (
              <div key={c.key} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedCity(isExpanded ? null : c.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">{c.displayName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {c.stores.length} loja{c.stores.length !== 1 ? "s" : ""} • {activeStores} ativa{activeStores !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPlatform ? (
                      <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full font-bold">Plataforma</span>
                    ) : (
                      <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-bold">Cardápio Digital</span>
                    )}
                    {isExpanded ? <X className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-border p-3 space-y-2 bg-muted/30">
                    {c.stores.map((store: any) => (
                      <div key={store.id} className="flex items-center justify-between p-2 rounded-lg bg-card">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">{store.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            store.status === "ativo" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                            store.status === "analise" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                            "bg-destructive/10 text-destructive"
                          }`}>
                            {store.status === "ativo" ? "Ativa" : store.status === "analise" ? "Em Análise" : "Bloqueada"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {store.delivery_mode === "own" ? "Motoboy Próprio" : "Plataforma"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {cityData.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma loja cadastrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CidadesTab;
