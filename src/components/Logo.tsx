/** FleetPanda Academy mark: geometric panda on a brand-orange tile. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="FleetPanda"
    >
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#EA580C" />
      {/* ears */}
      <circle cx="19" cy="19" r="7" fill="#1C1917" />
      <circle cx="45" cy="19" r="7" fill="#1C1917" />
      {/* face */}
      <circle cx="32" cy="35" r="17" fill="#FFFFFF" />
      {/* eye patches */}
      <ellipse
        cx="25"
        cy="32"
        rx="4.2"
        ry="5.6"
        transform="rotate(-18 25 32)"
        fill="#1C1917"
      />
      <ellipse
        cx="39"
        cy="32"
        rx="4.2"
        ry="5.6"
        transform="rotate(18 39 32)"
        fill="#1C1917"
      />
      {/* eyes */}
      <circle cx="26" cy="31" r="1.4" fill="#FFFFFF" />
      <circle cx="38" cy="31" r="1.4" fill="#FFFFFF" />
      {/* nose + mouth */}
      <ellipse cx="32" cy="40" rx="2.6" ry="2" fill="#1C1917" />
      <path
        d="M32 42.5v2.2M32 44.7c-1.2 1.6-3 1.8-4.2 1M32 44.7c1.2 1.6 3 1.8 4.2 1"
        stroke="#1C1917"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
