// Fase 4 da reorganização do painel (2026-11-08) — SOMENTE /admin-teste.
// Wrapper do Financeiro com o FinanceCenterReorg (3º nível subordinado).
// O botão "Como funciona" desta tela fica no topo (Fase 2 dos tutoriais,
// 2026-11-10 — ajuda na tela de novo; o "?" do cabeçalho continua).
import FinanceCenterReorg from "@/components/FinanceCenterReorg";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
  isPlatformAdmin?: boolean;
}

const FinanceTabReorg = ({ storeId, storeName, hasCommission, isPlatformAdmin }: Props) => (
  <div>
    <div className="flex justify-end px-4 pt-3 lg:px-6">
      <TutorialHelpButton tutorialId="finance" />
    </div>
    <FinanceCenterReorg
      storeId={storeId}
      storeName={storeName}
      hasCommission={hasCommission}
      isPlatformAdmin={isPlatformAdmin}
    />
  </div>
);

export default FinanceTabReorg;
