// Ruta de urgencia — hacer visible lo que hasta ahora solo vivía dentro del
// prompt de Pablo (`rutaUrgencia` en sectores.ts, un interruptor que nadie
// podía ver desde fuera).
//
// QUÉ HACE: cuando un paciente escribe a Pablo con una palabra de dolor o
// urgencia, se apunta —no se hace nada más, Pablo sigue la conversación igual
// que siempre—. La pestaña Hoy y el chat pueden entonces enseñar "a quién hay
// que meter hoy sí o sí": quien ha avisado de que le duele y TODAVÍA no tiene
// una cita puesta.
//
// POR QUÉ NO ES SOLO "el último mensaje contiene 'duele'": un paciente que ya
// tiene cita puesta no es una urgencia sin atender, es una cita normal. Se
// cruza contra la agenda real, igual que el recall cruza contra las visitas.

import "server-only";
import { logEvent, makeEventId, getMonthEvents, monthKey } from "./event-log";
import { getBusinessesForTenant, listRecordsForRange } from "./booking";

/** Palabras que, escritas por un paciente, apuntan a dolor o urgencia real. */
// Los "radicales" (urgenc, sangr, hinchad, inflamad) llevan `\w*` detrás, no
// `\b`: son la raíz de varias formas ("urgencia", "hinchada", "sangrando") y
// un `\b` justo después del radical exige que la palabra TERMINE ahí, así que
// nunca casaba con la forma conjugada real.
const PATRON_URGENCIA =
  /\b(duele|dolor\w*|urgenc\w*|sangr\w*|hinchad\w*|inflamad\w*|se me ha roto|se me ha ca[ií]do|absceso|no puedo (comer|dormir|masticar)|fiebre|muela rota|diente roto)\b/i;

export function detectarUrgencia(texto: string): boolean {
  return PATRON_URGENCIA.test(texto || "");
}

/**
 * Apunta que este paciente ha escrito con dolor/urgencia. No interrumpe la
 * conversación de Pablo ni cambia su respuesta: solo queda constancia para
 * que la pestaña Hoy y el chat la puedan enseñar.
 */
export async function marcarUrgencia(
  tenantId: string,
  input: { telefono: string; nombre?: string; texto: string },
): Promise<void> {
  if (!input.telefono) return;
  const ts = new Date().toISOString();
  await logEvent(tenantId, {
    id: makeEventId("urgencia_marcada", input.telefono, ts.slice(0, 16)),
    ts,
    type: "urgencia_marcada",
    channel: "pablo",
    senderId: input.telefono,
    meta: { nombre: input.nombre, texto: input.texto.slice(0, 300) },
  }).catch(() => {});
}

export type UrgenciaSinCita = {
  telefono: string;
  nombre?: string;
  texto: string;
  marcadaEn: string;
  diasEsperando: number;
};

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

/**
 * Quién ha escrito con dolor/urgencia y TODAVÍA no tiene una cita puesta.
 * Mira los últimos 2 meses de urgencias marcadas (de sobra: si lleva más de
 * unos días sin cita, ya no es una urgencia de hoy, es un caso que se ha
 * perdido — se sigue enseñando, con los días bien visibles, para que se note
 * exactamente eso).
 */
export async function urgenciasSinCita(tenantId: string): Promise<UrgenciaSinCita[]> {
  const ahora = new Date();
  const mesAnterior = new Date(ahora);
  mesAnterior.setMonth(mesAnterior.getMonth() - 1);
  const meses = new Set([monthKey(ahora), monthKey(mesAnterior)]);
  const eventos = (await Promise.all([...meses].map((m) => getMonthEvents(tenantId, m)))).flat();

  const marcas = eventos.filter((e) => e.type === "urgencia_marcada");
  // La más reciente por teléfono: si escribió con dolor dos veces, cuenta una.
  const porTelefono = new Map<string, (typeof marcas)[number]>();
  for (const e of marcas) {
    const tel = e.senderId || "";
    if (!tel) continue;
    const previa = porTelefono.get(tel);
    if (!previa || (e.ts || "") > (previa.ts || "")) porTelefono.set(tel, e);
  }

  // Quién de esos YA tiene cita (a partir de hoy, en cualquier negocio del
  // tenant): esos se quitan de la lista, ya están atendidos.
  const negocios = await getBusinessesForTenant(tenantId);
  const hoy = ahora.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const enUnAno = new Date(ahora);
  enUnAno.setFullYear(enUnAno.getFullYear() + 1);
  const hasta = enUnAno.toISOString().slice(0, 10);
  const conCita = new Set<string>();
  for (const negocio of negocios) {
    const citas = await listRecordsForRange(negocio.slug, hoy, hasta);
    for (const c of citas) {
      if (c.tipo === "cita" && (c.estado === "pendiente" || c.estado === "confirmada") && c.cliente.telefono) {
        conCita.add(c.cliente.telefono);
      }
    }
  }

  const resultado: UrgenciaSinCita[] = [];
  for (const [telefono, e] of porTelefono) {
    if (conCita.has(telefono)) continue;
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    resultado.push({
      telefono,
      nombre: typeof meta.nombre === "string" ? meta.nombre : undefined,
      texto: typeof meta.texto === "string" ? meta.texto : "",
      marcadaEn: e.ts || "",
      diasEsperando: diasDesde(e.ts || ahora.toISOString()),
    });
  }
  return resultado.sort((a, b) => b.diasEsperando - a.diasEsperando);
}
