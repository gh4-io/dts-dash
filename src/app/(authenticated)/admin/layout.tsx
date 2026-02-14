import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || !["admin", "superadmin"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <i className="fa-solid fa-shield-halved text-xl text-muted-foreground" />
        <h1 className="text-2xl font-bold">Administration</h1>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
