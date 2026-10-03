import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { storeItemsFor } from "@/lib/store-catalog";
import { ensurePublicCatalogFresh } from "@/lib/urbnbeeai-catalog-sync";
import { verificationRegionFromRequest } from "@/lib/verification-region";

export const dynamic = "force-dynamic";

/** Productos de la tienda con su precio vigente y lo que el usuario ya tiene. Sólo miembros. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para ver la tienda." }, { status: 401 });
  await ensurePublicCatalogFresh();
  const q = req.nextUrl.searchParams.get("region");
  const region = q === "us" ? "us" : q === "mx" ? "mx" : verificationRegionFromRequest(req);
  return NextResponse.json({
    region,
    isHost: user.role === "host" || user.role === "admin",
    items: storeItemsFor(user, region),
  });
}
