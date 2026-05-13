import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { runBlogBatchGenerate } from "@/lib/blog-bot-batch";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    count?: number;
    startDateIso?: string;
    /** Si true, exige bot habilitado (por defecto false: permite generar con solo API key). */
    requireBotEnabled?: boolean;
  };

  const count = Math.min(12, Math.max(1, Math.floor(Number(body.count) || 5)));
  const startDateIso =
    typeof body.startDateIso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDateIso)
      ? body.startDateIso
      : undefined;

  const skipEnabledCheck = !body.requireBotEnabled;

  const { posts, errors } = await runBlogBatchGenerate({
    count,
    startDateIso,
    skipEnabledCheck,
  });

  return NextResponse.json({
    generated: posts.length,
    posts,
    errors,
    message:
      posts.length > 0
        ? `${posts.length} artículo(s) guardados en data/blog-published-posts.json y visibles en el blog.`
        : "No se generó ningún artículo.",
  });
}
