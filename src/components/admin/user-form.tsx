"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserFormData {
  email: string;
  displayName: string;
  role: string;
  password: string;
}

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: { id: string; email: string; displayName: string; role: string };
  onSubmit: (data: UserFormData) => Promise<{ tempPassword?: string } | void>;
}

export function UserForm({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
}: UserFormProps) {
  const [form, setForm] = useState<UserFormData>({
    email: initialData?.email ?? "",
    displayName: initialData?.displayName ?? "",
    role: initialData?.role ?? "user",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset form when dialog opens/closes or initialData changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm({
        email: initialData?.email ?? "",
        displayName: initialData?.displayName ?? "",
        role: initialData?.role ?? "user",
        password: "",
      });
      setError(null);
      setTempPassword(null);
      setCopied(false);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (mode === "create" && !form.email) {
      setError("Email is required");
      return;
    }
    if (mode === "create" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Invalid email format");
      return;
    }
    if (!form.displayName || form.displayName.length < 2 || form.displayName.length > 50) {
      setError("Display name must be 2-50 characters");
      return;
    }

    setSaving(true);
    try {
      const result = await onSubmit(form);
      if (result?.tempPassword) {
        setTempPassword(result.tempPassword);
      } else {
        handleOpenChange(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = async () => {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create User" : "Edit User"}</DialogTitle>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              User created successfully. Share this temporary password with the user.
              They will be required to change it on first login.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
              <code className="flex-1 font-mono text-sm text-amber-500">
                {tempPassword}
              </code>
              <Button variant="outline" size="sm" onClick={copyPassword}>
                <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"} mr-1`} />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@cvg.local"
                disabled={mode === "edit"}
                type="email"
              />
            </div>

            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "create" && (
              <div className="space-y-2">
                <Label>Password (optional)</Label>
                <Input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                  type="password"
                />
                <p className="text-xs text-muted-foreground">
                  If blank, a temporary password will be generated
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2" />
                    Saving...
                  </>
                ) : mode === "create" ? (
                  <>
                    <i className="fa-solid fa-user-plus mr-2" />
                    Create User
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
