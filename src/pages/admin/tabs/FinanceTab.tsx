import FinanceCenter from "@/components/FinanceCenter";

interface Props {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
}

const FinanceTab = ({ storeId, storeName, hasCommission }: Props) => (
  <FinanceCenter 
    storeId={storeId} 
    storeName={storeName} 
    hasCommission={hasCommission} 
  />
);

export default FinanceTab;
