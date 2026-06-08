// Agenda central — Google Calendar (read/write).
//
// Reutiliza el OAuth existente de Lucía (gmail.ts: GMAIL_SCOPES con
// calendar.events). Cualquier agente (Pablo, Carmen, Eva, Lucía, etc.)
// puede llamar a `agendarCita()` para crear una cita en el calendario del
// fundador y dejar registro en el event-log del tenant.
//
// Ámbito actual: single-tenant durante la beta. El parámetro `userEmail`
// es el email del usuario AI-Team conectado a Google (el fundador en este
// momento). En multi-tenant futuro: resolver userEmail por tenantId.

import "server-only";
import { google } from "googleapis";
import { makeOAuthClient } from "./gmail";
import { getGmailTokens } from "./store";
import { logEvent, makeEventId, type EventChannel } from "./event-log";
import { DEFAULT_TENANT_ID } from "./tenants";

const PRIMARY = "primary";

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------

export type FreeBusySlot = { start: string; end: string };

export type FreeBusyResult =
  | { ok: true; busy: FreeBusySlot[]; timezone?: string }
  | { ok: false; reason: "no_tokens" | "api_error"; detail: string };

export type CreateEventInput = {
  summary: string;
  description?: string;
  start: string;          // ISO con TZ (ej. "2026-06-15T10:00:00+02:00") o "YYYY-MM-DDTHH:mm:ss"
  end: string;            // mismo formato que start
  attendees?: string[];   // emails de invitados
  location?: string;
  timezone?: string;      // default "Europe/Madrid"
};

export type CreateEventResult =
  | {
      ok: true;
      eventId: string;
      htmlLink?: string;
      hangoutLink?: string;
      iCalUID?: string;
    }
  | { ok: false; reason: "no_tokens" | "api_error" | "invalid_input"; detail: string };

export type AgendarCitaInput = {
  tenantId?: string;                 // default: tenant_aiteam (single-tenant beta)
  userEmail: string;                 // email del usuario AI-Team con tokens
  nombre: string;                    // nombre del cliente final que reserva
  motivo: string;                    // motivo de la cita
  start: string;                     // ISO
  end?: string;                      // ISO; si falta, suma 30 min al start
  agenteOrigen: EventChannel;        // pablo | carmen | eva | lucia | rocio | marta | dashboard…
  attendees?: string[];              // emails extra
  location?: string;
  redirectUri?: string;              // override para tests; default infiere de env
  customerPhone?: string;            // opcional, para incluir en la descripción
  durationMin?: number;              // si end no se pasa, este es el largo (default 30)
};

export type AgendarCitaResult =
  | { ok: true; eventId: string; htmlLink?: string; eventLogId: string }
  | { ok: false; reason: string; detail: string };

// -----------------------------------------------------------------------------
// Helpers internos
// -----------------------------------------------------------------------------

async function getAuthedCalendarClient(userEmail: string, redirectUri: string) {
  const tokens = await getGmailTokens(userEmail);
  if (!tokens?.refreshToken) return null;
  const oauth2 = makeOAuthClient(redirectUri);
  // Solo el refresh_token: NUNCA un access_token cacheado. La librería pide un
  // access_token fresco a Google en la primera llamada, con los scopes que
  // realmente concede el refresh_token guardado.
  oauth2.setCredentials({ refresh_token: tokens.refreshToken });
  // Forzamos YA un access_token nuevo. Si el refresh_token es de solo-Gmail
  // (sin calendar.events) el token resultante tampoco lo tendrá → la llamada
  // de calendar fallará con "insufficient scopes": señal de reconectar.
  try {
    await oauth2.getAccessToken();
  } catch {
    // si el refresh falla dejamos que la llamada de calendar dé el error real.
  }
  return google.calendar({ version: "v3", auth: oauth2 });
}

// Diagnóstico fiable: refresca el access_token y pregunta a Google qué scopes
// concede REALMENTE el refresh_token guardado (no la cadena `scope` que
// guardamos nosotros, que puede quedar desincronizada). Única fuente de verdad
// sobre si la agenda funcionará de verdad.
export async function getLiveGrantedScopes(
  userEmail: string,
  redirectUri: string,
): Promise<
  | { ok: true; scopes: string[]; hasCalendar: boolean }
  | { ok: false; reason: string }
