import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { hasStaffPermission } from "@/lib/staff";
import { ReportsDesk } from "./reports-desk";

export const dynamic = "force-dynamic";

export default async function CentroReportesPage() {
  const user = await getSessionUser();
  if (!hasStaffPermission(user, "reports")) redirect("/centro");
  return <ReportsDesk />;
}
