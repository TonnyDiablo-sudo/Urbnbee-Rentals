import type { BookingContractRecord } from "@/lib/booking-contract-types";
import { contractPlainLines } from "@/lib/booking-contract";

const WINANSI: Record<string, number> = {
  Á: 0xc1,
  É: 0xc9,
  Í: 0xcd,
  Ó: 0xd3,
  Ú: 0xda,
  Ü: 0xdc,
  Ñ: 0xd1,
  á: 0xe1,
  é: 0xe9,
  í: 0xed,
  ó: 0xf3,
  ú: 0xfa,
  ü: 0xfc,
  ñ: 0xf1,
  "¿": 0xbf,
  "¡": 0xa1,
  "—": 0x97,
  "–": 0x96,
  "«": 0xab,
  "»": 0xbb,
};

function winAnsiHex(text: string): string {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 63;
    if (cp < 128) bytes.push(cp);
    else bytes.push(WINANSI[ch] ?? 0x3f);
  }
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function wrapLine(line: string, max = 92): string[] {
  if (line.length <= max) return [line];
  const out: string[] = [];
  let rest = line;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut < 40) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

/** PDF 1.4: Helvetica + WinAnsi, varias páginas si el contrato no cabe en una. */
export function bookingContractPdf(contract: BookingContractRecord, extraLines: string[] = []): Buffer {
  const lines = [...contractPlainLines(contract), ...extraLines].flatMap((l) => wrapLine(l));
  const perPage = 48;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (pages.length === 0) pages.push([""]);

  const font = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  const contentStreams = pages.map((pageLines) => {
    const cmds = [
      "BT",
      "/F1 10 Tf",
      "14 TL",
      "50 800 Td",
      ...pageLines.map((line, i) => {
        const hex = winAnsiHex(line.length ? line : " ");
        return i === 0 ? `<${hex}> Tj` : `T* <${hex}> Tj`;
      }),
      "ET",
    ].join("\n");
    return `<< /Length ${Buffer.byteLength(cmds, "latin1")} >>\nstream\n${cmds}\nendstream`;
  });

  const objs: string[] = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjStart = 4;
  const kids = pages.map((_, i) => `${pageObjStart + i} 0 R`).join(" ");
  objs.push(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pages.length} >>`);
  objs.push(font);
  for (let i = 0; i < pages.length; i++) {
    const contentObj = 4 + pages.length + i;
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentObj} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    );
  }
  objs.push(...contentStreams);

  const header = "%PDF-1.4\n";
  let offset = Buffer.byteLength(header);
  const xref: number[] = [0];
  let body = header;
  objs.forEach((obj, i) => {
    xref.push(offset);
    const chunk = `${i + 1} 0 obj\n${obj}\nendobj\n`;
    body += chunk;
    offset += Buffer.byteLength(chunk);
  });
  const xrefTable = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${objs
    .map((_, i) => `${String(xref[i + 1]).padStart(10, "0")} 00000 n \n`)
    .join("")}`;
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  return Buffer.from(body + xrefTable + trailer);
}
