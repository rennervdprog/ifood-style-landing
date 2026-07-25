import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ClientHomeContent from "./cliente/home/ClientHomeContent";
import { useUserRouting } from "@/hooks/useUserRouting";
import ResellerHome from "./revendedor/ResellerHome";

const ClientAuthScreen = lazy(() => import("./cliente/auth/ClientAuthScreen"));

const ClientHome = () => {
  const { user, loading } = useAuth();
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  if (loading) return null;

  if (!user && !justLoggedIn) {
    return (
      <Suspense fallback={null}>
        <ClientAuthScreen onSuccess={() => setJustLoggedIn(true)} />
      </Suspense>
    );
  }

  return <ClientHomeSwitch />;
};

const ClientHomeSwitch = () => {
  const { isReseller, loading } = useUserRouting();
  if (loading) return null;
  if (isReseller) return <ResellerHome />;
  return <ClientHomeContent />;
};

export default ClientHome;