// Fase 4 da reorganização do painel (2026-11-08) — SOMENTE /admin-teste.
// O botão "Como funciona" desta tela fica no topo (Fase 2 dos tutoriais,
// 2026-11-10 — ajuda na tela de novo; o "?" do cabeçalho continua).
import StoreDriverManager from "@/components/StoreDriverManager";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
}

const DriversTabReorg = ({ storeId }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="drivers" />
    </div>
    <StoreDriverManager storeId={storeId} />
  </div>
);

export default DriversTabReorg;
