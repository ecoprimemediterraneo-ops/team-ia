// =============================================================================
// Motor de diagnóstico / AUDITORÍA con IA.
//
// Recibe el formulario de /diagnostico (web + Instagram + ciudad + nombre en
// Google + 8 respuestas + tipo + email) y produce una AUDITORÍA real:
//   1. Lee la WEB a fondo (señales verificadas: https, SEO, contacto claro,
//      legal/RGPD, píxeles, redes enlazadas…). NO mide velocidad técnica de la
//      web: AI-Team no rehace webs, así que no señala lo que no resuelve.
//   2. Mira el INSTAGRAM público (best-effort honesto).
//   3. Reseñas de Google: REAL si Places está activo; si no, "no verificable".
//   4. Cruza todo con las 8 respuestas.
//   5. Evalúa 5 FRENTES, cada uno con SEMÁFORO + sub-CHECKS (verificado / api /
//      autoreportado / no_verificable) + titular + PROBLEMA+SOLUCIÓN.
//   6. Estima el dinero perdido al mes (con topes de credibilidad). [INTACTO]
//   7. Bloque de HONESTIDAD: qué auditamos desde fuera ✓ vs qué necesita que
//      conectes tus cuentas 🔒 (gancho de venta + datos para la Colmena).
//   8. Guarda el LEAD (Supabase KV; fallback local).
//
// MARCO DE 3 NIVELES y REGLA DE ORO: lo que no se lee con certeza NO se inventa
// → se marca "no_verificable". Voz "el sistema": nunca nombres de agente.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import { anthropic, MODELS } from "./claude";
import { kvSet, kvListByPrefix, supabaseEnabled } from "./supabase";
import {
  fetchWebSignals,
  fetchIgSignals,
  fetchGooglePlaces,
  type WebSignals,
  type IgSignals,
  type GoogleSignals,
  type Verificabilidad,
  type SocialNet,
} from "./diagnostico-fetchers";

export type { WebSignals, IgSignals, GoogleSignals, Verificabilidad };

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type Sector = "dental" | "estetica" | "abogados" | "inmobiliaria" | "restaurante" | "generico";
export type Semaforo = "rojo" | "ambar" | "verde";
export type FrenteKey = "velocidad" | "web" | "instagram" | "resenas" | "captacion";

export type Respuestas = {
  q1_volumen: string;
  q2_tiempo: string;
  q3_fuera_horario: string;
  q4_ticket: string;
  q5_herramientas: string;
  q5_conectadas: string;
  q6_resenas: string;
  q7_origen: string;
  q8_seguimiento: string;
};

export type DiagnosticoInput = {
  nombre: string;
  tipo: string;
  web?: string;
  instagram?: string;
  ciudad?: string;        // para localizar la ficha de Google (Places)
  googleNombre?: string;  // nombre exacto en Google si difiere del comercial
  email: string;
  respuestas: Respuestas;
};

// Un sub-check concreto de la auditoría.
export type EstadoCheck = "ok" | "flojo" | "falta" | "no_verificable";
export type Check = {
  etiqueta: string;
  estado: EstadoCheck;
  fuente: Verificabilidad;
  detalle?: string;
};

export type FrenteResultado = {
  frente: FrenteKey;
  titulo: string;
  semaforo: Semaforo;
  titular: string;
  problema: string;
  solucion: string;
  checks: Check[];        // el detalle que "parece auditoría de 499€"
};

export type DineroPerdido = {
  totalMesEUR: number;
  totalAnioEUR: number;
  desglose: { concepto: string; eur: number }[];
  explicacion: string;
  supuestos: { leadsMes: number; ticketEUR: number };
};

// Bloque de honestidad / gancho: qué se auditó desde fuera vs qué necesita acceso.
export type Honestidad = {
  auditado: string[];   // leído desde fuera (verificado/api)
  conectar: string[];   // requiere conectar cuentas (no_verificable)
};

export type DiagnosticoResult = {
  sector: Sector;
  resumenTitular: string;
  frentes: FrenteResultado[]; // 6
  dinero: DineroPerdido;
  honestidad: Honestidad;
  generadoConIA: boolean;
};

export type InformeEmailInfo = {
  intentado: boolean;
  enviado: boolean;
  modo: "resend" | "log_local" | "error";
  to?: string;
  subject?: string;
  id?: string;
  error?: string;
  at: string;
};

// Versión del esquema del registro. Súbela cuando cambie la forma de `colmena`,
// para que el día de mañana la Colmena sepa con qué shape entrenar cada lead.
export const SCHEMA_VERSION = 2;

// SNAPSHOT para la COLMENA NEURONAL (futuro). Es una foto PLANA, ESTABLE y
// DOCUMENTADA de las features de cada auditoría: entrada + señales crudas
// (web/píxeles/redes/Google/Instagram) + etiquetas de salida
// (semáforos, €/mes). No se construye la Colmena ahora; esto solo deja los
// datos listos y ordenados para entrenarla mañana. Los campos `undefined`
// significan "no verificable" (no se inventan).
export type ColmenaSnapshot = {
  schemaVersion: number;
  capturadoEn: string;          // ISO
  sector: Sector;
  ciudad?: string;
  // ── entrada ──
  tieneWeb: boolean;
  tieneInstagram: boolean;
  respuestas: Respuestas;
  // ── señales WEB (verificadas; undefined = no verificable) ──
  web: {
    presente: boolean;
    ok?: boolean;
    https?: boolean;
    jsShell?: boolean;          // true = web JS/cascarón → señales con baja confianza
    seoTitle: boolean;
    seoDescription: boolean;
    mobileViewport?: boolean;
    hasWhatsapp?: boolean;
    whatsappNumber?: string;
    hasTel?: boolean;
    hasForm?: boolean;
    ctaHits?: number;
    noindex?: boolean;
    hasRobotsTxt?: boolean;
    hasSitemap?: boolean;
    cookieBanner?: boolean;
    legalLinks: string[];
    pixeles: { meta: boolean; googleAds: boolean; analytics: boolean; tagManager: boolean; tiktok: boolean };
    newsletter?: boolean;
    redes: Partial<Record<SocialNet, boolean>>;
  };
  // ── Google Places (api; apagado hasta activar clave) ──
  google: { enabled: boolean; ok?: boolean; rating?: number; reviews?: number };
  // ── Instagram (best-effort) ──
  instagram: { presente: boolean; accesible?: boolean; followers?: string; posts?: string };
  // ── salida / etiquetas ──
  dinero: { totalMesEUR: number; totalAnioEUR: number; ticketEUR: number; leadsMes: number };
  semaforos: Record<FrenteKey, Semaforo>;
  checksResumen: { ok: number; flojo: number; falta: number; no_verificable: number };
};

