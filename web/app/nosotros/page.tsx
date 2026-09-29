import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhoWeAre } from "@/components/who-we-are";

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
