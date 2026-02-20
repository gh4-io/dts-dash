"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface UserTableProps {
  users: UserRow[];
  currentUserId: string;
  onEdit: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
  onToggleActive: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: "border-amber-500 text-amber-500",
  admin: "border-blue-500 text-blue-500",
  user: "border-muted-foreground text-muted-foreground",
};

export function UserTable({
  users,
  currentUserId,
  onEdit,
  onResetPassword,
  onToggleActive,
  onDelete,
}: UserTableProps) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Quick Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isSelf = user.id === Number(currentUserId);

            return (
              <TableRow
                key={user.id}
                className={`cursor-pointer ${isSelf ? "bg-primary/5" : ""}`}
                onClick={() => onEdit(user)}
              >
                <TableCell className="font-medium">
                  {user.displayName}
                  {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {user.username || <span className="italic opacity-50">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={ROLE_COLORS[user.role] ?? ""}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.isActive ? (
                    <Badge variant="outline" className="border-emerald-500 text-emerald-500">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive text-destructive">
                      Disabled
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetPassword(user);
                      }}
                      title="Reset password"
                    >
                      <i className="fa-solid fa-key" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleActive(user);
                      }}
                      disabled={isSelf}
                      title={user.isActive ? "Disable user" : "Enable user"}
                    >
                      <i
                        className={`fa-solid ${
                          user.isActive
                            ? "fa-user-slash text-destructive"
                            : "fa-user-check text-emerald-500"
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(user);
                      }}
                      disabled={isSelf}
                      title="Delete user"
                    >
                      <i className="fa-solid fa-trash text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No users found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