export type DiagnosticoRecord = DiagnosticoInput & {
  schemaVersion: number;
  id: string;
  createdAt: string;
  sector: Sector;
  // Señales crudas (cada una completa, para no perder nada):
  webSignals: WebSignals;
  igSignals: IgSignals;
  googleSignals: GoogleSignals;
  // Resultado de la auditoría (frentes + checks + dinero + honestidad):
  resultado: DiagnosticoResult;
  // Foto ordenada de features para la Colmena Neuronal (2x1: auditoría + datos):
  colmena: ColmenaSnapshot;
  informeEmail?: InformeEmailInfo;
};

// -----------------------------------------------------------------------------
// Perfiles de sector
// -----------------------------------------------------------------------------

type SectorProfile = {
  label: string;
  ticketDefault: number;
  cliente: string;
  canal: string;
  perdidaTipica: string;
  ejemploResena: string;
};

const SECTOR_PROFILES: Record<Sector, SectorProfile> = {
  dental: {
    label: "clínica dental",
    ticketDefault: 120,
    cliente: "un paciente con dolor",
    canal: "un WhatsApp a las 23h un sábado",
    perdidaTipica: "no-shows y presupuestos de implante u ortodoncia que no se cierran",
    ejemploResena: "las reseñas de Google son lo primero que mira un paciente nuevo antes de pedir cita",
  },
  estetica: {
    label: "clínica de estética",
    // Clínica de estética / medicina estética (láser, tratamientos, bonos): el
    // ticket medio por cliente ronda varios cientos de €, no es un centro barato.
    ticketDefault: 500,
    cliente: "una clienta que pregunta por un tratamiento",
    canal: "un DM de Instagram a media tarde",
    perdidaTipica: "bonos y sesiones que no se reservan por no contestar a tiempo",
    ejemploResena: "en estética la clienta compara perfiles y reseñas antes de reservar",
  },
  abogados: {
    label: "despacho de abogados",
    ticketDefault: 900,
    cliente: "alguien con un problema legal urgente",
    canal: "una llamada fuera de horario",
    perdidaTipica: "casos que se van al despacho que SÍ contesta primero",
    ejemploResena: "un cliente con un problema serio elige al despacho con mejor reputación online",
  },
  inmobiliaria: {
    label: "inmobiliaria",
    ticketDefault: 3000,
    cliente: "un interesado en una vivienda",
    canal: "un formulario de un portal a medianoche",
    perdidaTipica: "visitas y operaciones perdidas por no responder en el primer minuto",
    ejemploResena: "quien va a comprar o vender mira la reputación de la agencia antes de fiarse",
  },
  restaurante: {
    label: "restaurante",
    ticketDefault: 40,
    cliente: "una mesa para esta noche",
    canal: "una reserva por Instagram",
    perdidaTipica: "reservas perdidas y reseñas sin responder",
    ejemploResena: "la gente elige dónde cenar por las reseñas y las fotos",
  },
  generico: {
    label: "negocio",
    ticketDefault: 100,
    cliente: "un cliente nuevo",
    canal: "un mensaje fuera de horario",
    perdidaTipica: "contactos que no se atienden a tiempo y no se les hace seguimiento",
    ejemploResena: "las reseñas de Google son decisivas para que te elijan a ti",
  },
};

export function normalizarSector(tipo: string): Sector {
  const t = (tipo || "").toLowerCase();
  if (t.includes("dental")) return "dental";
  if (t.includes("estétic") || t.includes("estetic") || t.includes("belleza")) return "estetica";
  if (t.includes("abogad") || t.includes("despacho") || t.includes("legal")) return "abogados";
  if (t.includes("inmobil")) return "inmobiliaria";
  if (t.includes("restaur")) return "restaurante";
  return "generico";
}

// =============================================================================
// DINERO PERDIDO  — [INTACTO: no se toca el cálculo ni los topes]
// =============================================================================

const VOL_MES: Record<string, number> = { "Menos de 20": 12, "20–50": 35, "50–100": 75, "Más de 100": 130 };
const RESP_FRAC: Record<string, number> = { "Al instante": 0.02, "Menos de 1 hora": 0.08, "Unas horas": 0.2, "Al día siguiente o más": 0.35 };
const FUERA_FRAC: Record<string, number> = { "Sí, siempre": 0, "A veces": 0.05, "No": 0.1 };
const SEGUI_FRAC: Record<string, number> = { "Sí, siempre": 0.03, "A veces": 0.12, "No, nunca": 0.25 };
const RESENAS_FALTA: Record<string, number> = { "Ninguna": 3, "1–5": 1.5, "5–15": 0.5, "Más de 15": 0 };
const CLOSE_RATE = 0.3;

const CAP: Record<Sector, { maxOps: number; maxEur: number }> = {
  dental:       { maxOps: 25, maxEur: 6000 },
  estetica:     { maxOps: 15, maxEur: 7000 },
  abogados:     { maxOps: 6,  maxEur: 9000 },
  inmobiliaria: { maxOps: 2,  maxEur: 7000 },
  restaurante:  { maxOps: 45, maxEur: 4500 },
  generico:     { maxOps: 18, maxEur: 6000 },
};

