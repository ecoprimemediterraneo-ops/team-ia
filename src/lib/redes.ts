/**
 * Sistema de publicación en redes sociales para AI-Team.
 *
 * Arquitectura: adapter pattern.
 * - Cada red implementa la interfaz RedAdapter.
 * - El motor (queue + cron) llama al adapter correspondiente cuando llega la fecha.
 * - Mientras no haya tokens, el adapter cae en "modo asistido" (lista para publicar manualmente).
 *
 * APIs usadas (todas gratis, propias):
 * - Meta Graph API → Instagram Business + Facebook Pages
 * - LinkedIn Marketing API → Company Page posts
 * - TikTok for Business API → vídeos (a configurar más adelante)
 *
 * NO usamos terceros como Ayrshare/Buffer. Todo nuestro.
 */

import fs from "node:fs/promises";
import path from "node:path";

export type Red = "instagram" | "facebook" | "linkedin" | "tiktok";

export type Publicacion = {
  id: string;
  red: Red;
  contenido: string;
  imagenUrl?: string; // URL pública absoluta
  videoUrl?: string;
  fechaProgramada: string; // ISO
  estado: "borrador" | "aprobada" | "programada" | "publicada" | "fallida" | "asistida";
  resultado?: { permalink?: string; id?: string; mensaje?: string };
  metadata?: { autor?: string; campaña?: string };
  creadaEn: string;
  actualizadaEn: string;
};

const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "queue.json");
const KV_KEY = "redes:queue";
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

// Seed bundled (commiteado en src/data/queue-seed.json) — siempre disponible incluso si /tmp se borra
import seedJson from "@/data/queue-seed.json";
import { kvGet, kvSet } from "./supabase";
const SEED: Publicacion[] = seedJson as Publicacion[];

async function load(): Promise<Publicacion[]> {
  let runtime: Publicacion[] = [];
  if (USE_SUPABASE) {
    runtime = (await kvGet<Publicacion[]>(KV_KEY)) || [];
  } else {
    try {
      runtime = JSON.parse(await fs.readFile(FILE, "utf-8")) as Publicacion[];
    } catch {
      runtime = [];
    }
  }
  // Mezclar: el runtime tiene prioridad si hay mismo id (porque pueden tener estados modificados)
  const runtimeIds = new Set(runtime.map((p) => p.id));
  const seedFiltrado = SEED.filter((p) => !runtimeIds.has(p.id));
  return [...seedFiltrado, ...runtime];
}

async function save(items: Publicacion[]) {
  if (USE_SUPABASE) {
    // Solo guarda lo que no es seed inmutable (los que tienen estado != seed inicial)
    // Para simplicidad: guardamos todo el merge, kvSet sobreescribe la clave entera
    await kvSet(KV_KEY, items);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2));
}

export async function listar(filtro?: { red?: Red; estado?: Publicacion["estado"] }): Promise<Publicacion[]> {
  const items = await load();
  return items.filter((p) =>
    (!filtro?.red || p.red === filtro.red) &&
    (!filtro?.estado || p.estado === filtro.estado),
  );
}

export async function obtener(id: string): Promise<Publicacion | null> {
  const items = await load();
  return items.find((p) => p.id === id) ?? null;
}

export async function crear(input: Omit<Publicacion, "id" | "estado" | "creadaEn" | "actualizadaEn">): Promise<Publicacion> {
  const items = await load();
  const ahora = new Date().toISOString();
  const pub: Publicacion = {
    ...input,
    id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    estado: "borrador",
    creadaEn: ahora,
    actualizadaEn: ahora,
  };
  items.push(pub);
  await save(items);
  return pub;
}

export async function actualizar(id: string, parcial: Partial<Publicacion>): Promise<Publicacion | null> {
  const items = await load();
  const idx = items.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...parcial, actualizadaEn: new Date().toISOString() };
  await save(items);
  return items[idx];
}

export async function eliminar(id: string): Promise<boolean> {
  const items = await load();
  const next = items.filter((p) => p.id !== id);
  if (next.length === items.length) return false;
  await save(next);
  return true;
}

// ───────────────────────────────────────────────
// ADAPTERS
// ───────────────────────────────────────────────

export type ResultadoPublicacion = {
  ok: boolean;
  permalink?: string;
  id?: string;
  mensaje?: string;
  asistido?: boolean; // true = requiere acción manual del usuario
};

