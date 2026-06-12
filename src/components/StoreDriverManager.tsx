import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bike, Plus, Trash2, Search, UserCheck, UserX, Loader2, Share2, Copy, Users, Wallet, Zap, Clock } from "lucide-react";
import StoreDriverFinance from "@/components/StoreDriverFinance";

interface StoreDriverManagerProps {
  storeId: string;
}

type PaymentMode = "instantaneo" | "fim_do_dia";

const StoreDriverManager = ({ storeId }: StoreDriverManagerProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundDrivers, setFoundDrivers] = useState<{ user_id: string; full_name: string; phone: string; vehicle: string; email: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"team" | "finance">("team");
  const [paymentModeChoice, setPaymentModeChoice] = useState<Record<string, PaymentMode>>({});

  // Fetch linked drivers
  const { data: storeDrivers, isLoading } = useQuery({
    queryKey: ["store-drivers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
         .from("store_drivers")
         .select("id, driver_user_id, created_at, payment_mode, status" as any)
         .eq("store_id", storeId);
      if (error) throw error;

      // Fetch driver profiles
      if (!data?.length) return [];
      const userIds = (data as any[]).map(d => d.driver_user_id);
      const [{ data: profiles }, { data: driverRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, phone, vehicle, whatsapp_number")
          .in("user_id", userIds),
        supabase
          .from("drivers")
          .select("user_id, is_online")
          .in("user_id", userIds),
      ]);

      const { data: locRows } = await supabase
        .from("driver_locations")
        .select("driver_id, updated_at")
        .in("driver_id", userIds);

      return (data as any[]).map(sd => ({
        ...sd,
        profile: profiles?.find(p => p.user_id === sd.driver_user_id),
        is_online: !!driverRows?.find(d => d.user_id === sd.driver_user_id)?.is_online,
        last_location_at: locRows?.find((l: any) => l.driver_id === sd.driver_user_id)?.updated_at || null,
      }));
    },
    refetchInterval: 15000,
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setFoundDrivers([]);

    try {
      const { data, error } = await supabase.rpc("search_motoboy_profiles", {
        _search: searchTerm.trim(),
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Nenhum motoboy encontrado. Verifique se ele já se cadastrou como entregador.");
        return;
      }

      const filtered = (data as any[]).filter(
        d => !storeDrivers?.some(sd => sd.driver_user_id === d.user_id)
      );

      if (filtered.length === 0) {
        toast.info("Todos os motoboys encontrados já estão vinculados à sua loja.");
        return;
      }

      setFoundDrivers(filtered.map(d => ({
        user_id: d.user_id,
        full_name: d.full_name || "",
        phone: d.phone || d.whatsapp_number || "",
        vehicle: d.vehicle || "",
        email: d.email || "",
      })));
    } catch {
      toast.error("Erro ao buscar motoboy.");
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (driver: typeof foundDrivers[0]) => {
    const mode: PaymentMode = paymentModeChoice[driver.user_id] || "fim_do_dia";
    setAdding(true);
    try {
      const { error } = await supabase
        .from("store_drivers")
        .insert({ store_id: storeId, driver_user_id: driver.user_id, payment_mode: mode } as any);

      if (error) throw error;
      toast.success(`${driver.full_name} vinculado! Modo: ${mode === "instantaneo" ? "Pagamento na hora" : "Acerto fim do dia"}`);
      setFoundDrivers(prev => prev.filter(d => d.user_id !== driver.user_id));
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ["store-drivers", storeId] });
    } catch {
      toast.error("Erro ao adicionar motoboy.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remover ${name} da sua equipe?`)) return;
    try {
      const { error } = await supabase.from("store_drivers").delete().eq("id", id);
      if (error) throw error;
      toast.success(`${name} removido da equipe.`);
      queryClient.invalidateQueries({ queryKey: ["store-drivers", storeId] });
    } catch {
      toast.error("Erro ao remover motoboy.");
    }
  };

  const updatePaymentMode = async (linkId: string, mode: PaymentMode) => {
    try {
      const { error } = await supabase
        .from("store_drivers")
        .update({ payment_mode: mode } as any)
        .eq("id", linkId);
      if (error) throw error;
      toast.success("Modo de pagamento atualizado.");
      queryClient.invalidateQueries({ queryKey: ["store-drivers", storeId] });
    } catch {
      toast.error("Erro ao atualizar modo de pagamento.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bike className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Motoboys da Loja</h2>
          <p className="text-xs text-muted-foreground">Gerencie sua equipe e o financeiro</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-muted/40 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("team")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "team" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Equipe
        </button>
        <button
          onClick={() => setActiveTab("finance")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "finance" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" /> Financeiro
        </button>
      </div>

      {activeTab === "finance" ? (
        <StoreDriverFinance storeId={storeId} />
      ) : (
        <>

      <div className="bg-muted border border-border rounded-2xl p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          🏍️ Adicione motoboys que já se cadastraram na plataforma. 
          Eles poderão ver e entregar <strong>apenas os pedidos da sua loja</strong>, 
          com confirmação de entrega via código PIN do cliente.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2">
            <p className="text-[11px] text-muted-foreground truncate">https://itasuper.com.br/cadastro-motoboy-loja</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText("https://itasuper.com.br/cadastro-motoboy-loja");
              toast.success("Link copiado!");
            }}
            className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
            title="Copiar link de cadastro"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const text = "Cadastre-se como motoboy da nossa loja: https://itasuper.com.br/cadastro-motoboy-loja";
              const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
              window.open(url, "_blank");
            }}
            className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
            title="Compartilhar via WhatsApp"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* APK Parceiro download link */}
        <div className="pt-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground mb-2">
            📲 <strong>Link do app:</strong> envie para o motoboy baixar o APK Parceiro (Android).
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2">
              <p className="text-[11px] text-muted-foreground truncate">https://itasuper.com.br/download</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText("https://itasuper.com.br/download");
                toast.success("Link do app copiado!");
              }}
              className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
              title="Copiar link do app"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const text = "Baixe o app ItaSuper Parceiro para receber e entregar pedidos: https://itasuper.com.br/download";
                const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                window.open(url, "_blank");
              }}
              className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
              title="Enviar link do app via WhatsApp"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search & Add */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Adicionar Motoboy
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Nome, e-mail ou telefone"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchTerm.trim()}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </div>

        {/* Found drivers */}
        {foundDrivers.map(driver => {
          const chosen = paymentModeChoice[driver.user_id] || "fim_do_dia";
          return (
            <div key={driver.user_id} className="bg-card border border-border rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{driver.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">{driver.email || driver.phone} • {driver.vehicle || "Veículo não informado"}</p>
                  </div>
                </div>
              </div>

              {/* Payment mode chooser */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Modo de pagamento da taxa</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentModeChoice(p => ({ ...p, [driver.user_id]: "instantaneo" }))}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      chosen === "instantaneo"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <Zap className={`h-4 w-4 mb-1 ${chosen === "instantaneo" ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-[11px] font-bold text-foreground">Pagamento na hora</p>
                    <p className="text-[9px] text-muted-foreground">Você acerta a cada entrega</p>
                  </button>
                  <button
                    onClick={() => setPaymentModeChoice(p => ({ ...p, [driver.user_id]: "fim_do_dia" }))}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      chosen === "fim_do_dia"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <Clock className={`h-4 w-4 mb-1 ${chosen === "fim_do_dia" ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-[11px] font-bold text-foreground">Acerto fim do dia</p>
                    <p className="text-[9px] text-muted-foreground">Acumula e paga junto</p>
                  </button>
                </div>
              </div>

              <button
                onClick={() => handleAdd(driver)}
                disabled={adding}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Adicionar à equipe
              </button>
            </div>
          );
        })}
      </div>

      {/* Linked Drivers List */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground px-1">
          Equipe ({storeDrivers?.length || 0})
        </h3>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (!storeDrivers || storeDrivers.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <UserX className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">Nenhum motoboy vinculado</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Busque pelo telefone de um motoboy cadastrado na plataforma para adicioná-lo à sua equipe.
            </p>
          </div>
        )}

        {storeDrivers?.map(sd => (
           <div key={sd.id} className={`bg-card border rounded-xl p-3 space-y-3 ${sd.status === 'rejected' ? 'opacity-50' : ''} ${sd.status === 'pending' ? 'border-border bg-muted' : 'border-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bike className="h-4 w-4 text-primary" />
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                      sd.is_online ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
                    }`}
                    title={sd.is_online ? "Online" : "Offline"}
                  />
                </div>
                <div>
                   <div className="flex flex-col">
                     <p className="text-sm font-bold text-foreground flex items-center gap-2">
                       {sd.profile?.full_name || "Motoboy"}
                       <span
                         className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                           sd.is_online
                             ? "bg-primary/15 text-primary"
                             : "bg-muted text-muted-foreground"
                         }`}
                       >
                         {sd.is_online ? "ONLINE" : "OFFLINE"}
                       </span>
                     </p>
                     {sd.status === 'pending' && (
                       <span className="text-[10px] font-black text-muted-foreground uppercase">Aguardando Aceite</span>
                     )}
                     {sd.status === 'rejected' && (
                       <span className="text-[10px] font-black text-destructive uppercase">Recusou Convite</span>
                     )}
                   </div>
                  <p className="text-[11px] text-muted-foreground">
                    {sd.profile?.phone || sd.profile?.whatsapp_number || "Sem telefone"} • {sd.profile?.vehicle || "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(sd.id, sd.profile?.full_name || "Motoboy")}
                className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Payment mode toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updatePaymentMode(sd.id, "instantaneo")}
                className={`p-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                  sd.payment_mode === "instantaneo"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="h-3 w-3" /> Na hora
              </button>
              <button
                onClick={() => updatePaymentMode(sd.id, "fim_do_dia")}
                className={`p-2 rounded-lg border text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                  (sd.payment_mode || "fim_do_dia") === "fim_do_dia"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3 w-3" /> Fim do dia
              </button>
            </div>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
};

export default StoreDriverManager;