const SECTOR_UNIDAD: Record<Sector, string> = {
  dental: "clientes",
  estetica: "clientes",
  abogados: "casos",
  inmobiliaria: "operaciones",
  restaurante: "reservas",
  generico: "clientes",
};

function num(v: string): number {
  const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function estimarDinero(r: Respuestas, sector: Sector): DineroPerdido {
  const prof = SECTOR_PROFILES[sector];
  const leadsMes = VOL_MES[r.q1_volumen] ?? 30;
  const ticketEUR = num(r.q4_ticket) || prof.ticketDefault;

  const fracResp = Math.min(0.5, (RESP_FRAC[r.q2_tiempo] ?? 0.15) + (FUERA_FRAC[r.q3_fuera_horario] ?? 0.05));

  let perdidaRespuesta = leadsMes * fracResp * CLOSE_RATE * ticketEUR;
  let perdidaSeguimiento = leadsMes * (SEGUI_FRAC[r.q8_seguimiento] ?? 0.12) * CLOSE_RATE * ticketEUR;
  let perdidaCaptacion = (RESENAS_FALTA[r.q6_resenas] ?? 1) * CLOSE_RATE * ticketEUR;

  const cap = CAP[sector];
  let capAplicado = false;

  const opsBrutas = (perdidaRespuesta + perdidaSeguimiento + perdidaCaptacion) / ticketEUR;
  if (opsBrutas > cap.maxOps) {
    const f = cap.maxOps / opsBrutas;
    perdidaRespuesta *= f;
    perdidaSeguimiento *= f;
    perdidaCaptacion *= f;
    capAplicado = true;
  }

  let bruto = perdidaRespuesta + perdidaSeguimiento + perdidaCaptacion;
  if (bruto > cap.maxEur) {
    const k = cap.maxEur / bruto;
    perdidaRespuesta *= k;
    perdidaSeguimiento *= k;
    perdidaCaptacion *= k;
    bruto = cap.maxEur;
    capAplicado = true;
  }

  const pResp = Math.round(perdidaRespuesta);
  const pSegui = Math.round(perdidaSeguimiento);
  const pCapt = Math.round(perdidaCaptacion);
  const totalMesEUR = pResp + pSegui + pCapt;

  const desglose = [
    { concepto: "Contactos que se enfrían por respuesta lenta o fuera de horario", eur: pResp },
    { concepto: "Interesados que preguntan y no compran por falta de seguimiento", eur: pSegui },
    { concepto: "Clientes que no llegan por poca visibilidad/reseñas en Google", eur: pCapt },
  ];

  const unidad = SECTOR_UNIDAD[sector];
  const opsFinal = Math.max(1, Math.round(totalMesEUR / ticketEUR));
  const explicacion =
    `Estimación conservadora sobre tus propios números: ~${leadsMes} contactos nuevos al mes y un ticket medio de ${ticketEUR}€. ` +
    `Asumimos que solo ~${Math.round(CLOSE_RATE * 100)}% de los contactos que hoy se pierden habrían acabado comprando, ` +
    `lo que equivale a perder ~${opsFinal} ${unidad} al mes.` +
    (capAplicado
      ? ` Lo ajustamos a un máximo realista para tu sector (un negocio pequeño no pierde decenas de ${unidad} al mes), para que la cifra sea creíble y no inflada.`
      : "") +
    ` No es una promesa, es lo que típicamente se escapa en ${prof.label === "negocio" ? "un negocio así" : "una " + prof.label}: ${prof.perdidaTipica}.`;

  return {
    totalMesEUR,
    totalAnioEUR: totalMesEUR * 12,
    desglose,
    explicacion,
    supuestos: { leadsMes, ticketEUR },
  };
}

// =============================================================================
// CHECKS por frente — el corazón de la auditoría reforzada.
// Cada check lleva su FUENTE (de dónde sale el dato) para no mentir nunca.
// =============================================================================

const FRENTE_TITULO: Record<FrenteKey, string> = {
  velocidad: "Velocidad de respuesta",
  web: "Tu web",
  instagram: "Tu Instagram",
  resenas: "Reseñas de Google",
  captacion: "Captación",
};

const ORDEN_FRENTES: FrenteKey[] = ["velocidad", "web", "instagram", "resenas", "captacion"];

const C = (etiqueta: string, estado: EstadoCheck, fuente: Verificabilidad, detalle?: string): Check => ({
  etiqueta, estado, fuente, detalle,
});

// ¿La web es legible de verdad? (no caída, no cascarón JS) → si no, las señales
// de la web pasan a "no_verificable" en vez de afirmar falsos negativos.
function webLeible(web: WebSignals): boolean {
  return !!(web.provided && web.ok && !web.error && !web.jsShell);
}

function checksVelocidad(r: Respuestas, web: WebSignals): Check[] {
  const checks: Check[] = [];
  // Autoreportado
  const tEstado: EstadoCheck =
    r.q2_tiempo === "Al instante" || r.q2_tiempo === "Menos de 1 hora" ? "ok" :
    r.q2_tiempo === "Unas horas" ? "flojo" : "falta";
  checks.push(C("Tiempo de respuesta", tEstado, "autoreportado", r.q2_tiempo || "(no dado)"));
  const fEstado: EstadoCheck = r.q3_fuera_horario === "Sí, siempre" ? "ok" : r.q3_fuera_horario === "A veces" ? "flojo" : "falta";
  checks.push(C("Atención fuera de horario y findes", fEstado, "autoreportado", r.q3_fuera_horario || "(no dado)"));
  // Verificado en web
  if (webLeible(web)) {
    checks.push(C("WhatsApp visible en la web", web.hasWhatsapp ? "ok" : "falta", "verificado",
      web.whatsappNumber ? `número ${web.whatsappNumber}` : web.hasWhatsapp ? "detectado" : "no detectado"));
    checks.push(C("Teléfono pulsable en la web", web.hasTel ? "ok" : "falta", "verificado"));
  } else if (web.provided) {
    checks.push(C("WhatsApp/teléfono en la web", "no_verificable", "no_verificable", "no se pudo leer la web con fiabilidad"));
  }
  // No verificable desde fuera
  checks.push(C("WhatsApp Business (catálogo, respuestas automáticas)", "no_verificable", "no_verificable", "requiere conectar tu WhatsApp"));
  return checks;
}

function checksWeb(web: WebSignals, sector: Sector): Check[] {
  const checks: Check[] = [];
  if (!web.provided) {
    checks.push(C("Web propia", "falta", "verificado", "no facilitaste web"));
    return checks;
  }
  if (web.error || web.ok === false) {
    checks.push(C("La web carga", "falta", "verificado", `no respondió (${web.error || web.status})`));
    return checks;
  }
  checks.push(C("La web carga", "ok", "verificado", `HTTP ${web.status}`));
  checks.push(C("Conexión segura (HTTPS)", web.https ? "ok" : "falta", "verificado"));

  // NOTA: no medimos velocidad técnica ni "móvil real" de la web (no rehacemos
  // webs). El frente de velocidad va de la VELOCIDAD DE RESPUESTA al cliente.

  if (webLeible(web)) {
    checks.push(C("SEO básico (título y descripción)", web.title && web.description ? "ok" : web.title ? "flojo" : "falta", "verificado"));
    checks.push(C("Indexable por Google", web.noindex ? "falta" : "ok", "verificado", web.noindex ? "tiene noindex" : (web.hasSitemap ? "con sitemap" : "")));
    checks.push(C("Contacto claro (formulario / teléfono / WhatsApp)", (web.hasForm || web.hasTel || web.hasWhatsapp) ? "ok" : "falta", "verificado"));
    checks.push(C("Llamada a la acción visible", (web.ctaHits ?? 0) >= 1 ? "ok" : "flojo", "verificado", `${web.ctaHits ?? 0} CTA detectadas`));
    // Legal/RGPD — crítico en clínicas y abogados
    const legalCritico = sector === "dental" || sector === "estetica" || sector === "abogados";
    const tieneLegal = (web.legalLinks?.length ?? 0) > 0;
    checks.push(C("Aviso legal y privacidad (RGPD)", tieneLegal ? "ok" : (legalCritico ? "falta" : "flojo"), "verificado",
      tieneLegal ? web.legalLinks!.join(", ") : "no detectados"));
    checks.push(C("Aviso de cookies", web.cookieBanner ? "ok" : "flojo", "verificado"));
  } else {
    checks.push(C("SEO, contacto y RGPD", "no_verificable", "no_verificable", "la web parece cargar por JavaScript; no se puede leer con fiabilidad"));
  }
  return checks;
}

function checksInstagram(input: DiagnosticoInput, ig: IgSignals): Check[] {
  const checks: Check[] = [];
  if (!input.instagram) {
    checks.push(C("Perfil de Instagram", "falta", "autoreportado", "no facilitaste Instagram"));
    return checks;
  }
  checks.push(C("Perfil indicado", "ok", "autoreportado", `@${ig.handle || ""}`));
  if (ig.accessible && ig.followers) {
    checks.push(C("Perfil público accesible", "ok", "verificado", `~${ig.followers} seguidores`));
    const posts = ig.posts ? parseInt(ig.posts.replace(/[^\d]/g, ""), 10) : NaN;
    if (!Number.isNaN(posts))
      checks.push(C("Actividad (nº de publicaciones)", posts >= 30 ? "ok" : posts >= 12 ? "flojo" : "falta", "verificado", `${ig.posts} publicaciones`));
  } else {
    checks.push(C("Perfil público accesible", "no_verificable", "no_verificable", "Instagram bloquea la lectura desde servidor o el perfil es poco activo"));
  }
  // Lo profundo NO es verificable desde fuera → conéctalo
  checks.push(C("Frecuencia y último post", "no_verificable", "no_verificable", "requiere conectar tu Instagram"));
  checks.push(C("Bio, enlace, cuenta de empresa y botón de acción", "no_verificable", "no_verificable", "requiere conectar tu Instagram"));
  checks.push(C("Mensajes/comentarios atendidos", "no_verificable", "no_verificable", "requiere conectar tu Instagram"));
  return checks;
}

function checksResenas(r: Respuestas, google: GoogleSignals): Check[] {
  const checks: Check[] = [];
  const pideEstado: EstadoCheck =
    r.q6_resenas === "Más de 15" ? "ok" : r.q6_resenas === "5–15" ? "flojo" : r.q6_resenas === "1–5" ? "flojo" : "falta";
  checks.push(C("Pides reseñas activamente", pideEstado, "autoreportado", r.q6_resenas || "(no dado)"));

  if (google.enabled && google.ok && typeof google.rating === "number") {
    checks.push(C("Nota media en Google", google.rating >= 4.3 ? "ok" : google.rating >= 3.8 ? "flojo" : "falta", "api", `${google.rating}★`));
    checks.push(C("Nº de reseñas en Google", (google.reviews ?? 0) >= 30 ? "ok" : (google.reviews ?? 0) >= 10 ? "flojo" : "falta", "api", `${google.reviews ?? 0} reseñas`));
  } else {
    checks.push(C("Nota media y nº de reseñas en Google", "no_verificable", "no_verificable",
      google.enabled ? "no se encontró tu ficha de Google" : "requiere conectar Google o activar la verificación de reseñas"));
  }
  checks.push(C("Respondes a las reseñas y con qué frecuencia", "no_verificable", "no_verificable", "requiere conectar tu Google Business Profile"));
  checks.push(C("Ficha de Google / Maps completa", "no_verificable", "no_verificable", "requiere conectar tu Google Business Profile"));
  return checks;
}

function checksCaptacion(r: Respuestas, web: WebSignals): Check[] {
  const checks: Check[] = [];
  if (webLeible(web)) {
    const pixel = web.metaPixel || web.googleAds || web.tiktokPixel;
    checks.push(C("Mide/hace publicidad (píxel de Meta/Google)", pixel ? "ok" : "flojo", "verificado",
      pixel ? [web.metaPixel && "Meta", web.googleAds && "Google Ads", web.tiktokPixel && "TikTok"].filter(Boolean).join(", ") : "no detectamos píxel de seguimiento"));
    checks.push(C("Analítica web instalada", (web.googleAnalytics || web.tagManager) ? "ok" : "flojo", "verificado"));
    checks.push(C("Captación de emails / newsletter", web.newsletter ? "ok" : "falta", "verificado", web.newsletter ? "detectada" : "no detectada"));
  } else if (web.provided) {
    checks.push(C("Píxeles, analítica y newsletter en la web", "no_verificable", "no_verificable", "no se pudo leer la web con fiabilidad"));
  } else {
    checks.push(C("Captación desde web", "falta", "verificado", "no hay web que capte contactos"));
  }
  // Autoreportado
  checks.push(C("Seguimiento a los que preguntan y no compran", r.q8_seguimiento === "Sí, siempre" ? "ok" : r.q8_seguimiento === "A veces" ? "flojo" : "falta", "autoreportado", r.q8_seguimiento || "(no dado)"));
  checks.push(C("Herramientas conectadas entre sí", r.q5_conectadas === "Sí" ? "ok" : r.q5_conectadas === "A medias" ? "flojo" : "falta", "autoreportado", r.q5_conectadas || "(no dado)"));
  return checks;
}

function construirChecks(
  input: DiagnosticoInput, web: WebSignals, ig: IgSignals, google: GoogleSignals, sector: Sector,
): Record<FrenteKey, Check[]> {
  return {
    velocidad: checksVelocidad(input.respuestas, web),
    web: checksWeb(web, sector),
    instagram: checksInstagram(input, ig),
    resenas: checksResenas(input.respuestas, google),
    captacion: checksCaptacion(input.respuestas, web),
  };
}

// Semáforo del frente a partir de sus checks (los no_verificable no cuentan
// para el color, pero sí se muestran).
function semaforoFromChecks(checks: Check[]): Semaforo {
  const juzgables = checks.filter((c) => c.estado !== "no_verificable");
  if (!juzgables.length) return "ambar";
  const peso = juzgables.reduce((acc, c) => acc + (c.estado === "falta" ? 1 : c.estado === "flojo" ? 0.5 : 0), 0);
  const ratio = peso / juzgables.length;
  if (ratio >= 0.6) return "rojo";
  if (ratio >= 0.25) return "ambar";
  return "verde";
}

// Bloque de honestidad: auditado ✓ vs conéctalo 🔒
function construirHonestidad(checksByFrente: Record<FrenteKey, Check[]>): Honestidad {
  const auditado = new Set<string>();
  const conectar = new Set<string>();
  for (const checks of Object.values(checksByFrente)) {
    for (const c of checks) {
      if (c.estado === "no_verificable") conectar.add(c.etiqueta);
      else if (c.fuente === "verificado" || c.fuente === "api") auditado.add(c.etiqueta);
    }
  }
  return { auditado: [...auditado].slice(0, 14), conectar: [...conectar].slice(0, 10) };
}

// Construye el snapshot ordenado para la Colmena a partir de todas las señales.
function construirColmena(
  input: DiagnosticoInput, sector: Sector, web: WebSignals, ig: IgSignals, google: GoogleSignals,
  sem: Record<FrenteKey, Semaforo>, dinero: DineroPerdido, checksByFrente: Record<FrenteKey, Check[]>, capturadoEn: string,
): ColmenaSnapshot {
  const social = web.social || {};
  const redes: Partial<Record<SocialNet, boolean>> = {};
  (["facebook", "instagram", "tiktok", "linkedin", "youtube", "twitter"] as SocialNet[]).forEach((n) => {
    redes[n] = n === "instagram" ? !!(social.instagram || input.instagram) : !!social[n];
  });

  const resumen = { ok: 0, flojo: 0, falta: 0, no_verificable: 0 };
  for (const checks of Object.values(checksByFrente)) {
    for (const c of checks) resumen[c.estado] += 1;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    capturadoEn,
    sector,
    ciudad: input.ciudad || undefined,
    tieneWeb: !!input.web,
    tieneInstagram: !!input.instagram,
    respuestas: input.respuestas,
    web: {
      presente: web.provided,
      ok: web.ok,
      https: web.https,
      jsShell: web.jsShell,
      seoTitle: !!web.title,
      seoDescription: !!web.description,
      mobileViewport: web.mobileViewport,
      hasWhatsapp: web.hasWhatsapp,
      whatsappNumber: web.whatsappNumber,
      hasTel: web.hasTel,
      hasForm: web.hasForm,
      ctaHits: web.ctaHits,
      noindex: web.noindex,
      hasRobotsTxt: web.hasRobotsTxt,
      hasSitemap: web.hasSitemap,
      cookieBanner: web.cookieBanner,
      legalLinks: web.legalLinks || [],
      pixeles: {
        meta: !!web.metaPixel,
        googleAds: !!web.googleAds,
        analytics: !!web.googleAnalytics,
        tagManager: !!web.tagManager,
        tiktok: !!web.tiktokPixel,
      },
      newsletter: web.newsletter,
      redes,
    },
    google: { enabled: google.enabled, ok: google.ok, rating: google.rating, reviews: google.reviews },
    instagram: { presente: ig.provided, accesible: ig.accessible, followers: ig.followers, posts: ig.posts },
    dinero: {
      totalMesEUR: dinero.totalMesEUR,
      totalAnioEUR: dinero.totalAnioEUR,
      ticketEUR: dinero.supuestos.ticketEUR,
      leadsMes: dinero.supuestos.leadsMes,
    },
    semaforos: sem,
    checksResumen: resumen,
  };
}

// =============================================================================
// IA — redacta titular + PROBLEMA/SOLUCIÓN por frente, coherente con los checks
// =============================================================================

function resumenSenales(web: WebSignals, ig: IgSignals, google: GoogleSignals): string {
  const lineas: string[] = [];
  lineas.push(
    !web.provided ? "WEB: no facilitó web." :
    web.error || web.ok === false ? `WEB: no cargó (${web.error || web.status}).` :
    `WEB: ${web.https ? "https" : "SIN https"}; ${web.hasWhatsapp ? "con" : "sin"} WhatsApp; ${web.hasForm ? "con" : "sin"} formulario; ${(web.legalLinks?.length ?? 0) > 0 ? "con" : "SIN"} aviso legal/RGPD; ${web.jsShell ? "(parece SPA, baja confianza)" : ""}. NO evalúes la velocidad técnica de la web.`,
  );
  lineas.push(
    !ig.provided ? "INSTAGRAM: no facilitó." :
    ig.accessible ? `INSTAGRAM: @${ig.handle}${ig.followers ? `, ~${ig.followers} seg.` : ""}${ig.posts ? `, ${ig.posts} posts` : ""}. (bio/frecuencia/empresa NO verificables sin conectar)` :
    `INSTAGRAM: @${ig.handle} no verificable desde fuera (IG bloquea).`,
  );
  lineas.push(
    google.enabled && google.ok ? `GOOGLE: ${google.rating ?? "?"}★, ${google.reviews ?? "?"} reseñas (real).` :
    "GOOGLE/RESEÑAS: no verificable desde fuera (Places apagado) → requiere conectar Google.",
  );
  return lineas.join("\n");
}

function resumenChecks(checksByFrente: Record<FrenteKey, Check[]>): string {
  return ORDEN_FRENTES.map((k) => {
    const items = checksByFrente[k]
      .map((c) => `  [${c.estado}] ${c.etiqueta}${c.detalle ? ` (${c.detalle})` : ""}`)
      .join("\n");
    return `${k}:\n${items}`;
  }).join("\n");
}

function promptIA(
  input: DiagnosticoInput, sector: Sector, web: WebSignals, ig: IgSignals, google: GoogleSignals,
  sem: Record<FrenteKey, Semaforo>, dinero: DineroPerdido, checksByFrente: Record<FrenteKey, Check[]>,
): string {
  const prof = SECTOR_PROFILES[sector];
  const r = input.respuestas;
  return `Eres el motor de AUDITORÍA digital de AI-Team. Auditas un ${prof.label} llamado "${input.nombre}" y redactas un informe claro, honesto y vendedor, SIN exagerar y SIN inventar.

VOZ OBLIGATORIA: habla siempre de "el sistema". NUNCA nombres de persona ni de agente. Tutea. Español de España. Frases cortas y directas.

SECTOR: ${prof.label}. Personaliza (cliente típico: ${prof.cliente}; canal: ${prof.canal}; lo que se pierde: ${prof.perdidaTipica}).

SEÑALES REALES CAPTADAS:
${resumenSenales(web, ig, google)}

CHECKS YA EVALUADOS por frente (respeta su estado; "no_verificable" = no se puede leer desde fuera, NO lo des por hecho — preséntalo como "para auditarlo a fondo, conecta tu cuenta"):
${resumenChecks(checksByFrente)}

RESPUESTAS DEL DUEÑO: contactos/mes ${r.q1_volumen}; responde en ${r.q2_tiempo}; fuera de horario ${r.q3_fuera_horario}; ticket ${r.q4_ticket || "(no dado)"}€; herramientas ${r.q5_herramientas || "(no)"} (conectadas: ${r.q5_conectadas || "?"}); reseñas/mes ${r.q6_resenas}; origen ${r.q7_origen}; seguimiento ${r.q8_seguimiento}.

DINERO ESTIMADO (NO lo cambies): ${dinero.totalMesEUR}€/mes.

SEMÁFORO FIJO por frente (respétalo): velocidad ${sem.velocidad}; web ${sem.web}; instagram ${sem.instagram}; resenas ${sem.resenas}; captacion ${sem.captacion}.

TAREA: devuelve SOLO un JSON válido (sin texto fuera, sin markdown):
{
  "resumenTitular": "frase de impacto (máx 90 car.) que resuma su situación",
  "frentes": [
    { "frente": "velocidad", "titular": "máx 60 car.", "problema": "1-2 frases concretas para su sector, coherentes con los checks", "solucion": "1-2 frases: qué hace EL SISTEMA por él" },
    { "frente": "web", "titular": "...", "problema": "...", "solucion": "..." },
    { "frente": "instagram", "titular": "...", "problema": "...", "solucion": "..." },
    { "frente": "resenas", "titular": "...", "problema": "...", "solucion": "..." },
    { "frente": "captacion", "titular": "...", "problema": "...", "solucion": "..." }
  ]
}

REGLAS:
- Coherente con el semáforo y los checks de cada frente. Si algo es "no_verificable", NO afirmes que está mal: di que para auditarlo a fondo hay que conectar la cuenta.
- Ejemplo problema→solución: "No contestas fuera de horario" → "El sistema responde 24/7, también noches y findes".
- Nada de "garantizado", "100%", "el mejor". Honesto.
- Los 5 frentes en este orden EXACTO: velocidad, web, instagram, resenas, captacion.`;
}

function parseJsonLoose(text: string): unknown | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function analizarConIA(
  input: DiagnosticoInput, sector: Sector, web: WebSignals, ig: IgSignals, google: GoogleSignals,
  sem: Record<FrenteKey, Semaforo>, dinero: DineroPerdido, checksByFrente: Record<FrenteKey, Check[]>,
): Promise<DiagnosticoResult> {
  const honestidad = construirHonestidad(checksByFrente);
  const base: DiagnosticoResult = { sector, resumenTitular: "", frentes: [], dinero, honestidad, generadoConIA: false };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...base, ...fallbackTextos(input, sector, sem, dinero, checksByFrente) };
  }

  try {
    const ai = await anthropic.messages.create({
      model: MODELS.fast, // Haiku: relación calidad/precio óptima para esta tarea guiada
      max_tokens: 1500,
      messages: [{ role: "user", content: promptIA(input, sector, web, ig, google, sem, dinero, checksByFrente) }],
    });
    const text = ai.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    const parsed = parseJsonLoose(text) as
      | { resumenTitular?: string; frentes?: { frente?: string; titular?: string; problema?: string; solucion?: string }[] }
      | null;

    if (!parsed || !Array.isArray(parsed.frentes)) {
      return { ...base, ...fallbackTextos(input, sector, sem, dinero, checksByFrente) };
    }

    const frentes: FrenteResultado[] = ORDEN_FRENTES.map((key) => {
      const f = parsed.frentes!.find((x) => x.frente === key);
      const fb = fallbackFrente(key, input, sector, sem[key]);
      return {
        frente: key,
        titulo: FRENTE_TITULO[key],
        semaforo: sem[key],
        titular: (f?.titular || fb.titular).slice(0, 90),
        problema: f?.problema || fb.problema,
        solucion: f?.solucion || fb.solucion,
        checks: checksByFrente[key],
      };
    });

    return {
      sector,
      resumenTitular: parsed.resumenTitular?.slice(0, 120) || fallbackResumen(input, dinero),
      frentes,
      dinero,
      honestidad,
      generadoConIA: true,
    };
  } catch (err) {
    console.error("[diagnostico] IA falló, usando fallback:", err);
    return { ...base, ...fallbackTextos(input, sector, sem, dinero, checksByFrente) };
  }
}

