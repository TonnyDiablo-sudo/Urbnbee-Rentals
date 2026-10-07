import { redirect } from "next/navigation";
import { isLegalNameLocked } from "@/lib/display-name";
import { getT } from "@/lib/i18n/server";
import { findUserById, getHostProfile } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { ProfileEditor, type ProfileDraft } from "./profile-editor";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Editar perfil") };
}

type Props = { searchParams: Promise<{ from?: string }> };

export default async function AppEditProfilePage({ searchParams }: Props) {
  const session = await getSessionUser();
  if (!session) redirect("/cuenta/entrar?next=/perfil/editar");
  const { from } = await searchParams;
  const u = findUserById(session.id);
  const p = getHostProfile(session.id);
  const initial: ProfileDraft = {
    fullName: u?.fullName ?? session.fullName ?? "",
    alias: u?.alias ?? "",
    showAlias: Boolean(u?.showAlias && u?.alias),
    nameLocked: isLegalNameLocked(session.id),
    email: session.email,
    phone: u?.phone ?? "",
    addressLine: u?.addressLine ?? "",
    bio: p?.bio ?? "",
    avatarUrl: p?.avatarUrl ?? "",
    work: p?.work ?? "",
    livesIn: p?.livesIn ?? "",
    languages: p?.languages ?? [],
    interests: p?.interests ?? [],
    chatLang: u?.chatLang ?? "",
  };
  return <ProfileEditor initial={initial} back={from === "host" ? "/host/menu" : "/perfil"} />;
}
