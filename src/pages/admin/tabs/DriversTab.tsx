import StoreDriverManager from "@/components/StoreDriverManager";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
}

const DriversTab = ({ storeId }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="drivers" />
    </div>
    <StoreDriverManager storeId={storeId} />
  </div>
);

export default DriversTab;
