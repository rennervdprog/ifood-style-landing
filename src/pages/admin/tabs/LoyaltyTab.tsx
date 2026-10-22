import { Star } from "lucide-react";
import LoyaltyConfigPanel from "@/components/LoyaltyConfigPanel";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
  allowLoyalty: boolean;
}

const LoyaltyTab = ({ storeId, allowLoyalty }: Props) => {
  if (allowLoyalty) {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <TutorialHelpButton tutorialId="loyalty" />
        </div>
        <LoyaltyConfigPanel storeId={storeId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Star className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-base font-bold text-foreground mb-1">Programa de Fidelidade</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Disponível nos planos Essencial e Crescimento. Faça upgrade para fidelizar seus clientes e aumentar o retorno!
      </p>
    </div>
  );
};

export default LoyaltyTab;
