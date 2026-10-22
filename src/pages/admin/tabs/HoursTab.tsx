import StoreHoursManager from "@/components/StoreHoursManager";
import TabHeader from "@/components/TabHeader";

interface Props {
  storeId: string;
  forceClosed: boolean;
}

const HoursTab = ({ storeId, forceClosed }: Props) => (
  <div className="space-y-4">
    <TabHeader title="Horários" subtitle="Quando sua loja aparece aberta e aceita pedidos" />
    <StoreHoursManager storeId={storeId} forceClosed={forceClosed} />
  </div>
);

export default HoursTab;
