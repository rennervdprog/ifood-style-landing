import AddonManager from "@/components/AddonManager";

interface Props {
  storeId: string;
}

const AddonsTab = ({ storeId }: Props) => (
  <AddonManager storeId={storeId} />
);

export default AddonsTab;
