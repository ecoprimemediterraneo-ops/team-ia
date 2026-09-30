import React from "react";
import { AbsoluteFill, Audio, staticFile, interpolate, useVideoConfig } from "remotion";
import { Oferta } from "./Oferta";
import { AntesDespues } from "./AntesDespues";
import { HuecoLibre } from "./HuecoLibre";
import { MUSICA_POR_PLANTILLA, framesPorPulso, type PropsVideo, type TextosOferta, type TextosAntesDespues, type TextosHueco } from "./tipos";

export const Video: React.FC<PropsVideo> = (props) => {
  const { durationInFrames } = useVideoConfig();
  const pista = props.musica || MUSICA_POR_PLANTILLA[props.plantilla];
  const fpb = framesPorPulso(pista);
  const comun = { marca: props.marca, fotos: props.fotos, fpb };
  return (
    <AbsoluteFill>
      {props.plantilla === "oferta" ? <Oferta {...comun} textos={props.textos as TextosOferta} /> : null}
      {props.plantilla === "antes_despues" ? <AntesDespues {...comun} textos={props.textos as TextosAntesDespues} /> : null}
      {props.plantilla === "hueco_libre" ? <HuecoLibre {...comun} textos={props.textos as TextosHueco} /> : null}
      <Audio src={staticFile(`musica/${pista}.wav`)} volume={(f) => interpolate(f, [durationInFrames - 20, durationInFrames], [0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
};
