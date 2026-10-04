import { parseAllowedConnectReturnUrl } from "@/lib/beeagent-partner";
import { DEFAULT_BOT_PERMISSIONS } from "@/lib/beeagent-permission-defs";
import { getBotPermissions } from "@/lib/beeagent-permissions";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { ConnectClient } from "./connect-client";

export default async function ConnectBeeagentPage({
  searchParams,
}: {
  searchParams: Promise<{ return_url?: string; state?: string }>;
}) {
  const q = await searchParams;
  const dest = parseAllowedConnectReturnUrl(typeof q.return_url === "string" ? q.return_url : "");
  if (!dest) {
    const t = await getT();
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold text-[#484848]">{t("No se puede conectar")}</h1>
        <p className="mt-3 text-sm text-[#666]">
          {t("El destino de regreso no está en la lista permitida. Pide a urbnbeeai que use un")}
          <code className="mx-1">return_url</code>
          {t("de su dominio.")}
        </p>
        <a href="/host/settings/integrations" className="mt-6 inline-block text-sm text-[#dcb81e] underline">
          {t("Volver a Integraciones")}
        </a>
      </div>
    );
  }

  const user = await getSessionUser();
  return (
    <ConnectClient
      returnUrl={dest.toString()}
      state={typeof q.state === "string" ? q.state : ""}
      initialPermissions={user ? getBotPermissions(user.id) : DEFAULT_BOT_PERMISSIONS}
    />
  );;
}
