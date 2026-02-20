import { redirect } from "next/navigation";

/**
 * Aircraft Types page now redirects to the Data Hub.
 * The editor component remains in the codebase at
 * src/components/admin/aircraft-type-editor.tsx if needed.
 */
export default function AircraftTypesPage() {
  redirect("/admin/import?type=aircraft-type-mappings");
}
