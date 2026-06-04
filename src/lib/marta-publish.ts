// =============================================================================
// Marta · Publicación de posts y Reels en Instagram (Marta parte 2)
// =============================================================================
//
// Estado: LISTO pero DESACTIVADO por defecto.
//
// Para ACTIVAR esta funcionalidad en producción hacen falta DOS cosas:
//
//   1. App Review de Meta aprobado para el permiso `instagram_content_publish`
//      (la misma app de Meta que ya usa Marta para DMs). Sin este permiso, la
//      llamada a POST /{ig-user-id}/media_publish devuelve error (#10 / #200).
//
//   2. Variable de entorno `MARTA_PUBLISH_ENABLED=true` en Vercel
//      (Production + Preview + Development según convenga). Mientras esté en
//      `false` (o ausente), `publishToInstagram()` no llama a Meta: solo logea
//      "[marta/publish] desactivado — pendiente App Review" y devuelve un
//      objeto `{ skipped: true, ... }` sin error, para no romper nada.
//
// Variables de entorno usadas (ya existentes en el proyecto, no añade nuevas
// excepto el flag):
//
//   - MARTA_PUBLISH_ENABLED      → "true" para activar. Default: desactivado.
//   - INSTAGRAM_ACCESS_TOKEN     → EAA del System User (mismo que usa el
//                                  webhook). Fallback: WHATSAPP_ACCESS_TOKEN.
//   - FACEBOOK_PAGE_ID           → Page id conectada a la cuenta IG. El IG
//                                  user id se DERIVA de aquí mediante
//                                  GET /{page-id}?fields=instagram_business_account.
//   - INSTAGRAM_USER_ID          → Opcional. Si está, se usa directamente y
//                                  se evita el lookup. Útil para producción.
//
// Flujo de publicación (Instagram Graph API, 2 pasos):
//
//   1) POST /{ig-user-id}/media            → crea media container, devuelve `id` (creation_id).
//      - Imagen:  image_url + caption
//      - Vídeo:   video_url + caption + media_type=VIDEO
//      - Reel:    video_url + caption + media_type=REELS
//
//   2) POST /{ig-user-id}/media_publish    → publica el container, con `creation_id`.
//
//   Para vídeo/Reel hay que esperar a que el container esté `FINISHED` antes
//   de publicar (Meta lo procesa unos segundos). Hacemos polling al endpoint
//   GET /{creation-id}?fields=status_code con un timeout razonable.
//
// Errores típicos que esta capa maneja con mensajes claros:
//
//   - (#190)            → token caducado o inválido.
//   - (#10) / (#200)    → permiso `instagram_content_publish` no concedido
//                          (típico mientras la App Review está pendiente).
//   - (#100)            → parámetro inválido (image_url/video_url mal,
//                          caption demasiado larga, formato no soportado).
//   - status ERROR       → Meta no pudo procesar el media (URL inalcanzable,
//                          formato no válido, vídeo > 60s para Reel, etc.).
//
// NO se usa en ningún sitio del repo todavía. Es un módulo aislado, listo
// para enchufar desde una ruta `src/app/api/marta/publish/route.ts` o desde
// un cron cuando llegue el momento.
// =============================================================================

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Máximo tiempo esperando a que Meta procese vídeo/Reel antes de publicar.
const VIDEO_PROCESS_TIMEOUT_MS = 60_000;
const VIDEO_POLL_INTERVAL_MS = 3_000;

// -----------------------------------------------------------------------------
// Tipos públicos
// -----------------------------------------------------------------------------

// IMAGE / VIDEO / REELS → posts al feed o reel.
// STORIES_IMAGE / STORIES_VIDEO → publicación a Stories (caducan en 24h).
export type PublishMediaType =
  | "IMAGE"
  | "VIDEO"
  | "REELS"
  | "STORIES_IMAGE"
  | "STORIES_VIDEO";

export interface PublishInput {
  mediaType: PublishMediaType;
  /** URL pública accesible por Meta. Imagen para IMAGE/STORIES_IMAGE, vídeo para VIDEO/REELS/STORIES_VIDEO. */
  mediaUrl: string;
  /** Caption (≤ 2200 chars, ≤ 30 hashtags). Opcional. Stories: Instagram suele ignorarlo. */
  caption?: string;
  /** Opcional. Para Reels: thumbnail (URL). */
  coverUrl?: string;
}

export type PublishResult =
  | { ok: true; igMediaId: string; creationId: string }
  | { ok: false; reason: PublishErrorReason; detail: string; metaCode?: number }
  | { skipped: true; reason: "flag_disabled" | "missing_env"; detail: string };

export type PublishErrorReason =
  | "token_invalid_or_expired"
  | "permission_missing"
  | "invalid_media"
  | "processing_failed"
  | "processing_timeout"
  | "ig_user_lookup_failed"
  | "network_error"
  | "unknown";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getToken(): string | null {
  const t = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";
  return t.length > 0 ? t : null;
}

