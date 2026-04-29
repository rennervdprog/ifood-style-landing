import React from "react";
import PizzaBorderManager from "@/components/PizzaBorderManager";
import { useAdmin } from "../AdminContext";
const BordasTab = () => {
  const { store } = useAdmin();
  if (!store) return null;
  return <div className="p-4 lg:p-6"><PizzaBorderManager storeId={store.id} /></div>;
};
export default BordasTab;
