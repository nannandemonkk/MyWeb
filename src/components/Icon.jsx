const shapes = {
  sprout: <path d="M12 21V11M12 15C5 15 3 10 4 6c6-1 10 3 8 9ZM12 11c0-6 3-9 9-8 1 6-3 9-9 8Z" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  down: <path d="m8 10 4 4 4-4" />,
  left: <path d="m14 7-5 5 5 5" />,
  right: <path d="m10 7 5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  book: <path d="M12 5v15M12 5C8 2 3 3 3 3v15s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z" />,
  pen: <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-4L4 15l-1 6Z" />,
  check: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8 12 3 3 5-6" /></>,
  pin: <path d="m16 3 5 5-4 2-3 5-2-2-7 7M5 8l5-3 2-4M5 8l11 11" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  sunrise: <path d="M3 17h18M5 21h14M6 17a6 6 0 0 1 12 0M12 3v5M9 6l3-3 3 3M3 10l2 2M19 12l2-2" />,
  sunset: <path d="M3 17h18M5 21h14M6 17a6 6 0 0 1 12 0M12 3v5M9 5l3 3 3-3M3 10l2 2M19 12l2-2" />,
  moon: <path d="M20.7 14.2A9 9 0 0 1 9.8 3.3a9 9 0 1 0 10.9 10.9Z" />,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--paper)" /><circle cx="15" cy="17" r="3" fill="var(--paper)" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  leaf: <path d="M4 20 17 7M6 17C-1 8 9 1 21 3c1 11-5 20-15 14Z" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  back: <path d="M19 12H5m5-5-5 5 5 5" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
};

export default function Icon({ name = "sprout", className = "" }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name] || shapes.sprout}</svg>;
}
