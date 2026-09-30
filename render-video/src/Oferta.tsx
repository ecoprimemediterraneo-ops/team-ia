// «Oferta»: el precio es el héroe. Gancho a golpes → servicio sobre foto →
// PRECIO gigante → fecha límite corriendo en cinta → recap → marca.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Foto, Destello, Grano, Palabras, Cinta, Cierre, letras, sobre, bloque, golpe } from "./comun";
import type { MarcaVideo, TextosOferta } from "./tipos";

export const Oferta: React.FC<{ marca: MarcaVideo; fotos: string[]; textos: TextosOferta; fpb: number }> = ({ marca, fotos, textos, fpb }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = letras(marca.tipografia);
  const fuerte = bloque(marca);
  const enFuerte = sobre(fuerte, marca);
  const enFondo = sobre(marca.fondo, marca);
  const p = (n: number) => Math.round(n * fpb);
  const foto = (i: number) => fotos[i % Math.max(1, fotos.length)];
  const cortes = [3, 8, 12, 16, 20].map(p);
  const tachado = interpolate(f, [p(9), p(9) + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: marca.fondo }}>
      {/* 0-3 · Gancho: una palabra por pulso sobre el bloque de color */}
      <Sequence from={0} durationInFrames={p(3)}>
        <AbsoluteFill style={{ backgroundColor: fuerte, padding: "0 90px", justifyContent: "center" }}>
          <Palabras texto={textos.gancho} desde={0} cada={p(0.75)} size={300} color={enFuerte} font={L.titular} peso={L.peso} mayus={L.mayus} tracking={L.tracking} lineHeight={0.9} />
        </AbsoluteFill>
      </Sequence>

      {/* 3-8 · Servicio sobre la foto */}
      <Sequence from={p(3)} durationInFrames={p(5)}>
        <Foto src={foto(0)} color={fuerte} oscurecer={0.75} />
        <AbsoluteFill style={{ padding: "0 80px 300px", justifyContent: "flex-end" }}>
          <div style={{ ...golpe(f - p(3), 0, fps, 0.3), alignSelf: "flex-start", background: fuerte, color: enFuerte, fontFamily: L.apoyo, fontWeight: 800, fontSize: 38, letterSpacing: "0.16em", padding: "14px 26px", marginBottom: 34 }}>OFERTA</div>
          <Palabras texto={textos.servicio} desde={p(0.5)} cada={p(0.5)} size={150} color="#FFFFFF" font={L.titular} peso={L.peso} mayus={L.mayus} tracking={L.tracking} />
        </AbsoluteFill>
      </Sequence>

      {/* 8-12 · PRECIO gigante */}
      <Sequence from={p(8)} durationInFrames={p(4)}>
        <AbsoluteFill style={{ backgroundColor: marca.fondo, alignItems: "center", justifyContent: "center" }}>
          <AbsoluteFill style={{ background: fuerte, clipPath: `polygon(0 ${interpolate(f - p(8), [0, 8], [100, 62], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}%, 100% ${interpolate(f - p(8), [0, 8], [100, 74], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}%, 100% 100%, 0 100%)` }} />
          <div style={{ position: "absolute", top: 260, left: 80, fontFamily: L.apoyo, fontWeight: 800, fontSize: 40, letterSpacing: "0.2em", color: enFondo }}>{(marca.nombre || "").toUpperCase()}</div>
          <div style={{ position: "absolute", bottom: 250, left: 0, right: 0, textAlign: "center", fontFamily: L.apoyo, fontWeight: 800, fontSize: 46, letterSpacing: "0.12em", color: enFuerte, textTransform: "uppercase", ...golpe(f - p(8), p(2), fps, 0.3) }}>{textos.hasta}</div>
          {textos.precioAntes ? (
            <div style={{ position: "relative", fontFamily: L.apoyo, fontWeight: 700, fontSize: 90, color: enFondo, opacity: 0.55, marginBottom: 10 }}>
              {textos.precioAntes}
              <div style={{ position: "absolute", left: -10, top: "52%", height: 10, width: `${tachado * 110}%`, background: fuerte, transform: "rotate(-8deg)" }} />
            </div>
          ) : null}
          <div style={{ ...golpe(f - p(8), 0, fps, 0.6), fontFamily: L.titular, fontWeight: L.peso, fontSize: 400, lineHeight: 0.9, color: fuerte, letterSpacing: "-0.03em" }}>{textos.precio}</div>
          <div style={{ ...golpe(f - p(8), p(1.5), fps, 0.3), marginTop: 30, fontFamily: L.apoyo, fontWeight: 800, fontSize: 44, letterSpacing: "0.14em", color: enFondo, textTransform: "uppercase" }}>{textos.servicio}</div>
        </AbsoluteFill>
      </Sequence>

      {/* 12-16 · Fecha límite en cinta sobre foto 2 */}
      <Sequence from={p(12)} durationInFrames={p(4)}>
        <Foto src={foto(1)} color={fuerte} oscurecer={0.45} />
        <Cinta texto={textos.hasta} fondo={fuerte} color={enFuerte} font={L.apoyo} size={64} top={760} velocidad={11} />
        <Cinta texto={textos.hasta} fondo={marca.fondo} color={enFondo} font={L.apoyo} size={64} top={930} velocidad={-9} angulo={3} />
      </Sequence>

      {/* 16-20 · Recap partido: foto arriba, bloque abajo */}
      <Sequence from={p(16)} durationInFrames={p(4)}>
        <AbsoluteFill>
          <div style={{ position: "absolute", inset: 0, bottom: "45%", overflow: "hidden" }}><Foto src={foto(2)} color={fuerte} /></div>
          <AbsoluteFill style={{ top: "55%", backgroundColor: fuerte, padding: "70px 80px", gap: 20 }}>
            <Palabras texto={textos.servicio} desde={0} cada={p(0.33)} size={100} color={enFuerte} font={L.titular} peso={L.peso} mayus={L.mayus} tracking={L.tracking} />
            <div style={{ ...golpe(f - p(16), p(1.5), fps, 0.5), fontFamily: L.titular, fontWeight: L.peso, fontSize: 200, color: enFuerte, lineHeight: 0.9 }}>{textos.precio}</div>
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* 20-24 · Marca */}
      <Sequence from={p(20)}>
        <Cierre marca={marca} desde={0} fpb={fpb} cta={textos.cta} linea={textos.hasta} />
      </Sequence>

      <Destello en={cortes} />
      <Grano />
      <Progreso fpb={fpb} color={fuerte} />
    </AbsoluteFill>
  );
};

/** Barra fina arriba que avanza a saltos en cada pulso: ritmo visible. */
export const Progreso: React.FC<{ fpb: number; color: string }> = ({ fpb, color }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const saltos = Math.floor(f / fpb) * fpb;
  const w = interpolate(f, [saltos, saltos + 4], [saltos, saltos + fpb], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) / durationInFrames;
  return (
    <div style={{ position: "absolute", top: 34, left: 60, right: 60, height: 8, borderRadius: 8, background: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(1, w) * 100}%`, background: color, boxShadow: "0 0 0 2px rgba(255,255,255,.6) inset" }} />
    </div>
  );
};
