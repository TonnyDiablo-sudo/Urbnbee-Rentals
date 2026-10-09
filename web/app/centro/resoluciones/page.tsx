import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { hasStaffPermission } from "@/lib/staff";
import { AppealsDesk } from "./appeals-desk";

export const dynamic = "force-dynamic";

export default async function ResolucionesPage() {
  const user = await getSessionUser();
  if (!hasStaffPermission(user, "appeals")) redirect("/centro");
  return <AppealsDesk />;
}
