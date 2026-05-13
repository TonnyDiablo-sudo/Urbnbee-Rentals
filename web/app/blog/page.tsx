import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAllPostsSorted, getPostOfTheDay } from "@/lib/blog";

export default function BlogIndexPage() {
  const featured = getPostOfTheDay();
  const posts = getAllPostsSorted();
  const gridPosts = posts.filter((p) => p.slug !== featured.slug);

  return (
    <>
      <SiteHeader />
      <main className="bg-[#fafafa]" style={{ paddingTop: 88 }}>
        {/* Hero + featured: dos columnas en desktop */}
        <div className="border-b border-[#ebebeb] bg-white">
          <div className="mx-auto max-w-7xl px-4 pt-8 pb-10 sm:px-6 lg:px-8 lg:pt-12 lg:pb-14">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 lg:items-start">
              <header className="lg:col-span-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#dcb81e]">Blog Urbnbee</p>
                <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#222] sm:text-4xl">
                  Ideas para tu alojamiento
                </h1>
                <p className="mt-4 text-sm leading-relaxed text-[#666]">
                  Notas sobre hospedar mejor, usar Urbnbee con claridad y sacar partido a{" "}
                  <strong>Urbnbee AI</strong> sin perder el trato humano.
                </p>
                <div className="mt-8 hidden lg:block rounded-xl border border-[#ebebeb] bg-[#fafafa] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Hoy te recomendamos</p>
                  <p className="mt-2 text-sm text-[#555]">
                    Cada día destacamos una lectura distinta del archivo — ideal para empezar si vienes por primera vez.
                  </p>
                </div>
              </header>

              <article
                className="lg:col-span-7 rounded-2xl border border-[#ebebeb] bg-[#fafafa] p-6 shadow-sm sm:p-8"
                aria-labelledby="featured-title"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#dcb81e]">
                  Lectura del día · Urbnbee
                </p>
                <h2 id="featured-title" className="mt-3 text-xl font-semibold leading-snug text-[#222] sm:text-2xl">
                  <Link href={`/blog/${featured.slug}`} className="transition hover:text-black hover:underline">
                    {featured.title}
                  </Link>
                </h2>
                <time className="mt-2 block text-xs tabular-nums text-[#aaa]" dateTime={featured.publishedAt}>
                  {featured.publishedAt}
                </time>
                <p className="mt-5 text-sm leading-relaxed text-[#484848] line-clamp-4 sm:line-clamp-none">
                  {featured.excerpt}
                </p>
                <Link
                  href={`/blog/${featured.slug}`}
                  className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold text-black shadow-sm transition hover:brightness-95"
                  style={{ backgroundColor: "#dcb81e" }}
                >
                  Leer artículo completo
                </Link>
              </article>
            </div>
          </div>
        </div>

        {/* Grid de artículos */}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#222]">Más artículos</h2>
              <p className="mt-1 text-sm text-[#888]">
                {posts.length} entradas · consejos, Urbnbee AI y experiencia de huéspedes
              </p>
            </div>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {gridPosts.map((p) => (
              <li key={p.slug} className="h-full">
                <Link
                  href={`/blog/${p.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-[#ebebeb] bg-white p-5 shadow-sm transition hover:border-[#dcb81e]/40 hover:shadow-md"
                >
                  <time className="text-xs tabular-nums text-[#aaa]" dateTime={p.publishedAt}>
                    {p.publishedAt}
                  </time>
                  <h3 className="mt-3 text-base font-semibold leading-snug text-[#222] group-hover:text-black group-hover:underline">
                    {p.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#666] line-clamp-3">{p.excerpt}</p>
                  <span className="mt-4 text-sm font-medium text-[#dcb81e]">
                    Leer más <span aria-hidden>→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {gridPosts.length === 0 && (
            <p className="mt-8 text-center text-sm text-[#888]">No hay más artículos en la lista.</p>
          )}

          <p className="mt-14 text-center text-xs text-[#aaa]">
            Urbnbee · Urbnbee AI · contenido para anfitriones y huéspedes en México y LATAM.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
