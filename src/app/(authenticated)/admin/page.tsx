import { redirect } from "next/navigation";

/**
 * `/admin` has no page of its own — it lands on the first tab in the admin nav.
 *
 * Keep this in step with the first entry of ADMIN_NAV_ITEMS in
 * `src/components/admin/admin-nav.tsx`. It used to point at Customers, which had
 * long since stopped being first, so entering the section highlighted a tab in
 * the middle of the bar.
 */
export default function AdminPage() {
  redirect("/admin/import");
}
