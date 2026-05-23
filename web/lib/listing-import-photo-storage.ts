import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getUploadsDir } from "@/lib/runtime-paths";

export async function saveListingPhotoBuffer(
  listingId: string,
  buf: Buffer,
  ext: "jpg" | "png" | "webp" = "jpg"
): Promise<string> {
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(getUploadsDir(), "host-listings", listingId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/host-listings/${listingId}/${name}`;
}
