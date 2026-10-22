import CouponManager from "@/components/CouponManager";
import TabHeader from "@/components/TabHeader";

interface Props {
  storeId: string;
}

const CouponsTab = ({ storeId }: Props) => (
  <div className="space-y-4">
    <TabHeader title="Cupons" subtitle="Códigos de desconto da sua loja e quanto eles trouxeram de vendas" />
    <CouponManager storeId={storeId} isAdmin />
  </div>
);

export default CouponsTab;