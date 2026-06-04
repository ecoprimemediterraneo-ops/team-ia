// Presets y tipos del motor de estilo. Sin dependencias de sharp/node,
// para poder importarlo desde componentes cliente.

// Filtros sharp (instantáneos, gratis).
export type StylePreset = "natural" | "calido" | "vivido" | "luminoso";

export const STYLE_PRESETS: { id: StylePreset; label: string; description: string }[] = [
  { id: "natural", label: "Natural", description: "Sin ajustes, foto tal cual" },
  { id: "calido", label: "Cálido", description: "Tonos cálidos, brillo suave (clínicas/estética)" },
  { id: "vivido", label: "Vívido", description: "Saturación y contraste altos, impacto visual" },
  { id: "luminoso", label: "Luminoso", description: "Aireado, premium, fondos claros" },
];

// Estilos IA (vía Gemini, tarda unos segundos y cuesta por imagen).
export type AIStyle = "comic" | "editorial";

export const AI_STYLES: { id: AIStyle; label: string; description: string }[] = [
  { id: "comic", label: "Cómic", description: "Ilustración moderna, líneas limpias, colores planos" },
  { id: "editorial", label: "Editorial", description: "Revista premium, iluminación cuidada, realista" },
];

export type StyleConfig = {
  preset: StylePreset;
  logoUrl?: string;
  // Si aiStyle está definido, primero pasa por IA y después por preset+logo.
  aiStyle?: AIStyle;
};
