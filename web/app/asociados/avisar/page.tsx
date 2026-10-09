import { OUTREACH_RULES, outreachQuota, outreachRows, whatsappApiConfigured } from "@/lib/associate-outreach";
import type { OutreachChannel } from "@/lib/associate-outreach-store";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { OutreachBoard } from "./outreach-board";

const ORDER = { pendiente: 0, enviado: 1, respondio: 2, reclamo: 3, no_quiere: 4 } as const;
const CHANNELS: OutreachChannel[] = ["whatsapp", "messenger", "email", "whatsapp_api"];

export default async function OutreachPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const rows = outreachRows(user).sort(
    (a, b) => ORDER[a.state] - ORDER[b.state] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const quotas = Object.fromEntries(CHANNELS.map((c) => [c, outreachQuota(user.id, c)])) as Record<
    OutreachChannel,
    ReturnType<typeof outreachQuota>
  >;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("Por avisar")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          {t(
            "Avísale a cada dueño que le creamos su anuncio, con su enlace, su usuario y su contraseña temporal. Ve uno por uno y con calma: WhatsApp y Facebook bloquean a quien manda muchos mensajes iguales seguidos. Cabibee pone tope diario y espera entre mensajes."
          )}
        </p>
      </div>
      <OutreachBoard
        rows={rows}
        quotas={quotas}
        rules={OUTREACH_RULES}
        apiReady={whatsappApiConfigured()}
        showAssociate={user.role === "admin"}
      />
    </div>
  );
}
