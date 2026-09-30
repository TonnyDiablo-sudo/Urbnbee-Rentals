import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { LangProvider } from "@/components/i18n-provider";
import { getLang, getT } from "@/lib/i18n/server";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: {
      default: t("Cabibee — Alojamientos verificados"),
      template: "%s · Cabibee",
    },
    description: t(
      "Directorio de anfitriones verificados. Explora habitaciones, casas, departamentos y más con transparencia total."
    ),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${roboto.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased font-sans">
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
