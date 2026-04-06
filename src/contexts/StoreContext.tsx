import React, { createContext, useContext, useState } from "react";

interface StoreContextType {
  currentStoreId: string | null;
  currentStoreSlug: string | null;
  currentStoreName: string | null;
  setCurrentStore: (id: string | null, slug: string | null, name: string | null) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [currentStoreSlug, setCurrentStoreSlug] = useState<string | null>(null);
  const [currentStoreName, setCurrentStoreName] = useState<string | null>(null);

  const setCurrentStore = (id: string | null, slug: string | null, name: string | null) => {
    setCurrentStoreId(id);
    setCurrentStoreSlug(slug);
    setCurrentStoreName(name);
  };

  return (
    <StoreContext.Provider value={{ currentStoreId, currentStoreSlug, currentStoreName, setCurrentStore }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreContext = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStoreContext must be used within StoreProvider");
  return ctx;
};
