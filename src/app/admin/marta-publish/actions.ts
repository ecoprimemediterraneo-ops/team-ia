"use server";

// Server action de la página /admin/marta-publish.
// Solo funciones async exportadas (restricción de "use server").
// Tipos y constantes viven en ./types.

import { getSession } from "@/lib/auth";
import {
  publishToInstagram,
  type PublishMediaType,
  type PublishResult,
} from "@/lib/marta-publish";
import type { PublishActionState } from "./types";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export async function publishAction(
  _prev: PublishActionState,
  formData: FormData,
): Promise<PublishActionState> {
  const s = await getSession();
  if (!s || (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com")) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "No autorizado",
      detail: "Inicia sesión como fundador antes de publicar.",
    };
  }

  const caption = String(formData.get("caption") || "").trim();
  const mediaUrl = String(formData.get("mediaUrl") || "").trim();
  const mediaType = (String(formData.get("mediaType") || "IMAGE").toUpperCase() as PublishMediaType);
  const coverUrl = String(formData.get("coverUrl") || "").trim() || undefined;

  if (!mediaUrl) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Falta URL del media",
      detail: "Pega una URL pública (https://…) accesible por Meta.",
    };
  }
  if (!/^https?:\/\//.test(mediaUrl)) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "URL no válida",
      detail: "La URL debe empezar por http:// o https:// y estar disponible públicamente.",
    };
  }
  if (caption.length > 2200) {
    return {
      ts: Date.now(),
      variant: "error",
      title: "Caption demasiado largo",
      detail: `Instagram limita el caption a 2200 caracteres. Tienes ${caption.length}.`,
    };
  }

  const result: PublishResult = await publishToInstagram({
    mediaType,
    mediaUrl,
    caption: caption || undefined,
    coverUrl,
  });

  if ("skipped" in result && result.skipped) {
    return {
      ts: Date.now(),
      variant: "skipped",
      title:
        result.reason === "flag_disabled"
          ? "Publicación desactivada por flag"
          : "Falta configuración de entorno",
      detail:
        result.reason === "flag_disabled"
          ? "Pon MARTA_PUBLISH_ENABLED=true (en .env.local para local o en Vercel para prod) y reinicia / redeploya."
          : result.detail,
    };
  }

  if ("ok" in result && result.ok) {
    let permalink: string | undefined;
    try {
      const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
      if (token) {
        const r = await fetch(
          `https://graph.facebook.com/v21.0/${result.igMediaId}?fields=permalink`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (r.ok) {
          const j = (await r.json()) as { permalink?: string };
          permalink = j.permalink;
        }
      }
    } catch {
      // ignoramos; el ID basta para confirmar éxito
    }

    return {
      ts: Date.now(),
      variant: "ok",
      title: "Publicado en Instagram ✅",
      detail: `Media ID: ${result.igMediaId}`,
      igMediaId: result.igMediaId,
      permalink,
    };
  }

  // ok === false (fallo Meta)
  const failure = result as { ok: false; reason: string; detail: string; metaCode?: number };
  return {
    ts: Date.now(),
    variant: "error",
    title: "Meta rechazó la publicación",
    detail: failure.detail,
    metaCode: failure.metaCode,
  };
}
