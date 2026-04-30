import { CashRegister } from "@/components/CashRegister";

interface Props {
  storeId: string;
}

const CashRegisterTab = ({ storeId }: Props) => (
  <CashRegister storeId={storeId} />
);

export default CashRegisterTab;
