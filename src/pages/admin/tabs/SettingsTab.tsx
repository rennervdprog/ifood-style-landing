import React from "react";
import StoreSettings from "@/components/StoreSettings";
import { useAdmin } from "../AdminContext";

const SettingsTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
       <StoreSettings 
         storeId={store.id} 
         storeName={store.name} 
         storeCategory={store.category} 
         storeCategories={store.categories}
         storeImageUrl={store.image_url} 
         storeIsOpen={store.is_open} 
         forceClosed={store.force_closed} 
         storeSlug={store.slug}
         storeAddressStreet={store.address_street}
         storeAddressNumber={store.address_number}
         storeAddressComplement={store.address_complement}
         storeAddressNeighborhood={store.address_neighborhood}
         storeAddressReference={store.address_reference}
         storeAddressCity={store.address_city}
         storeAddressState={store.address_state}
         storeAddressCep={store.address_cep}
         storeDeliveryMode={store.delivery_mode}
         storeOwnDeliveryFee={store.own_delivery_fee}
         storeDeliveryFeeType={store.delivery_fee_type}
         storeDeliveryBaseKm={store.delivery_base_km}
         storeDeliveryFeeBase={store.delivery_fee_base}
         storeDeliveryFeePerKm={store.delivery_fee_per_km}
         storeSettings={store.settings}
       />
    </div>
  );
};

export default SettingsTab;
