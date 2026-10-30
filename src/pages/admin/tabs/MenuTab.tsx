import MenuBuilder from "@/components/MenuBuilder";
import TutorialHelpButton from "@/components/TutorialHelp";

interface Props {
  storeId: string;
  storeCategory: string;
}

const MenuTab = ({ storeId, storeCategory }: Props) => (
  <div className="space-y-2">
    <div className="flex justify-end">
      <TutorialHelpButton tutorialId="menu" />
    </div>
    <MenuBuilder storeId={storeId} storeCategory={storeCategory} />
  </div>
);

export default MenuTab;
