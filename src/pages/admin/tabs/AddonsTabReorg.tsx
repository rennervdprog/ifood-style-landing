/**
 * ABA ADICIONAIS REORG (Fase 3 da reorganização, montada só no /admin-teste).
 * Renderiza o AddonManagerReorg (filtros por tipo num seletor único
 * compacto, selos sem âmbar). O botão "Como funciona" desta tela fica
 * no topo (Fase 2 dos tutoriais, 2026-11-10 — ajuda na tela de novo;
 * o "?" do cabeçalho do shell continua existindo).
 */
import AddonManagerReorg from "@/components/AddonManagerReorg";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
}

const AddonsTabReorg = ({ storeId }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="addons" />
    </div>
    <AddonManagerReorg storeId={storeId} />
  </div>
);

export default AddonsTabReorg;
