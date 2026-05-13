"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewListingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/host/listings", { method: "POST" })
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
      <p className="text-[#888]">{error ?? "Creando borrador…"}</p>
    </div>
  );
}
