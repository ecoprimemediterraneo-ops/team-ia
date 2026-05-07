export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const w =
    size === "lg" ? 320 : size === "sm" ? 110 : 170;
  return (
    <svg
      viewBox="0 0 320 130"
      width={w}
      height={(w * 130) / 320}
      aria-label="Team IA"
      role="img"
    >
      {/* "TU" tag arriba a la izquierda */}
      <g transform="translate(8, 28) rotate(-10)">
        <text
          x="0"
          y="0"
          fontFamily="var(--font-anton), Impact, sans-serif"
          fontSize="34"
          fontStyle="italic"
          fill="#000"
        >
          TU
        </text>
      </g>

      {/* TEAM·IA con borde negro grueso y relleno rojo */}
      <g transform="translate(160, 90) skewX(-10)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fontFamily="var(--font-anton), Impact, sans-serif"
          fontSize="92"
          fontStyle="italic"
          fontWeight="900"
          stroke="#000"
          strokeWidth="9"
          strokeLinejoin="round"
          paintOrder="stroke"
          fill="#C8202A"
        >
          TEAM·IA
        </text>
        {/* Sombra dura por debajo */}
      </g>
    </svg>
  );
}
