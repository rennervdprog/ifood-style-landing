import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ClientHomeContent from "./cliente/home/ClientHomeContent";
import { useIsReseller } from "@/hooks/useIsReseller";
import ResellerHome from "./revendedor/ResellerHome";

const ClientAuthScreen = lazy(() => import("./cliente/auth/ClientAuthScreen"));

const ClientHome = () => {
  const { user, loading } = useAuth();
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user && !justLoggedIn) {
    return (
      <Suspense fallback={
        <div className="min-h-dvh bg-background flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }>
        <ClientAuthScreen onSuccess={() => setJustLoggedIn(true)} />
      </Suspense>
    );
  }

  return <ClientHomeSwitch />;
};

const ClientHomeSwitch = () => {
  const { isReseller, loading } = useIsReseller();
  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (isReseller) return <ResellerHome />;
  return <ClientHomeContent />;
};

export default ClientHome;