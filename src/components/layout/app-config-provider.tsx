"use client";

import { createContext, useContext } from "react";

interface AppConfig {
  appTitle: string;
  appSubtitle: string;
  passwordMinLength: number;
}

const AppConfigContext = createContext<AppConfig>({
  appTitle: "Dashboard",
  appSubtitle: "Line Maintenance Operations",
  passwordMinLength: 12,
});

export function AppConfigProvider({
  appTitle,
  appSubtitle,
  passwordMinLength,
  children,
}: {
  appTitle: string;
  appSubtitle: string;
  passwordMinLength: number;
  children: React.ReactNode;
}) {
  return (
    <AppConfigContext.Provider value={{ appTitle, appSubtitle, passwordMinLength }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppTitle(): string {
  return useContext(AppConfigContext).appTitle;
}

export function useAppSubtitle(): string {
  return useContext(AppConfigContext).appSubtitle;
}

export function usePasswordMinLength(): number {
  return useContext(AppConfigContext).passwordMinLength;
}
