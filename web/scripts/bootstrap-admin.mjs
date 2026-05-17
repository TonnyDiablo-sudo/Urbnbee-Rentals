#!/usr/bin/env node
/**
 * Promueve a admin el usuario con correo URBNBEE_ADMIN_EMAIL (idempotente).
 * Útil en Railway: define la variable y redeploy; el usuario debe existir ya.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const email = process.env.URBNBEE_ADMIN_EMAIL?.trim().toLowerCase();
if (!email) {
  process.exit(0);
}

const cwd = process.cwd();
const rawDir = process.env.URBNBEE_DATA_DIR?.trim();
const dataDir = rawDir
  ? isAbsolute(rawDir)
    ? rawDir
    : resolve(cwd, rawDir)
  : join(cwd, "data");
const storeFile = join(dataDir, "marketplace-store.json");

if (!existsSync(storeFile)) {
  console.warn("[bootstrap-admin] no existe", storeFile);
  process.exit(0);
}

let data;
try {
  data = JSON.parse(readFileSync(storeFile, "utf8"));
} catch (e) {
  console.warn("[bootstrap-admin] JSON inválido:", e?.message);
  process.exit(1);
}

const user = (data.users ?? []).find((u) => u?.email === email);
if (!user) {
  console.warn("[bootstrap-admin] no hay usuario con email:", email);
  process.exit(0);
}

if (user.role === "admin") {
  console.log("[bootstrap-admin] ya es admin:", email);
  process.exit(0);
}

user.role = "admin";
try {
  writeFileSync(storeFile, JSON.stringify(data, null, 2), "utf8");
  console.log("[bootstrap-admin] promovido a admin:", email);
} catch (e) {
  console.warn("[bootstrap-admin] no pude guardar:", e?.message);
  process.exit(1);
}
