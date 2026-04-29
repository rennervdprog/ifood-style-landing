import React from "react";
import LoyaltyConfigPanel from "@/components/LoyaltyConfigPanel";
import { useAdmin } from "../AdminContext";

const LoyaltyTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <LoyaltyConfigPanel storeId={store.id} />
    </div>
  );
};

export default LoyaltyTab;
