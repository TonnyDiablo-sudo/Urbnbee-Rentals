import { NextRequest, NextResponse } from "next/server";
import { resolveBookingForContract } from "@/lib/booking-contract-access";
import { bookingContractPdf } from "@/lib/booking-contract-pdf";
import { contractIsFullyAccepted, contractPlainLines } from "@/lib/booking-contract";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const id = req.nextUrl.searchParams.get("id");
  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();

  const resolved = await resolveBookingForContract(token, id);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const { booking } = resolved;
  if (!booking.contract) {
    return NextResponse.json(
      { error: "Esta reserva todavía no tiene contrato." },
      { status: 409 }
    );
  }

  const filename = `contrato-cabibee-${booking.token}`;

  if (format === "pdf") {
    const pdf = bookingContractPdf(booking.contract);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  if (format === "txt") {
    const body = contractPlainLines(booking.contract).join("\r\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.txt"`,
      },
    });
  }

  return NextResponse.json({
    bookingId: booking.id,
    token: booking.token,
    status: booking.status,
    accepted: contractIsFullyAccepted(booking.contract),
    contract: booking.contract,
    lines: contractPlainLines(booking.contract),
  });
}
