import type { AssociateDayCount } from "@/lib/associate-stats";

const WEEKDAY = ["D", "L", "M", "M", "J", "V", "S"];

/** Barras por día de cuentas creadas, con la línea de la meta diaria. */
export function DayBars({ days, goal, title }: { days: AssociateDayCount[]; goal: number; title?: string }) {
  const max = Math.max(goal, ...days.map((d) => d.accounts), 1);
  return (
    <div>
      {title && <p className="mb-2 text-sm font-semibold text-gray-900">{title}</p>}
      <div className="relative flex h-36 items-end gap-1">
        {goal > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-amber-400"
            style={{ bottom: `${(goal / max) * 100}%` }}
          />
        )}
        {days.map((d) => {
          const hit = goal > 0 && d.accounts >= goal;
          return (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.day}: ${d.accounts}`}>
              <span className="mb-0.5 text-[10px] text-gray-500">{d.accounts || ""}</span>
              <div
                className={`w-full rounded-t ${hit ? "bg-green-500" : d.accounts ? "bg-amber-400" : "bg-gray-100"}`}
                style={{ height: `${Math.max(d.accounts ? 4 : 2, (d.accounts / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {days.map((d) => (
          <span key={d.day} className="flex-1 text-center text-[10px] text-gray-400">
            {WEEKDAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}
            <br />
            {Number(d.day.slice(8))}
          </span>
        ))}
      </div>
    </div>
  );
}
