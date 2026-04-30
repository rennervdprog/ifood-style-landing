import MenuBuilder from "@/components/MenuBuilder";

interface Props {
  storeId: string;
  storeCategory: string;
}

const MenuTab = ({ storeId, storeCategory }: Props) => (
  <MenuBuilder storeId={storeId} storeCategory={storeCategory} />
);

export default MenuTab;
