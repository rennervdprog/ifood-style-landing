import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bike,
  Plus,
  Trash2,
  Search,
  UserCheck,
  UserX,
  Loader2,
  Share2,
  Copy,
  Users,
  Wallet,
  Zap,
  Clock,
  Info,
  Smartphone,
  UserPlus,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Send,
  AlertTriangle,
} from "lucide-react";
import StoreDriverFinance from "@/components/StoreDriverFinance";

interface StoreDriverManagerProps {
  storeId: string;
}

type PaymentMode = "instantaneo" | "fim_do_dia";
type DriverTab = "team" | "directory" | "invites" | "finance";

type ManualDriver = {
  user_id: string;
  full_name: string;
  phone: string;
  vehicle: string;
  email: string;
};

type DirectoryDriver = {
  user_id: string;
  full_name: string;
  city: string;
  vehicle: string;
  phone: string;
};

const StoreDriverManager = ({ storeId }: StoreDriverManagerProps) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DriverTab>("team");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundDrivers, setFoundDrivers] = useState<ManualDriver[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directorySearching, setDirectorySearching] = useState(false);
  const [directoryDrivers, setDirectoryDrivers] = useState<DirectoryDriver[]>([]);
  const [adding, setAdding] = useState(false);
  const [paymentModeChoice, setPaymentModeChoice] = useState<Record<string, PaymentMode>>({});

  const { data: storeLocation } = useQuery({
    queryKey: ["store-driver-directory-city", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("address_city")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data as { address_city?: string | null } | null;
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: storeDrivers, isLoading } = useQuery({
    queryKey: ["store-drivers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_drivers")
        .select("id, driver_user_id, created_at, payment_mode, status" as any)
        .eq("store_id", storeId);
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = (data as any[]).map((driver) => driver.driver_user_id);
      const [{ data: profiles }, { data: driverRows }, { data: locationRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, phone, vehicle, whatsapp_number")
          .in("user_id", userIds),
        supabase
          .from("drivers")
          .select("user_id, is_online")
          .in("user_id", userIds),
        supabase
          .from("driver_locations")
          .select("driver_user_id, updated_at")
          .in("driver_user_id", userIds),
      ]);

      return (data as any[]).map((link) => ({
        ...link,
        profile: profiles?.find((profile) => profile.user_id === link.driver_user_id),
        is_online: !!driverRows?.find((driver) => driver.user_id === link.driver_user_id)?.is_online,
        last_location_at: (locationRows as any[] | null)?.find(
          (location) => location.driver_user_id === link.driver_user_id,
        )?.updated_at || null,
      }));
    },
    refetchInterval: 15000,
  });

  const driverIds = (storeDrivers || []).map((driver: any) => driver.driver_user_id);
  const { data: deliveryStats } = useQuery({
    queryKey: ["store-driver-delivery-stats", storeId, driverIds.join(",")],
    enabled: driverIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_driver_earnings" as any)
        .select("driver_user_id, driver_amount, status, created_at")
        .eq("store_id", storeId)
        .in("driver_user_id", driverIds);
      if (error) throw error;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const stats: Record<string, { total: number; today: number; pending: number; pendingAmount: number; totalAmount: number }> = {};
      (data as any[] || []).forEach((earning) => {
        const key = earning.driver_user_id;
        if (!stats[key]) stats[key] = { total: 0, today: 0, pending: 0, pendingAmount: 0, totalAmount: 0 };
        stats[key].total += 1;
        stats[key].totalAmount += Number(earning.driver_amount || 0);
        if (new Date(earning.created_at).getTime() >= startOfToday) stats[key].today += 1;
        if (earning.status !== "pago") {
          stats[key].pending += 1;
          stats[key].pendingAmount += Number(earning.driver_amount || 0);
        }
      });
      return stats;
    },
    refetchInterval: 30000,
  });

  const linkedDrivers = storeDrivers || [];
  const cityName = storeLocation?.address_city || "sua cidade";
  const pendingInvites = useMemo(
    () => linkedDrivers.filter((driver: any) => driver.status === "pending"),
    [linkedDrivers],
  );
  const onlineDrivers = useMemo(
    () => linkedDrivers.filter((driver: any) => driver.status !== "rejected" && driver.is_online),
    [linkedDrivers],
  );
  const hasOperationalDriver = onlineDrivers.length > 0;

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
        (driver) => !linkedDrivers.some((linked: any) => linked.driver_user_id === driver.user_id),
      );
      if (filtered.length === 0) {
        toast.info("Todos os motoboys encontrados já estão vinculados à sua loja.");
        return;
      }

      setFoundDrivers(
        filtered.map((driver) => ({
          user_id: driver.user_id,
          full_name: driver.full_name || "",
          phone: driver.phone || driver.whatsapp_number || "",
          vehicle: driver.vehicle || "",
          email: driver.email || "",
        })),
      );
    } catch {
      toast.error("Erro ao buscar motoboy.");
    } finally {
      setSearching(false);
    }
  };

  const handleDirectorySearch = async () => {
    setDirectorySearching(true);
    setDirectoryDrivers([]);
    try {
      const { data, error } = await supabase.rpc("list_store_city_opt_in_drivers" as any, {
        _store_id: storeId,
        _search: directorySearch.trim() || null,
      } as any);
      if (error) throw error;

      const candidates = ((data as any[]) || [])
        .filter((driver) => !linkedDrivers.some((linked: any) => linked.driver_user_id === driver.user_id))
        .map((driver) => ({
          user_id: driver.user_id,
          full_name: driver.full_name || "Motoboy",
          city: driver.city || cityName,
          vehicle: driver.vehicle || "Veículo não informado",
          phone: driver.whatsapp_number || "",
        }));
      setDirectoryDrivers(candidates);
      if (candidates.length === 0) {
        toast.info("Nenhum motoboy com contato autorizado foi encontrado para esta cidade.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível consultar a base de motoboys.");
    } finally {
      setDirectorySearching(false);
    }
  };

  const handleAdd = async (driver: ManualDriver) => {
    const mode: PaymentMode = paymentModeChoice[driver.user_id] || "fim_do_dia";
    setAdding(true);
    try {
      const { error } = await supabase
        .from("store_drivers")
        .insert({ store_id: storeId, driver_user_id: driver.user_id, payment_mode: mode } as any);
      if (error) throw error;
      toast.success(`${driver.full_name} vinculado! Modo: ${mode === "instantaneo" ? "Pagamento na hora" : "Acerto fim do dia"}`);
      setFoundDrivers((current) => current.filter((candidate) => candidate.user_id !== driver.user_id));
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

  const copyDriverRegistration = () => {
    navigator.clipboard.writeText("https://itasuper.com.br/cadastro-motoboy-loja");
    toast.success("Link de cadastro copiado!");
  };

  const shareDriverRegistration = () => {
    const message = "Cadastre-se como motoboy da nossa loja: https://itasuper.com.br/cadastro-motoboy-loja";
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const copyDriverApp = () => {
    navigator.clipboard.writeText("https://itasuper.com.br/download");
    toast.success("Link do app copiado!");
  };

  const shareDriverApp = () => {
    const message = "Baixe o app ItaSuper Parceiro para receber e entregar pedidos: https://itasuper.com.br/download";
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const tabClass = (tab: DriverTab) =>
    `whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-bold transition-colors ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-6 pb-4">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Operação / Entregas</p>
          <div className="mt-1 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground">Motoboys</h2>
              <p className="text-xs text-muted-foreground">Organize sua equipe e mantenha a entrega disponível.</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowHowItWorks((current) => !current)}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
        >
          <Info className="h-4 w-4" />
          Ver como funciona
        </button>
      </header>

      {showHowItWorks && (
        <section className="border border-border bg-muted/30 px-4 py-3">
          <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-4">
            <p><span className="font-black text-primary">1. Convide</span><br />Compartilhe o cadastro e o app Parceiro.</p>
            <p><span className="font-black text-primary">2. Combine</span><br />Definam contratação e pagamento fora da ItaSuper.</p>
            <p><span className="font-black text-primary">3. Vincule</span><br />Adicione o profissional à equipe da sua loja.</p>
            <p><span className="font-black text-primary">4. Entregue</span><br />O motoboy online passa a receber seus pedidos.</p>
          </div>
        </section>
      )}

      {!hasOperationalDriver && (
        <section className="flex flex-col gap-4 border border-primary/30 border-l-4 border-l-primary bg-card px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-black text-foreground">Nenhum motoboy ativo neste momento</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Sua loja continuará visível, mas a entrega fica indisponível até um motoboy estar online.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => setActiveTab("directory")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground hover:bg-primary/90"
            >
              <MapPin className="h-4 w-4" /> Encontrar na minha cidade
            </button>
            <button
              onClick={() => setActiveTab("invites")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-xs font-black text-primary hover:bg-primary/5"
            >
              <Send className="h-4 w-4" /> Convidar motoboy
            </button>
          </div>
        </section>
      )}

      <section className="grid divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-1 py-3 sm:px-4">
          <p className="text-2xl font-black tabular-nums text-foreground">{linkedDrivers.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Motoboys na equipe</p>
        </div>
        <div className="px-1 py-3 sm:px-4">
          <p className="text-2xl font-black tabular-nums text-foreground">{pendingInvites.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Convites pendentes</p>
        </div>
        <div className="px-1 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${hasOperationalDriver ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
            <p className="text-sm font-black text-foreground">{hasOperationalDriver ? "Entrega disponível agora" : "Entrega indisponível agora"}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Baseado na presença atual da equipe.</p>
        </div>
      </section>

      <nav className="flex gap-6 overflow-x-auto border-b border-border" aria-label="Seções de motoboys">
        <button onClick={() => setActiveTab("team")} className={tabClass("team")}>Equipe ({linkedDrivers.length})</button>
        <button onClick={() => setActiveTab("directory")} className={tabClass("directory")}>Base em {cityName}</button>
        <button onClick={() => setActiveTab("invites")} className={tabClass("invites")}>Convites{pendingInvites.length ? ` (${pendingInvites.length})` : ""}</button>
        <button onClick={() => setActiveTab("finance")} className={tabClass("finance")}>Financeiro</button>
      </nav>

      {activeTab === "team" && (
        <section className="space-y-4">
          {isLoading && (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}

          {!isLoading && linkedDrivers.length === 0 && (
            <div className="border border-border bg-card px-5 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Bike className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-black text-foreground">Sua equipe está vazia</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Escolha como quer adicionar o primeiro motoboy.</p>
              <div className="mx-auto mt-7 grid max-w-4xl gap-4 text-left md:grid-cols-2">
                <div className="flex items-center gap-3 border border-border p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><UserPlus className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-foreground">Já conhece alguém?</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Busque pelo nome, e-mail ou WhatsApp e envie o convite.</p>
                  </div>
                  <button onClick={() => setActiveTab("invites")} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted">Buscar motoboy</button>
                </div>
                <div className="flex items-center gap-3 border border-border p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-foreground">Precisa encontrar profissionais?</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Veja motoboys de {cityName} que autorizaram contato direto.</p>
                  </div>
                  <button onClick={() => setActiveTab("directory")} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground hover:bg-primary/90">Ver base da cidade</button>
                </div>
              </div>
              <p className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> A ItaSuper só exibe contatos autorizados. A contratação é combinada direto entre loja e motoboy.</p>
            </div>
          )}

          {linkedDrivers.map((driver: any) => {
            const stats = deliveryStats?.[driver.driver_user_id];
            const selectedMode = driver.payment_mode || "fim_do_dia";
            const driverName = driver.profile?.full_name || "Motoboy";
            return (
              <article key={driver.id} className={`border border-border bg-card p-4 ${driver.status === "rejected" ? "opacity-60" : ""}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bike className="h-5 w-5" />
                      <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card ${driver.is_online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-black text-foreground">{driverName}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${driver.is_online ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{driver.is_online ? "ONLINE" : "OFFLINE"}</span>
                        {driver.status === "pending" && <span className="text-[10px] font-black uppercase text-amber-600">Aguardando aceite</span>}
                        {driver.status === "rejected" && <span className="text-[10px] font-black uppercase text-destructive">Recusou convite</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{driver.profile?.phone || driver.profile?.whatsapp_number || "Sem telefone"} · {driver.profile?.vehicle || "Veículo não informado"}</p>
                      {driver.last_location_at && <p className="mt-1 text-[11px] text-muted-foreground">Última localização: {formatRelativeTime(driver.last_location_at)}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleRemove(driver.id, driverName)} className="inline-flex h-9 w-9 items-center justify-center self-end rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 sm:self-auto" title={`Remover ${driverName}`}><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="mt-4 grid gap-3 border-t border-border pt-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="grid grid-cols-2 divide-x divide-border border border-border">
                    <div className="px-3 py-2 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Entregas hoje</p><p className="mt-1 text-lg font-black tabular-nums text-foreground">{stats?.today || 0}</p></div>
                    <div className="px-3 py-2 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total entregue</p><p className="mt-1 text-lg font-black tabular-nums text-foreground">{stats?.total || 0}</p></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => updatePaymentMode(driver.id, "instantaneo")} className={`rounded-lg border px-2 py-2 text-[11px] font-bold ${selectedMode === "instantaneo" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Zap className="mr-1 inline h-3.5 w-3.5" />Na hora</button>
                    <button onClick={() => updatePaymentMode(driver.id, "fim_do_dia")} className={`rounded-lg border px-2 py-2 text-[11px] font-bold ${selectedMode === "fim_do_dia" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Clock className="mr-1 inline h-3.5 w-3.5" />Fim do dia</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {activeTab === "directory" && (
        <section className="space-y-4">
          <div className="border border-border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-foreground">Base de motoboys em {cityName}</h3><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">Opcional</span></div>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Profissionais que autorizaram voluntariamente o contato de lojistas da mesma cidade.</p>
                </div>
              </div>
              <div className="flex max-w-md gap-2 border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> A ItaSuper só disponibiliza o contato autorizado. Contratação, pagamento, escala e seguro são definidos diretamente entre vocês.</div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Nome ou veículo (opcional)" value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleDirectorySearch()} className="w-full border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
              <button onClick={handleDirectorySearch} disabled={directorySearching} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground disabled:opacity-50">{directorySearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Ver base</button>
            </div>
          </div>
          {directoryDrivers.length > 0 && <div className="divide-y divide-border border border-border bg-card">{directoryDrivers.map((driver) => <div key={driver.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bike className="h-4 w-4" /></div><div><p className="text-sm font-black text-foreground">{driver.full_name}</p><p className="mt-1 text-xs text-muted-foreground">{driver.vehicle} · {driver.city}</p></div></div><button type="button" onClick={() => window.open(`https://wa.me/${driver.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-[#25D366]/10 px-3 py-2 text-xs font-black text-[#128C4A] hover:bg-[#25D366]/20 sm:self-auto"><MessageCircle className="h-4 w-4" /> WhatsApp</button></div>)}</div>}
        </section>
      )}

      {activeTab === "invites" && (
        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <InviteLinkCard icon={<UserPlus className="h-5 w-5" />} title="Convide um motoboy para se cadastrar" description="Compartilhe o link para ele criar a conta de entregador na plataforma." url="https://itasuper.com.br/cadastro-motoboy-loja" onCopy={copyDriverRegistration} onShare={shareDriverRegistration} />
            <InviteLinkCard icon={<Smartphone className="h-5 w-5" />} title="Envie o app Parceiro" description="Depois do cadastro, o motoboy instala o app para receber e entregar pedidos." url="https://itasuper.com.br/download" onCopy={copyDriverApp} onShare={shareDriverApp} />
          </div>
          <div className="border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-base font-black text-foreground"><Search className="h-4 w-4 text-primary" /> Buscar e vincular alguém conhecido</h3>
            <p className="mt-1 text-xs text-muted-foreground">Use nome, e-mail ou telefone do profissional já cadastrado. O vínculo libera somente os pedidos desta loja.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Nome, e-mail ou telefone" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSearch()} className="w-full border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div><button onClick={handleSearch} disabled={searching || !searchTerm.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground disabled:opacity-50">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar</button></div>
            {foundDrivers.length > 0 && <div className="mt-4 space-y-3">{foundDrivers.map((driver) => { const selected = paymentModeChoice[driver.user_id] || "fim_do_dia"; return <div key={driver.user_id} className="border border-border p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserCheck className="h-4 w-4" /></div><div><p className="text-sm font-black text-foreground">{driver.full_name}</p><p className="mt-1 text-xs text-muted-foreground">{driver.email || driver.phone} · {driver.vehicle || "Veículo não informado"}</p></div></div><div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px]"><div><p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Como será o acerto da entrega?</p><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setPaymentModeChoice((current) => ({ ...current, [driver.user_id]: "instantaneo" }))} className={`border p-2 text-left text-xs font-bold ${selected === "instantaneo" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Zap className="mb-1 h-4 w-4" />Na hora<br /><span className="text-[10px] font-normal">A cada entrega</span></button><button onClick={() => setPaymentModeChoice((current) => ({ ...current, [driver.user_id]: "fim_do_dia" }))} className={`border p-2 text-left text-xs font-bold ${selected === "fim_do_dia" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><Clock className="mb-1 h-4 w-4" />Fim do dia<br /><span className="text-[10px] font-normal">Acerto acumulado</span></button></div></div><button onClick={() => handleAdd(driver)} disabled={adding} className="self-end rounded-lg bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground disabled:opacity-50">{adding ? "Vinculando..." : "Adicionar à equipe"}</button></div></div>; })}</div>}
          </div>
          {pendingInvites.length > 0 && <div className="border border-amber-500/30 bg-amber-500/5 p-4"><p className="text-sm font-black text-foreground">Convites aguardando aceite</p><p className="mt-1 text-xs text-muted-foreground">{pendingInvites.map((driver: any) => driver.profile?.full_name || "Motoboy").join(", ")}.</p></div>}
        </section>
      )}

      {activeTab === "finance" && <StoreDriverFinance storeId={storeId} />}
    </div>
  );
};

const InviteLinkCard = ({ icon, title, description, url, onCopy, onShare }: { icon: ReactNode; title: string; description: string; url: string; onCopy: () => void; onShare: () => void }) => (
  <article className="border border-border bg-card p-5">
    <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div><div><h3 className="text-sm font-black text-foreground">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div></div>
    <div className="mt-4 flex items-center gap-2"><p className="min-w-0 flex-1 truncate border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">{url}</p><button onClick={onCopy} title="Copiar link" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"><Copy className="h-4 w-4" /></button><button onClick={onShare} title="Compartilhar pelo WhatsApp" className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20"><Share2 className="h-4 w-4" /></button></div>
  </article>
);

const formatRelativeTime = (timestamp: string) => {
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
};

export default StoreDriverManager;
