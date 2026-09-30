// Contrato ÚNICO entre la app (tropa/src/lib/marta-video.ts) y el render.
// Si cambias algo aquí, cámbialo también allí.
export type Tipografia = "impacto" | "elegante" | "moderna";
export type Pista = "ritmo" | "brillo" | "calma";
export type PlantillaVideo = "oferta" | "antes_despues" | "hueco_libre";

export type MarcaVideo = {
  nombre: string;
  fondo: string;
  acento: string;
  texto: string;
  tipografia: Tipografia;
  logoUrl?: string;
};

export type TextosOferta = { gancho: string; servicio: string; precio: string; precioAntes?: string; hasta: string; cta: string };
export type TextosAntesDespues = { gancho: string; frase: string; servicio: string; cta: string };
export type TextosHueco = { gancho: string; hora: string; dia: string; servicio: string; profesional?: string; cta: string; telefono?: string };

export type PropsVideo = {
  plantilla: PlantillaVideo;
  marca: MarcaVideo;
  fotos: string[];
  musica?: Pista;
  formato?: "reel" | "historia";
  textos: TextosOferta | TextosAntesDespues | TextosHueco;
};

export const BPM: Record<Pista, number> = { ritmo: 120, brillo: 124, calma: 104 };
export const MUSICA_POR_PLANTILLA: Record<PlantillaVideo, Pista> = { oferta: "ritmo", antes_despues: "calma", hueco_libre: "brillo" };
/** Pulsos que dura cada plantilla (a su tempo salen 12-13 s). */
export const PULSOS: Record<PlantillaVideo, number> = { oferta: 24, antes_despues: 22, hueco_libre: 22 };
export const FPS = 30;
export const framesPorPulso = (p: Pista) => (60 / BPM[p]) * FPS;
