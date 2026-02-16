"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm() {
  const { data: session, update: updateSession } = useSession();
  const user = session?.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string;
  } | undefined;

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [username, setUsername] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetch("/api/account/profile")
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.username !== undefined) setUsername(data.username); })
        .catch(() => {});
    }
  }, [user?.id]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Profile updated" });
        // Update the session so the header reflects the new name
        await updateSession({ name: displayName.trim() });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "Failed to update profile" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          placeholder="Your display name"
        />
        <p className="text-xs text-muted-foreground">2-50 characters</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="flex items-center gap-2">
          <Input
            id="username"
            value={username ?? ""}
            disabled
            className="opacity-60 font-mono"
          />
          <i className="fa-solid fa-lock text-muted-foreground text-sm" />
        </div>
        <p className="text-xs text-muted-foreground">Contact an admin to change your username</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="flex items-center gap-2">
          <Input
            id="email"
            value={user?.email ?? ""}
            disabled
            className="opacity-60"
          />
          <i className="fa-solid fa-lock text-muted-foreground text-sm" />
        </div>
        <p className="text-xs text-muted-foreground">Contact an admin to change your email</p>
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {user?.role ?? "user"}
          </span>
        </div>
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

      <Button
        onClick={handleSave}
        disabled={saving || displayName.trim().length < 2}
      >
        {saving ? (
          <>
            <i className="fa-solid fa-spinner fa-spin mr-2" />
            Saving...
          </>
        ) : (
          "Save Profile"
        )}
      </Button>
    </div>
  );
}
