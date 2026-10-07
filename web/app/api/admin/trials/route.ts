import { NextRequest, NextResponse } from "next/server";
import { FAMILY_COPY } from "@/lib/membership-plans-store";
import { getSessionUser } from "@/lib/session";
import { TRIAL_DAY_OPTIONS, TRIAL_FAMILIES, TRIAL_MAX_COLLABORATORS } from "@/lib/tool-trial";
import { saveTrialSettings, trialSettings } from "@/lib/trial-settings-store";

export const dynamic = "force-dynamic";

async function isAdmin() {
  const user = await getSessionUser();
  return Boolean(user && user.role === "admin");
}

function payload() {
  return {
    ...trialSettings(),
    options: TRIAL_DAY_OPTIONS,
    tools: TRIAL_FAMILIES.map((f) => ({ family: f, label: FAMILY_COPY[f].label })),
    maxCollaborators: TRIAL_MAX_COLLABORATORS,
  };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(payload());
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown; days?: unknown };
  saveTrialSettings({ enabled: body.enabled, days: body.days });
  return NextResponse.json({ ok: true, ...payload() });
}
