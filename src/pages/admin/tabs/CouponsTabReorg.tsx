// Fase 4 da reorganização do painel (2026-11-08) — SOMENTE /admin-teste.
// Cupons com o CouponManagerReorg (modelos em cartão próprio de criação rápida).
import CouponManagerReorg from "@/components/CouponManagerReorg";
import TabHeader from "@/components/TabHeader";

interface Props {
  storeId: string;
}

const CouponsTabReorg = ({ storeId }: Props) => (
  <div className="space-y-4">
    <TabHeader title="Cupons" subtitle="Códigos de desconto da sua loja e quanto eles trouxeram de vendas" tutorialId="coupons" />
    <CouponManagerReorg storeId={storeId} isAdmin />
  </div>
);

export default CouponsTabReorg;
