"use client";

import { useT } from "@/components/i18n-provider";
import { BOT_PERMISSION_DEFS, type BotPermission, type BotPermissions } from "@/lib/beeagent-permission-defs";

/** Al prender un permiso se prende lo que necesita; al apagarlo se apaga lo que depende de él. */
export function toggleBotPermission(value: BotPermissions, key: BotPermission, on: boolean): BotPermissions {
  const next = { ...value, [key]: on };
  const def = BOT_PERMISSION_DEFS.find((d) => d.key === key);
  if (on && def?.needs) next[def.needs] = true;
  if (!on) for (const d of BOT_PERMISSION_DEFS) if (d.needs === key) next[d.key] = false;
  return next;
}

export function BotPermissionsPicker({
  value,
  onChange,
  disabled,
}: {
  value: BotPermissions;
  onChange: (next: BotPermissions) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <ul className="divide-y divide-[#f0f0f0] rounded-xl border border-[#ebebeb]">
      {BOT_PERMISSION_DEFS.map((d) => (
        <li key={d.key}>
          <label
            className={`flex items-start gap-3 px-4 py-3 ${d.locked || disabled ? "cursor-default" : "cursor-pointer hover:bg-[#fafafa]"}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#dcb81e]"
              checked={value[d.key]}
              disabled={d.locked || disabled}
              onChange={(e) => onChange(toggleBotPermission(value, d.key, e.target.checked))}
            />
            <span>
              <span className="block text-sm font-medium text-[#484848]">{t(d.label)}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[#888]">{t(d.hint)}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
