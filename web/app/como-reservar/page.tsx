import { HowToBook } from "@/components/guides/how-to-book";
import { WishlistWebShell } from "@/components/wishlist/web-shell";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Cómo reservar") };
}

export default function WebHowToBookPage() {
  return (
    <WishlistWebShell>
      <div className="mx-auto max-w-4xl">
        <HowToBook exploreHref="/alojamientos" membershipHref="/guest/membresia" />
      </div>
    </WishlistWebShell>
  );
}
