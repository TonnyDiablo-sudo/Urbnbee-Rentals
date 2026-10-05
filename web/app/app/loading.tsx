export default function AppLoading() {
  return (
    <div
      className="animate-pulse px-5"
      style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}
      role="status"
      aria-label="Cargando"
    >
      <div className="h-8 w-40 rounded-lg bg-[#eee]" />
      <div className="mt-5 h-12 w-full rounded-full bg-[#f0f0f0]" />
      <div className="mt-7 grid gap-x-5 gap-y-7 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={i === 2 ? "hidden lg:block" : i === 1 ? "hidden md:block" : ""}>
            <div className="aspect-[4/3] w-full rounded-2xl bg-[#eee]" />
            <div className="mt-3 h-4 w-2/3 rounded bg-[#eee]" />
            <div className="mt-2 h-4 w-1/2 rounded bg-[#f0f0f0]" />
          </div>
        ))}
      </div>
    </div>
  );
}
