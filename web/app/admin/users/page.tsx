import { getAdminUsers } from "@/lib/admin-data";
import { UsersExplorer } from "./users-explorer";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ pendientes?: string }> }) {
  const sp = await searchParams;
  return <UsersExplorer key={sp.pendientes ?? ""} users={getAdminUsers()} initialPending={sp.pendientes === "1"} />;
}
