import { redirect } from "next/navigation";

export default function AdminAddressProofsPage() {
  redirect("/admin/users?pendientes=1");
}
