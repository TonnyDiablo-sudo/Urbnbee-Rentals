import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { requestProto } from "@/lib/app-host";
import { chromeExtensionZip } from "@/lib/chrome-extension-zip";

export const runtime = "nodejs";

/** Descarga de la extensión de Chrome, sólo para asociados con sesión. */
export async function GET(req: NextRequest) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const server = `${requestProto(req.headers.get("x-forwarded-proto"), host)}://${host.replace(/^app\./i, "")}`;
  const zip = chromeExtensionZip(server);
  if (!zip) return NextResponse.json({ error: "La extensión no está en el servidor." }, { status: 404 });

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="cabibee-extension.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
