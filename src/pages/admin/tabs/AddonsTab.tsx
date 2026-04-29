import React from "react";
import AddonManager from "@/components/AddonManager";
import { useAdmin } from "../AdminContext";
const AddonsTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return <div className="p-4 lg:p-6"><AddonManager storeId={store.id} /></div>;
};
export default AddonsTab;
