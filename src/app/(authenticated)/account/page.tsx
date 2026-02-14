"use client";

import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/account/profile-form";
import { PreferencesForm } from "@/components/account/preferences-form";
import { SecurityPanel } from "@/components/account/security-panel";
import { usePreferences } from "@/lib/hooks/use-preferences";

export default function AccountPage() {
  const { fetch: fetchPrefs, loaded } = usePreferences();

  useEffect(() => {
    if (!loaded) {
      fetchPrefs();
    }
  }, [loaded, fetchPrefs]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">
        <i className="fa-solid fa-user mr-2" />
        My Account
      </h1>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <i className="fa-solid fa-id-card mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <i className="fa-solid fa-sliders mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security">
            <i className="fa-solid fa-lock mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="rounded-lg border border-border bg-card p-6">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="preferences" className="rounded-lg border border-border bg-card p-6">
          <PreferencesForm />
        </TabsContent>

        <TabsContent value="security" className="rounded-lg border border-border bg-card p-6">
          <SecurityPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
