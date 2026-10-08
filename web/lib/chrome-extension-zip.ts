import "server-only";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { deflateRawSync } from "zlib";

/** Railway arranca con `cd web`, así que la extensión queda un nivel arriba. */
function extensionDir(): string | null {
  for (const dir of [path.join(process.cwd(), "..", "chrome-extension"), path.join(process.cwd(), "chrome-extension")]) {
    if (existsSync(path.join(dir, "manifest.json"))) return dir;
  }
  return null;
}

export function chromeExtensionVersion(): string | null {
  const dir = extensionDir();
  if (!dir) return null;
  try {
    return String(JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")).version ?? "") || null;
  } catch {
    return null;
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const { time, date } = dosDateTime(new Date());
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const packed = deflateRawSync(f.data);
    const crc = crc32(f.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + packed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/**
 * ZIP con los archivos en la raíz: "Extraer todo" de Windows ya crea la carpeta con el nombre del ZIP,
 * y esa carpeta es la que se elige en "Cargar descomprimida". Trae la dirección del servidor ya puesta.
 */
export function chromeExtensionZip(server: string): Buffer | null {
  const dir = extensionDir();
  if (!dir) return null;
  const files: { name: string; data: Buffer }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isFile() || entry.startsWith(".") || entry === "config.json") continue;
    files.push({ name: entry, data: readFileSync(full) });
  }
  files.push({ name: "config.json", data: Buffer.from(JSON.stringify({ server }, null, 2)) });
  return buildZip(files);
}
