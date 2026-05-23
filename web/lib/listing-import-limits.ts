export const LISTING_IMPORT_MAX_IMAGES = 6;
export const LISTING_IMPORT_MAX_BYTES_PER_IMAGE = 5 * 1024 * 1024;
export const LISTING_IMPORT_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const LISTING_IMPORT_MAX_NOTES_CHARS = 4000;

export const LISTING_IMPORT_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function listingImportAiEnabled(): boolean {
  const flag = process.env.LISTING_IMPORT_AI_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  const key =
    process.env.BLOG_BOT_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.LISTING_IMPORT_OPENAI_API_KEY?.trim();
  return Boolean(key);
}
