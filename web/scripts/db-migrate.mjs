/**
 * Aplica web/sql/001_schema.sql contra MySQL.
 * Requiere DATABASE_URL (mysql://...) o MYSQL_URL o DB_HOST + DB_USER + DB_PASSWORD + DB_NAME.
 */
import { readFileSync } from "fs";
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

const sqlPath = join(__dirname, "..", "sql", "001_schema.sql");
const sql = readFileSync(sqlPath, "utf8");

const cfg = getConfig();
const conn = await mysql.createConnection(cfg);
try {
  await conn.query(sql);
  console.log("db-migrate: OK (001_schema.sql)");
} finally {
  await conn.end();
}
