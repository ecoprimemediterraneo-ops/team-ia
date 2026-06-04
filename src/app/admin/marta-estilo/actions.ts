"use server";

import { getSession } from "@/lib/auth";
import {
  STYLE_PRESETS,
  AI_STYLES,
  type StylePreset,
  type AIStyle,
} from "@/lib/image-style-presets";
import { setStyleConfig } from "@/lib/style-config-temp";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export type SaveState = {
  ts: number;
  ok: boolean;
  message: string;
};

export async function saveStyleAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const s = await getSession();
  if (!s || (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com")) {
    return { ts: Date.now(), ok: false, message: "No autorizado." };
  }

  const presetRaw = String(formData.get("preset") || "natural") as StylePreset;
  const preset = STYLE_PRESETS.find((p) => p.id === presetRaw)?.id || "natural";
  const logoUrl = String(formData.get("logoUrl") || "").trim() || undefined;
  const aiRaw = String(formData.get("aiStyle") || "").trim() as AIStyle | "";
  const aiStyle = AI_STYLES.find((a) => a.id === aiRaw)?.id;

  if (logoUrl && !/^https?:\/\//.test(logoUrl)) {
    return { ts: Date.now(), ok: false, message: "logoUrl debe empezar por http(s)://" };
  }

  setStyleConfig({ preset, logoUrl, aiStyle });
  const aiNote = aiStyle ? ` + IA="${aiStyle}"` : "";
  return {
    ts: Date.now(),
    ok: true,
    message: `Guardado en memoria temporal: preset="${preset}"${aiNote}${logoUrl ? " · con logo" : ""}. PENDIENTE conectar con ficha del tenant.`,
  };
}
