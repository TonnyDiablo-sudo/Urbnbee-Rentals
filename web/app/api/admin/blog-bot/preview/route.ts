import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { generateBlogPostWithLlm } from "@/lib/blog-bot-generate";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let dateIso: string | undefined;
  let topicAngle: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.publishedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.publishedAt)) {
      dateIso = body.publishedAt;
    }
    if (typeof body?.topicAngle === "string" && body.topicAngle.trim()) {
      topicAngle = body.topicAngle.trim();
    }
  } catch {
    /* empty body ok */
  }

  const result = await generateBlogPostWithLlm({ dateIso, topicAngle });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.detail ? 422 : 400 }
    );
  }

  return NextResponse.json({
    post: result.post,
    note:
      "Vista previa: los artículos guardados en disco aparecen en el blog junto con los de blog-data.ts.",
  });
}
