import FinanceCenter from "@/components/FinanceCenter";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
  storeName: string;
  hasCommission: boolean;
  isPlatformAdmin?: boolean;
}

const FinanceTab = ({ storeId, storeName, hasCommission, isPlatformAdmin }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="finance" />
    </div>
    <FinanceCenter
      storeId={storeId}
      storeName={storeName}
      hasCommission={hasCommission}
      isPlatformAdmin={isPlatformAdmin}
    />
  </div>
);

export default FinanceTab;
