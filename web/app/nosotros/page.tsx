import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhoWeAre } from "@/components/who-we-are";

export const metadata: Metadata = {
  title: "Quiénes somos",
  description: "Cabibee es un lugar seguro para hospedarte. Sabes quién te recibe, ves el lugar y tu reserva queda guardada.",
};

export default function NosotrosPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white" style={{ paddingTop: "72px" }}>
        <WhoWeAre />
      </main>
      <SiteFooter />
    </>
  );
}
