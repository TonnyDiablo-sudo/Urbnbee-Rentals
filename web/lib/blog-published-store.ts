import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type { BlogPost } from "@/lib/blog-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "blog-published-posts.json");

let rows: BlogPost[] = [];
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(
      DATA_FILE,
      JSON.stringify({ version: 1 as const, posts: rows }, null, 2),
      "utf8"
    );
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[blog-published-store] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) {
      rows = [];
      return;
    }
    const raw = readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as { posts?: BlogPost[] };
    rows = Array.isArray(data.posts) ? data.posts.filter((p) => p?.slug && p?.title) : [];
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[blog-published-store] load failed:", e);
    rows = [];
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    reloadFromDisk();
  } catch {
    /* ignore */
  }
}

reloadFromDisk();

export function listPublishedFromDisk(): BlogPost[] {
  syncIfStale();
  return [...rows];
}

export function appendPublishedPosts(newPosts: BlogPost[]): void {
  syncIfStale();
  const existingSlugs = new Set(rows.map((r) => r.slug));
  for (const p of newPosts) {
    if (!existingSlugs.has(p.slug)) {
      rows.push(p);
      existingSlugs.add(p.slug);
    }
  }
  persist();
}

export function appendPublishedPost(post: BlogPost): void {
  appendPublishedPosts([post]);
}

/** Evita colisión de slug con conjunto existente. */
export function dedupeSlug(slug: string, taken: Set<string>): string {
  let s = slug;
  let n = 0;
  while (taken.has(s)) {
    n += 1;
    s = `${slug}-${n}`;
  }
  return s;
}
