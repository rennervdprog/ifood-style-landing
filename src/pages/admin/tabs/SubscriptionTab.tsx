import StoreSubscription from "@/components/StoreSubscription";

interface Props {
  storeId: string;
  storeName: string;
}

const SubscriptionTab = ({ storeId, storeName }: Props) => (
  <StoreSubscription storeId={storeId} storeName={storeName} />
);

export default SubscriptionTab;