import { redirect } from "next/navigation";

export default function AdminClaimsPage() {
  redirect("/admin/users?pendientes=1");
}
