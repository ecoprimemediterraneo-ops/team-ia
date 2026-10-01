// Piezas comunes de las tres plantillas. Reglas de dirección de arte:
//   · El protagonista es el TEXTO: entra con golpe, en el pulso, nunca flota.
//   · Cortes secos en el pulso. Nada de fundidos largos ni zooms lentos: una foto
//     entra con un "punch" de 6 fotogramas y se queda quieta.
//   · Colores y letra del cliente. El acento se usa en bloques, no en adornos.
import React, { useState } from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { loadFont as anton } from "@remotion/google-fonts/Anton";
import { loadFont as playfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as montserrat } from "@remotion/google-fonts/Montserrat";
import type { MarcaVideo, Tipografia } from "./tipos";

const A = anton("normal", { weights: ["400"], subsets: ["latin"] });
const P = playfair("normal", { weights: ["700", "900"], subsets: ["latin"] });
const PI = playfair("italic", { weights: ["700"], subsets: ["latin"] });
const I = inter("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });
const M = montserrat("normal", { weights: ["800", "900"], subsets: ["latin"] });

/** Letra de titular y de apoyo según la tipografía del cliente. */
export function letras(t: Tipografia) {
  if (t === "elegante") return { titular: P.fontFamily, peso: 900, italica: PI.fontFamily, apoyo: I.fontFamily, mayus: false, tracking: "-0.02em" };
  if (t === "moderna") return { titular: M.fontFamily, peso: 900, italica: M.fontFamily, apoyo: I.fontFamily, mayus: true, tracking: "-0.03em" };
  return { titular: A.fontFamily, peso: 400, italica: A.fontFamily, apoyo: I.fontFamily, mayus: true, tracking: "0em" };
}

// ─── Color ──────────────────────────────────────────────────────────────────
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Texto legible sobre un color: el de la marca si contrasta, si no blanco o casi negro. */
export function sobre(fondo: string, marca: MarcaVideo): string {
  const c = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  if (c(fondo, marca.texto) >= 4.5) return marca.texto;
  return lum(fondo) > 0.35 ? "#111111" : "#FFFFFF";
}
/** Color "fuerte" de la marca para bloques: el acento, o el texto si el acento es casi el fondo. */
export function bloque(marca: MarcaVideo): string {
  return Math.abs(lum(marca.acento) - lum(marca.fondo)) < 0.08 ? marca.texto : marca.acento;
}

// ─── Tiempo en pulsos ───────────────────────────────────────────────────────
export function usePulso(fpb: number) {
  const f = useCurrentFrame();
  return { f, pulso: f / fpb, en: (p: number) => Math.round(p * fpb) };
}

/** Golpe de entrada: escala 1.35→1 con muelle seco. `desde` en fotogramas. */
export function golpe(frame: number, desde: number, fps: number, fuerza = 0.35) {
  const s = spring({ frame: frame - desde, fps, config: { damping: 14, stiffness: 260, mass: 0.6 } });
  return { transform: `scale(${1 + fuerza * (1 - s)})`, opacity: frame < desde ? 0 : Math.min(1, (frame - desde + 1) / 2) };
}

// ─── Foto ───────────────────────────────────────────────────────────────────
/** Foto a sangre con "punch" al entrar (6 fotogramas) y QUIETA después. */
export const Foto: React.FC<{ src?: string; desde?: number; posicion?: string; oscurecer?: number; color: string }> = ({ src, desde = 0, posicion = "center", oscurecer = 0, color }) => {
  const f = useCurrentFrame();
  const [rota, setRota] = useState(false); // foto que no carga → queda el bloque de color
  const k = interpolate(f - desde, [0, 6], [1.12, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ backgroundColor: color, overflow: "hidden" }}>
      {src && !rota ? <Img src={src} onError={() => setRota(true)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: posicion, transform: `scale(${k})` }} /> : null}
      {oscurecer > 0 ? <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${oscurecer * 0.55}) 0%, rgba(0,0,0,${oscurecer * 0.15}) 40%, rgba(0,0,0,${oscurecer}) 100%)` }} /> : null}
    </AbsoluteFill>
  );
};

/** Destello de 3 fotogramas en cada corte: marca el pulso sin ser un efecto. */
export const Destello: React.FC<{ en: number[]; color?: string }> = ({ en, color = "#FFFFFF" }) => {
  const f = useCurrentFrame();
  const o = Math.max(0, ...en.map((c) => (f >= c && f < c + 3 ? 0.55 * (1 - (f - c) / 3) : 0)));
  return o > 0 ? <AbsoluteFill style={{ backgroundColor: color, opacity: o, mixBlendMode: "screen" }} /> : null;
};

/** Grano muy fino: quita el aspecto de plantilla digital. */
export const Grano: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 7} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Ancho medio de una letra (en "em") por familia: lo justo para no partir palabras. */
export function ajustar(palabras: string[], size: number, ancho: number, font: string, mayus: boolean): number {
  const larga = Math.max(1, ...palabras.map((p) => p.length));
  const em = /Anton/.test(font) ? 0.46 : /Playfair/.test(font) ? (mayus ? 0.72 : 0.56) : mayus ? 0.74 : 0.6;
  return Math.min(size, Math.floor(ancho / (larga * em)));
}

// ─── Texto cinético ─────────────────────────────────────────────────────────
/**
 * Palabras que entran UNA A UNA en el pulso, desde abajo, con máscara. Es la
 * pieza que hace que no parezca un pase de diapositivas.
 */
export const Palabras: React.FC<{
  texto: string; desde: number; cada: number; size: number; color: string; font: string; peso: number;
  mayus?: boolean; tracking?: string; align?: "left" | "center"; lineHeight?: number; resaltar?: { palabra: number; fondo: string; color: string };
  /** Ancho disponible: la letra se encoge para que la palabra más larga quepa entera. */
  ancho?: number;
}> = ({ texto, desde, cada, size: size0, color, font, peso, mayus, tracking = "0", align = "left", lineHeight = 0.95, resaltar, ancho = 920 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ps = texto.split(/\s+/).filter(Boolean);
  const size = ajustar(ps, size0, ancho, font, !!mayus);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", columnGap: size * 0.22, rowGap: size * 0.02 }}>
      {ps.map((p, i) => {
        const t0 = desde + i * cada;
        const s = spring({ frame: f - t0, fps, config: { damping: 16, stiffness: 240, mass: 0.5 } });
        const hl = resaltar && resaltar.palabra === i;
        return (
          <span key={i} style={{ overflow: "hidden", display: "inline-block", lineHeight, paddingBottom: size * 0.06 }}>
            <span style={{
              display: "inline-block", transform: `translateY(${(1 - s) * 105}%) rotate(${(1 - s) * 4}deg)`, opacity: f < t0 ? 0 : 1,
              fontFamily: font, fontWeight: peso, fontSize: size, color: hl ? resaltar!.color : color, letterSpacing: tracking,
              textTransform: mayus ? "uppercase" : "none", background: hl ? resaltar!.fondo : "transparent", padding: hl ? `0 ${size * 0.12}px` : 0,
            }}>{p}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Cinta que corre en horizontal (fecha límite, hueco…): movimiento constante y con intención. */
export const Cinta: React.FC<{ texto: string; fondo: string; color: string; font: string; size: number; velocidad?: number; angulo?: number; top: number }> = ({ texto, fondo, color, font, size, velocidad = 9, angulo = -4, top }) => {
  const f = useCurrentFrame();
  const item = `${texto}  ✦  `;
  return (
    <div style={{ position: "absolute", left: -120, right: -120, top, transform: `rotate(${angulo}deg)`, background: fondo, padding: `${size * 0.28}px 0`, overflow: "hidden", whiteSpace: "nowrap" }}>
      <div style={{ transform: `translateX(${-(f * velocidad) % 2000}px)`, fontFamily: font, fontSize: size, color, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase" }}>
        {item.repeat(12)}
      </div>
    </div>
  );
};

const IconoWhatsApp: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.02c-.24.68-1.42 1.31-1.95 1.36-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.93-4.66-4.11-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.98.95-2.25.24-.27.53-.34.71-.34l.51.01c.16.01.38-.06.6.46.23.54.77 1.87.84 2 .07.14.11.3.02.48-.09.18-.13.29-.27.45-.13.16-.28.35-.4.47-.13.13-.27.28-.12.55.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.61-.14.25.09 1.58.75 1.85.88.27.14.45.2.52.32.07.11.07.66-.17 1.33z" />
  </svg>
);

/** Botón «Reserva por WhatsApp»: entra con golpe y late en cada pulso. */
export const Boton: React.FC<{ texto: string; desde: number; fpb: number; fondo: string; color: string; font: string; size?: number; toque?: number }> = ({ texto, desde, fpb, fondo, color, font, size = 50, toque }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Golpe suave: con más fuerza el botón (casi del ancho del vídeo) se salía por los lados al entrar.
  const g = golpe(f, desde, fps, 0.2);
  const fase = ((f - desde) % fpb) / fpb;
  const late = f > desde + fpb ? 1 + 0.035 * Math.max(0, 1 - fase * 4) : 1;
  const pulsado = toque !== undefined && f >= toque && f < toque + 6 ? 0.93 : 1;
  return (
    <div style={{ ...g, transform: `${g.transform} scale(${late * pulsado})`, display: "inline-flex", alignItems: "center", gap: size * 0.4, background: fondo, color, borderRadius: 999, padding: `${size * 0.55}px ${size * 0.9}px`, fontFamily: font, fontWeight: 800, fontSize: size, boxShadow: "0 18px 40px rgba(0,0,0,0.28)" }}>
      <IconoWhatsApp size={size * 1.25} color={color} />
      <span>{texto}</span>
    </div>
  );
};

/** Cierre: logo + nombre + CTA. El último pulso siempre es la marca. */
export const Cierre: React.FC<{ marca: MarcaVideo; desde: number; fpb: number; cta: string; linea?: string }> = ({ marca, desde, fpb, cta, linea }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = letras(marca.tipografia);
  const tinta = sobre(marca.fondo, marca);
  const fuerte = bloque(marca);
  const [sinLogo, setSinLogo] = useState(false);
  const barra = interpolate(f - desde, [0, fpb], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.exp) });
  return (
    <AbsoluteFill style={{ backgroundColor: marca.fondo, alignItems: "center", justifyContent: "center", gap: 56 }}>
      <AbsoluteFill style={{ background: fuerte, transform: `translateY(${(1 - barra) * 100}%)`, top: "72%" }} />
      <div style={golpe(f, desde, fps, 0.25)}>
        {marca.logoUrl && !sinLogo ? (
          // Un logo que no carga NO rompe el vídeo: se pone el nombre del negocio.
          <Img src={marca.logoUrl} onError={() => setSinLogo(true)} style={{ width: 920, height: 400, objectFit: "contain" }} />
        ) : (
          <div style={{ fontFamily: L.titular, fontWeight: L.peso, fontSize: 130, color: tinta, textTransform: L.mayus ? "uppercase" : "none", textAlign: "center", lineHeight: 0.95 }}>{marca.nombre}</div>
        )}
      </div>
      {linea ? (
        // Línea de apoyo: cabe SIEMPRE (se encoge y, si hace falta, parte en dos). "LIMPIEZA FACIAL PROFUNDA · 45 MIN" se salía por los lados.
        <div style={{ ...golpe(f, desde + Math.round(fpb), fps, 0.2), maxWidth: 940, textAlign: "center", fontFamily: L.apoyo, fontWeight: 700, fontSize: Math.min(40, Math.floor(1800 / Math.max(1, linea.length))), lineHeight: 1.3, letterSpacing: "0.14em", color: tinta, textTransform: "uppercase" }}>{linea}</div>
      ) : null}
      <div style={{ position: "absolute", top: "76%" }}>
        <Boton texto={cta} desde={desde + Math.round(fpb * 2)} fpb={fpb} fondo={marca.fondo} color={sobre(marca.fondo, marca)} font={L.apoyo} size={54} />
      </div>
    </AbsoluteFill>
  );
};
