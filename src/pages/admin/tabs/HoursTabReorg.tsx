// Fase 4 da reorganização do painel (2026-11-08) — SOMENTE /admin-teste.
// Horários com o StoreHoursManagerReorg (blocos colapsáveis + interruptor
// no mesmo estilo do card "Status da loja" da barra lateral).
import StoreHoursManagerReorg from "@/components/StoreHoursManagerReorg";
import TabHeader from "@/components/TabHeader";

interface Props {
  storeId: string;
  forceClosed: boolean;
}

const HoursTabReorg = ({ storeId, forceClosed }: Props) => (
  <div className="space-y-4">
    <TabHeader title="Horários" subtitle="Quando sua loja aparece aberta e aceita pedidos" tutorialId="hours" />
    <StoreHoursManagerReorg storeId={storeId} forceClosed={forceClosed} />
  </div>
);

export default HoursTabReorg;
