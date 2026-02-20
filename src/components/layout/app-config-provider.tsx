"use client";

import { createContext, useContext } from "react";

interface AppConfig {
  appTitle: string;
  passwordMinLength: number;
}

const AppConfigContext = createContext<AppConfig>({
  appTitle: "Dashboard",
  passwordMinLength: 12,
});

export function AppConfigProvider({
  appTitle,
  passwordMinLength,
  children,
}: {
  appTitle: string;
  passwordMinLength: number;
  children: React.ReactNode;
}) {
  return (
    <AppConfigContext.Provider value={{ appTitle, passwordMinLength }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppTitle(): string {
  return useContext(AppConfigContext).appTitle;
}

export function usePasswordMinLength(): number {
  return useContext(AppConfigContext).passwordMinLength;
}
