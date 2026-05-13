import { NextResponse } from "next/server";
import { createListing, listListingsForHost } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const listings = listListingsForHost(user.id);
  return NextResponse.json({ listings });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const listing = createListing(user.id);
  return NextResponse.json({ listing });
}
