export const metadata = { title: "Sin conexión" };

export default function AppOfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-24 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />
      <h1 className="mt-6 text-xl font-bold text-[#222]">Sin conexión</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#717171]">
        Revisa tu internet. Cabibee se actualiza solo en cuanto vuelvas a tener señal.
      </p>
      <a href="/app" className="mt-6 rounded-xl bg-[#dcb81e] px-6 py-3 text-sm font-semibold text-black">
        Reintentar
      </a>
    </div>
  );
}
