import { redirect } from "next/navigation";
import { AccountSuspended } from "@/components/account/account-suspended";
import { isAccountSuspended } from "@/lib/account-standing";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SuspendedAccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/cuenta-suspendida");
  if (!isAccountSuspended(user)) redirect("/");
  return <AccountSuspended reason={user.suspendReason} />;
}
