"use server";

// Server action de /admin/ficha-cliente. Solo funciones async exportadas.
// Tipos viven en ./types.

import { getSession } from "@/lib/auth";
import { saveFicha, type Ficha } from "@/lib/ficha";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import type { AIStyle, StyleConfig, StylePreset } from "@/lib/image-style-presets";
import type { SaveState } from "./types";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export async function saveFichaAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const s = await getSession();
  if (!s || (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com")) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "No autorizado",
      detail: "Inicia sesión como fundador antes de editar la ficha.",
    };
  }

  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();

  // Estilo visual del cliente (B3).
  const presetRaw = String(formData.get("estiloPreset") || "natural").trim() as StylePreset;
  const validPresets: StylePreset[] = ["natural", "calido", "vivido", "luminoso"];
  const preset: StylePreset = validPresets.includes(presetRaw) ? presetRaw : "natural";

  const aiRaw = String(formData.get("estiloAI") || "").trim();
  const validAI: AIStyle[] = ["comic", "editorial"];
  const aiStyle: AIStyle | undefined = validAI.includes(aiRaw as AIStyle)
    ? (aiRaw as AIStyle)
    : undefined;

  const logoUrl = String(formData.get("estiloLogoUrl") || "").trim() || undefined;
  const estilo: StyleConfig = { preset, aiStyle, logoUrl };

  const ficha: Ficha = {
    nombreNegocio: String(formData.get("nombreNegocio") || "").trim(),
    sector: String(formData.get("sector") || "").trim(),
    ciudad: String(formData.get("ciudad") || "").trim(),
    tono: String(formData.get("tono") || "").trim(),
    serviciosClave: parseLines(String(formData.get("serviciosClave") || "")),
    promosActuales: parseLines(String(formData.get("promosActuales") || "")),
    publicoObjetivo: String(formData.get("publicoObjetivo") || "").trim() || undefined,
    notasEstilo: String(formData.get("notasEstilo") || "").trim() || undefined,
    estilo,
  };

  if (!ficha.nombreNegocio) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Falta el nombre del negocio",
      detail: "Es el único campo obligatorio para guardar la ficha.",
    };
  }

  try {
    const t = await saveFicha(tenantId, ficha);
    if (!t) {
      return {
        ts: Date.now(),
        variant: "error",
        title: "Tenant no encontrado",
        detail: `No existe el tenant "${tenantId}".`,
      };
    }
    return {
      ts: Date.now(),
      variant: "ok",
      title: "Ficha guardada ✅",
      detail: `Actualizada para ${t.name} (${t.id}).`,
    };
  } catch (err) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Error guardando la ficha",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
