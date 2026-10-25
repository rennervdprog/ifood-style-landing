/**
 * CÓPIA DE TESTE (/admin-teste) de src/pages/admin/tabs/AddonsTab.tsx.
 * Mesma aba, mas renderiza o AddonManagerTeste (redesign da aba Adicionais).
 * NÃO usada pelo /admin original.
 */
import AddonManagerTeste from "@/components/AddonManagerTeste";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
}

const AddonsTabTeste = ({ storeId }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="addons" />
    </div>
    <AddonManagerTeste storeId={storeId} />
  </div>
);

export default AddonsTabTeste;
