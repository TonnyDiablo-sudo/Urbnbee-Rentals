import { NextRequest, NextResponse } from "next/server";
import { BLOG_POSTS } from "@/lib/blog-data";
import { generateBlogPostWithLlm } from "@/lib/blog-bot-generate";
import { DEFAULT_BLOG_TOPICS, getBlogBotConfig, patchBlogBotConfig } from "@/lib/blog-bot-store";
import {
  appendPublishedPost,
  dedupeSlug,
  listPublishedFromDisk,
} from "@/lib/blog-published-store";
import { getYyyyMmDdInTimezone, matchesBlogSchedule } from "@/lib/blog-schedule";

export const runtime = "nodejs";

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getBlogBotConfig();
  if (!config.enabled || !config.scheduleEnabled) {
    return NextResponse.json({ skipped: true, reason: "bot_or_schedule_off" });
  }

  if (!matchesBlogSchedule(config)) {
    return NextResponse.json({ skipped: true, reason: "outside_window" });
  }

  const tz = config.scheduleTimezone?.trim() || "America/Mexico_City";
  const today = getYyyyMmDdInTimezone(new Date(), tz);
  if (config.scheduleLastPublishedDate === today) {
    return NextResponse.json({ skipped: true, reason: "already_published_today" });
  }

  const topics = config.topics?.length ? config.topics : DEFAULT_BLOG_TOPICS;
  let idx = 0;
  for (let i = 0; i < today.length; i++) idx += today.charCodeAt(i);
  const topic = topics[idx % topics.length];

  const res = await generateBlogPostWithLlm({
    dateIso: today,
    topicAngle: topic,
    skipEnabledCheck: false,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error, detail: res.detail }, { status: 400 });
  }

  const taken = new Set([
    ...BLOG_POSTS.map((p) => p.slug),
    ...listPublishedFromDisk().map((p) => p.slug),
  ]);
  const slug = dedupeSlug(res.post.slug, taken);
  appendPublishedPost({
    ...res.post,
    slug,
    publishedAt: res.post.publishedAt || today,
  });

  patchBlogBotConfig({ scheduleLastPublishedDate: today });

  return NextResponse.json({ ok: true, slug, topic, publishedAt: today });
}
