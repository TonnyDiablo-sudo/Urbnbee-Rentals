type P = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  viewBox: "0 0 24 24",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconSearch({ className = "h-6 w-6" }: P) {
  return (
    <svg className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function IconTrips({ className = "h-6 w-6" }: P) {
  return (
    <svg className={className} {...base}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18" />
    </svg>
  );
}

export function IconChat({ className = "h-6 w-6" }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
    </svg>
  );
}

export function IconUser({ className = "h-6 w-6" }: P) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  );
}

export function IconToday({ className = "h-6 w-6" }: P) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconCalendar({ className = "h-6 w-6" }: P) {
  return (
    <svg className={className} {...base}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </svg>
  );
}

export function IconHome({ className = "h-6 w-6" }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M3 11l9-7 9 7M5 9.5V20h14V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function IconMenu({ className = "h-6 w-6" }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconBack({ className = "h-5 w-5" }: P) {
  return (
    <svg className={className} {...base} strokeWidth={2.2}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconChevron({ className = "h-5 w-5" }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconStar({ className = "h-3.5 w-3.5" }: P) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z" />
    </svg>
  );
}

export function IconShield({ className = "h-5 w-5" }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconSwitch({ className = "h-5 w-5" }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
    </svg>
  );
}

export function IconPlus({ className = "h-5 w-5" }: P) {
  return (
    <svg className={className} {...base} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSend({ className = "h-5 w-5" }: P) {
  return (
    <svg className={className} {...base} strokeWidth={2}>
      <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />
    </svg>
  );
}

export function IconClose({ className = "h-5 w-5" }: P) {
  return (
    <svg className={className} {...base} strokeWidth={2.2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconExternal({ className = "h-4 w-4" }: P) {
  return (
    <svg className={className} {...base}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </svg>
  );
}
