// =============================================================================
// Diagnóstico — capa de SEÑALES (lo que se puede leer de verdad desde fuera).
//
// MARCO DE HONESTIDAD (3 niveles):
//   verificado     → leído con un fetch del servidor (web pública, HTML).
//   api            → leído con una API fiable (Google Places, si se activa con
//                    clave). Fiable incluso desde IP de servidor.
//   no_verificable → bloqueado / requiere que el dueño conecte su cuenta
//                    (Instagram a fondo, reseñas sin Places, WhatsApp Business…).
//
// REGLA: lo que no se lee con certeza NO se inventa. Se marca no_verificable.
// Aviso real: un fetch solo ve el HTML inicial; en webs JS/SPA puede haber
// falsos negativos → marcamos `jsShell` para bajar confianza, no afirmar.
// =============================================================================

export type Verificabilidad = "verificado" | "api" | "autoreportado" | "no_verificable";

export type SocialNet = "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube" | "twitter";

export type WebSignals = {
  provided: boolean;
  ok?: boolean;
  status?: number;
  finalUrl?: string;
  https?: boolean;
  title?: string;
  description?: string;
  lang?: string;
  // contacto / conversión
  hasWhatsapp?: boolean;
  whatsappNumber?: string;
  hasTel?: boolean;
  hasEmail?: boolean;
  hasForm?: boolean;
  mobileViewport?: boolean; // declara viewport (dato crudo; no se evalúa al cliente)
  ctaHits?: number;
  // SEO / indexación
  noindex?: boolean;
  hasRobotsTxt?: boolean;
  hasSitemap?: boolean;
  // legal / cookies (RGPD)
  cookieBanner?: boolean;
  legalLinks?: string[];
  // captación / publicidad / analítica (píxeles)
  metaPixel?: boolean;
  googleAnalytics?: boolean;
  googleAds?: boolean;
  tagManager?: boolean;
  tiktokPixel?: boolean;
  newsletter?: boolean;
  // redes enlazadas desde la web
  social?: Partial<Record<SocialNet, string>>;
  // calidad de la lectura
  jsShell?: boolean; // poco texto renderizado → SPA/cascarón → baja confianza
  textLength?: number;
  bytes?: number;
  error?: string;
};

export type IgSignals = {
  provided: boolean;
  handle?: string;
  url?: string;
  accessible?: boolean;
  followers?: string;
  posts?: string;
  status?: number;
  error?: string;
};

export type GoogleSignals = {
  enabled: boolean; // ¿Places activado? (clave presente). PREPARADO PERO APAGADO.
  intentado: boolean;
  ok?: boolean;
  rating?: number;
  reviews?: number;
  placeId?: string;
  name?: string;
  mapsUrl?: string;
  error?: string;
};

const UA = "Mozilla/5.0 (compatible; AI-Team-Diagnostico/1.0; +https://aiteam.marketing)";

export async function fetchConTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": UA } });
  } finally {
    clearTimeout(t);
  }
}

function normalizarUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

// -----------------------------------------------------------------------------
// WEB — fetch del HTML + robots/sitemap. Todo "verificado" (con la salvedad de
// jsShell para webs JS donde puede haber falsos negativos).
// -----------------------------------------------------------------------------

