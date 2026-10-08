import Link from "next/link";
import type { TFn } from "@/lib/i18n";

/** Anuncio dado de alta por el equipo de Cabibee que el dueño todavía no reclama. A propósito casi invisible. */
export function UnclaimedNotice({ listingId, t }: { listingId: string; t: TFn }) {
  return (
    <p className="text-[10px] leading-snug text-[#c4c4c4]">
      {t("Anuncio con información pública.")} {t("No deposites antes de ver el lugar.")}{" "}
      <Link href={`/reclamar/${encodeURIComponent(listingId)}`} className="hover:text-[#888] hover:underline">
        {t("¿Es tuyo? Reclámalo o pide que lo borremos")}
      </Link>
    </p>
  );
}
