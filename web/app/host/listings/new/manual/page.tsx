"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";

export default function NewListingManualPage() {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/host/listings", { method: "POST", credentials: "include" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? "No se pudo crear");
          return;
        }
        if (data.listing?.id) {
          router.replace(`/host/listings/${data.listing.id}/edit`);
        }
      })
      .catch(() => setError("Error de red"));
  }, [router]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-[#888]">{error ? t(error) : t("Creando borrador…")}</p>
      {error && (
        <Link href="/host/listings/new" className="mt-4 inline-block text-sm text-[#dcb81e] underline">
          {t("Volver")}
        </Link>
      )}
    </div>
  );
}