export async function fetchWebSignals(rawUrl?: string): Promise<WebSignals> {
  if (!rawUrl || !rawUrl.trim()) return { provided: false };
  const url = normalizarUrl(rawUrl);
  try {
    const res = await fetchConTimeout(url, 9000);
    const finalUrl = res.url || url;
    const https = finalUrl.startsWith("https://");
    const html = (await res.text()).slice(0, 400_000);
    const lower = html.toLowerCase();

    const textLength = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim().length;
    const jsShell = textLength < 600;

    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim().slice(0, 160);
    const description = (
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] || ""
    ).trim().slice(0, 300);
    const lang = (html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || "").slice(0, 8) || undefined;

    const waMatch = lower.match(/wa\.me\/(\+?\d[\d\s-]{6,})|api\.whatsapp\.com\/send\?phone=(\+?\d+)/);
    const hasWhatsapp = /wa\.me|api\.whatsapp|whatsapp/.test(lower);
    const whatsappNumber = ((waMatch?.[1] || waMatch?.[2] || "").replace(/[\s-]/g, "") || undefined);
    const hasTel = /href=["']tel:/.test(lower);
    const hasEmail = /href=["']mailto:/.test(lower);
    const hasForm = /<form/.test(lower);
    const mobileViewport = /name=["']viewport["']/.test(lower);
    const ctaHits = (lower.match(/reserva|pide cita|pedir cita|agenda|contacta|presupuesto|llámanos|llamanos|cita previa|book/g) || []).length;

    const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);

    const legalLinks: string[] = [];
    if (/privacidad|privacy/.test(lower)) legalLinks.push("privacidad");
    if (/aviso legal|aviso-legal|legal-notice|t[ée]rminos/.test(lower)) legalLinks.push("aviso legal");
    if (/pol[ií]tica de cookies|cookie-policy|política de cookies/.test(lower)) legalLinks.push("cookies");
    const cookieBanner = /cookie/.test(lower) && /(acept|consent|rgpd|gdpr|cookiebot|cookieconsent|onetrust|tarteaucitron)/.test(lower);

    const metaPixel = /connect\.facebook\.net\/[^"']*fbevents|fbq\s*\(/.test(lower);
    const googleAnalytics = /google-analytics\.com\/analytics|googletagmanager\.com\/gtag|gtag\s*\(/.test(lower);
    const tagManager = /googletagmanager\.com\/gtm/.test(lower);
    const googleAds = /googleadservices|google_conversion|gtag\/js\?id=aw-|aw-\d/.test(lower);
    const tiktokPixel = /analytics\.tiktok\.com|ttq\.load/.test(lower);
    const newsletter = /mailchimp|list-manage\.com|mailerlite|sendinblue|brevo|substack|klaviyo|newsletter|suscr[ií]bete a/.test(lower);

    const grab = (re: RegExp): string | undefined => {
      const m = lower.match(re);
      return m ? m[0] : undefined;
    };
    const social: Partial<Record<SocialNet, string>> = {};
    const fb = grab(/facebook\.com\/[a-z0-9_.\-/]+/);
    const ig = grab(/instagram\.com\/[a-z0-9_.\-/]+/);
    const tk = grab(/tiktok\.com\/@[a-z0-9_.\-]+/);
    const li = grab(/linkedin\.com\/(?:company|in)\/[a-z0-9_.\-/]+/);
    const yt = grab(/youtube\.com\/[a-z0-9_.\-@/]+/);
    const tw = grab(/(?:twitter|x)\.com\/[a-z0-9_]+/);
    if (fb) social.facebook = fb;
    if (ig) social.instagram = ig;
    if (tk) social.tiktok = tk;
    if (li) social.linkedin = li;
    if (yt) social.youtube = yt;
    if (tw) social.twitter = tw;

    // robots.txt / sitemap.xml (best-effort, no rompe si fallan)
    let hasRobotsTxt: boolean | undefined;
    let hasSitemap: boolean | undefined;
    try {
      const origin = new URL(finalUrl).origin;
      const rb = await fetchConTimeout(origin + "/robots.txt", 4000);
      hasRobotsTxt = rb.ok;
      const sm = await fetchConTimeout(origin + "/sitemap.xml", 4000);
      hasSitemap = sm.ok;
    } catch {
      /* ignore */
    }

    return {
      provided: true, ok: res.ok, status: res.status, finalUrl, https, title, description, lang,
      hasWhatsapp, whatsappNumber, hasTel, hasEmail, hasForm, mobileViewport, ctaHits, noindex,
      hasRobotsTxt, hasSitemap, cookieBanner, legalLinks,
      metaPixel, googleAnalytics, googleAds, tagManager, tiktokPixel, newsletter,
      social, jsShell, textLength, bytes: html.length,
    };
  } catch (e) {
    return { provided: true, ok: false, error: e instanceof Error ? e.message : "fetch_error" };
  }
}

// -----------------------------------------------------------------------------
// INSTAGRAM — best-effort honesto. Solo sacamos "existe + (a veces) seguidores/
// posts". Bio, frecuencia, último post, cuenta de empresa, botón de acción NO
// son verificables desde fuera → eso es "conéctalo".
// -----------------------------------------------------------------------------

export async function fetchIgSignals(handle?: string): Promise<IgSignals> {
  if (!handle || !handle.trim()) return { provided: false };
  const user = handle
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?].*$/, "");
  if (!user) return { provided: false };
  const url = `https://www.instagram.com/${user}/`;
  try {
    const res = await fetchConTimeout(url, 8000);
    const html = (await res.text()).slice(0, 250_000);
    const desc =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
      "";
    const followers = desc.match(/([\d.,]+\s?[KMkm]?)\s*Followers/)?.[1]?.trim();
    const posts = desc.match(/([\d.,]+)\s*Posts/)?.[1]?.trim();
    const accessible = res.ok && (!!followers || !!desc);
    return { provided: true, handle: user, url, accessible, followers, posts, status: res.status };
  } catch (e) {
    return { provided: true, handle: user, url, accessible: false, error: e instanceof Error ? e.message : "fetch_error" };
  }
}

// -----------------------------------------------------------------------------
// GOOGLE PLACES — reseñas REALES (nota media + nº). PREPARADO PERO APAGADO:
// solo se activa si GOOGLE_PLACES_API_KEY está definida. Sin clave → enabled:false
// y las reseñas quedan "no verificable / conéctalo". (Requiere billing en prod.)
// -----------------------------------------------------------------------------

export async function fetchGooglePlaces(nombre?: string, ciudad?: string): Promise<GoogleSignals> {
  const key = process.env.GOOGLE_PLACES_API_KEY || "";
  if (!key) return { enabled: false, intentado: false };
  const query = [nombre, ciudad].filter(Boolean).join(" ").trim();
  if (!query) return { enabled: true, intentado: false };
  try {
    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${key}`;
    const fr = await fetchConTimeout(findUrl, 8000);
    const fj = (await fr.json()) as { candidates?: { place_id?: string; name?: string }[] };
    const cand = fj.candidates?.[0];
    if (!cand?.place_id) return { enabled: true, intentado: true, ok: false, error: "place_not_found" };
    const detUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${cand.place_id}&fields=name,rating,user_ratings_total,url&key=${key}`;
    const dr = await fetchConTimeout(detUrl, 8000);
    const dj = (await dr.json()) as {
      result?: { name?: string; rating?: number; user_ratings_total?: number; url?: string };
    };
    const r = dj.result || {};
    return {
      enabled: true, intentado: true, ok: true, placeId: cand.place_id,
      name: r.name, rating: r.rating, reviews: r.user_ratings_total, mapsUrl: r.url,
    };
  } catch (e) {
    return { enabled: true, intentado: true, ok: false, error: e instanceof Error ? e.message : "places_error" };
  }
}
