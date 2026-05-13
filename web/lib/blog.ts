import { BLOG_POSTS } from "@/lib/blog-data";
import { listPublishedFromDisk } from "@/lib/blog-published-store";
import type { BlogPost } from "@/lib/blog-types";

/** Combina artículos estáticos (`blog-data.ts`) + publicados en disco (`data/blog-published-posts.json`). */
export function getAllPostsMerged(): BlogPost[] {
  const disk = listPublishedFromDisk();
  const staticSlugs = new Set(BLOG_POSTS.map((p) => p.slug));
  const out = [...BLOG_POSTS];
  for (const p of disk) {
    if (!staticSlugs.has(p.slug)) out.push(p);
  }
  return out.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getAllPostsSorted(): BlogPost[] {
  return getAllPostsMerged();
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  const disk = listPublishedFromDisk().find((p) => p.slug === slug);
  if (disk) return disk;
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/** Una entrada destacada distinta cada día civil (rotación sobre todos los posts disponibles). */
export function getPostOfTheDay(date = new Date()): BlogPost {
  const posts = getAllPostsMerged();
  if (posts.length === 0) {
    return BLOG_POSTS[0];
  }
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const idx = ((dayOfYear % posts.length) + posts.length) % posts.length;
  return posts[idx];
}

export function getAllSlugs(): string[] {
  return getAllPostsMerged().map((p) => p.slug);
}
