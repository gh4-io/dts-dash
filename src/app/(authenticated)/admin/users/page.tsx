"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserTable } from "@/components/admin/user-table";
import { UserForm } from "@/components/admin/user-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface UserRow {
  id: number;
  email: string;
  username?: string | null;
  displayName: string;
  role: string;
  isActive: boolean;
  forcePasswordChange: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    user: UserRow;
    tempPassword?: string;
  } | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<UserRow | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deletePhrase, setDeletePhrase] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = () => {
    setEditingUser(null);
    setFormMode("create");
    setFormOpen(true);
  };

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    setFormMode("edit");
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: {
    email: string;
    username: string;
    displayName: string;
    role: string;
    password: string;
    newPassword: string;
    isActive: boolean;
    forcePasswordChange: boolean;
  }) => {
    setMessage(null);

    if (formMode === "create") {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create user");

      await fetchUsers();
      setMessage({ type: "success", text: `User ${data.email} created` });
      return { tempPassword: body.tempPassword };
    } else if (editingUser) {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username || null,
          displayName: data.displayName,
          role: data.role,
          isActive: data.isActive,
          forcePasswordChange: data.forcePasswordChange,
          ...(data.newPassword ? { newPassword: data.newPassword } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update user");

      await fetchUsers();
      setMessage({ type: "success", text: "User updated" });
    }
  };

  const handleResetPassword = async (user: UserRow) => {
    setResetPasswordDialog({ user });
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error ?? "Failed to reset password" });
        setResetPasswordDialog(null);
        return;
      }
      setResetPasswordDialog({ user, tempPassword: body.tempPassword });
    } catch {
      setMessage({ type: "error", text: "Network error" });
      setResetPasswordDialog(null);
    }
  };

  const handleToggleActive = (user: UserRow) => {
    setConfirmToggle(user);
  };

  const confirmToggleActive = async () => {
    if (!confirmToggle) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${confirmToggle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !confirmToggle.isActive }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error ?? "Failed to update user" });
      } else {
        setMessage({
          type: "success",
          text: `User ${confirmToggle.isActive ? "disabled" : "enabled"}`,
        });
        await fetchUsers();
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setConfirmToggle(null);
    }
  };

  const handleDeleteUser = (user: UserRow) => {
    setDeleteTarget(user);
    setDeletePhrase("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error ?? "Failed to delete user" });
      } else {
        setMessage({ type: "success", text: `User ${deleteTarget.email} deleted` });
        if (editingUser?.id === deleteTarget.id) setFormOpen(false);
        await fetchUsers();
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const copyPassword = async (pw: string) => {
    await navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-spinner fa-spin text-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} user{users.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={handleCreate}>
          <i className="fa-solid fa-user-plus mr-2" />
          Create User
        </Button>
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

      <UserTable
        users={users}
        currentUserId={session?.user?.id ?? ""}
        onEdit={handleEdit}
        onResetPassword={handleResetPassword}
        onToggleActive={handleToggleActive}
        onDelete={handleDeleteUser}
      />

      {/* Create/Edit dialog */}
      <UserForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialData={editingUser ?? undefined}
        onSubmit={handleFormSubmit}
        onDelete={editingUser ? () => handleDeleteUser(editingUser) : undefined}
      />

      {/* Reset password dialog */}
      <Dialog open={!!resetPasswordDialog} onOpenChange={() => setResetPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          {resetPasswordDialog?.tempPassword ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                New temporary password for <strong>{resetPasswordDialog.user.email}</strong>:
              </p>
              <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                <code className="flex-1 font-mono text-sm text-amber-500">
                  {resetPasswordDialog.tempPassword}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyPassword(resetPasswordDialog.tempPassword!)}
                >
                  <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"} mr-1`} />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The user will be required to change this password on next login.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <i className="fa-solid fa-spinner fa-spin text-xl text-muted-foreground" />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResetPasswordDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm toggle active dialog */}
      <Dialog open={!!confirmToggle} onOpenChange={() => setConfirmToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmToggle?.isActive ? "Disable User" : "Enable User"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmToggle?.isActive
              ? `This will prevent ${confirmToggle.email} from logging in.`
              : `This will allow ${confirmToggle?.email} to log in again.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmToggle(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmToggle?.isActive ? "destructive" : "default"}
              onClick={confirmToggleActive}
            >
              {confirmToggle?.isActive ? "Disable" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Type{" "}
              <strong className="text-foreground">{deleteTarget?.displayName}</strong> to confirm
              deletion.
            </p>
            <Input
              value={deletePhrase}
              onChange={(e) => setDeletePhrase(e.target.value)}
              placeholder={deleteTarget?.displayName}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  deletePhrase.toLowerCase() === deleteTarget?.displayName.toLowerCase()
                ) {
                  confirmDelete();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletePhrase.toLowerCase() !== deleteTarget?.displayName.toLowerCase()}
              onClick={confirmDelete}
            >
              <i className="fa-solid fa-trash mr-2" />
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
