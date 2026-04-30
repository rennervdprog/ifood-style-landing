import StoreHoursManager from "@/components/StoreHoursManager";

interface Props {
  storeId: string;
  forceClosed: boolean;
}

const HoursTab = ({ storeId, forceClosed }: Props) => (
  <StoreHoursManager storeId={storeId} forceClosed={forceClosed} />
);

export default HoursTab;
