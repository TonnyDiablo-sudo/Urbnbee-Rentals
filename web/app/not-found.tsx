import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-5xl font-bold text-[#dcb81e]">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-[#222]">{t("No encontramos esta página")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#555]">
        {t("Puede que el enlace esté mal escrito o que la página ya no exista.")}
      </p>
      <Link href="/" className="mt-6 rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white">
        {t("Ir al inicio")}
      </Link>
    </main>
  );
}
