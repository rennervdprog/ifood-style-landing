import StoreSettings from "@/components/StoreSettings";
import WhatsAppSetup from "@/components/WhatsAppSetup";
import { MessageCircle } from "lucide-react";

interface Props {
  store: any;
}

const SettingsTab = ({ store }: Props) => (
  <div className="space-y-6">
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">WhatsApp</h2>
      </div>
      <WhatsAppSetup
        storeId={store.id}
        storeSlug={store.slug || ""}
        storeName={store.name}
        expectedPhone={store.whatsapp_number || store.whatsapp || store.phone || null}
      />
    </section>
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
      storeSettings={store.settings || null} 
    />
  </div>
);

export default SettingsTab;
