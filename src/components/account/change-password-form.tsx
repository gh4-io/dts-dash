"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePasswordMinLength } from "@/components/layout/app-config-provider";

interface ChangePasswordFormProps {
  forced?: boolean;
}

export function ChangePasswordForm({ forced = false }: ChangePasswordFormProps) {
  const router = useRouter();
  const minLength = usePasswordMinLength();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= minLength &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          clearForceFlag: forced,
        }),
      });

      if (res.ok) {
        setMessage({
          type: "success",
          text: forced
            ? "Password changed successfully. Redirecting..."
            : "Password changed. Other sessions have been signed out.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        // If forced reset, redirect to dashboard after 1.5s
        if (forced) {
          setTimeout(() => {
            router.push("/dashboard");
          }, 1500);
        }
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "Failed to change password" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Forced reset warning banner */}
      {forced && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <i className="fa-solid fa-triangle-exclamation mr-2" />
          Your administrator requires you to change your password before continuing.
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        {newPassword.length > 0 && newPassword.length < minLength && (
          <p className="text-xs text-destructive">Must be at least {minLength} characters</p>
        )}
        {newPassword.length > 0 && newPassword === currentPassword && (
          <p className="text-xs text-destructive">Must differ from current password</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        {confirmPassword.length > 0 && confirmPassword !== newPassword && (
          <p className="text-xs text-destructive">Passwords do not match</p>
        )}
      </div>

      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <Button type="submit" disabled={!isValid || saving}>
        {saving ? (
          <>
            <i className="fa-solid fa-spinner fa-spin mr-2" />
            Changing...
          </>
        ) : (
          <>
            <i className="fa-solid fa-key mr-2" />
            Change Password
          </>
        )}
      </Button>
    </form>
  );
}
