// Google Business Profile (GBP) — capa de Rocío para leer y responder reseñas.
//
// =============================================================================
// CREDENCIALES Y CONFIGURACIÓN
// =============================================================================
// La conexión sigue el mismo patrón OAuth que Lucía con Gmail (refresh-token):
//
// Env vars (locales en .env.local · producción en Vercel):
//
//   GOOGLE_CLIENT_ID          ← ya existe (compartido con Lucía)
//   GOOGLE_CLIENT_SECRET      ← ya existe (compartido con Lucía)
//   ROCIO_USE_MOCK            ← "true" para forzar datos de prueba aunque el
//                               usuario esté "conectado". Útil mientras Google
//                               no aprueba el acceso a GBP API.
//   ROCIO_AUTO_REPLY          ← "true" → reseñas 5★ sin texto se publican
//                               directo sin pedir aprobación por WhatsApp.
//                               Las demás siempre pasan por aprobación.
//
// =============================================================================
// IMPORTANTE — APROBACIÓN DE GOOGLE PENDIENTE
// =============================================================================
// La Google Business Profile API es de acceso restringido. Hay que solicitarlo
// en https://developers.google.com/my-business/content/prereqs y esperar a
// que Google apruebe (suele tardar días/semanas).
//
// MIENTRAS NO HAYA ACCESO REAL: el código está completo y se ejecuta contra
// datos de prueba (mock). Cuando llegue la aprobación, basta con desactivar
// `ROCIO_USE_MOCK` y la lógica real toma el control automáticamente. NO se
// requieren cambios de código.
//
// =============================================================================
// AÑADIR EL SCOPE EN GOOGLE CLOUD CONSOLE (cuando se apruebe)
// =============================================================================
// 1. https://console.cloud.google.com → APIs & Services → Library →
//    "Google My Business API" + "Business Profile Performance API" → Enable.
// 2. OAuth consent screen → Scopes → añadir
//    https://www.googleapis.com/auth/business.manage
// 3. Si la app no está aprobada por Google, añadir el email del usuario como
//    Test User para que el OAuth funcione en pruebas.
//
// =============================================================================

import { google } from "googleapis";
import { getGbpTokens } from "./store";

// Scopes que pedimos. `business.manage` cubre lectura de reseñas + respuesta.
export const GBP_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
];

const MOCK = (process.env.ROCIO_USE_MOCK || "").toLowerCase() === "true";

export function makeOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
}

export function getRedirectUri(host: string, proto: string) {
  return `${proto}://${host}/api/rocio/callback`;
}

export type GbpLocation = {
  name: string;          // accounts/{ACCOUNT}/locations/{LOC}
  title: string;
  storeCode?: string;
  websiteUri?: string;
};

export type GbpReview = {
  name: string;          // accounts/{A}/locations/{L}/reviews/{R}
  reviewId: string;
  reviewer: { displayName: string; profilePhotoUrl?: string };
  starRating: 1 | 2 | 3 | 4 | 5;
  comment: string;       // "" si no hay texto
  createTime: string;    // ISO
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
};

// -----------------------------------------------------------------------------
// MOCK — datos de prueba mientras no haya acceso real a GBP API.
// -----------------------------------------------------------------------------
const MOCK_LOCATION: GbpLocation = {
  name: "accounts/MOCK_ACCOUNT_123/locations/MOCK_LOC_456",
  title: "Negocio de prueba (mock)",
  storeCode: "DEMO",
};