function isEnabled(): boolean {
  return (process.env.MARTA_PUBLISH_ENABLED || "").toLowerCase() === "true";
}

// Mapea un error de Graph API a una razón legible.
function classifyGraphError(code: number | undefined, message: string): PublishErrorReason {
  if (code === 190) return "token_invalid_or_expired";
  if (code === 10 || code === 200) return "permission_missing";
  if (code === 100) return "invalid_media";
  if (/permission/i.test(message)) return "permission_missing";
  if (/access token/i.test(message)) return "token_invalid_or_expired";
  return "unknown";
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
}

async function readGraphError(res: Response): Promise<{ code?: number; message: string }> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as GraphErrorBody;
    return { code: j.error?.code, message: j.error?.message || text };
  } catch {
    return { message: text };
  }
}

// -----------------------------------------------------------------------------
// IG user id: cacheado en memoria del módulo
// -----------------------------------------------------------------------------

let cachedIgUserId: { value: string; expiresAt: number } | null = null;

async function resolveIgUserId(token: string): Promise<string> {
  const fromEnv = process.env.INSTAGRAM_USER_ID;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const now = Date.now();
  if (cachedIgUserId && cachedIgUserId.expiresAt > now) return cachedIgUserId.value;

  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!pageId) {
    throw new Error("FACEBOOK_PAGE_ID no configurado y INSTAGRAM_USER_ID ausente");
  }

  const url = `${GRAPH}/${pageId}?fields=instagram_business_account`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await readGraphError(res);
    throw new Error(`page lookup failed: status=${res.status} code=${err.code ?? "?"} msg=${err.message}`);
  }
  const data = (await res.json()) as { instagram_business_account?: { id?: string } };
  const id = data.instagram_business_account?.id;
  if (!id) {
    throw new Error("la Page no tiene instagram_business_account vinculada");
  }
  cachedIgUserId = { value: id, expiresAt: now + 6 * 60 * 60 * 1000 }; // 6h
  return id;
}

// -----------------------------------------------------------------------------
// Pasos del flujo
// -----------------------------------------------------------------------------

async function createMediaContainer(
  igUserId: string,
  token: string,
  input: PublishInput,
): Promise<string> {
  const params = new URLSearchParams();
  if (input.mediaType === "IMAGE") {
    params.set("image_url", input.mediaUrl);
  } else if (input.mediaType === "STORIES_IMAGE") {
    // Stories de imagen → media_type=STORIES + image_url.
    params.set("image_url", input.mediaUrl);
    params.set("media_type", "STORIES");
  } else if (input.mediaType === "STORIES_VIDEO") {
    // Stories de vídeo → media_type=STORIES + video_url.
    params.set("video_url", input.mediaUrl);
    params.set("media_type", "STORIES");
    if (input.coverUrl) params.set("cover_url", input.coverUrl);
  } else {
    // VIDEO o REELS
    params.set("video_url", input.mediaUrl);
    params.set("media_type", input.mediaType);
    if (input.coverUrl) params.set("cover_url", input.coverUrl);
  }
  if (input.caption) params.set("caption", input.caption);

  const url = `${GRAPH}/${igUserId}/media`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await readGraphError(res);
    const reason = classifyGraphError(err.code, err.message);
    const e = new Error(`create container failed: ${err.message}`) as Error & {
      reason: PublishErrorReason;
      metaCode?: number;
    };
    e.reason = reason;
    e.metaCode = err.code;
    throw e;
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("create container: respuesta sin id");
  return data.id;
}

async function waitForContainerReady(creationId: string, token: string): Promise<void> {
  const deadline = Date.now() + VIDEO_PROCESS_TIMEOUT_MS;
  const url = `${GRAPH}/${creationId}?fields=status_code`;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = await readGraphError(res);
      const e = new Error(`status check failed: ${err.message}`) as Error & {
        reason: PublishErrorReason;
      };
      e.reason = classifyGraphError(err.code, err.message);
      throw e;
    }
    const data = (await res.json()) as { status_code?: string };
    const status = data.status_code || "";
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      const e = new Error(`container ${status}`) as Error & { reason: PublishErrorReason };
      e.reason = "processing_failed";
      throw e;
    }
    if (Date.now() >= deadline) {
      const e = new Error("timeout esperando FINISHED") as Error & { reason: PublishErrorReason };
      e.reason = "processing_timeout";
      throw e;
    }
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
  }
}

