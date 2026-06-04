"use server";

import { getSession } from "@/lib/auth";
import { generateArranque } from "@/lib/marta-arranque";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import type { ArranqueState } from "./types";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export async function arranqueAction(
  _prev: ArranqueState,
  formData: FormData,
): Promise<ArranqueState> {
  const s = await getSession();
  if (!s || (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com")) {
    return { ts: Date.now(), variant: "error", title: "No autorizado" };
  }
  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();
  const countRaw = parseInt(String(formData.get("count") || "6"), 10);
  const count = Math.min(Math.max(Number.isFinite(countRaw) ? countRaw : 6, 1), 12);

  const result = await generateArranque(tenantId, count);
  if (!("ok" in result) || !result.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "No se pudo generar el arranque",
      detail: "ok" in result ? "" : (result as { detail?: string }).detail || "",
    };
  }

  return {
    ts: Date.now(),
    variant: "ok",
    title: `Generados ${result.drafts.length} posts + bio`,
    detail: result.errors.length
      ? `${result.errors.length} aviso(s) durante la generación — abajo.`
      : "Todo limpio.",
    bio: result.bio.ok ? result.bio.bio : `(bio no generada: ${result.bio.detail})`,
    drafts: result.drafts,
    warnings: result.errors,
  };
}
