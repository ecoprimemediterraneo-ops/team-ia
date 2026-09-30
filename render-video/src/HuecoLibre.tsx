// «Hueco libre hoy»: urgencia. HOY a golpe → la HORA rueda como un marcador →
// qué servicio y con quién → botón de WhatsApp que se "pulsa" en el pulso.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Foto, Destello, Grano, Palabras, Cierre, Boton, Cinta, letras, sobre, bloque, golpe } from "./comun";
import { Progreso } from "./Oferta";
import type { MarcaVideo, TextosHueco } from "./tipos";

/** Un dígito que rueda como un marcador de estación y frena en su sitio. */
const Rueda: React.FC<{ c: string; desde: number; size: number; color: string; font: string }> = ({ c, desde, size, color, font }) => {
  const f = useCurrentFrame();
  const alto = Math.round(size * 1.15);
  const caja = { display: "block", height: alto, lineHeight: `${alto}px`, fontFamily: font, fontSize: size, color, textAlign: "center" as const };
  if (!/\d/.test(c)) return <span style={{ ...caja, display: "inline-block", width: size * 0.3 }}>{c}</span>;
  const final = Number(c);
  const vueltas = 10 + final;
  const t = interpolate(f, [desde, desde + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const pos = t * vueltas;
  return (
    <span style={{ display: "inline-block", height: alto, width: size * 0.62, overflow: "hidden", clipPath: "inset(0)", verticalAlign: "top" }}>
      <span style={{ display: "block", transform: `translateY(${-pos * alto}px)` }}>
        {Array.from({ length: vueltas + 1 }, (_, i) => <span key={i} style={caja}>{i % 10}</span>)}
      </span>
    </span>
  );
};

export const HuecoLibre: React.FC<{ marca: MarcaVideo; fotos: string[]; textos: TextosHueco; fpb: number }> = ({ marca, fotos, textos, fpb }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = letras(marca.tipografia);
  const fuerte = bloque(marca);
  const enFuerte = sobre(fuerte, marca);
  const enFondo = sobre(marca.fondo, marca);
  const p = (n: number) => Math.round(n * fpb);
  const foto = (i: number) => fotos[i % Math.max(1, fotos.length)];
  const cortes = [3, 8, 12, 17].map(p);
  const toque = p(15);
  const onda = interpolate(f, [toque, toque + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: marca.fondo }}>
      {/* 0-3 · HOY */}
      <Sequence from={0} durationInFrames={p(3)}>
        <AbsoluteFill style={{ backgroundColor: fuerte, padding: "0 80px", justifyContent: "center" }}>
          <div style={{ ...golpe(f, 0, fps, 0.8), fontFamily: L.titular, fontWeight: L.peso, fontSize: 420, lineHeight: 0.85, color: enFuerte, letterSpacing: L.tracking }}>{L.mayus ? "HOY" : "Hoy"}</div>
          <Palabras texto={textos.gancho} desde={p(1)} cada={p(0.4)} size={170} color={enFuerte} font={L.titular} peso={L.peso} mayus={L.mayus} tracking={L.tracking} />
        </AbsoluteFill>
      </Sequence>

      {/* 3-8 · La hora rueda */}
      <Sequence from={p(3)} durationInFrames={p(5)}>
        <Foto src={foto(0)} color={fuerte} oscurecer={0.85} />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ ...golpe(f - p(3), 0, fps, 0.3), background: fuerte, color: enFuerte, fontFamily: L.apoyo, fontWeight: 800, fontSize: 40, letterSpacing: "0.16em", padding: "14px 26px", marginBottom: 30, textTransform: "uppercase" }}>{textos.dia}</div>
          <div style={{ display: "flex", fontWeight: L.peso }}>
            {textos.hora.split("").map((c, i) => <Rueda key={i} c={c} desde={p(0.5) + i * 3} size={330} color="#FFFFFF" font={L.titular} />)}
          </div>
          <div style={{ ...golpe(f - p(3), p(2.5), fps, 0.4), marginTop: 20, fontFamily: L.apoyo, fontWeight: 800, fontSize: 52, color: "#FFFFFF", letterSpacing: "0.1em" }}>{L.mayus ? "LIBRE" : "libre"}</div>
        </AbsoluteFill>
      </Sequence>

      {/* 8-12 · Qué y con quién */}
      <Sequence from={p(8)} durationInFrames={p(4)}>
        <Foto src={foto(1)} color={fuerte} oscurecer={0.7} />
        <AbsoluteFill style={{ padding: "0 80px 340px", justifyContent: "flex-end" }}>
          <Palabras texto={textos.servicio} desde={0} cada={p(0.4)} size={150} color="#FFFFFF" font={L.titular} peso={L.peso} mayus={L.mayus} tracking={L.tracking} />
          {textos.profesional ? <div style={{ ...golpe(f - p(8), p(2), fps, 0.3), marginTop: 26, fontFamily: L.apoyo, fontWeight: 700, fontSize: 56, color: "#FFFFFF" }}>{textos.profesional}</div> : null}
        </AbsoluteFill>
        <Cinta texto={`${textos.hora} · ${textos.servicio}`} fondo={fuerte} color={enFuerte} font={L.apoyo} size={46} top={170} velocidad={10} angulo={-3} />
      </Sequence>

      {/* 12-17 · El botón, y se pulsa */}
      <Sequence from={p(12)} durationInFrames={p(5)}>
        <AbsoluteFill style={{ backgroundColor: marca.fondo, alignItems: "center", justifyContent: "center", gap: 60 }}>
          <div style={{ ...golpe(f - p(12), 0, fps, 0.5), fontFamily: L.titular, fontWeight: L.peso, fontSize: 300, lineHeight: 0.9, color: fuerte }}>{textos.hora}</div>
          <Palabras texto={L.mayus ? "¿Te lo quedas?" : "¿Te lo quedas?"} desde={0} cada={p(0.33)} size={130} color={enFondo} font={L.titular} peso={L.peso} mayus={L.mayus} tracking={L.tracking} align="center" />
          <div style={{ position: "relative" }}>
            <Boton texto={textos.cta} desde={p(1.5)} fpb={fpb} fondo="#25D366" color="#FFFFFF" font={L.apoyo} size={60} toque={toque - p(12)} />
            {onda > 0 && onda < 1 ? <div style={{ position: "absolute", right: 90, top: "50%", width: 60 + onda * 260, height: 60 + onda * 260, marginTop: -(30 + onda * 130), marginRight: -(30 + onda * 130), borderRadius: 999, border: `8px solid ${fuerte}`, opacity: 1 - onda }} /> : null}
          </div>
          {textos.telefono ? <div style={{ ...golpe(f - p(12), p(2.5), fps, 0.2), fontFamily: L.apoyo, fontWeight: 700, fontSize: 48, color: enFondo, letterSpacing: "0.06em" }}>{textos.telefono}</div> : null}
        </AbsoluteFill>
      </Sequence>

      {/* 17-22 · Marca */}
      <Sequence from={p(17)}>
        <Cierre marca={marca} desde={0} fpb={fpb} cta={textos.cta} linea={`${textos.dia} · ${textos.hora}`} />
      </Sequence>

      <Destello en={cortes} />
      <Grano />
      <Progreso fpb={fpb} color={fuerte} />
    </AbsoluteFill>
  );
};
