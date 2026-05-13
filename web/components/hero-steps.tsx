const steps = [
  {
    n: "01",
    title: "Directorio de Anfitriones Verificados",
    body:
      "Reserva con confianza: conectamos viajeros con anfitriones verificados y reducimos el riesgo de fraudes. Cada perfil es revisado para garantizar autenticidad y seguridad.",
  },
  {
    n: "02",
    title: "Accede a la Información de los Anfitriones",
    body:
      "Transparencia total: obtén todos los detalles del alojamiento para tomar la mejor decisión. Consulta distintas formas de contacto y opciones de reserva.",
  },
  {
    n: "03",
    title: "Evalúa al Anfitrión con Opiniones Reales",
    body:
      "Consulta valoraciones y referencias en distintos sitios. Transparencia total: revisa la reputación antes de reservar.",
  },
];

export function HeroSteps() {
  return (
    <section className="relative overflow-hidden border-b border-stone-200/80 bg-gradient-to-b from-amber-50/80 to-[color:var(--urb-bg)]">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-800/90">
            Marketplace de estadías
          </p>
          <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl md:text-5xl">
            Encuentra tu próximo hogar lejos de casa
          </h1>
          <p className="mt-4 text-pretty text-base text-stone-600 sm:text-lg">
            Directorio curado de anfitriones verificados. Explora, compara y contacta con
            total transparencia — la misma experiencia visual que ya conoces, con una base
            técnica pensada para escalar.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {steps.map((s) => (
            <article
              key={s.n}
              className="group relative flex flex-col rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:border-amber-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-3xl font-bold tabular-nums text-amber-600/90">
                  {s.n}
                </span>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                  /por noche aprox.
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold leading-snug text-stone-900">
                – {s.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">{s.body}</p>
              <button
                type="button"
                className="mt-6 text-left text-sm font-semibold text-amber-800 underline-offset-4 transition group-hover:underline"
              >
                Ver datos de contacto y perfil en otras plataformas
              </button>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          <label className="sr-only" htmlFor="search-more">
            Más opciones de búsqueda
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="search-more"
              type="search"
              placeholder="Destino, barrio o referencia…"
              className="min-h-12 flex-1 rounded-full border border-stone-200 bg-white px-5 text-sm text-stone-900 shadow-inner outline-none ring-amber-500/0 transition placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
            />
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-400"
            >
              Más opciones de búsqueda
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