// -----------------------------------------------------------------------------
// Fallback determinista (sin IA / si el JSON falla)
// -----------------------------------------------------------------------------

function fallbackResumen(input: DiagnosticoInput, dinero: DineroPerdido): string {
  return `${input.nombre || "Tu negocio"} está dejando ~${dinero.totalMesEUR}€/mes sobre la mesa. Se puede recuperar.`;
}

function fallbackFrente(
  key: FrenteKey, input: DiagnosticoInput, sector: Sector, sem: Semaforo,
): { titular: string; problema: string; solucion: string } {
  const prof = SECTOR_PROFILES[sector];
  const r = input.respuestas;
  switch (key) {
    case "velocidad":
      return {
        titular: sem === "verde" ? "Respondes rápido, buen punto de partida" : "Estás tardando demasiado en contestar",
        problema: sem === "verde"
          ? "Contestas bien, pero mantener ese ritmo a mano se cae cuando sube el volumen o llega fuera de horario."
          : `Cuando ${prof.cliente} escribe por ${prof.canal}, no recibe respuesta al momento y se va a otro sitio.`,
        solucion: "El sistema responde al instante 24/7, también noches y fines de semana, y agenda o deriva sin que toques nada.",
      };
    case "web":
      return {
        titular: !input.web ? "No tienes web visible" : sem === "verde" ? "Tu web cumple, se puede exprimir más" : "Tu web no convierte visitas en clientes",
        problema: !input.web
          ? "Hoy quien te busca y no encuentra una web clara desconfía y elige a otro."
          : "Recibe visitas pero no las empuja a contactar (contacto poco claro, lenta en móvil o sin avisos legales).",
        solucion: "El sistema convierte cada visita en conversación: capta el contacto, resuelve dudas y lleva a reservar.",
      };
    case "instagram":
      return {
        titular: !input.instagram ? "Instagram sin aprovechar" : "Tu Instagram no trabaja para ti",
        problema: !input.instagram
          ? `${prof.cliente.charAt(0).toUpperCase() + prof.cliente.slice(1)} te busca en Instagram antes de decidir, y no te encuentra activo.`
          : "Publicas, pero los DMs y comentarios no se convierten en clientes porque nadie los atiende a tiempo.",
        solucion: "El sistema contesta DMs y comentarios al momento, hace seguimiento y convierte seguidores en citas.",
      };
    case "resenas":
      return {
        titular: r.q6_resenas === "Ninguna" ? "No estás pidiendo reseñas" : sem === "verde" ? "Buen ritmo de reseñas" : "Pides pocas reseñas",
        problema: r.q6_resenas === "Ninguna"
          ? `No pides reseñas y ${prof.ejemploResena}.`
          : "Pides algunas, pero no de forma sistemática, así que tu reputación crece despacio frente a la competencia.",
        solucion: "El sistema pide la reseña en el momento justo tras cada cliente y responde a todas, subiendo tu posición en Google.",
      };
    case "captacion":
      return {
        titular: sem === "rojo" ? "Dependes demasiado del boca a boca" : "Captación mejorable",
        problema: r.q8_seguimiento === "No, nunca"
          ? "Los interesados que preguntan y no compran se pierden: no hay seguimiento y no vuelves a saber de ellos."
          : "La captación funciona a ratos, pero las herramientas sueltas hacen que se caigan contactos por el camino.",
        solucion: "El sistema centraliza todos los contactos, hace seguimiento automático a los que no compran y los recupera.",
      };
  }
}

