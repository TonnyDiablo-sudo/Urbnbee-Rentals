import type { BlogBotConfigRecord } from "@/lib/blog-bot-types";

const WEEKDAY_SHORT_TO_NUM: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Fecha civil YYYY-MM-DD en la zona horaria indicada. */
export function getYyyyMmDdInTimezone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function partsInTimezone(d: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  let hour = 0;
  let minute = 0;
  let weekdayStr = "Mon";
  for (const p of parts) {
    if (p.type === "hour") hour = Number(p.value);
    if (p.type === "minute") minute = Number(p.value);
    if (p.type === "weekday") weekdayStr = p.value;
  }
  const weekday = WEEKDAY_SHORT_TO_NUM[weekdayStr] ?? 1;
  return { hour, minute, weekday };
}

/** Compara HH:mm configurado con la hora actual en TZ; tolerancia en minutos para cron externo. */
export function matchesBlogSchedule(
  config: BlogBotConfigRecord,
  now = new Date(),
  toleranceMinutes = 12
): boolean {
  if (!config.scheduleEnabled) return false;
  const tz = config.scheduleTimezone?.trim() || "America/Mexico_City";
  const days = config.scheduleDaysOfWeek;
  if (!Array.isArray(days) || days.length === 0) return false;

  const t = config.scheduleTimeLocal?.trim() || "09:00";
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return false;
  const wantH = Number(m[1]);
  const wantM = Number(m[2]);
  if (wantH > 23 || wantM > 59) return false;

  const { hour, minute, weekday } = partsInTimezone(now, tz);
  if (!days.includes(weekday)) return false;

  const currentTotal = hour * 60 + minute;
  const wantTotal = wantH * 60 + wantM;
  const diff = Math.abs(currentTotal - wantTotal);
  const wrap = 24 * 60;
  const dist = Math.min(diff, wrap - diff);
  return dist <= toleranceMinutes;
}
