import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "beeagent-agent-status.json");

export type BeeagentAgentStatus = {
  hostId: string;
  active: boolean;
  customerAgentId?: string;
  updatedAt: string;
};

const rows = new Map<string, BeeagentAgentStatus>();
let cachedMtime = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(
      DATA_FILE,
      JSON.stringify({ version: 1, statuses: [...rows.values()] }, null, 2),
      "utf8"
    );
    if (existsSync(DATA_FILE)) cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[beeagent-agent-status] persist:", e);
  }
}

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { statuses?: BeeagentAgentStatus[] };
    rows.clear();
    for (const r of data.statuses ?? []) {
      if (r?.hostId) rows.set(r.hostId, r);
    }
    cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[beeagent-agent-status] load:", e);
  }
}

function sync() {
  try {
    if (!existsSync(DATA_FILE)) return;
    if (statSync(DATA_FILE).mtimeMs === cachedMtime) return;
    reload();
  } catch {
    /* ignore */
  }
}

reload();

export function getBeeagentAgentStatus(hostId: string): BeeagentAgentStatus | undefined {
  sync();
  return rows.get(hostId);
}

export function setBeeagentAgentStatus(input: {
  hostId: string;
  active: boolean;
  customerAgentId?: string;
}): BeeagentAgentStatus {
  sync();
  const rec: BeeagentAgentStatus = {
    hostId: input.hostId,
    active: Boolean(input.active),
    customerAgentId: input.customerAgentId?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  rows.set(input.hostId, rec);
  persist();
  return rec;
}
