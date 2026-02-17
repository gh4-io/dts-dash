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
  username: string;
  displayName: string;
  role: string;
  password: string;
  newPassword: string;
  isActive: boolean;
  forcePasswordChange: boolean;
}

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: {
    id: string;
    email: string;
    username?: string | null;
    displayName: string;
    role: string;
    isActive: boolean;
    forcePasswordChange: boolean;
  };
  onSubmit: (data: UserFormData) => Promise<{ tempPassword?: string } | void>;
  onDelete?: () => void;
}

export function UserForm({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  onDelete,
}: UserFormProps) {
  const [form, setForm] = useState<UserFormData>({
    email: initialData?.email ?? "",
    username: initialData?.username ?? "",
    displayName: initialData?.displayName ?? "",
    role: initialData?.role ?? "user",
    password: "",
    newPassword: "",
    isActive: initialData?.isActive ?? true,
    forcePasswordChange: initialData?.forcePasswordChange ?? false,
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
        username: initialData?.username ?? "",
        displayName: initialData?.displayName ?? "",
        role: initialData?.role ?? "user",
        password: "",
        newPassword: "",
        isActive: initialData?.isActive ?? true,
        forcePasswordChange: initialData?.forcePasswordChange ?? false,
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
    if (
      form.username &&
      (form.username.length < 3 ||
        form.username.length > 30 ||
        !/^[a-zA-Z0-9._-]+$/.test(form.username))
    ) {
      setError("Username must be 3-30 characters (letters, numbers, dots, hyphens, underscores)");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create User" : "Edit User"}</DialogTitle>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              User created successfully. Share this temporary password with the user. They will be
              required to change it on first login.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
              <code className="flex-1 font-mono text-sm text-amber-500">{tempPassword}</code>
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
                placeholder="user@local"
                disabled={mode === "edit"}
                type="email"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Username <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="jdoe"
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                3-30 characters. Used for login alongside email.
              </p>
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
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
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

            {mode === "edit" && (
              <>
                <div className="border-t border-border pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Account Status</Label>
                    <Select
                      value={form.isActive ? "active" : "disabled"}
                      onValueChange={(v) => setForm({ ...form, isActive: v === "active" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">
                          <span className="flex items-center gap-2">
                            <i className="fa-solid fa-circle-check text-emerald-500" />
                            Active
                          </span>
                        </SelectItem>
                        <SelectItem value="disabled">
                          <span className="flex items-center gap-2">
                            <i className="fa-solid fa-circle-xmark text-destructive" />
                            Disabled
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      id="force-reset"
                      type="checkbox"
                      checked={form.forcePasswordChange}
                      onChange={(e) => setForm({ ...form, forcePasswordChange: e.target.checked })}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <Label htmlFor="force-reset" className="cursor-pointer font-normal">
                      Require password reset at next login
                    </Label>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <Label>
                    New Password{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    placeholder="Leave blank to keep current password"
                    type="password"
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    If provided, the user&apos;s password will be updated immediately.
                  </p>
                </div>
              </>
            )}

            <DialogFooter className="flex-row items-center">
              {mode === "edit" && onDelete && (
                <Button
                  variant="ghost"
                  className="mr-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    handleOpenChange(false);
                    onDelete();
                  }}
                >
                  <i className="fa-solid fa-trash mr-2" />
                  Delete User
                </Button>
              )}
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
