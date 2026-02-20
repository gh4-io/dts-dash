import { redirect } from "next/navigation";

/**
 * Customers page now redirects to the Data Hub.
 * The customer CRUD editor component remains in the codebase at
 * src/components/admin/customer-color-editor.tsx if needed.
 */
export default function CustomersPage() {
  redirect("/admin/import?type=customers");
}