function fallbackTextos(
  input: DiagnosticoInput, sector: Sector, sem: Record<FrenteKey, Semaforo>, dinero: DineroPerdido,
  checksByFrente: Record<FrenteKey, Check[]>,
): Pick<DiagnosticoResult, "resumenTitular" | "frentes" | "generadoConIA"> {
  return {
    resumenTitular: fallbackResumen(input, dinero),
    generadoConIA: false,
    frentes: ORDEN_FRENTES.map((key) => {
      const fb = fallbackFrente(key, input, sector, sem[key]);
      return { frente: key, titulo: FRENTE_TITULO[key], semaforo: sem[key], ...fb, checks: checksByFrente[key] };
    }),
  };
}

// =============================================================================
// Persistencia del LEAD  — [INTACTA]
// =============================================================================

const KV_PREFIX = "diag:";
const DATA_DIR = path.join(process.cwd(), "data");
const LOCAL_FILE = path.join(DATA_DIR, "diagnosticos.json");

async function guardarLocal(record: DiagnosticoRecord): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let list: DiagnosticoRecord[] = [];
  try {
    list = JSON.parse(await fs.readFile(LOCAL_FILE, "utf-8"));
  } catch {
    list = [];
  }
  list.push(record);
  await fs.writeFile(LOCAL_FILE, JSON.stringify(list, null, 2));
}

