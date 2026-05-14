import "server-only";
import mysql from "mysql2/promise";

export type MysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function parseConnectionString(urlString: string): MysqlConfig | null {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "mysql:" && u.protocol !== "mysql2:") return null;
    const database = u.pathname.replace(/^\//, "").split("?")[0];
    if (!database) return null;
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username || ""),
      password: decodeURIComponent(u.password || ""),
      database,
    };
  } catch {
    return null;
  }
}

/** Lee credenciales desde DATABASE_URL / MYSQL_URL / DB_* (Railway MySQL, PlanetScale, etc.). */
export function getMysqlConfigFromEnv(): MysqlConfig | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.MYSQL_URL,
    process.env.DATABASE_PRIVATE_URL,
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const p = parseConnectionString(c);
    if (p) return p;
  }
  if (
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD !== undefined &&
    process.env.DB_NAME
  ) {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
  }
  return null;
}

let pool: mysql.Pool | null = null;

export function isMysqlConfigured(): boolean {
  return getMysqlConfigFromEnv() !== null;
}

export function getMysqlPool(): mysql.Pool | null {
  const cfg = getMysqlConfigFromEnv();
  if (!cfg) return null;
  if (!pool) {
    pool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
    });
  }
  return pool;
}

export async function pingMysql(): Promise<{ ok: boolean; error?: string }> {
  const p = getMysqlPool();
  if (!p) return { ok: false, error: "not_configured" };
  try {
    await p.query("SELECT 1 AS ok");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
