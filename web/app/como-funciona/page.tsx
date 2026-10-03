import { HowItWorks } from "@/components/guides/how-it-works";
import { WishlistWebShell } from "@/components/wishlist/web-shell";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Qué es Cabibee y cómo funciona") };
}

export default function WebHowItWorksPage() {
  return (
    <WishlistWebShell>
      <div className="mx-auto max-w-4xl">
        <HowItWorks exploreHref="/alojamientos" bookHref="/como-reservar" storeHref="/tienda" />
      </div>
    </WishlistWebShell>
  );
}
