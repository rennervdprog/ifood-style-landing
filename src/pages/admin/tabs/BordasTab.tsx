import PizzaBorderManager from "@/components/PizzaBorderManager";
import PizzaFlavorManager from "@/components/PizzaFlavorManager";

interface Props {
  storeId: string;
  category: string;
}

const BordasTab = ({ storeId, category }: Props) => {
  if (category !== "pizzas") return null;
  return (
    <div className="space-y-8">
      <PizzaFlavorManager storeId={storeId} />
      <PizzaBorderManager storeId={storeId} />
    </div>
  );
};

export default BordasTab;
