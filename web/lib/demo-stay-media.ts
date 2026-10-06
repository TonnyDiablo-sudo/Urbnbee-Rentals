import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { arrivalMessageOf } from "@/lib/arrival-message-template";
import type { ChatAttachment } from "@/lib/host-inbox-types";
import { listAllListings, updateListing } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { storeStayMessageFile } from "@/lib/stay-messages";
import { stayMessagesOf } from "@/lib/stay-messages-template";

type Slot = "welcome" | "mid" | "checkout" | "arrival";

/** Notas de voz habladas que vienen con el código (scripts/demo-media). */
const BUNDLED_SECONDS: Record<Slot, number> = { welcome: 17, mid: 13, checkout: 10, arrival: 13 };

function speech(slot: Slot): { data: Buffer; mime: string; seconds: number } | null {
  const p = join(process.cwd(), "scripts", "demo-media", `${slot}.mp3`);
  return existsSync(p) ? { data: readFileSync(p), mime: "audio/mpeg", seconds: BUNDLED_SECONDS[slot] } : null;
}

function chimeWav(notes: number[], noteSec = 0.5): Buffer {
  const rate = 22_050;
  const perNote = Math.floor(rate * noteSec);
  const samples = new Int16Array(perNote * notes.length + rate / 2);
  notes.forEach((hz, n) => {
    for (let i = 0; i < perNote; i++) {
      const t = i / rate;
      const env = Math.min(1, i / 300) * Math.exp(-1.8 * t);
      const v = Math.sin(2 * Math.PI * hz * t) * 0.8 + Math.sin(4 * Math.PI * hz * t) * 0.2;
      const k = n * perNote + i;
      samples[k] = Math.max(-32767, Math.min(32767, samples[k] + v * env * 26_000));
    }
  });
  const data = Buffer.from(samples.buffer);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

async function photoOf(url: string | undefined, fallback: { r: number; g: number; b: number }): Promise<Buffer> {
  if (url && /^https:\/\//.test(url)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {
      /* sin red: va el color */
    }
  }
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: fallback } }).jpeg().toBuffer();
}

async function store(listingId: string, data: Buffer, mime: string, durationSec?: number): Promise<ChatAttachment | null> {
  const r = await storeStayMessageFile({ listingId, data, mime, durationSec });
  return r.attachment ?? null;
}

/** Devuelve el audio y si es voz de verdad (o el tono de respaldo). */
async function voiceNote(l: HostListingRecord, slot: Slot, notes: number[]): Promise<{ a: ChatAttachment | null; real: boolean }> {
  const s = speech(slot);
  if (s) return { a: await store(l.id, s.data, s.mime, s.seconds), real: true };
  return { a: await store(l.id, chimeWav(notes), "audio/wav", Math.ceil(notes.length * 0.5 + 0.5)), real: false };
}

const keep = (xs: (ChatAttachment | null)[]) => xs.filter((x): x is ChatAttachment => !!x);
const isDemoTone = (a: ChatAttachment) => a.kind === "audio" && a.file.endsWith(".wav");

async function voices(l: HostListingRecord) {
  const out = {
    welcome: await voiceNote(l, "welcome", [523, 659, 784]),
    mid: await voiceNote(l, "mid", [784, 659]),
    checkout: await voiceNote(l, "checkout", [659, 523]),
    arrival: await voiceNote(l, "arrival", [392, 523, 659, 784]),
  };
  return { ...out, real: Object.values(out).every((v) => v.real) };
}

async function fill(l: HostListingRecord): Promise<void> {
  const id = l.id;
  const pic = (i: number, c: { r: number; g: number; b: number }) => photoOf(l.photos[i % Math.max(1, l.photos.length)], c);
  const v = await voices(l);
  const welcome = keep([await store(id, await pic(0, { r: 220, g: 184, b: 30 }), "image/jpeg"), v.welcome.a]);
  const mid = keep([await store(id, await pic(1, { r: 120, g: 170, b: 210 }), "image/jpeg"), v.mid.a]);
  const checkout = keep([await store(id, await pic(2, { r: 200, g: 120, b: 90 }), "image/jpeg"), v.checkout.a]);
  const arrival = keep([await store(id, await pic(3, { r: 90, g: 160, b: 110 }), "image/jpeg"), v.arrival.a]);

  const s = stayMessagesOf(l.stayMessages);
  const a = arrivalMessageOf(l.arrivalMessage);
  updateListing(id, l.hostId, {
    stayMessages: {
      welcome: { ...s.welcome, attachments: s.welcome.attachments.length ? s.welcome.attachments : welcome },
      mid: s.mid.map((m, i) => (i === 0 && !m.attachments.length ? { ...m, attachments: mid } : m)),
      checkout: { ...s.checkout, attachments: s.checkout.attachments.length ? s.checkout.attachments : checkout },
    },
    arrivalMessage: { ...a, attachments: a.attachments?.length ? a.attachments : arrival },
    demoStayMedia: v.real ? "voice" : "done",
  });
}

/** Los tonos de prueba casi no se oían: se cambian por notas de voz habladas. */
async function upgradeVoices(l: HostListingRecord): Promise<void> {
  const v = await voices(l);
  if (!v.real) return;
  const swap = (files: ChatAttachment[], next: ChatAttachment | null) =>
    files.some(isDemoTone) ? keep([...files.filter((f) => !isDemoTone(f)), next]) : files;
  const s = stayMessagesOf(l.stayMessages);
  const a = arrivalMessageOf(l.arrivalMessage);
  updateListing(l.id, l.hostId, {
    stayMessages: {
      welcome: { ...s.welcome, attachments: swap(s.welcome.attachments, v.welcome.a) },
      mid: s.mid.map((m, i) => (i === 0 ? { ...m, attachments: swap(m.attachments, v.mid.a) } : m)),
      checkout: { ...s.checkout, attachments: swap(s.checkout.attachments, v.checkout.a) },
    },
    arrivalMessage: { ...a, attachments: swap(a.attachments ?? [], v.arrival.a) },
    demoStayMedia: "voice",
  });
}

/** Fotos y notas de voz de muestra en los mensajes de los anuncios demo. */
export async function ensureDemoStayMedia(): Promise<void> {
  for (const l of listAllListings()) {
    try {
      if (l.demoStayMedia === "pending") await fill(l);
      else if (l.demoStayMedia === "done") await upgradeVoices(l);
    } catch (e) {
      console.warn("[demo stay media]", l.id, e);
    }
  }
}
