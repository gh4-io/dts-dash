"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm() {
  const { data: session, update: updateSession } = useSession();
  const user = session?.user as
    | {
        id: string;
        name?: string | null;
        email?: string | null;
        role?: string;
      }
    | undefined;

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetch("/api/account/profile")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            if (data.username !== undefined) setUsername(data.username ?? "");
            if (data.email) setEmail(data.email);
            if (data.displayName) setDisplayName(data.displayName);
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    // Client-side validation
    if (displayName.trim().length < 2 || displayName.trim().length > 50) {
      setMessage({ type: "error", text: "Display name must be 2-50 characters" });
      setSaving(false);
      return;
    }
    if (
      username &&
      (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9._-]+$/.test(username))
    ) {
      setMessage({
        type: "error",
        text: "Username must be 3-30 characters (letters, numbers, dots, hyphens, underscores)",
      });
      setSaving(false);
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ type: "error", text: "Invalid email format" });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          username: username || null,
          email: email.trim(),
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Profile updated" });
        await updateSession({ name: displayName.trim(), email: email.trim().toLowerCase() });
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
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="font-mono"
          maxLength={30}
          placeholder="jdoe"
        />
        <p className="text-xs text-muted-foreground">
          3-30 characters (letters, numbers, dots, hyphens, underscores). Used for login alongside
          email.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="you@example.com"
        />
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

      <Button onClick={handleSave} disabled={saving || displayName.trim().length < 2 || !email}>
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
