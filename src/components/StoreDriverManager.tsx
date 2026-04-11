import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bike, Plus, Trash2, Search, UserCheck, UserX, Loader2 } from "lucide-react";

interface StoreDriverManagerProps {
  storeId: string;
}

const StoreDriverManager = ({ storeId }: StoreDriverManagerProps) => {
  const queryClient = useQueryClient();
  const [searchPhone, setSearchPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundDriver, setFoundDriver] = useState<{ user_id: string; full_name: string; phone: string; vehicle: string } | null>(null);
  const [adding, setAdding] = useState(false);

  // Fetch linked drivers
  const { data: storeDrivers, isLoading } = useQuery({
    queryKey: ["store-drivers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_drivers")
        .select("id, driver_user_id, created_at")
        .eq("store_id", storeId);
      if (error) throw error;

      // Fetch driver profiles
      if (!data?.length) return [];
      const userIds = data.map(d => d.driver_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, vehicle, whatsapp_number")
        .in("user_id", userIds);

      return data.map(sd => ({
        ...sd,
        profile: profiles?.find(p => p.user_id === sd.driver_user_id),
      }));
    },
  });

  const handleSearch = async () => {
    if (!searchPhone.trim()) return;
    setSearching(true);
    setFoundDriver(null);

    try {
      // Search for a driver profile by phone/whatsapp
      const cleanPhone = searchPhone.replace(/\D/g, "");
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, vehicle, whatsapp_number, role")
        .eq("role", "motoboy");

      const match = profiles?.find(p => {
        const pPhone = (p.phone || "").replace(/\D/g, "");
        const pWhatsapp = (p.whatsapp_number || "").replace(/\D/g, "");
        return pPhone.includes(cleanPhone) || pWhatsapp.includes(cleanPhone) || cleanPhone.includes(pPhone) || cleanPhone.includes(pWhatsapp);
      });

      if (match) {
        // Check if already linked
        const alreadyLinked = storeDrivers?.some(sd => sd.driver_user_id === match.user_id);
        if (alreadyLinked) {
          toast.info("Este motoboy já está vinculado à sua loja.");
        } else {
          setFoundDriver({
            user_id: match.user_id,
            full_name: match.full_name,
            phone: match.phone || match.whatsapp_number || "",
            vehicle: match.vehicle || "",
          });
        }
      } else {
        toast.error("Nenhum motoboy encontrado com esse telefone. Verifique se ele já se cadastrou como entregador na plataforma.");
      }
    } catch {
      toast.error("Erro ao buscar motoboy.");
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!foundDriver) return;
    setAdding(true);
    try {
      const { error } = await supabase
        .from("store_drivers")
        .insert({ store_id: storeId, driver_user_id: foundDriver.user_id });

      if (error) throw error;
      toast.success(`${foundDriver.full_name} vinculado à sua loja!`);
      setFoundDriver(null);
      setSearchPhone("");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bike className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Motoboys da Loja</h2>
          <p className="text-xs text-muted-foreground">Gerencie seus entregadores próprios</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
        <p className="text-xs text-muted-foreground">
          🏍️ Adicione motoboys que já se cadastraram na plataforma como entregador. 
          Eles poderão ver e entregar <strong>apenas os pedidos da sua loja</strong>, 
          com confirmação de entrega via código PIN do cliente.
        </p>
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
              type="tel"
              placeholder="Telefone ou WhatsApp do motoboy"
              value={searchPhone}
              onChange={e => setSearchPhone(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchPhone.trim()}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </div>

        {/* Found driver card */}
        {foundDriver && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{foundDriver.full_name}</p>
                <p className="text-[11px] text-muted-foreground">{foundDriver.phone} • {foundDriver.vehicle || "Veículo não informado"}</p>
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1"
            >
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Adicionar
            </button>
          </div>
        )}
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
          <div key={sd.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bike className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{sd.profile?.full_name || "Motoboy"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {sd.profile?.phone || sd.profile?.whatsapp_number || "Sem telefone"} • {sd.profile?.vehicle || "—"}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleRemove(sd.id, sd.profile?.full_name || "Motoboy")}
              className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoreDriverManager;
