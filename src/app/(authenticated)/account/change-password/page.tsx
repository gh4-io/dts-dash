"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/account/change-password-form";

function ChangePasswordPageContent() {
  const searchParams = useSearchParams();
  const forced = searchParams.get("forced") === "true";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          <i className="fa-solid fa-key mr-2" />
          {forced ? "Password Reset Required" : "Change Password"}
        </h1>
        {!forced && (
          <p className="mt-2 text-sm text-muted-foreground">Update your account password</p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <ChangePasswordForm forced={forced} />
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="text-center">Loading...</div>}>
      <ChangePasswordPageContent />
    </Suspense>
  );
}
