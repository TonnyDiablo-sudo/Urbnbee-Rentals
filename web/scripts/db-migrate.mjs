/**
 * Aplica web/sql/*.sql en orden contra MySQL.
 * Requiere DATABASE_URL (mysql://...) o MYSQL_URL o DB_HOST + DB_USER + DB_PASSWORD + DB_NAME.
 */
import { readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseConnectionString(urlString) {
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
}

function getConfig() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.MYSQL_URL,
    process.env.DATABASE_PRIVATE_URL,
  ].filter(Boolean);
  for (const c of candidates) {
    const p = parseConnectionString(c);
    if (p) return { ...p, multipleStatements: true };
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
      multipleStatements: true,
    };
  }
  throw new Error(
    "Falta conexión MySQL: define DATABASE_URL o MYSQL_URL, o DB_HOST, DB_USER, DB_PASSWORD, DB_NAME"
  );
}

const sqlDir = join(__dirname, "..", "sql");
const files = readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const cfg = getConfig();
const conn = await mysql.createConnection(cfg);
try {
  for (const f of files) {
    const sql = readFileSync(join(sqlDir, f), "utf8");
    await conn.query(sql);
    console.log("db-migrate: OK", f);
  }

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'urb_users' AND COLUMN_NAME = 'address_line'`,
    [cfg.database]
  );
  if (!Array.isArray(cols) || cols.length === 0) {
    await conn.query("ALTER TABLE urb_users ADD COLUMN address_line VARCHAR(512) NULL");
    console.log("db-migrate: OK urb_users.address_line");
  }
} finally {
  await conn.end();
}
