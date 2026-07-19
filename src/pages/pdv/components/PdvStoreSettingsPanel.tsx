import { useQuery } from "@tanstack/react-query";
import { Loader2, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StoreSettings from "@/components/StoreSettings";

/**
 * Wrapper que carrega o registro completo da loja e renderiza o
 * componente reutilizável `StoreSettings` dentro da aba do PDV.
 * Usado principalmente por lojas PDV Only, que não têm acesso ao
 * painel `/admin` completo.
 */
export function PdvStoreSettingsPanel({ storeId }: { storeId: string }) {
  const { data: store, isLoading } = useQuery({
    queryKey: ["pdv-store-full", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId)
        .maybeSingle();
      return data as any;
    },
  });

  if (isLoading || !store) {
    return (
      <div className="flex-1 flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black">Configurações da loja</h2>
      </div>
      <StoreSettings
        storeId={store.id}
        storeName={store.name}
        storeCategory={store.category}
        storeCategories={store.categories || null}
        storeImageUrl={store.image_url}
        storeIsOpen={store.is_open}
        forceClosed={store.force_closed || false}
        storeSlug={store.slug || null}
        storeAddressStreet={store.address_street || null}
        storeAddressNumber={store.address_number || null}
        storeAddressComplement={store.address_complement || null}
        storeAddressNeighborhood={store.address_neighborhood || null}
        storeAddressReference={store.address_reference || null}
        storeAddressCity={store.address_city || null}
        storeAddressState={store.address_state || null}
        storeAddressCep={store.address_cep || null}
        storeDeliveryMode={store.delivery_mode || "platform"}
        storeOwnDeliveryFee={store.own_delivery_fee || 0}
        storeDeliveryFeeType={store.delivery_fee_type || "fixed"}
        storeDeliveryBaseKm={store.delivery_base_km || 0}
        storeDeliveryFeeBase={store.delivery_fee_base || 0}
        storeDeliveryFeePerKm={store.delivery_fee_per_km || 0}
        storeMinimumOrderValue={store.minimum_order_value || 0}
        storeEstimatedDeliveryTime={store.estimated_delivery_time || null}
        storeSettings={store.settings || null}
      />
    </div>
  );
}