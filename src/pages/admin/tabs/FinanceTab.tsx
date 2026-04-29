import React from "react";
import FinanceCenter from "@/components/FinanceCenter";
import { useAdmin } from "../AdminContext";

const FinanceTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <FinanceCenter storeId={store.id} />
    </div>
  );
};

export default FinanceTab;
