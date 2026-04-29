import React from "react";
import StoreSettings from "@/components/StoreSettings";
import { useAdmin } from "../AdminContext";

const SettingsTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <StoreSettings store={store} />
    </div>
  );
};

export default SettingsTab;
