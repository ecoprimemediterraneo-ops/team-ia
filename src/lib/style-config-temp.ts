// Almacén TEMPORAL en memoria para StyleConfig de Marta.
//
// PENDIENTE: cuando la otra sesión termine /admin/ficha-cliente + tenants.ts,
// mover esto a la ficha del tenant (campo `style` en TenantFicha) y borrar
// este archivo. Se reinicia en cada redeploy / restart del server.

import type { AIStyle, StyleConfig, StylePreset } from "./image-style-presets";

let current: StyleConfig = { preset: "natural" };

export function getStyleConfig(): StyleConfig {
  return { ...current };
}

export function setStyleConfig(next: {
  preset: StylePreset;
  logoUrl?: string;
  aiStyle?: AIStyle;
}): StyleConfig {
  current = { preset: next.preset, logoUrl: next.logoUrl, aiStyle: next.aiStyle };
  return getStyleConfig();
}
