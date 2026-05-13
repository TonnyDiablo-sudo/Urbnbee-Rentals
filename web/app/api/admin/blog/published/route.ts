import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { BLOG_POSTS } from "@/lib/blog-data";
import { listPublishedFromDisk } from "@/lib/blog-published-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staticSlugs = new Set(BLOG_POSTS.map((p) => p.slug));
  const disk = listPublishedFromDisk();

  const rows = [
    ...BLOG_POSTS.map((p) => ({
      ...p,
      source: "static" as const,
      origin: "Código (blog-data.ts)",
    })),
    ...disk
      .filter((p) => !staticSlugs.has(p.slug))
      .map((p) => ({
        ...p,
        source: "disk" as const,
        origin: "Archivo (blog-published-posts.json)",
      })),
  ];

  rows.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const allSlugs = new Set([
    ...BLOG_POSTS.map((p) => p.slug),
    ...disk.map((p) => p.slug),
  ]);

  return NextResponse.json({
    posts: rows,
    counts: {
      static: BLOG_POSTS.length,
      disk: disk.length,
      totalUnique: allSlugs.size,
    },
  });
}
