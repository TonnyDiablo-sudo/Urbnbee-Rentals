import Link from "next/link";
import { IconShield } from "./icons";

/** Pantalla para quien todavía no tiene cuenta: explica para qué la necesita y lo lleva a crearla. */
export function AuthGate({
  title,
  message,
  next,
  host = false,
  perks,
}: {
  title: string;
  message: string;
  next: string;
  /** La cuenta se crea ya como anfitrión. */
  host?: boolean;
  perks?: string[];
}) {
  const q = `next=${encodeURIComponent(next)}${host ? "&modo=anfitrion" : ""}`;
  return (
    <div className="flex flex-1 flex-col px-6 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf6d8] text-[#b8931a]">
        <IconShield className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-[#222]">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#555]">{message}</p>
      {perks && perks.length > 0 && (
        <ul className="mt-5 space-y-2.5 text-sm text-[#333]">
          {perks.map((p) => (
            <li key={p} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#dcb81e]" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 space-y-3">
        <Link
          href={`/cuenta/registro?${q}`}
          className="block w-full rounded-xl bg-[#dcb81e] py-3.5 text-center text-[15px] font-semibold text-black active:brightness-95"
        >
          {host ? "Crear cuenta de anfitrión" : "Crear cuenta gratis"}
        </Link>
        <Link
          href={`/cuenta/entrar?${q}`}
          className="block w-full rounded-xl border border-[#222] py-3.5 text-center text-[15px] font-semibold text-[#222] active:bg-[#f5f5f5]"
        >
          Ya tengo cuenta
        </Link>
      </div>
    </div>
  );
}
