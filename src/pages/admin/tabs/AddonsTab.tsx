import AddonManager from "@/components/AddonManager";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
}

const AddonsTab = ({ storeId }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="addons" />
    </div>
    <AddonManager storeId={storeId} />
  </div>
);

export default AddonsTab;
