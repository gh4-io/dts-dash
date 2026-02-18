import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthProvider } from "@/components/layout/session-provider";
import { ThemeScript } from "@/components/layout/theme-script";
import { TimelineScript } from "@/components/layout/timeline-script";
import { PreferencesLoader } from "@/components/layout/preferences-loader";
import { AppConfigProvider } from "@/components/layout/app-config-provider";
import { getAppTitle, getPasswordRequirements } from "@/lib/config/loader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const appTitle = getAppTitle();
  return {
    title: appTitle,
    description: `${appTitle} — Operations Dashboard`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const appTitle = getAppTitle();
  const { minLength: passwordMinLength } = getPasswordRequirements();

  return (
    <html lang="en" className="theme-neutral" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <TimelineScript />
        <link rel="stylesheet" href="/vendor/fontawesome/css/all.min.css" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppConfigProvider appTitle={appTitle} passwordMinLength={passwordMinLength}>
          <AuthProvider>
            <ThemeProvider>
              <PreferencesLoader />
              {children}
            </ThemeProvider>
          </AuthProvider>
        </AppConfigProvider>
      </body>
    </html>
  );
}
