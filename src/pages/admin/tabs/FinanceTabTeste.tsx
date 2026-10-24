/**
 * TELA 4 — CÓPIA DE TESTE (/admin-teste) de src/pages/admin/tabs/FinanceTab.tsx.
 * Idêntica ao original, EXCETO: renderiza FinanceCenterTeste em vez do
 * FinanceCenter original. O botão "Como funciona" (TutorialHelpButton) é
 * o mesmo, sem alteração.
 */
import FinanceCenterTeste from "../components/teste/FinanceCenterTeste";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
  isPlatformAdmin?: boolean;
  focusSection?: "resumo" | "repasse";
}

const FinanceTabTeste = ({ storeId, storeName, hasCommission, isPlatformAdmin, focusSection }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="finance" />
    </div>
    <FinanceCenterTeste
      storeId={storeId}
      storeName={storeName}
      hasCommission={hasCommission}
      isPlatformAdmin={isPlatformAdmin}
      focusSection={focusSection}
    />
  </div>
);

export default FinanceTabTeste;
