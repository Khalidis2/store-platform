"use client";

import { createContext, useContext, ReactNode } from "react";

type StoreInfo = {
  id: string;
  name: string;
  isLive: boolean;
  logoUrl: string | null;
  accentColor: string | null;
  tagline: string | null;
};

const StoreContext = createContext<StoreInfo | null>(null);

export function StoreProvider({ store, children }: { store: StoreInfo; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStoreInfo() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStoreInfo must be used within StoreProvider");
  return ctx;
}
