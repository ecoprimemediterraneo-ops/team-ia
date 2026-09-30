import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";
import { FPS, PULSOS, MUSICA_POR_PLANTILLA, framesPorPulso, type PropsVideo } from "./tipos";

const marca = { nombre: "Salón Bella", fondo: "#FBF7F4", acento: "#8A5A64", texto: "#3B2A2E", tipografia: "elegante" as const };
const fotos = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1080&q=80",
  "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1080&q=80",
  "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=1080&q=80",
];
const DEFECTO: PropsVideo = {
  plantilla: "oferta", marca, fotos,
  textos: { gancho: "Solo este mes", servicio: "Manicura semipermanente", precio: "19 €", precioAntes: "25 €", hasta: "Hasta el 15 de octubre", cta: "Reserva por WhatsApp" },
};

export const Root: React.FC = () => (
  <Composition
    id="Video"
    component={Video as unknown as React.FC<Record<string, unknown>>}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={300}
    defaultProps={DEFECTO as unknown as Record<string, unknown>}
    calculateMetadata={({ props }) => {
      const pr = props as unknown as PropsVideo;
      const pista = pr.musica || MUSICA_POR_PLANTILLA[pr.plantilla];
      return { durationInFrames: Math.round(PULSOS[pr.plantilla] * framesPorPulso(pista)) };
    }}
  />
);
