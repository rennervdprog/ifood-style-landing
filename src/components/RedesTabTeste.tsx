/**
 * RedesTabTeste — Tela "Redes" do super-admin, SÓ LEITURA (Fase 2).
 *
 * Lista as redes (matriz) com suas sublojas, status, plano e gerentes.
 * Nenhuma ação nesta fase: sem aprovar/suspender, sem ajustar limite,
 * sem criar rede — só ver. Os dados vêm das tabelas do sistema de matriz
 * (store_networks, stores, store_managers, profiles).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Store, Users } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  groupNetworksWithUnits,
  summarizeNetworks,
  networkPlanLabel,
  resolveNetworkDisplayStatus,
  NETWORK_STATUS_LABELS,
  type NetworkRow,
  type NetworkStoreRow,
  type NetworkManagerRow,
  type NetworkProfileRow,
} from "@/lib/superAdminRedes";

const RedesTabTeste = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["super-admin-redes-teste"],
    queryFn: async () => {
      const [networksRes, storesRes, managersRes] = await Promise.all([
        (supabase as any).from("store_networks").select("*").order("created_at", { ascending: true }),
        (supabase as any)
          .from("stores")
          .select("id, name, slug, network_id, is_matriz, is_draft, status, address_city, address_neighborhood, force_closed")
          .not("network_id", "is", null)
          .order("created_at", { ascending: true }),
        (supabase as any).from("store_managers").select("store_id, user_id, is_active"),
      ]);
      if (networksRes.error) throw networksRes.error;
      if (storesRes.error) throw storesRes.error;
      if (managersRes.error) throw managersRes.error;
      const networks = (networksRes.data as NetworkRow[]) || [];
      const stores = (storesRes.data as NetworkStoreRow[]) || [];
      const managers = (managersRes.data as NetworkManagerRow[]) || [];
      const userIds = Array.from(
        new Set([
          ...networks.map((n) => n.owner_id),
          ...managers.map((m) => m.user_id),
        ]),
      );
      let profiles: NetworkProfileRow[] = [];
      if (userIds.length > 0) {
        const { data: profs, error: profErr } = await (supabase as any)
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);
        if (profErr) throw profErr;
        profiles = (profs as NetworkProfileRow[]) || [];
      }
      return groupNetworksWithUnits({ networks, stores, managers, profiles });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar as redes. Tente novamente.
        </CardContent>
      </Card>
    );
  }

  const totals = summarizeNetworks(data);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Redes</p>
            <p className="text-xl font-black">{totals.networks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Sublojas</p>
            <p className="text-xl font-black">{totals.sublojas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Rascunhos</p>
            <p className="text-xl font-black">{totals.drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Com gerente</p>
            <p className="text-xl font-black">{totals.withManager}</p>
          </CardContent>
        </Card>
      </div>

      {data.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma rede cadastrada.
          </CardContent>
        </Card>
      )}

      {data.map((group) => {
        const status = resolveNetworkDisplayStatus(group.network);
        return (
          <Card key={group.network.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate">{group.network.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Dono: {group.ownerEmail ?? group.ownerName ?? "—"}
                  </p>
                </div>
                <Badge
                  variant={status === "active" ? "default" : "secondary"}
                  className="shrink-0"
                >
                  {NETWORK_STATUS_LABELS[status]}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/40 rounded-xl p-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Plano</p>
                  <p className="text-xs font-black">{networkPlanLabel(group.network.plan_type)}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Mensalidade</p>
                  <p className="text-xs font-black">{formatBRL(Number(group.network.monthly_fee || 0))}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Sublojas</p>
                  <p className="text-xs font-black">
                    {group.sublojas.length} / {group.network.max_units}
                  </p>
                </div>
              </div>

              {group.matrizStore && (
                <p className="text-xs text-muted-foreground">
                  Página do grupo: <b className="text-foreground">{group.matrizStore.name}</b> (não vende)
                </p>
              )}

              {group.sublojas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma subloja criada nesta rede.</p>
              ) : (
                <div className="space-y-2">
                  {group.sublojas.map((unit) => (
                    <div key={unit.id} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                      <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">
                          {unit.name}
                          {unit.is_draft ? " · RASCUNHO" : ""}
                          {unit.force_closed ? " · PAUSADA" : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {unit.address_city ?? "—"}
                          {unit.address_neighborhood ? ` · ${unit.address_neighborhood}` : ""}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                        <Users className="h-3 w-3" />
                        {group.managersByStore[unit.id] ?? "Sem gerente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-[11px] text-muted-foreground text-center">
        Somente leitura nesta fase — aprovar/suspender rede, ajustar limite e criar rede chegam nas próximas fases.
      </p>
    </div>
  );
};

export default RedesTabTeste;
