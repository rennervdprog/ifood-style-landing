import React from "react";
import StoreHoursManager from "@/components/StoreHoursManager";
import { useAdmin } from "../AdminContext";
const HoursTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return <div className="p-4 lg:p-6"><StoreHoursManager storeId={store.id} /></div>;
};
export default HoursTab;
