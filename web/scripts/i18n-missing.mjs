#!/usr/bin/env node
/**
 * Lista las claves en español que no tienen traducción al inglés.
 *
 *   node scripts/i18n-missing.mjs            # t("…") + errores de API/lib
 *   node scripts/i18n-missing.mjs --labels   # además, posibles mapas de etiquetas
 *   node scripts/i18n-missing.mjs --json     # salida JSON { file: [keys] }
 *   node scripts/i18n-missing.mjs --dynamic  # además, lista las llamadas t(variable)
 *   node scripts/i18n-missing.mjs --hardcoded  # además, texto JSX/atributos que no pasan por t()
 *
 * Las props de texto de componentes (<Field label="…">) se cuentan como claves: esos componentes
 * traducen adentro. Se omiten las rutas de INTERNAL (API de socios, webhooks).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const WITH_LABELS = args.has("--labels");
const AS_JSON = args.has("--json");
const SHOW_DYNAMIC = args.has("--dynamic");
const SHOW_HARDCODED = args.has("--hardcoded");
const dynamic = [];
const hardcoded = [];
const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/** Herramientas internas (sólo en español) y APIs que no ve una persona: no se auditan. */
const INTERNAL = [
  /^app\/api\/integrations\/beeagent\/v1\//,
  /^app\/api\/webhooks\//,
  /^lib\/(platform-analytics|mailboxes-store|beeagent-partner|beeagent-require-link)/,
];

function loadDictionaries() {
  const dir = join(ROOT, "lib", "i18n", "en");
  const dict = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".ts") || name === "index.ts") continue;
    let src = readFileSync(join(dir, name), "utf8");
    const m = src.match(/export\s+const\s+\w+\s*:\s*Record<string,\s*string>\s*=\s*/);
    if (!m) {
      console.warn(`! Formato no reconocido: ${name}`);
      continue;
    }
    src = src.slice(m.index + m[0].length).trim().replace(/;\s*$/, "");
    try {
      Object.assign(dict, new Function(`return (${src});`)());
    } catch (e) {
      console.warn(`! No se pudo evaluar ${name}: ${e.message}`);
    }
  }
  return dict;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** Lee un literal de cadena que empieza en src[i] (comilla). Devuelve { value, end } o null. */
function readLiteral(src, i) {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (q === "`" && c === "$" && src[j + 1] === "{") return null;
    if (c === q) break;
    if (q !== "`" && c === "\n") return null;
    j++;
  }
  if (j >= src.length) return null;
  const raw = src.slice(i, j + 1);
  try {
    return { value: new Function(`return ${raw};`)(), end: j + 1 };
  } catch {
    return null;
  }
}

const SPANISH_HINT =
  /[áéíóúñü¿¡]|\b(el|la|los|las|de|del|un|una|tu|tus|para|con|por|sin|que|no|sí|es|está|ya|más|en|y|o)\b/i;

function looksSpanishText(s) {
  if (!s || s.length < 2) return false;
  if (!/[a-záéíóúñ]/i.test(s)) return false;
  if (/^[\w./:-]+$/.test(s) && !/[áéíóúñ]/i.test(s) && !/\s/.test(s)) return false;
  return SPANISH_HINT.test(s);
}

