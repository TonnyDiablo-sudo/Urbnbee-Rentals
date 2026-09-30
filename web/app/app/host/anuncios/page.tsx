import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { IconPlus } from "../../_components/icons";
import { TabHeader } from "../../_components/top-bar";
import { HostListings } from "./host-listings";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Anuncios") };
}

export default async function AppHostListingsPage() {
  const t = await getT();
  return (
    <>
      <TabHeader
        title={t("Anuncios")}
        right={
          <Link
            href="/host/anuncios/nuevo"
            className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f1f1] text-[#222]"
            aria-label={t("Nuevo anuncio")}
          >
            <IconPlus />
          </Link>
        }
      />
      <HostListings />
    </>
  );
}
