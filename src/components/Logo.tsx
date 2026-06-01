export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const w = size === "lg" ? 380 : size === "sm" ? 260 : 380;
  const h = (w * 110) / 380;
  return (
    <svg
      viewBox="0 0 380 110"
      width={w}
      height={h}
      aria-label="AI-Team"
      role="img"
      style={{ transform: "rotate(-2deg)" }}
    >
      {/* Borde exterior del sello */}
      <rect x="2" y="2" width="376" height="106" rx="4"
        fill="none" stroke="#000" strokeWidth="4" />
      {/* Borde interior del sello */}
      <rect x="9" y="9" width="362" height="92" rx="2"
        fill="none" stroke="#000" strokeWidth="1.5" />

      {/* AI-TEAM centrado dentro del marco */}
      <g transform="translate(190, 78) skewX(-8)">
        <text
          x="0" y="0"
          textAnchor="middle"
          fontFamily="var(--font-anton), Impact, sans-serif"
          fontSize="76"
          fontStyle="italic"
          fontWeight="900"
          stroke="#000"
          strokeWidth="7"
          strokeLinejoin="round"
          paintOrder="stroke"
          fill="#C8202A"
          letterSpacing="-1"
        >
          AI-TEAM
        </text>
      </g>
    </svg>
  );
}
