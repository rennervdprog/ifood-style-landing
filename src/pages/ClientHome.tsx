import { useAuth } from "@/contexts/AuthContext";
import ClientHomeContent from "./cliente/home/ClientHomeContent";
import { useUserRouting } from "@/hooks/useUserRouting";
import ResellerHome from "./revendedor/ResellerHome";

const ClientHome = () => {
  const { loading } = useAuth();
  if (loading) return null;
  return <ClientHomeSwitch />;
};

const ClientHomeSwitch = () => {
  const { user } = useAuth();
  const { isReseller, loading } = useUserRouting();
  if (user && loading) return null;
  if (user && isReseller) return <ResellerHome />;
  return <ClientHomeContent />;
};

export default ClientHome;