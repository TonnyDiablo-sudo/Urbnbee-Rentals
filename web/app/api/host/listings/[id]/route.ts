import { NextRequest, NextResponse } from "next/server";
import {
  deleteListing,
  getListingById,
  updateListing,
  slugifyTitle,
} from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import type { HostListingRecord } from "@/lib/marketplace-types";
import type { ListingCategory } from "@/lib/mock-data";

const CATEGORY_KEYS: ListingCategory[] = ["habitaciones", "casas", "departamentos", "cabanas", "vinos"];

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const listing = getListingById(id);
  if (!listing || listing.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  return NextResponse.json({ listing });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const listing = getListingById(id);
  if (!listing || listing.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const body = await req.json();
  const patch: Partial<HostListingRecord> = {};

  const stringFields: (keyof HostListingRecord)[] = [
    "title",
    "description",
    "spaceType",
    "city",
    "zone",
    "county",
    "country",
    "addressLine",
    "size",
  ];
  for (const k of stringFields) {
    if (body[k] !== undefined) (patch as Record<string, unknown>)[k] = String(body[k]);
  }

  if (body.slug !== undefined) patch.slug = String(body.slug).trim().toLowerCase().replace(/\s+/g, "-");
  if (body.categoryKey !== undefined && CATEGORY_KEYS.includes(body.categoryKey)) {
    patch.categoryKey = body.categoryKey;
  }
  if (body.guests !== undefined) patch.guests = clampInt(body.guests, 1, 50);
  if (body.bedrooms !== undefined) patch.bedrooms = clampInt(body.bedrooms, 0, 50);
  if (body.bathrooms !== undefined) patch.bathrooms = clampInt(body.bathrooms, 0, 50);
  if (body.lat !== undefined) patch.lat = Number(body.lat);
  if (body.lng !== undefined) patch.lng = Number(body.lng);
  if (body.pricePerNight !== undefined) patch.pricePerNight = Math.max(0, Number(body.pricePerNight));
  if (body.cleaningFee !== undefined) patch.cleaningFee = Math.max(0, Number(body.cleaningFee));
  if (Array.isArray(body.photos)) patch.photos = body.photos.map(String);
  if (Array.isArray(body.amenities)) patch.amenities = body.amenities.map(String);
  if (Array.isArray(body.blockedDates)) patch.blockedDates = body.blockedDates.map(String);
  if (body.nightlyPriceOverrides !== undefined) {
    patch.nightlyPriceOverrides = sanitizeNightlyPriceOverrides(body.nightlyPriceOverrides);
  }
  if (body.rules && typeof body.rules === "object") {
    patch.rules = {
      smoking: body.rules.smoking ?? listing.rules.smoking,
      pets: body.rules.pets ?? listing.rules.pets,
      parties: body.rules.parties ?? listing.rules.parties,
      children: body.rules.children ?? listing.rules.children,
    };
  }
  if (typeof body.published === "boolean") patch.published = body.published;
  if (typeof body.verified === "boolean") patch.verified = body.verified;
  if (body.bookingApprovalMode === "instant" || body.bookingApprovalMode === "approval") {
    patch.bookingApprovalMode = body.bookingApprovalMode;
  }

  if (body.regenerateSlug === true && body.title) {
    patch.slug = slugifyTitle(String(body.title));
  }

  const updated = updateListing(id, user.id, patch);
  return NextResponse.json({ listing: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const ok = deleteListing(id, user.id);
  if (!ok) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

function clampInt(v: unknown, min: number, max: number) {
  const n = Math.floor(Number(v));
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeNightlyPriceOverrides(raw: unknown): Record<string, number> {
  if (raw === null) return {};
  if (typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ISO_DATE.test(k)) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    out[k] = Math.round(n * 100) / 100;
  }
  return out;
}
