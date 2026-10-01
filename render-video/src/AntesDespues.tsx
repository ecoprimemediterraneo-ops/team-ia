// «Antes y después»: la cortinilla va en el pulso (abre, duda, se abre del
// todo), no a velocidad constante. Luego la frase manda, con las dos fotos
// como apoyo, y cierra la marca.
import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Foto, Destello, Grano, Palabras, Cierre, letras, sobre, bloque, golpe } from "./comun";
import { Progreso } from "./Oferta";
import type { MarcaVideo, TextosAntesDespues } from "./tipos";

const Etiqueta: React.FC<{ texto: string; fondo: string; color: string; font: string; lado: "izq" | "der"; o?: number }> = ({ texto, fondo, color, font, lado, o = 1 }) => (
  <div style={{ position: "absolute", bottom: 230, [lado === "izq" ? "left" : "right"]: 60, background: fondo, color, fontFamily: font, fontWeight: 800, fontSize: 44, letterSpacing: "0.16em", padding: "14px 26px", opacity: o }}>{texto}</div>
);

export const AntesDespues: React.FC<{ marca: MarcaVideo; fotos: string[]; textos: TextosAntesDespues; fpb: number }> = ({ marca, fotos, textos, fpb }) => {
  const f = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const L = letras(marca.tipografia);
  const fuerte = bloque(marca);
  const enFuerte = sobre(fuerte, marca);
  const enFondo = sobre(marca.fondo, marca);
  const p = (n: number) => Math.round(n * fpb);
  const antes = fotos[0], despues = fotos[1] || fotos[0];
  const e = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: Easing.bezier(0.7, 0, 0.2, 1) };
  // Posición de la cortinilla (0 = todo ANTES, 1 = todo DESPUÉS), a golpes de pulso.
  const x = f < p(4.5) ? interpolate(f, [p(3), p(4)], [0, 0.55], e)
    : f < p(6) ? interpolate(f, [p(4.5), p(5.25)], [0.55, 0.3], e)
    : interpolate(f, [p(6), p(7.5)], [0.3, 1], e);
  const cortes = [3, 9, 11, 17].map(p);

  return (
    <AbsoluteFill style={{ backgroundColor: marca.fondo }}>
      {/* 0-3 · ANTES + gancho */}
      <Sequence from={0} durationInFrames={p(3)}>
        <Foto src={antes} color={fuerte} oscurecer={0.55} />
        <AbsoluteFill style={{ padding: "220px 80px 0" }}>
          <Palabras texto={textos.gancho} desde={2} cada={p(0.5)} size={160} color="#FFFFFF" font={L.titular} peso={L.peso} mayus={L.mayus} tracking={L.tracking} />
        </AbsoluteFill>
        <div style={golpe(f, p(1), fps, 0.4)}><Etiqueta texto="ANTES" fondo={marca.fondo} color={enFondo} font={L.apoyo} lado="izq" /></div>
      </Sequence>

      {/* 3-9 · La cortinilla */}
      <Sequence from={p(3)} durationInFrames={p(6)}>
        <Foto src={antes} color={fuerte} desde={-99} />
        <AbsoluteFill style={{ clipPath: `inset(0 ${(1 - x) * 100}% 0 0)` }}>
          <Foto src={despues} color={fuerte} desde={-99} />
        </AbsoluteFill>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: x * width - 5, width: 10, background: fuerte, boxShadow: "0 0 30px rgba(0,0,0,.35)" }} />
        <div style={{ position: "absolute", top: 900, left: x * width - 55, width: 110, height: 110, borderRadius: 999, background: fuerte, color: enFuerte, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: L.apoyo, fontWeight: 800, fontSize: 44 }}>‹ ›</div>
        <Etiqueta texto="ANTES" fondo={marca.fondo} color={enFondo} font={L.apoyo} lado="izq" o={1 - Math.max(0, x - 0.75) * 4} />
        <Etiqueta texto="DESPUÉS" fondo={fuerte} color={enFuerte} font={L.apoyo} lado="der" o={Math.min(1, x * 3)} />
      </Sequence>

      {/* 9-11 · DESPUÉS a pantalla completa, con golpe */}
      <Sequence from={p(9)} durationInFrames={p(2)}>
        <Foto src={despues} color={fuerte} oscurecer={0.35} />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ ...golpe(f - p(9), 0, fps, 0.7), fontFamily: L.titular, fontWeight: L.peso, fontSize: 210, color: "#FFFFFF", textTransform: L.mayus ? "uppercase" : "none", letterSpacing: L.tracking, textShadow: "0 10px 40px rgba(0,0,0,.4)" }}>{L.mayus ? "DESPUÉS" : "Después"}</div>
        </AbsoluteFill>
      </Sequence>

      {/* 11-17 · La frase manda; las dos fotos, de apoyo */}
      <Sequence from={p(11)} durationInFrames={p(6)}>
        <AbsoluteFill style={{ backgroundColor: marca.fondo, padding: "200px 80px 0" }}>
          <Palabras texto={textos.frase} desde={0} cada={p(0.5)} size={128} color={enFondo} font={L.titular} peso={L.peso} mayus={L.mayus} tracking={L.tracking} resaltar={{ palabra: 0, fondo: fuerte, color: enFuerte }} />
          <div style={{ ...golpe(f - p(11), p(3), fps, 0.3), transformOrigin: "left center", marginTop: 36, fontFamily: L.apoyo, fontWeight: 700, fontSize: 42, letterSpacing: "0.14em", color: enFondo, opacity: 0.8, textTransform: "uppercase" }}>{textos.servicio}</div>
        </AbsoluteFill>
        {[antes, despues].map((src, i) => {
          const t0 = p(11) + p(1 + i);
          const y = interpolate(f, [t0, t0 + 8], [700, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.4)) });
          return (
            <div key={i} style={{ position: "absolute", bottom: 170, left: i ? 540 : 60, width: 480, height: 660, transform: `translateY(${y}px) rotate(${i ? 3 : -3}deg)`, border: `12px solid ${i ? fuerte : "#FFFFFF"}`, boxShadow: "0 20px 50px rgba(0,0,0,.3)", overflow: "hidden", background: fuerte }}>
              {src ? <Img src={src} onError={() => { /* foto rota: queda el marco de color */ }} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
              <div style={{ position: "absolute", left: 0, bottom: 0, background: i ? fuerte : "#FFFFFF", color: i ? enFuerte : "#111", fontFamily: L.apoyo, fontWeight: 800, fontSize: 30, letterSpacing: "0.14em", padding: "10px 18px" }}>{i ? "DESPUÉS" : "ANTES"}</div>
            </div>
          );
        })}
      </Sequence>

      {/* 17-22 · Marca */}
      <Sequence from={p(17)}>
        <Cierre marca={marca} desde={0} fpb={fpb} cta={textos.cta} linea={textos.servicio} />
      </Sequence>

      <Destello en={cortes} />
      <Grano />
      <Progreso fpb={fpb} color={fuerte} />
    </AbsoluteFill>
  );
};
