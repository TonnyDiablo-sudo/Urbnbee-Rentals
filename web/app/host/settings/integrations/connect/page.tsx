import { parseAllowedConnectReturnUrl } from "@/lib/beeagent-partner";
import { ConnectClient } from "./connect-client";

export default async function ConnectBeeagentPage({
  searchParams,
}: {
  searchParams: Promise<{ return_url?: string; state?: string }>;
}) {
  const q = await searchParams;
  const dest = parseAllowedConnectReturnUrl(typeof q.return_url === "string" ? q.return_url : "");
  if (!dest) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold text-[#484848]">No se puede conectar</h1>
        <p className="mt-3 text-sm text-[#666]">
          El destino de regreso no está en la lista permitida. Pide a urbnbeeai que use un
          <code className="mx-1">return_url</code> de su dominio.
        </p>
        <a href="/host/settings/integrations" className="mt-6 inline-block text-sm text-[#dcb81e] underline">
          Volver a Integraciones
        </a>
      </div>
    );
  }

  return <ConnectClient returnUrl={dest.toString()} state={typeof q.state === "string" ? q.state : ""} />;
}
