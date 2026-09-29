import Link from "next/link";
import { IconPlus } from "../../_components/icons";
import { TabHeader } from "../../_components/top-bar";
import { HostListings } from "./host-listings";

export const metadata = { title: "Anuncios" };

export default function AppHostListingsPage() {
  return (
    <>
      <TabHeader
        title="Anuncios"
        right={
          <Link
            href="/host/anuncios/nuevo"
            className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f1f1] text-[#222]"
            aria-label="Nuevo anuncio"
          >
            <IconPlus />
          </Link>
        }
      />
      <HostListings />
    </>
  );
}
