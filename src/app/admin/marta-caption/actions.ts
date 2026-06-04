"use server";

import { getSession } from "@/lib/auth";
import { generarCaption } from "@/lib/marta-caption";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export type CaptionState = {
  ts: number;
  ok: boolean;
  caption: string;
  tema: string;
  tenantId: string;
  error?: string;
};

export async function generateAction(
  _prev: CaptionState,
  formData: FormData,
): Promise<CaptionState> {
  const s = await getSession();
  if (!s || (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com")) {
    return {
      ts: Date.now(),
      ok: false,
      caption: "",
      tema: "",
      tenantId: "",
      error: "No autorizado.",
    };
  }

  const tenantId = String(formData.get("tenantId") || "").trim();
  const tema = String(formData.get("tema") || "").trim() || undefined;
  const contexto = String(formData.get("contexto") || "").trim() || undefined;

  if (!tenantId) {
    return {
      ts: Date.now(),
      ok: false,
      caption: "",
      tema: "",
      tenantId: "",
      error: "Falta tenant.",
    };
  }

  const result = await generarCaption({ tenantId, tema, contexto });
  if (!result.ok) {
    return {
      ts: Date.now(),
      ok: false,
      caption: "",
      tema: tema || "",
      tenantId,
      error: `[${result.reason}] ${result.detail}`,
    };
  }

  return {
    ts: Date.now(),
    ok: true,
    caption: result.caption,
    tema: result.tema,
    tenantId,
  };
}
