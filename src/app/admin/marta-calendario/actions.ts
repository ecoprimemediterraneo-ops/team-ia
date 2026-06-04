"use server";

import { getSession } from "@/lib/auth";
import { generateArranque } from "@/lib/marta-arranque";
import { scheduleBatch } from "@/lib/marta-calendar";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";
import type { CalendarState } from "./types";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export async function scheduleArranqueAction(
  _prev: CalendarState,
  formData: FormData,
): Promise<CalendarState> {
  const s = await getSession();
  if (!s || (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com")) {
    return { ts: Date.now(), variant: "error", title: "No autorizado" };
  }
  const tenantId = String(formData.get("tenantId") || DEFAULT_TENANT_ID).trim();
  const count = Math.min(Math.max(parseInt(String(formData.get("count") || "6"), 10) || 6, 1), 12);
  const daySpan = Math.max(1, parseInt(String(formData.get("daySpan") || "7"), 10) || 7);
  const postsPerDay = Math.min(Math.max(parseInt(String(formData.get("postsPerDay") || "2"), 10) || 2, 1), 3);
  const startsTomorrow = formData.get("startsTomorrow") === "1";

  // 1) Genera drafts (caption + imagen estilada).
  const arr = await generateArranque(tenantId, count);
  if (!("ok" in arr) || !arr.ok) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "No se pudieron generar los drafts",
      detail: "ok" in arr ? "" : (arr as { detail?: string }).detail || "",
    };
  }

  // 2) Programa cada draft.
  const scheduled = await scheduleBatch(
    tenantId,
    arr.drafts.map((d) => ({
      caption: d.caption,
      imageUrl: d.imageUrl,
      tema: d.tema,
      mediaType: "IMAGE" as const,
    })),
    { daySpan, postsPerDay, startsTomorrow },
  );

  return {
    ts: Date.now(),
    variant: "ok",
    title: `${scheduled.length} posts programados`,
    detail: arr.errors.length
      ? `${arr.errors.length} aviso(s) durante la generación.`
      : "Todo limpio. Cuando lleguen las horas, dispara el trigger (botón abajo).",
    scheduled,
    warnings: arr.errors,
  };
}