export interface RedAdapter {
  red: Red;
  esConfigurado(): boolean;
  publicar(pub: Publicacion): Promise<ResultadoPublicacion>;
}

// ───────────────────────────────────────────────
// INSTAGRAM (Meta Graph API)
// ───────────────────────────────────────────────
//
// Env vars necesarias:
//   META_ACCESS_TOKEN          → long-lived user access token
//   META_INSTAGRAM_USER_ID     → Business Account ID de IG
//
// Pasos para conseguirlos (una vez):
// 1. Verificar empresa en business.facebook.com (1-3 semanas)
// 2. Crear app en developers.facebook.com → tipo "Business"
// 3. Añadir producto "Instagram" a la app
// 4. Conectar cuenta IG Business (la cuenta debe estar conectada a una Page de Facebook)
// 5. Generar long-lived access token
// 6. Pegar en Vercel env

export const InstagramAdapter: RedAdapter = {
  red: "instagram",
  esConfigurado() {
    return !!(process.env.META_ACCESS_TOKEN && process.env.META_INSTAGRAM_USER_ID);
  },
  async publicar(pub) {
    if (!this.esConfigurado()) {
      return { ok: true, asistido: true, mensaje: "Meta API sin configurar — modo asistido activado" };
    }
    const token = process.env.META_ACCESS_TOKEN!;
    const igUserId = process.env.META_INSTAGRAM_USER_ID!;

    if (!pub.imagenUrl && !pub.videoUrl) {
      return { ok: false, mensaje: "Instagram requiere imagen o vídeo" };
    }

    try {
      // Paso 1: crear contenedor
      const isVideo = !!pub.videoUrl;
      const mediaParams = new URLSearchParams({
        caption: pub.contenido,
        access_token: token,
      });
      if (isVideo) {
        mediaParams.set("media_type", "REELS");
        mediaParams.set("video_url", pub.videoUrl!);
      } else {
        mediaParams.set("image_url", pub.imagenUrl!);
      }

      const r1 = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
        method: "POST",
        body: mediaParams,
      });
      const j1 = await r1.json();
      if (!r1.ok) return { ok: false, mensaje: `Meta error 1: ${JSON.stringify(j1)}` };

      const containerId = j1.id;

      // Paso 2: publicar contenedor
      const r2 = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: containerId, access_token: token }),
      });
      const j2 = await r2.json();
      if (!r2.ok) return { ok: false, mensaje: `Meta error 2: ${JSON.stringify(j2)}` };

      return { ok: true, id: j2.id, mensaje: "Publicado en Instagram" };
    } catch (e) {
      return { ok: false, mensaje: e instanceof Error ? e.message : "Error desconocido" };
    }
  },
};

// ───────────────────────────────────────────────
// FACEBOOK PAGE (Meta Graph API)
// ───────────────────────────────────────────────
//
// Env vars necesarias:
//   META_ACCESS_TOKEN          → mismo token que IG
//   META_FACEBOOK_PAGE_ID      → ID de la página de Facebook

export const FacebookAdapter: RedAdapter = {
  red: "facebook",
  esConfigurado() {
    return !!(process.env.META_ACCESS_TOKEN && process.env.META_FACEBOOK_PAGE_ID);
  },
  async publicar(pub) {
    if (!this.esConfigurado()) {
      return { ok: true, asistido: true, mensaje: "Meta API sin configurar — modo asistido activado" };
    }
    const token = process.env.META_ACCESS_TOKEN!;
    const pageId = process.env.META_FACEBOOK_PAGE_ID!;

    try {
      const params = new URLSearchParams({
        message: pub.contenido,
        access_token: token,
      });
      if (pub.imagenUrl) params.set("link", pub.imagenUrl);

      const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
        method: "POST",
        body: params,
      });
      const j = await r.json();
      if (!r.ok) return { ok: false, mensaje: `FB error: ${JSON.stringify(j)}` };
      return { ok: true, id: j.id, mensaje: "Publicado en Facebook" };
    } catch (e) {
      return { ok: false, mensaje: e instanceof Error ? e.message : "Error desconocido" };
    }
  },
};

