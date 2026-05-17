#!/usr/bin/env node
/**
 * Wrapper de arranque para producción (Railway).
 *
 * 1) Si `URBNBEE_DATA_DIR` apunta a un volumen distinto de `./data`, copia los JSON semilla
 *    del bundle (`./data/*.json`) hacia el volumen — solo cuando el archivo destino NO existe.
 *    Así el primer deploy nace con blog/listings seed y los siguientes conservan lo que escribió la app.
 * 3) Si hay `DATABASE_URL` / `MYSQL_URL` / `DATABASE_PRIVATE_URL`, ejecuta `scripts/db-migrate.mjs`
 *    (idempotente) antes de levantar Next — así el schema existe en la red privada de Railway.
 * 4) Lanza `next start` heredando el PORT que Railway inyecta.
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
const bundledDataDir = join(cwd, "data");

function resolveOptional(envValue, fallback) {
  const raw = envValue?.trim();
  if (!raw) return fallback;
  return isAbsolute(raw) ? raw : resolve(cwd, raw);
}

const targetDataDir = resolveOptional(process.env.URBNBEE_DATA_DIR, bundledDataDir);
const targetUploadsDir = resolveOptional(
  process.env.URBNBEE_UPLOADS_DIR,
  join(cwd, "public", "uploads")
);

try {
  mkdirSync(targetDataDir, { recursive: true });
} catch (e) {
  console.warn("[start] mkdir data falló:", targetDataDir, e?.message);
}
try {
  mkdirSync(targetUploadsDir, { recursive: true });
} catch (e) {
  console.warn("[start] mkdir uploads falló:", targetUploadsDir, e?.message);
}

if (existsSync(bundledDataDir) && resolve(targetDataDir) !== resolve(bundledDataDir)) {
  try {
    for (const f of readdirSync(bundledDataDir)) {
      const src = join(bundledDataDir, f);
      const dst = join(targetDataDir, f);
      try {
        if (!statSync(src).isFile()) continue;
      } catch {
        continue;
      }
      if (!existsSync(dst)) {
        try {
          copyFileSync(src, dst);
          console.log(`[start] seed copiado: ${f} → ${targetDataDir}`);
        } catch (e) {
          console.warn(`[start] no pude copiar seed ${f}:`, e?.message);
        }
      }
    }
  } catch (e) {
    console.warn("[start] seed walk falló:", e?.message);
  }
}

console.log(`[start] DATA_DIR=${targetDataDir}`);
console.log(`[start] UPLOADS_DIR=${targetUploadsDir}`);
console.log(`[start] PORT=${process.env.PORT ?? "(default)"}`);

const dbUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.MYSQL_URL?.trim() ||
  process.env.DATABASE_PRIVATE_URL?.trim();
if (dbUrl) {
  const migrateScript = join(cwd, "scripts", "db-migrate.mjs");
  console.log("[start] DATABASE_URL/MYSQL_URL presente → ejecutando db:migrate");
  const mig = spawnSync(process.execPath, [migrateScript], {
    stdio: "inherit",
    cwd,
    env: process.env,
  });
  if (mig.status !== 0) {
    console.error("[start] db-migrate falló con código", mig.status);
    process.exit(mig.status ?? 1);
  }
}

if (process.env.URBNBEE_ADMIN_EMAIL?.trim()) {
  const bootstrapScript = join(cwd, "scripts", "bootstrap-admin.mjs");
  const boot = spawnSync(process.execPath, [bootstrapScript], {
    stdio: "inherit",
    cwd,
    env: process.env,
  });
  if (boot.status !== 0) {
    console.warn("[start] bootstrap-admin terminó con código", boot.status);
  }
}

const __filename = fileURLToPath(import.meta.url);
void __filename;

const isWin = process.platform === "win32";
const child = spawn(isWin ? "npx.cmd" : "npx", ["next", "start"], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