const MOCK_REVIEWS: GbpReview[] = [
  {
    name: "accounts/MOCK_ACCOUNT_123/locations/MOCK_LOC_456/reviews/rv_005",
    reviewId: "rv_005",
    reviewer: { displayName: "María G." },
    starRating: 5,
    comment: "Atención excelente, los recomiendo 100%. Volveré seguro.",
    createTime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updateTime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    name: "accounts/MOCK_ACCOUNT_123/locations/MOCK_LOC_456/reviews/rv_004",
    reviewId: "rv_004",
    reviewer: { displayName: "Pedro R." },
    starRating: 1,
    comment: "Llegué a la hora y tuve que esperar 30 minutos. Mal servicio.",
    createTime: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updateTime: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    name: "accounts/MOCK_ACCOUNT_123/locations/MOCK_LOC_456/reviews/rv_003",
    reviewId: "rv_003",
    reviewer: { displayName: "Laura S." },
    starRating: 5,
    comment: "", // 5★ sin texto → candidato para auto-reply si ROCIO_AUTO_REPLY=true
    createTime: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    updateTime: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    name: "accounts/MOCK_ACCOUNT_123/locations/MOCK_LOC_456/reviews/rv_002",
    reviewId: "rv_002",
    reviewer: { displayName: "Carlos M." },
    starRating: 3,
    comment: "Está bien pero el precio me pareció alto.",
    createTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updateTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    name: "accounts/MOCK_ACCOUNT_123/locations/MOCK_LOC_456/reviews/rv_001",
    reviewId: "rv_001",
    reviewer: { displayName: "Ana T." },
    starRating: 4,
    comment: "Buen trato, repetiré.",
    createTime: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    updateTime: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    reviewReply: {
      comment: "¡Gracias Ana! Nos alegra leerte. Te esperamos pronto.",
      updateTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  },
];

export function isMockMode(): boolean {
  return MOCK;
}

// -----------------------------------------------------------------------------
// API REAL
// -----------------------------------------------------------------------------

export async function getAuthedGbp(userEmail: string, redirectUri: string) {
  const tokens = await getGbpTokens(userEmail);
  if (!tokens) return null;
  const oauth2 = makeOAuthClient(redirectUri);
  oauth2.setCredentials({ refresh_token: tokens.refreshToken });
  return { oauth2, tokens };
}

/**
 * Lista las ubicaciones del usuario conectado. En modo MOCK devuelve un único
 * negocio de prueba para que la UI funcione.
 */
export async function listLocations(userEmail: string, redirectUri: string): Promise<GbpLocation[]> {
  if (MOCK || !(await getGbpTokens(userEmail))) return [MOCK_LOCATION];

  const authed = await getAuthedGbp(userEmail, redirectUri);
  if (!authed) return [];
  const { oauth2 } = authed;
  const accessToken = (await oauth2.getAccessToken()).token;
  if (!accessToken) throw new Error("Sin access_token de GBP");

  // 1) cuentas
  const acctRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!acctRes.ok) throw new Error(`GBP accounts ${acctRes.status}: ${await acctRes.text().catch(() => "")}`);
  const acctJson = (await acctRes.json()) as { accounts?: Array<{ name: string }> };
  const accounts = acctJson.accounts ?? [];

  const out: GbpLocation[] = [];
  for (const a of accounts) {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,storeCode,websiteUri`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!locRes.ok) continue;
    const locJson = (await locRes.json()) as { locations?: GbpLocation[] };
    for (const l of locJson.locations ?? []) out.push(l);
  }
  return out;
}

/**
 * Lista las reseñas de una ubicación. En modo MOCK devuelve el set de prueba.
 */
export async function listReviews(
  userEmail: string,
  redirectUri: string,
  locationName: string,
): Promise<GbpReview[]> {
  if (MOCK || !(await getGbpTokens(userEmail))) return MOCK_REVIEWS;

  const authed = await getAuthedGbp(userEmail, redirectUri);
  if (!authed) return [];
  const accessToken = (await authed.oauth2.getAccessToken()).token;
  if (!accessToken) throw new Error("Sin access_token de GBP");

  const r = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!r.ok) throw new Error(`GBP reviews ${r.status}: ${await r.text().catch(() => "")}`);
  const j = (await r.json()) as { reviews?: Array<Record<string, unknown>> };
  return (j.reviews ?? []).map(normalizeReview);
}

function normalizeReview(raw: Record<string, unknown>): GbpReview {
  const star = String(raw.starRating || "").toUpperCase();
  const starMap: Record<string, GbpReview["starRating"]> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
  };
  return {
    name: String(raw.name || ""),
    reviewId: String(raw.reviewId || raw.name || ""),
    reviewer: raw.reviewer as GbpReview["reviewer"],
    starRating: starMap[star] || 5,
    comment: String(raw.comment || ""),
    createTime: String(raw.createTime || new Date().toISOString()),
    updateTime: String(raw.updateTime || new Date().toISOString()),
    reviewReply: raw.reviewReply as GbpReview["reviewReply"] | undefined,
  };
}

/**
 * Publica respuesta a una reseña. En modo MOCK solo loguea y devuelve ok.
 */
export async function replyToReview(
  userEmail: string,
  redirectUri: string,
  reviewName: string,
  comment: string,
): Promise<{ ok: true } | { ok: false; reason: string; detail: string }> {
  if (MOCK || !(await getGbpTokens(userEmail))) {
    console.log(`[rocio] MOCK reply ${reviewName}: ${comment.slice(0, 120)}…`);
    return { ok: true };
  }

  const authed = await getAuthedGbp(userEmail, redirectUri);
  if (!authed) return { ok: false, reason: "no_tokens", detail: "Sin tokens GBP." };
  const accessToken = (await authed.oauth2.getAccessToken()).token;
  if (!accessToken) return { ok: false, reason: "no_access_token", detail: "Sin access_token." };

  const r = await fetch(
    `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    },
  );
  if (!r.ok) {
    return { ok: false, reason: `http_${r.status}`, detail: await r.text().catch(() => "") };
  }
  return { ok: true };
}
