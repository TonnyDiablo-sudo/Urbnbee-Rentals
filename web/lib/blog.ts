import { BLOG_POSTS } from "@/lib/blog-data";
import { listPublishedFromDisk } from "@/lib/blog-published-store";
import type { BlogPost } from "@/lib/blog-types";

function scrubBrand(text: string): string {
  return text
    .replace(/Urbnbee AI/g, "Cabibee")
    .replace(/BeeBot/g, "el asistente de Cabibee")
    .replace(/\bUrbnbee\b/g, "Cabibee");
}

/** Los textos semilla traían solo tres párrafos. Esto los cierra para que el artículo se lea entero. */
function completePost(post: BlogPost): BlogPost {
  const title = scrubBrand(post.title);
  const excerpt = scrubBrand(post.excerpt);
  const paragraphs = post.paragraphs.map(scrubBrand);
  if (paragraphs.length >= 6) return { ...post, title, excerpt, paragraphs };
  const topic = title.replace(/\s+/g, " ").trim();
  return {
    ...post,
    title,
    excerpt,
    paragraphs: [
      ...paragraphs,
      `Esto es lo que puedes hacer hoy en Cabibee, a partir de «${topic}». Abre el anuncio y revisa la primera pantalla: título, fotos y precio. Si uno de los tres no coincide con la estancia real, corrígelo antes de seguir.`,
      "Después baja a las reglas y a la capacidad. Escribe en una lista corta cuántas personas caben, cómo se entra y qué no está permitido. Un huésped con prisa tiene que entenderlo sin escribirte.",
      "Cierra el repaso leyendo el texto en voz alta. Si suena a promesa que no puedes cumplir, cámbialo. En Cabibee el anuncio, el asistente y tu respuesta personal tienen que decir lo mismo. Así el lugar se siente seguro para quien llega y para quien recibe.",
    ],
  };
}

/** Combina artículos estáticos (`blog-data.ts`) + publicados en disco (`data/blog-published-posts.json`). */
export function getAllPostsMerged(): BlogPost[] {
  const disk = listPublishedFromDisk();
  const staticSlugs = new Set(BLOG_POSTS.map((p) => p.slug));
  const out = BLOG_POSTS.map(completePost);
  for (const p of disk) {
    if (!staticSlugs.has(p.slug)) out.push(completePost(p));
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
  if (disk) return completePost(disk);
  const found = BLOG_POSTS.find((p) => p.slug === slug);
  return found ? completePost(found) : undefined;
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
