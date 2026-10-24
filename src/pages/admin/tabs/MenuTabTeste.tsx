/**
 * TELA 3 — CÓPIA DE TESTE (/admin-teste) de src/pages/admin/tabs/MenuTab.tsx.
 * Idêntica ao original, EXCETO: renderiza MenuBuilderTeste em vez do
 * MenuBuilder original. O botão "Como funciona" (TutorialHelpButton) é
 * o mesmo, sem alteração.
 */
import MenuBuilderTeste from "../sections/MenuBuilderTeste";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
  storeCategory: string;
}

const MenuTabTeste = ({ storeId, storeCategory }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="menu" />
    </div>
    <MenuBuilderTeste storeId={storeId} storeCategory={storeCategory} />
  </div>
);

export default MenuTabTeste;