async function publishContainer(
  igUserId: string,
  token: string,
  creationId: string,
): Promise<string> {
  const url = `${GRAPH}/${igUserId}/media_publish`;
  const params = new URLSearchParams({ creation_id: creationId });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await readGraphError(res);
    const e = new Error(`publish failed: ${err.message}`) as Error & {
      reason: PublishErrorReason;
      metaCode?: number;
    };
    e.reason = classifyGraphError(err.code, err.message);
    e.metaCode = err.code;
    throw e;
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("publish: respuesta sin id");
  return data.id;
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

/**
 * Publica un post o Reel en la cuenta de Instagram de Marta.
 *
 * Comportamiento:
 *  - Si `MARTA_PUBLISH_ENABLED` no es "true", devuelve `{ skipped: true, ... }`
 *    sin tocar la red. Esto es lo esperado mientras la App Review de
 *    `instagram_content_publish` esté pendiente.
 *  - Si está activada y falta config crítica (token o page id), devuelve
 *    `{ skipped: true, reason: "missing_env", ... }`.
 *  - Si todo va bien, devuelve `{ ok: true, igMediaId, creationId }`.
 *  - Cualquier fallo de Meta se devuelve como `{ ok: false, reason, detail, metaCode? }`
 *    — NO lanza excepciones hacia arriba.
 */
export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  if (!isEnabled()) {
    console.log(
      "[marta/publish] desactivado — pendiente App Review (instagram_content_publish). " +
        "Pon MARTA_PUBLISH_ENABLED=true para activar.",
      { mediaType: input.mediaType, mediaUrl: input.mediaUrl.slice(0, 80) },
    );
    return {
      skipped: true,
      reason: "flag_disabled",
      detail: "MARTA_PUBLISH_ENABLED != 'true'",
    };
  }

  const token = getToken();
  if (!token) {
    console.error("[marta/publish] falta token (INSTAGRAM_ACCESS_TOKEN o WHATSAPP_ACCESS_TOKEN)");
    return { skipped: true, reason: "missing_env", detail: "missing access token" };
  }

  let igUserId: string;
  try {
    igUserId = await resolveIgUserId(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[marta/publish] no se pudo resolver IG user id:", msg);
    return { ok: false, reason: "ig_user_lookup_failed", detail: msg };
  }

  // Paso 1 — crear container
  let creationId: string;
  try {
    creationId = await createMediaContainer(igUserId, token, input);
    console.log("[marta/publish] container creado", { creationId, mediaType: input.mediaType });
  } catch (err) {
    return errorToResult(err, "fallo creando media container");
  }

  // Paso 1.5 — esperar a FINISHED si es vídeo/Reel/StoryVideo.
  const needsPolling =
    input.mediaType === "VIDEO" ||
    input.mediaType === "REELS" ||
    input.mediaType === "STORIES_VIDEO";
  if (needsPolling) {
    try {
      await waitForContainerReady(creationId, token);
    } catch (err) {
      return errorToResult(err, "container no llegó a FINISHED");
    }
  }

  // Paso 2 — publicar
  try {
    const igMediaId = await publishContainer(igUserId, token, creationId);
    console.log("[marta/publish] publicado OK", { igMediaId, creationId });
    return { ok: true, igMediaId, creationId };
  } catch (err) {
    return errorToResult(err, "fallo publicando container");
  }
}

function errorToResult(err: unknown, context: string): PublishResult {
  const e = err as Error & { reason?: PublishErrorReason; metaCode?: number };
  const reason: PublishErrorReason = e.reason || "unknown";
  const detail = e.message || String(err);
  const human = humanReadable(reason, detail);
  console.error(`[marta/publish] ${context}: ${human}`, { reason, metaCode: e.metaCode });
  return { ok: false, reason, detail: human, metaCode: e.metaCode };
}

function humanReadable(reason: PublishErrorReason, detail: string): string {
  switch (reason) {
    case "token_invalid_or_expired":
      return `Token de Instagram inválido o caducado. Regenera INSTAGRAM_ACCESS_TOKEN en Business Manager. Detalle: ${detail}`;
    case "permission_missing":
      return `Falta permiso 'instagram_content_publish' (probablemente App Review aún pendiente). Detalle: ${detail}`;
    case "invalid_media":
      return `Media inválido (URL inaccesible, formato no soportado o caption fuera de límites). Detalle: ${detail}`;
    case "processing_failed":
      return `Meta no pudo procesar el media (formato, duración o codec no válidos). Detalle: ${detail}`;
    case "processing_timeout":
      return `Timeout esperando a que Meta procesara el vídeo/Reel. Reintenta más tarde. Detalle: ${detail}`;
    case "ig_user_lookup_failed":
      return `No se pudo resolver el IG user id desde la Page. Detalle: ${detail}`;
    case "network_error":
      return `Error de red llamando a Graph API. Detalle: ${detail}`;
    default:
      return `Error desconocido publicando en Instagram. Detalle: ${detail}`;
  }
}

/** Exporta el estado del flag para usos de diagnóstico/UI. */
export function isPublishEnabled(): boolean {
  return isEnabled();
}
