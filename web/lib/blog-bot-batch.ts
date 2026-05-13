import type { BlogPost } from "@/lib/blog-types";
import { BLOG_POSTS } from "@/lib/blog-data";
import {
  appendPublishedPost,
  dedupeSlug,
  listPublishedFromDisk,
} from "@/lib/blog-published-store";
import { DEFAULT_BLOG_TOPICS, getBlogBotConfig } from "@/lib/blog-bot-store";
import { generateBlogPostWithLlm } from "@/lib/blog-bot-generate";

function allTakenSlugs(): Set<string> {
  const s = new Set<string>();
  for (const p of BLOG_POSTS) s.add(p.slug);
  for (const p of listPublishedFromDisk()) s.add(p.slug);
  return s;
}

function addDaysToIsoDate(startYyyyMmDd: string, daysToAdd: number): string {
  const [y, m, d] = startYyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + daysToAdd);
  return dt.toISOString().slice(0, 10);
}

export async function runBlogBatchGenerate(params: {
  count: number;
  startDateIso?: string;
  skipEnabledCheck?: boolean;
}): Promise<{ posts: BlogPost[]; errors: string[] }> {
  const cfg = getBlogBotConfig();
  const topics = cfg.topics?.length ? cfg.topics : DEFAULT_BLOG_TOPICS;
  const taken = allTakenSlugs();
  const posts: BlogPost[] = [];
  const errors: string[] = [];

  const start =
    params.startDateIso && /^\d{4}-\d{2}-\d{2}$/.test(params.startDateIso)
      ? params.startDateIso
      : new Date().toISOString().slice(0, 10);

  for (let i = 0; i < params.count; i++) {
    const dateIso = addDaysToIsoDate(start, i);
    const topic = topics[i % topics.length];
    const res = await generateBlogPostWithLlm({
      dateIso,
      topicAngle: topic,
      skipEnabledCheck: params.skipEnabledCheck,
    });
    if (!res.ok) {
      errors.push(`Entrada ${i + 1}/${params.count}: ${res.error}`);
      continue;
    }
    let slug = res.post.slug;
    slug = dedupeSlug(slug, taken);
    taken.add(slug);
    const post: BlogPost = {
      ...res.post,
      slug,
      publishedAt: res.post.publishedAt || dateIso,
    };
    appendPublishedPost(post);
    posts.push(post);
    await new Promise((r) => setTimeout(r, 350));
  }

  return { posts, errors };
}
