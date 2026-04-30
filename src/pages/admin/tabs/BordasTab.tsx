import PizzaBorderManager from "@/components/PizzaBorderManager";

interface Props {
  storeId: string;
  category: string;
}

const BordasTab = ({ storeId, category }: Props) => {
  if (category !== "pizzas") return null;
  return <PizzaBorderManager storeId={storeId} />;
};

export default BordasTab;
