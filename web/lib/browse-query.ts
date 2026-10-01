function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Texto libre contra título, ciudad, zona o tipo. «cabañas» también encuentra «cabaña». */
export function matchesBrowseQuery(text: string, q: string): boolean {
  const query = normalize(q.trim());
  if (!query) return true;
  const hay = normalize(text);
  if (hay.includes(query)) return true;
  const stem = query.replace(/es$/, "").replace(/s$/, "");
  return stem.length >= 4 && hay.includes(stem);
}
