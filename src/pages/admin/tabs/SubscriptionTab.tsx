import StoreSubscription from "@/components/StoreSubscription";
import TabHeader from "@/components/TabHeader";

interface Props {
  storeId: string;
  storeName: string;
}

const SubscriptionTab = ({ storeId, storeName }: Props) => (
  <div className="max-w-2xl mx-auto">
    <TabHeader title="Meu Plano" subtitle="Seu plano atual, mensalidade e o que está incluído" />
    <StoreSubscription storeId={storeId} storeName={storeName} />
  </div>
);

export default SubscriptionTab;