import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { SidebarHydrator } from "@/components/layout/sidebar-hydrator";
import { DeviceTypeHydrator } from "@/components/layout/device-type-hydrator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IosInstallPrompt } from "@/components/shared/ios-install-prompt";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <DeviceTypeHydrator>
        <SidebarHydrator />
        <div className="flex h-dvh overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6">{children}</main>
          </div>
        </div>
        <BottomTabBar />
        <IosInstallPrompt />
      </DeviceTypeHydrator>
    </TooltipProvider>
  );
}
