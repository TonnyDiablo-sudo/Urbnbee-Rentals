import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ContractViewClient } from "./contract-view-client";

export default async function ContratoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\D/g, "").slice(0, 6);

  return (
    <>
      <SiteHeader />
      <div style={{ paddingTop: 72 }}>
        <ContractViewClient token={token.length === 6 ? token : ""} />
      </div>
      <SiteFooter />
    </>
  );
}
