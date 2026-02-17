"use client";

import { createContext, useContext } from "react";

interface AppConfig {
  appTitle: string;
}

const AppConfigContext = createContext<AppConfig>({ appTitle: "Dashboard" });

export function AppConfigProvider({
  appTitle,
  children,
}: {
  appTitle: string;
  children: React.ReactNode;
}) {
  return <AppConfigContext.Provider value={{ appTitle }}>{children}</AppConfigContext.Provider>;
}

export function useAppTitle(): string {
  return useContext(AppConfigContext).appTitle;
}