async function guardarDiagnostico(record: DiagnosticoRecord): Promise<"supabase" | "local"> {
  if (supabaseEnabled()) {
    await kvSet(KV_PREFIX + record.id, record);
    return "supabase";
  }
  await guardarLocal(record);
  return "local";
}

export async function listarDiagnosticos(): Promise<DiagnosticoRecord[]> {
  if (supabaseEnabled()) {
    const rows = await kvListByPrefix<DiagnosticoRecord>(KV_PREFIX);
    return rows
      .map((r) => r.value)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  try {
    const list: DiagnosticoRecord[] = JSON.parse(await fs.readFile(LOCAL_FILE, "utf-8"));
    return list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } catch {
    return [];
  }
}

export async function registrarEnvioInforme(id: string, info: InformeEmailInfo): Promise<void> {
  try {
    if (supabaseEnabled()) {
      const rec = await kvGetRecord(id);
      if (rec) {
        rec.informeEmail = info;
        await kvSet(KV_PREFIX + id, rec);
      }
      return;
    }
    let list: DiagnosticoRecord[] = [];
    try {
      list = JSON.parse(await fs.readFile(LOCAL_FILE, "utf-8"));
    } catch {
      list = [];
    }
    const idx = list.findIndex((d) => d.id === id);
    if (idx >= 0) {
      list[idx].informeEmail = info;
      await fs.writeFile(LOCAL_FILE, JSON.stringify(list, null, 2));
    }
  } catch (err) {
    console.error("[diagnostico] no se pudo registrar el envío del informe (no crítico):", err);
  }
}

async function kvGetRecord(id: string): Promise<DiagnosticoRecord | null> {
  const { kvGet } = await import("./supabase");
  return kvGet<DiagnosticoRecord>(KV_PREFIX + id);
}

async function registrarLeadPipeline(record: DiagnosticoRecord): Promise<void> {
  try {
    const { createLead } = await import("./pipeline");
    await createLead({
      businessName: record.nombre || record.email,
      email: record.email,
      sector: record.sector,
      subsector: record.tipo,
      city: record.ciudad,
      website: record.web,
      instagram: record.instagram,
      stage: "new",
      source: "diagnostico-web",
      ownerEmail: process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com",
      notes: `Diagnóstico: pierde ~${record.resultado.dinero.totalMesEUR}€/mes. ${record.resultado.resumenTitular}`,
      tags: ["diagnostico", record.sector],
    });
  } catch (err) {
    console.error("[diagnostico] no se pudo registrar en pipeline (no crítico):", err);
  }
}

// =============================================================================
// Orquestador público
// =============================================================================

function nuevoId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rnd}`;
}

export async function ejecutarDiagnostico(
  input: DiagnosticoInput,
): Promise<{ record: DiagnosticoRecord; almacenado: "supabase" | "local" }> {
  const sector = normalizarSector(input.tipo);
  const googleQueryNombre = (input.googleNombre || input.nombre || "").trim();

  // 1. Lectura de señales en paralelo (web + IG + Google Places). NO se mide la
  // velocidad técnica de la web (no rehacemos webs).
  const [webSignals, igSignals, googleSignals] = await Promise.all([
    fetchWebSignals(input.web),
    fetchIgSignals(input.instagram),
    fetchGooglePlaces(googleQueryNombre, input.ciudad),
  ]);

  // 2. Dinero perdido (determinista, INTACTO).
  const dinero = estimarDinero(input.respuestas, sector);

  // 3. Checks por frente → semáforos.
  const checksByFrente = construirChecks(input, webSignals, igSignals, googleSignals, sector);
  const sem = Object.fromEntries(
    ORDEN_FRENTES.map((k) => [k, semaforoFromChecks(checksByFrente[k])]),
  ) as Record<FrenteKey, Semaforo>;

  // 4. Narrativa IA (con fallback) + honestidad.
  const resultado = await analizarConIA(input, sector, webSignals, igSignals, googleSignals, sem, dinero, checksByFrente);

  // 4b. Snapshot ordenado de features para la Colmena (2x1: auditoría + datos).
  const createdAt = new Date().toISOString();
  const colmena = construirColmena(input, sector, webSignals, igSignals, googleSignals, sem, dinero, checksByFrente, createdAt);

  const record: DiagnosticoRecord = {
    ...input,
    schemaVersion: SCHEMA_VERSION,
    id: nuevoId(),
    createdAt,
    sector,
    webSignals,
    igSignals,
    googleSignals,
    resultado,
    colmena,
  };

  // 5. Guardar lead (captación + Colmena: guardamos TODAS las señales crudas).
  const almacenado = await guardarDiagnostico(record);
  await registrarLeadPipeline(record);

  return { record, almacenado };
}
