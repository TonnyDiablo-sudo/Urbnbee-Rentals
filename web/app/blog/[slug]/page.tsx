import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAllPostsSorted, getAllSlugs, getPostBySlug } from "@/lib/blog";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = true;

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Artículo" };
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getAllPostsSorted()
    .filter((p) => p.slug !== slug)
    .slice(0, 5);

  return (
    <>
      <SiteHeader />
      <article className="bg-[#fafafa]" style={{ paddingTop: 88 }}>
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16">
            {/* Columna principal */}
            <div className="lg:col-span-8">
              <Link
                href="/blog"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#dcb81e] underline underline-offset-2 hover:text-[#b8931a]"
              >
                ← Blog Urbnbee
              </Link>
              <p className="mt-8 text-xs font-bold uppercase tracking-wider text-[#aaa]">Urbnbee · Alojamientos</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-[#222] sm:text-4xl">
                {post.title}
              </h1>
              <time className="mt-4 block text-sm text-[#aaa]" dateTime={post.publishedAt}>
                Publicado el {post.publishedAt}
              </time>

              <div className="mt-8 grid gap-8 lg:grid-cols-5 lg:gap-10">
                <p className="lg:col-span-2 rounded-xl border border-[#ebebeb] bg-white p-5 text-sm italic leading-relaxed text-[#555] shadow-sm lg:p-6">
                  {post.excerpt}
                </p>
                <div className="lg:col-span-3 space-y-6 text-[#3a3a3a]">
                  {post.paragraphs.slice(0, 1).map((para, i) => (
                    <p key={i} className="text-base leading-relaxed sm:text-[1.05rem] sm:leading-[1.75]">
                      {para}
                    </p>
                  ))}
                </div>
              </div>

              <div className="mt-10 space-y-6 border-t border-[#ebebeb] pt-10 text-sm leading-relaxed text-[#3a3a3a] sm:text-base sm:leading-[1.75]">
                {post.paragraphs.slice(1).map((para, i) => (
                  <p key={i + 1}>{para}</p>
                ))}
              </div>

              <p
                className="mt-12 rounded-2xl bg-white p-6 text-center text-sm text-[#666] shadow-sm"
                style={{ border: "1px solid #ebebeb" }}
              >
                ¿Listo para aplicarlo? Explora{" "}
                <Link href="/" className="font-semibold text-[#dcb81e] underline">
                  alojamientos en Urbnbee
                </Link>{" "}
                o entra a tu panel de anfitrión.
              </p>
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <div className="sticky top-28 space-y-8">
                <div className="rounded-2xl border border-[#ebebeb] bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">En este artículo</p>
                  <p className="mt-2 text-sm text-[#666] leading-relaxed">
                    Tips prácticos alineados con Urbnbee y Urbnbee AI: transparencia, calendario y buena comunicación.
                  </p>
                </div>

                {related.length > 0 && (
                  <div className="rounded-2xl border border-[#ebebeb] bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Seguir leyendo</p>
                    <ul className="mt-4 space-y-3">
                      {related.map((r) => (
                        <li key={r.slug}>
                          <Link
                            href={`/blog/${r.slug}`}
                            className="group block rounded-lg border border-transparent p-2 -m-2 transition hover:border-[#ebebeb] hover:bg-[#fafafa]"
                          >
                            <span className="text-xs text-[#aaa] tabular-nums">{r.publishedAt}</span>
                            <span className="mt-1 block text-sm font-medium leading-snug text-[#333] group-hover:text-[#dcb81e] group-hover:underline">
                              {r.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/blog"
                      className="mt-4 inline-block text-sm font-medium text-[#dcb81e] hover:underline"
                    >
                      Ver todos los artículos →
                    </Link>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </article>
      <SiteFooter />
    </>
  );
}
