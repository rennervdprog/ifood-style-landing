import FinanceCenter from "@/components/FinanceCenter";

interface Props {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
  isPlatformAdmin?: boolean;
}

const FinanceTab = ({ storeId, storeName, hasCommission, isPlatformAdmin }: Props) => (
  <FinanceCenter 
    storeId={storeId} 
    storeName={storeName} 
    hasCommission={hasCommission} 
    isPlatformAdmin={isPlatformAdmin}
  />
);

export default FinanceTab;
