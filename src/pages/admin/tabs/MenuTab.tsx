import React from "react";
import MenuBuilder from "@/components/MenuBuilder";
import { useAdmin } from "../AdminContext";
const MenuTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return <div className="p-4 lg:p-6"><MenuBuilder storeId={store.id} /></div>;
};
export default MenuTab;
