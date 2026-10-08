import { getAdminUsers } from "@/lib/admin-data";
import { UsersExplorer } from "./users-explorer";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ pendientes?: string; origen?: string }>;
}) {
  const sp = await searchParams;
  const origin = sp.origen === "asociado" ? "associate" : sp.origen === "organico" ? "organic" : "";
  return (
    <UsersExplorer
      key={`${sp.pendientes ?? ""}|${origin}`}
      users={getAdminUsers()}
      initialPending={sp.pendientes === "1"}
      initialOrigin={origin}
    />
  );
}
