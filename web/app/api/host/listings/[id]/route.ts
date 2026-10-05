import { NextRequest, NextResponse } from "next/server";
import {
  deleteListing,
  getListingById,
  updateListing,
  slugifyTitle,
} from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { deleteProofsForListing } from "@/lib/address-proof-store";
import { sanitizeArrivalGuide } from "@/lib/arrival-guide";
import { sanitizeArrivalMessage } from "@/lib/arrival-message-template";
import { sanitizeListingContract } from "@/lib/booking-contract-templates";
import { exactAddressProblem } from "@/lib/listing-address";
import { sanitizeAgentFaq, sanitizeAgentNotes } from "@/lib/listing-agent-info";
import { applyRentalMode, sanitizePricing } from "@/lib/listing-pricing";
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
    "state",
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
  if (body.bathroomType === "private" || body.bathroomType === "shared") patch.bathroomType = body.bathroomType;
  else if (body.bathroomType === null) patch.bathroomType = undefined;
  if (typeof body.selfCheckIn === "boolean") patch.selfCheckIn = body.selfCheckIn;
  else if (body.selfCheckIn === null) patch.selfCheckIn = undefined;
  if (body.rentalMode === "nightly" || body.rentalMode === "monthly") patch.rentalMode = body.rentalMode;
  if (body.pricePerMonth !== undefined) {
    const n = Math.round(Number(body.pricePerMonth));
    patch.pricePerMonth = Number.isFinite(n) && n > 0 ? Math.min(n, 10_000_000) : undefined;
  }
  if (body.lat !== undefined) patch.lat = Number(body.lat);
  if (body.lng !== undefined) patch.lng = Number(body.lng);
  if (body.locationPrecision === "approximate" || body.locationPrecision === "exact") {
    patch.locationPrecision = body.locationPrecision;
  }
  if (body.pricePerNight !== undefined) patch.pricePerNight = Math.max(0, Number(body.pricePerNight));
  if (body.cleaningFee !== undefined) patch.cleaningFee = Math.max(0, Number(body.cleaningFee));
  if (Array.isArray(body.photos)) patch.photos = body.photos.map(String);
  if (Array.isArray(body.amenities)) patch.amenities = body.amenities.map(String);
  if (Array.isArray(body.blockedDates)) patch.blockedDates = body.blockedDates.map(String);
  if (body.nightlyPriceOverrides !== undefined) {
    patch.nightlyPriceOverrides = sanitizeNightlyPriceOverrides(body.nightlyPriceOverrides);
  }
  if (body.pricing !== undefined) patch.pricing = sanitizePricing(body.pricing);
  if (body.arrivalGuide !== undefined) patch.arrivalGuide = sanitizeArrivalGuide(body.arrivalGuide);
  if (typeof body.agentCanShareAccessCode === "boolean") patch.agentCanShareAccessCode = body.agentCanShareAccessCode;
  else if (body.agentCanShareAccessCode !== undefined) {
    return NextResponse.json({ error: "agentCanShareAccessCode debe ser true o false." }, { status: 400 });
  }
  if (body.arrivalMessage !== undefined) patch.arrivalMessage = sanitizeArrivalMessage(body.arrivalMessage);
  if (body.rules && typeof body.rules === "object") {
    patch.rules = {
      smoking: body.rules.smoking ?? listing.rules.smoking,
      pets: body.rules.pets ?? listing.rules.pets,
      parties: body.rules.parties ?? listing.rules.parties,
      children: body.rules.children ?? listing.rules.children,
    };
  }
  if (body.addressUnit !== undefined) patch.addressUnit = String(body.addressUnit ?? "").trim().slice(0, 60);
  if (typeof body.noAddressUnit === "boolean") patch.noAddressUnit = body.noAddressUnit;
  if (body.houseRules !== undefined) patch.houseRules = String(body.houseRules ?? "").slice(0, 2000);
  if (body.agentFaq !== undefined) patch.agentFaq = sanitizeAgentFaq(body.agentFaq);
  if (body.agentNotes !== undefined) patch.agentNotes = sanitizeAgentNotes(body.agentNotes);
  if (typeof body.published === "boolean") patch.published = body.published;

  // La insignia de verificado no se autoasigna: la concede Stripe Identity o el equipo.
  // Se rechaza en voz alta en vez de ignorarse, para que un intento no parezca aceptado.
  if (body.verified !== undefined) {
    return NextResponse.json(
      {
        error:
          "La insignia de verificado no se edita desde aquí: se obtiene verificando tu identidad en «Verificación».",
      },
      { status: 403 }
    );
  }
  if (body.bookingApprovalMode === "instant" || body.bookingApprovalMode === "approval") {
    patch.bookingApprovalMode = body.bookingApprovalMode;
  }
  if (typeof body.requireCreditCheck === "boolean") {
    patch.requireCreditCheck = body.requireCreditCheck;
  }
  if (body.creditCheckPayer === "host" || body.creditCheckPayer === "guest") {
    patch.creditCheckPayer = body.creditCheckPayer;
  }
  if (typeof body.chargeTax === "boolean") {
    patch.chargeTax = body.chargeTax;
  }
  if (body.contract !== undefined) {
    patch.contract = sanitizeListingContract(body.contract, listing.contract);
  }

  if (body.regenerateSlug === true && body.title) {
    patch.slug = slugifyTitle(String(body.title));
  }

  const touchesPrice = ["rentalMode", "pricePerMonth", "pricePerNight", "pricing"].some((k) => k in patch);
  if (touchesPrice) {
    const merged = { ...listing, ...patch };
    if (merged.rentalMode === "monthly" && !(merged.pricePerMonth && merged.pricePerMonth > 0)) {
      return NextResponse.json({ error: "Escribe la renta mensual." }, { status: 400 });
    }
    Object.assign(patch, applyRentalMode(merged));
  }

  const touchesAddress = ["addressLine", "addressUnit", "noAddressUnit"].some((k) => k in patch);
  if (touchesAddress || patch.published === true) {
    const merged = { ...listing, ...patch };
    const problem = merged.published ? exactAddressProblem(merged) : null;
    if (problem) {
      return NextResponse.json(
        { error: problem, code: "exact_address_required" },
        { status: 400 }
      );
    }
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
  deleteProofsForListing(id);
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
