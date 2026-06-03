import CouponManager from "@/components/CouponManager";

interface Props {
  storeId: string;
}

const CouponsTab = ({ storeId }: Props) => (
  <div className="space-y-4">
    <CouponManager storeId={storeId} isAdmin />
  </div>
);

export default CouponsTab;