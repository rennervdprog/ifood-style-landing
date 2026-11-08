// Fase 4 da reorganização do painel (2026-11-08) — SOMENTE /admin-teste.
// Wrapper do Financeiro sem o botão "Como funciona" (ajuda centralizada no
// "?" do cabeçalho) e com o FinanceCenterReorg (3º nível subordinado).
import FinanceCenterReorg from "@/components/FinanceCenterReorg";

interface Props {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
  isPlatformAdmin?: boolean;
}

const FinanceTabReorg = ({ storeId, storeName, hasCommission, isPlatformAdmin }: Props) => (
  <FinanceCenterReorg
    storeId={storeId}
    storeName={storeName}
    hasCommission={hasCommission}
    isPlatformAdmin={isPlatformAdmin}
  />
);

export default FinanceTabReorg;
