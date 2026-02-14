import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthProvider } from "@/components/layout/session-provider";
import { ThemeScript } from "@/components/layout/theme-script";
import { PreferencesLoader } from "@/components/layout/preferences-loader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CVG Dashboard",
  description: "CVG Line Maintenance Operations Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="theme-neutral" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link
          rel="stylesheet"
          href="/vendor/fontawesome/css/all.min.css"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ThemeProvider>
            <PreferencesLoader />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
