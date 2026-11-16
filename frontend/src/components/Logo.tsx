/**
 * Memora brand mark — a memory graph: nodes held together by recall links.
 *
 * The glyph is drawn in ink (`#312e81`) so it keeps contrast on the pastel
 * gradient badge. A slow light sweep (`logo-sheen`) passes over the badge
 * every few seconds for a subtle premium touch.
 */
export function Logo({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="7.5" r="3.2" fill="#312e81" />
      <circle cx="8.5" cy="20" r="3.2" fill="#4338ca" fillOpacity="0.92" />
      <circle cx="23.5" cy="20" r="3.2" fill="#4338ca" fillOpacity="0.92" />
      <circle cx="16" cy="25.5" r="2.4" fill="#6d28d9" fillOpacity="0.85" />
      <path
        d="M14 10.5 10 17.2M18 10.5 22 17.2M11.7 20.9h8.6M16 20v3.1"
        stroke="#312e81"
        strokeOpacity="0.8"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoBadge({ size = "size-10" }: { size?: string }) {
  return (
    <div
      className={`${size} relative grid place-items-center overflow-hidden rounded-2xl brand-gradient shadow-lg shadow-indigo-300/25 ring-1 ring-white/25`}
    >
      <Logo />
      <span className="logo-sheen" aria-hidden="true" />
    </div>
  );
}
