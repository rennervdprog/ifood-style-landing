// Fase 4 da reorganização do painel (2026-11-08) — SOMENTE /admin-teste.
// Motoboys sem o botão "Como funciona" solto (ajuda centralizada no "?" do
// cabeçalho); o "Ver como funciona" interno do gerenciador já é sob demanda.
import StoreDriverManager from "@/components/StoreDriverManager";

interface Props {
  storeId: string;
}

const DriversTabReorg = ({ storeId }: Props) => (
  <div className="space-y-2">
    <StoreDriverManager storeId={storeId} />
  </div>
);

export default DriversTabReorg;