function collect() {
  const hits = new Map();
  const add = (file, key, kind) => {
    if (!key || !/[A-Za-zÁÉÍÓÚáéíóúñ]/.test(key)) return;
    const rel = relative(ROOT, file).split(sep).join("/");
    if (!hits.has(rel)) hits.set(rel, new Map());
    const m = hits.get(rel);
    if (!m.has(key)) m.set(key, kind);
  };

  const uiFiles = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components")), ...walk(join(ROOT, "lib"))].filter((f) => {
    const rel = relative(ROOT, f).split(sep).join("/");
    return !rel.startsWith("lib/i18n/") && !INTERNAL.some((re) => re.test(rel));
  });

  const tCall = /(?<![\w.$])t\(\s*/g;
  const errProp = /\b(?:error|message)\s*:\s*/g;
  const uiMsgProp = /\b(?:error|text)\s*:\s*/g;
  const stateSetter = /(?<![\w.$])(?:set(?:Err|Error|Msg|Message|Toast|Notice|Ok|Status|LocErr|AiErr|Hint)\w*|toast|saved|flash)\(/g;
  const labelProp =
    /(?:^|[{,\s])(?:label|title|hint|help|text|body|blurb|description|placeholder|empty|subtitle|cta|desc|name)\s*:\s*(?=["'`])/g;
  const labelMapDecl =
    /\bconst\s+(?:[A-Z][A-Z0-9_]*(?:LABEL|WORD|TITLE|NAME|MONTH|DOW|TEXT|HINT|STEPS|FAQ)[A-Z0-9_]*(?:\s*:[^=;]*)?|\w+\s*:\s*(?:Readonly<)?(?:Record<[^>]*,\s*string>|Partial<Record<[^>]*,\s*string>>|string\[\])[^=;]*)\s*=\s*[[{]/g;

  const jsxProp = /\s(label|title|message|hint|help|placeholder|subtitle|description|aria-label|alt)="([^"]*)"/g;
  const jsxText = /(?<![=\-\s])>([^<>{}`]*?[A-Za-zÁÉÍÓÚáéíóúñ¿¡][^<>{}`]*?)(?=[<{])/g;

  for (const file of uiFiles) {
    const src = readFileSync(file, "utf8");
    const isApi = file.includes(`${sep}app${sep}api${sep}`);
    const isApiOrLib =
      file.includes(`${sep}app${sep}api${sep}`) || file.startsWith(join(ROOT, "lib") + sep) || /actions?\.ts$/.test(file);

    for (const m of src.matchAll(tCall)) {
      const start = m.index + m[0].length;
      const lit = readLiteral(src, start);
      const after = lit && src.slice(lit.end).match(/^\s*([,)])/);
      if (lit && after) {
        add(file, lit.value, "t");
        continue;
      }
      if (src[start] === ")") continue;
      const close = matchingBrace(src, start - m[0].length + m[0].indexOf("("));
      if (close < 0) continue;
      const arg = firstArg(src.slice(start, close));
      const found = /[?]|\?\?|\|\|/.test(arg) ? literalsIn(arg) : [];
      for (const v of found) add(file, v, "t?");
      if (SHOW_DYNAMIC && !found.length) {
        const line = src.slice(0, start).split("\n").length;
        dynamic.push(`${relative(ROOT, file).split(sep).join("/")}:${line}  t(${arg.replace(/\s+/g, " ").slice(0, 70)})`);
      }
    }

    if (file.endsWith(".tsx")) {
      for (const m of src.matchAll(jsxProp)) {
        const tag = src.slice(0, m.index).match(/<([\w.]+)[^<]*$/);
        if (!tag) continue;
        const isComponent = /^[A-Z]/.test(tag[1]);
        if (isComponent && /[A-Za-zÁÉÍÓÚáéíóúñ]{2,}/.test(m[2]) && !/^(https?:|\/|#)/.test(m[2])) add(file, m[2], "prop");
        else if (!isComponent && SHOW_HARDCODED && /^(placeholder|aria-label|title|alt)$/.test(m[1]) && /[a-záéíóúñ]{3,}/i.test(m[2]))
          hardcoded.push(`${relative(ROOT, file).split(sep).join("/")}:${lineOf(src, m.index)}  <${tag[1]} ${m[1]}="${m[2]}">`);
      }
      if (SHOW_HARDCODED) {
        for (const m of src.matchAll(jsxText)) {
          const text = m[1].trim();
          if (!/[A-Za-zÁÉÍÓÚáéíóúñ]{3,}/.test(text) || /^[\w.]+$/.test(text) && !/^[A-ZÁÉÍÓÚ]?[a-záéíóúñ]+$/.test(text)) continue;
          if (/[;=]|=>|&&|\|\||\)\s*$|\?\s*\(|^\)|\/\/|\bvoid\b|^Promise$|^\[/.test(text)) continue;
          hardcoded.push(`${relative(ROOT, file).split(sep).join("/")}:${lineOf(src, m.index)}  >${text.slice(0, 90)}<`);
        }
      }
    }

    if (isApiOrLib || file.endsWith(".tsx")) {
      for (const m of src.matchAll(isApiOrLib ? errProp : uiMsgProp)) {
        const lit = readLiteral(src, m.index + m[0].length);
        if (lit && looksSpanishText(lit.value)) add(file, lit.value, "error");
      }
    }
    for (const m of src.matchAll(/new Error\(\s*/g)) {
      const lit = readLiteral(src, m.index + m[0].length);
      if (lit && looksSpanishText(lit.value)) add(file, lit.value, "error");
    }
    if (file.endsWith(".tsx")) {
      for (const m of src.matchAll(stateSetter)) {
        const open = m.index + m[0].length - 1;
        const close = matchingBrace(src, open);
        if (close < 0) continue;
        for (const v of literalsIn(firstArg(src.slice(open + 1, close)))) {
          if (looksSpanishText(v)) add(file, v, "state");
        }
      }
    }

    if (WITH_LABELS && !isApi) {
      for (const m of src.matchAll(labelProp)) {
        const lit = readLiteral(src, m.index + m[0].length);
        if (lit && looksSpanishText(lit.value)) add(file, lit.value, "label");
      }
      for (const m of src.matchAll(labelMapDecl)) {
        const open = m.index + m[0].length - 1;
        const close = matchingBrace(src, open);
        if (close < 0) continue;
        for (const v of literalsIn(src.slice(open + 1, close))) {
          if (looksSpanishText(v) || /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(v)) add(file, v, "label");
        }
      }
    }
  }
  return hits;
}

/** Primer argumento de una lista "a, b, c" respetando paréntesis, llaves y cadenas. */
function firstArg(args) {
  for (let i = 0; i < args.length; i++) {
    const c = args[i];
    if (c === '"' || c === "'" || c === "`") i = skipString(args, i);
    else if (c === "(" || c === "{" || c === "[") {
      i = matchingBrace(args, i);
      if (i < 0) return args;
    } else if (c === ",") return args.slice(0, i);
  }
  return args;
}

/** Índice del cierre que corresponde a la apertura en src[open] (saltando cadenas). */
function matchingBrace(src, open) {
  const pairs = { "{": "}", "(": ")", "[": "]" };
  const stack = [pairs[src[open]]];
  for (let i = open + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) return -1;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
    }
  }
  return -1;
}

function skipString(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") j++;
    else if (q === "`" && src[j] === "$" && src[j + 1] === "{") j = matchingBrace(src, j + 1);
    else if (src[j] === q) return j;
    if (j < 0) return src.length;
  }
  return src.length;
}

/** Literales de cadena dentro de una expresión, sin los que se usan para comparar o indexar. */
function literalsIn(expr) {
  const out = [];
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c !== '"' && c !== "'" && c !== "`") continue;
    const lit = readLiteral(expr, i);
    const end = skipString(expr, i);
    if (lit) {
      const before = expr.slice(Math.max(0, i - 4), i);
      const after = expr.slice(lit.end, lit.end + 4);
      const isCompare = /[!=]==?\s*$|\[\s*$/.test(before) || /^\s*(?:[!=]==?|\])/.test(after);
      const isKey = /^\s*:/.test(after) && /(?:^|[{,])\s*$/.test(expr.slice(0, i));
      if (!isCompare && !isKey) out.push(lit.value);
    }
    i = end;
  }
  return out;
}

const EN = loadDictionaries();
const hits = collect();
const missing = {};
let total = 0;
const unique = new Set();
for (const [file, keys] of [...hits.entries()].sort()) {
  const list = [...keys.entries()].filter(([k]) => !(k in EN));
  if (!list.length) continue;
  missing[file] = list.map(([k, kind]) => ({ key: k, kind }));
  total += list.length;
  list.forEach(([k]) => unique.add(k));
}

if (AS_JSON) {
  process.stdout.write(JSON.stringify(missing, null, 2));
} else {
  for (const [file, list] of Object.entries(missing)) {
    console.log(`\n${file}`);
    for (const { key, kind } of list) console.log(`  [${kind}] ${JSON.stringify(key)}`);
  }
  if (SHOW_HARDCODED) {
    console.log(`\nPosible texto fijo sin t() (${hardcoded.length}):`);
    for (const h of hardcoded) console.log(`  ${h}`);
  }
  if (SHOW_DYNAMIC) {
    console.log(`\nLlamadas t() con clave dinámica (${dynamic.length}):`);
    for (const d of dynamic) console.log(`  ${d}`);
  }
  console.log(`\nDiccionario EN: ${Object.keys(EN).length} claves`);
  console.log(`Faltan: ${unique.size} claves únicas (${total} ocurrencias en ${Object.keys(missing).length} archivos)`);
}
