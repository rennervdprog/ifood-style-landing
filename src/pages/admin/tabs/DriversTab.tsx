import StoreDriverManager from "@/components/StoreDriverManager";

interface Props {
  storeId: string;
}

const DriversTab = ({ storeId }: Props) => (
  <StoreDriverManager storeId={storeId} />
);

export default DriversTab;