// ───────────────────────────────────────────────
// LINKEDIN (LinkedIn Marketing API)
// ───────────────────────────────────────────────
//
// Env vars necesarias:
//   LINKEDIN_ACCESS_TOKEN      → access token con permiso w_organization_social
//   LINKEDIN_ORG_URN           → ej. "urn:li:organization:12345678"
//
// Pasos:
// 1. Crear app en linkedin.com/developers
// 2. Pedir producto "Share on LinkedIn" + "Marketing Developer Platform"
// 3. Conectar a tu Company Page
// 4. OAuth 2-legged → access token

export const LinkedInAdapter: RedAdapter = {
  red: "linkedin",
  esConfigurado() {
    return !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORG_URN);
  },
  async publicar(pub) {
    if (!this.esConfigurado()) {
      return { ok: true, asistido: true, mensaje: "LinkedIn API sin configurar — modo asistido activado" };
    }
    const token = process.env.LINKEDIN_ACCESS_TOKEN!;
    const orgUrn = process.env.LINKEDIN_ORG_URN!;

    try {
      const body = {
        author: orgUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: pub.contenido },
            shareMediaCategory: pub.imagenUrl ? "ARTICLE" : "NONE",
            ...(pub.imagenUrl && {
              media: [{
                status: "READY",
                originalUrl: pub.imagenUrl,
              }],
            }),
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      };

      const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) return { ok: false, mensaje: `LinkedIn error: ${JSON.stringify(j)}` };
      return { ok: true, id: j.id, mensaje: "Publicado en LinkedIn" };
    } catch (e) {
      return { ok: false, mensaje: e instanceof Error ? e.message : "Error desconocido" };
    }
  },
};

// ───────────────────────────────────────────────
// TIKTOK (placeholder — configurar más adelante)
// ───────────────────────────────────────────────

export const TikTokAdapter: RedAdapter = {
  red: "tiktok",
  esConfigurado() {
    return !!process.env.TIKTOK_ACCESS_TOKEN;
  },
  async publicar() {
    return { ok: true, asistido: true, mensaje: "TikTok pendiente de implementación — modo asistido" };
  },
};

const ADAPTERS: Record<Red, RedAdapter> = {
  instagram: InstagramAdapter,
  facebook: FacebookAdapter,
  linkedin: LinkedInAdapter,
  tiktok: TikTokAdapter,
};

export function adapterPara(red: Red): RedAdapter {
  return ADAPTERS[red];
}

// ───────────────────────────────────────────────
// MOTOR: publicar pendientes (lo llama el cron)
// ───────────────────────────────────────────────

export async function publicarPendientes(): Promise<{ procesadas: number; ok: number; fallidas: number; asistidas: number }> {
  const items = await load();
  const ahora = Date.now();
  const pendientes = items.filter((p) => p.estado === "programada" && new Date(p.fechaProgramada).getTime() <= ahora);

  let ok = 0, fallidas = 0, asistidas = 0;

  for (const pub of pendientes) {
    const adapter = adapterPara(pub.red);
    const res = await adapter.publicar(pub);
    if (res.asistido) {
      await actualizar(pub.id, { estado: "asistida", resultado: { mensaje: res.mensaje } });
      asistidas++;
    } else if (res.ok) {
      await actualizar(pub.id, { estado: "publicada", resultado: { permalink: res.permalink, id: res.id, mensaje: res.mensaje } });
      ok++;
    } else {
      await actualizar(pub.id, { estado: "fallida", resultado: { mensaje: res.mensaje } });
      fallidas++;
    }
  }

  return { procesadas: pendientes.length, ok, fallidas, asistidas };
}

// ───────────────────────────────────────────────
// MODO ASISTIDO: link "publicar a mano"
// ───────────────────────────────────────────────

export function urlAsistido(pub: Publicacion): string {
  // Devuelve una URL que abre la red social con el texto listo para pegar.
  // El usuario tiene que pegar texto (ya copiado al portapapeles desde el dashboard) + subir imagen manual.
  switch (pub.red) {
    case "instagram":
      // IG web no permite publicar directo. Abrimos Creator Studio.
      return "https://www.facebook.com/creatorstudio/";
    case "facebook":
      return "https://www.facebook.com/";
    case "linkedin":
      return "https://www.linkedin.com/feed/?shareActive=true";
    case "tiktok":
      return "https://www.tiktok.com/upload";
    default:
      return "#";
  }
}
