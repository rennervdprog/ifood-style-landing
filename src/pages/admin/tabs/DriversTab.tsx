import React from "react";
import StoreDriverManager from "@/components/StoreDriverManager";
import { useAdmin } from "../AdminContext";
const DriversTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return <div className="p-4 lg:p-6"><StoreDriverManager storeId={store.id} /></div>;
};
export default DriversTab;
