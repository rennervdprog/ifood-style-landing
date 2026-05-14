import { Star } from "lucide-react";
import LoyaltyConfigPanel from "@/components/LoyaltyConfigPanel";

interface Props {
  storeId: string;
  allowLoyalty: boolean;
}

const LoyaltyTab = ({ storeId, allowLoyalty }: Props) => {
  if (allowLoyalty) {
    return <LoyaltyConfigPanel storeId={storeId} />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Star className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-base font-bold text-foreground mb-1">Programa de Fidelidade</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Disponível nos planos Essencial, Crescimento e Apoiador. Faça upgrade para fidelizar seus clientes e aumentar o retorno!
      </p>
    </div>
  );
};

export default LoyaltyTab;