> {
  const tokens = await getGmailTokens(userEmail);
  if (!tokens?.refreshToken) return { ok: false, reason: "no_tokens" };
  const oauth2 = makeOAuthClient(redirectUri);
  oauth2.setCredentials({ refresh_token: tokens.refreshToken });
  try {
    const at = await oauth2.getAccessToken();
    const accessToken = typeof at === "string" ? at : at?.token;
    if (!accessToken) return { ok: false, reason: "no_access_token" };
    const info = await oauth2.getTokenInfo(accessToken);
    const scopes = info.scopes ?? [];
    const hasCalendar = scopes.some(
      (s) => s.includes("calendar.events") || s.endsWith("/auth/calendar"),
    );
    return { ok: true, scopes, hasCalendar };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function defaultRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://aiteam.marketing";
  return `${base.replace(/\/$/, "")}/api/lucia/callback`;
}

function ensureIsoWithDefaultTz(value: string, timezone: string): string {
  // Si no lleva offset/Z, asumimos que está en `timezone` y devolvemos sin Z;
  // Google acepta el formato "2026-06-15T10:00:00" con timeZone explícito.
  return value;
}

// -----------------------------------------------------------------------------
// Free/Busy — disponibilidad
// -----------------------------------------------------------------------------

/**
 * Consulta los huecos OCUPADOS del calendario "primary" del usuario entre
 * `from` y `to` (ISO). Para derivar huecos LIBRES, basta con restar a la
 * franja completa.
 */
export async function freeBusyQuery(
  userEmail: string,
  redirectUri: string,
  from: string,
  to: string,
): Promise<FreeBusyResult> {
  const cal = await getAuthedCalendarClient(userEmail, redirectUri);
  if (!cal) return { ok: false, reason: "no_tokens", detail: "Sin tokens para este usuario." };
  try {
    // IMPORTANTE: NO usamos freebusy.query. El scope `calendar.events` (el que
    // pedimos para poder CREAR citas) NO autoriza freebusy.query — eso requiere
    // `calendar.readonly`/`calendar`, y por eso daba 500 "insufficient scopes"
    // aunque el token fuera correcto. En su lugar listamos los eventos del rango
    // con events.list (SÍ permitido por calendar.events) y derivamos los huecos
    // ocupados. Mismo resultado, sin pedir más permisos.
    const r = await cal.events.list({
      calendarId: PRIMARY,
      timeMin: from,
      timeMax: to,
      singleEvents: true,        // expande eventos recurrentes a instancias
      orderBy: "startTime",
      maxResults: 250,
    });
    const busy = (r.data.items ?? [])
      // ignora eventos marcados como "libre" (transparency: transparent) y
      // cancelados
      .filter((ev) => ev.status !== "cancelled" && ev.transparency !== "transparent")
      .map((ev) => ({
        // eventos con hora → dateTime; eventos de día completo → date
        start: ev.start?.dateTime || ev.start?.date || "",
        end: ev.end?.dateTime || ev.end?.date || "",
      }))
      .filter((b) => b.start && b.end);
    return { ok: true, busy };
  } catch (err) {
    return {
      ok: false,
      reason: "api_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// -----------------------------------------------------------------------------
// Crear evento
// -----------------------------------------------------------------------------

export async function createEvent(
  userEmail: string,
  redirectUri: string,
  input: CreateEventInput,
): Promise<CreateEventResult> {
  if (!input.summary?.trim()) {
    return { ok: false, reason: "invalid_input", detail: "Falta summary." };
  }
  if (!input.start || !input.end) {
    return { ok: false, reason: "invalid_input", detail: "Faltan start/end." };
  }
  const cal = await getAuthedCalendarClient(userEmail, redirectUri);
  if (!cal) return { ok: false, reason: "no_tokens", detail: "Sin tokens para este usuario." };

  const tz = input.timezone || "Europe/Madrid";
  try {
    const r = await cal.events.insert({
      calendarId: PRIMARY,
      sendUpdates: input.attendees && input.attendees.length > 0 ? "all" : "none",
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: ensureIsoWithDefaultTz(input.start, tz), timeZone: tz },
        end: { dateTime: ensureIsoWithDefaultTz(input.end, tz), timeZone: tz },
        attendees: (input.attendees ?? []).map((email) => ({ email })),
      },
    });
    return {
      ok: true,
      eventId: r.data.id || "",
      htmlLink: r.data.htmlLink ?? undefined,
      hangoutLink: r.data.hangoutLink ?? undefined,
      iCalUID: r.data.iCalUID ?? undefined,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "api_error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// -----------------------------------------------------------------------------
// Función reutilizable: agendarCita()
// -----------------------------------------------------------------------------

/**
 * Crea una cita en el calendario del fundador y deja el evento registrado en
 * el event-log del tenant (type: "appointment_set", meta con nombre/motivo/
 * agente/eventId). Pensada para que la llamen Pablo, Carmen, Eva, Lucía,
 * Marta, etc., con la misma firma.
 *
 * Devuelve {ok:true, eventId, eventLogId} o {ok:false, reason, detail}.
 */
export async function agendarCita(input: AgendarCitaInput): Promise<AgendarCitaResult> {
  const tenantId = input.tenantId || DEFAULT_TENANT_ID;
  const durationMin = input.durationMin && input.durationMin > 0 ? input.durationMin : 30;
  const end = input.end || new Date(new Date(input.start).getTime() + durationMin * 60_000).toISOString();
  const redirectUri = input.redirectUri || defaultRedirectUri();

  const descripcion = [
    `Cita reservada por el agente ${input.agenteOrigen}.`,
    `Cliente: ${input.nombre}`,
    `Motivo: ${input.motivo}`,
    input.customerPhone ? `Teléfono: ${input.customerPhone}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await createEvent(input.userEmail, redirectUri, {
    summary: `${input.motivo} · ${input.nombre}`,
    description: descripcion,
    start: input.start,
    end,
    attendees: input.attendees,
    location: input.location,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, detail: result.detail };
  }

  // Log en event-log para informe mensual / feed.
  let eventLogId = "";
  try {
    const ts = input.start;
    const ev = await logEvent(tenantId, {
      id: makeEventId("appointment_set", result.eventId || ts),
      ts,
      type: "appointment_set",
      channel: input.agenteOrigen,
      meta: {
        tipo: "cita_agendada",
        nombre: input.nombre,
        motivo: input.motivo,
        fechaIso: input.start,
        horaIso: input.start,
        endIso: end,
        agenteOrigen: input.agenteOrigen,
        eventId: result.eventId,
        htmlLink: result.htmlLink,
        ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
        ...(input.location ? { location: input.location } : {}),
      },
    });
    eventLogId = ev.id;
  } catch (err) {
    // No bloquea la creación de la cita si el log falla.
    console.error("[calendar/agendarCita] event-log falló:", err);
  }

  return { ok: true, eventId: result.eventId, htmlLink: result.htmlLink, eventLogId };
}
