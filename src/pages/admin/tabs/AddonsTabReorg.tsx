/**
 * ABA ADICIONAIS REORG (Fase 3 da reorganização, montada só no /admin-teste).
 * Renderiza o AddonManagerReorg (filtros por tipo num seletor único
 * compacto, selos sem âmbar). O botão "Como funciona" por tela não
 * aparece aqui: a ajuda é central no cabeçalho do shell (botão "?").
 */
import AddonManagerReorg from "@/components/AddonManagerReorg";

interface Props {
  storeId: string;
}

const AddonsTabReorg = ({ storeId }: Props) => (
  <div className="space-y-2">
    <AddonManagerReorg storeId={storeId} />
  </div>
);

export default AddonsTabReorg;
