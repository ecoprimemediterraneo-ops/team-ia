// Dos avisos diarios, los dos APAGADOS por defecto:
//
//   · CUMPLEAÑOS (BIRTHDAY_ENABLED): el día de su cumpleaños, entre 10:00 y
//     20:00 (hora de España), una felicitación por WhatsApp a la clienta que lo
//     tenga en su ficha. Una vez al año. Por plantilla (BIRTHDAY_TEMPLATE,
//     2 variables: nombre, negocio): es fuera de la ventana de 24 h.
//   · RESUMEN DIARIO A LA DUEÑA (DAILY_SUMMARY_ENABLED): a las 8:30, las citas
//     del día (hora, clienta, servicio, profesional), los huecos libres y las
//     anulaciones de ayer. Por plantilla si existe DAILY_SUMMARY_TEMPLATE; si no,
//     texto (solo llega si ella escribió al número en las últimas 24 h).
//
// Apagados, calculan lo mismo y lo devuelven/dejan en el log: nada sale.
// Los dispara n8n con CRON_SECRET (/api/cron/avisos-diarios).

import "server-only";
import { listBusinesses, listRecords, clientesMetaDe, saveClienteMeta, computeFreeSlots, resolverServicio, type BusinessBooking } from "./booking";
import { getTenant } from "./tenants";
import { sendWhatsAppTemplate, sendWhatsAppText } from "./whatsapp-sender";

const REDIRECT = "https://aiteam.marketing/api/lucia/callback";
const on = (v?: string) => (v || "").toLowerCase() === "true";
function madrid(d: Date): { fecha: string; mmdd: string; hora: number; anio: number } {
  const f = d.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const hora = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(d)) % 24;
  return { fecha: f, mmdd: f.slice(5), hora, anio: Number(f.slice(0, 4)) };
}
const ayerDe = (f: string) => new Date(Date.parse(`${f}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

// -----------------------------------------------------------------------------
// Cumpleaños
// -----------------------------------------------------------------------------
export type Felicitacion = { slug: string; nombre: string; telefono: string; modo: string };

export async function pasadaCumpleanos(ahora = new Date()): Promise<{ enabled: boolean; felicitaciones: Felicitacion[]; motivo?: string }> {
  const enabled = on(process.env.BIRTHDAY_ENABLED);
  const m = madrid(ahora);
  if (m.hora < 10 || m.hora >= 20) return { enabled, felicitaciones: [], motivo: "fuera de 10:00–20:00" };
  const out: Felicitacion[] = [];
  const recs = await listRecords();
  for (const b of await listBusinesses()) {
    const metas = await clientesMetaDe(b.slug);
    for (const [key, meta] of Object.entries(metas)) {
      if (meta.cumpleanos !== m.mmdd || meta.felicitadaAnio === m.anio) continue;
      const ult = recs.filter((r) => r.slug === b.slug && r.cliente?.telefono && `t:${r.cliente.telefono.replace(/\D/g, "").slice(-9)}` === key)
        .sort((x, y) => y.startIso.localeCompare(x.startIso))[0];
      if (!ult) continue;
      const nombre = (meta.memoria?.nombre || ult.cliente.nombre || "").split(" ")[0];
      let modo = "apagado (BIRTHDAY_ENABLED)";
      if (enabled) {
        const plantilla = process.env.BIRTHDAY_TEMPLATE;
        if (!plantilla) modo = "sin_plantilla (BIRTHDAY_TEMPLATE)";
        else {
          const r = await sendWhatsAppTemplate(ult.cliente.telefono.replace(/[^\d+]/g, ""), plantilla, meta.memoria?.idioma === "en" ? "en" : "es", [nombre, b.nombre], { tenantId: b.tenantId, a: ult.cliente.telefono, motivo: "cumpleanos" });
          modo = r.ok ? "enviado" : `error: ${r.detail}`;
          if (r.ok) await saveClienteMeta(b.slug, key, { felicitadaAnio: m.anio });
        }
      }
      out.push({ slug: b.slug, nombre, telefono: `…${ult.cliente.telefono.slice(-3)}`, modo });
    }
  }
  return { enabled, felicitaciones: out };
}

// -----------------------------------------------------------------------------
// Resumen diario a la dueña
// -----------------------------------------------------------------------------
export type Resumen = { tenantId: string; slug: string; texto: string; citas: number; huecos: number; anuladasAyer: number; variables: string[] };

export async function resumenDelDia(b: BusinessBooking, ahora = new Date()): Promise<Resumen> {
  const { fecha } = madrid(ahora);
  const ayer = ayerDe(fecha);
  const recs = (await listRecords()).filter((r) => r.slug === b.slug && r.tipo !== "bloqueo");
  const hoy = recs.filter((r) => r.startIso.slice(0, 10) === fecha && r.estado !== "cancelada").sort((x, y) => x.startIso.localeCompare(y.startIso));
  const anuladas = recs.filter((r) => r.estado === "cancelada" && (r.canceladaEn || "").slice(0, 10) === ayer);
  const lineas = hoy.map((r) => `${r.startIso.slice(11, 16)} ${r.cliente?.nombre || "?"} · ${r.servicioNombre || "cita"}${r.empleadoNombre ? ` · ${r.empleadoNombre}` : ""}`);
  // Huecos libres de hoy, con el servicio de referencia, por profesional.
  const ref = b.servicios.find((s) => s.activo);
  const staff = (b.empleados || []).filter((e) => e.activo);
  const huecos: string[] = [];
  if (ref) {
    const sel = resolverServicio(ref, {});
    for (const e of staff.length ? staff : [undefined]) {
      const r = await computeFreeSlots(b, sel, fecha, REDIRECT, undefined, e?.id).catch(() => null);
      if (r?.ok && r.slots.length) huecos.push(`${e ? `${e.nombre}: ` : ""}${r.slots.slice(0, 4).map((s) => s.slice(11, 16)).join(", ")}${r.slots.length > 4 ? ` (+${r.slots.length - 4})` : ""}`);
    }
  }
  const nHuecos = huecos.length;
  const texto = [
    `Buenos dias. Hoy en ${b.nombre}:`,
    hoy.length ? `${hoy.length} cita${hoy.length === 1 ? "" : "s"}:\n${lineas.join("\n")}` : "Hoy no hay citas.",
    huecos.length ? `Huecos libres:\n${huecos.join("\n")}` : "No quedan huecos libres hoy.",
    anuladas.length ? `Anuladas ayer: ${anuladas.map((r) => `${r.cliente?.nombre || "?"} (${r.startIso.slice(8, 10)}/${r.startIso.slice(5, 7)} ${r.startIso.slice(11, 16)})`).join(", ")}` : "Ayer no se anuló ninguna cita.",
  ].join("\n\n");
  const variables = [b.nombre, String(hoy.length), lineas.join("; ") || "ninguna", huecos.join("; ") || "ninguno", anuladas.map((r) => r.cliente?.nombre || "?").join(", ") || "ninguna"];
  return { tenantId: b.tenantId, slug: b.slug, texto, citas: hoy.length, huecos: nHuecos, anuladasAyer: anuladas.length, variables };
}

export async function pasadaResumenDiario(ahora = new Date(), soloTenant?: string): Promise<{ enabled: boolean; resumenes: (Resumen & { modo: string })[] }> {
  const enabled = on(process.env.DAILY_SUMMARY_ENABLED);
  const out: (Resumen & { modo: string })[] = [];
  const vistos = new Set<string>();
  for (const b of await listBusinesses()) {
    if (soloTenant && b.tenantId !== soloTenant) continue;
    if (vistos.has(b.tenantId)) continue; // un resumen por negocio principal del tenant
    const t = await getTenant(b.tenantId);
    if (!t?.ownerWhatsapp) continue;
    vistos.add(b.tenantId);
    const r = await resumenDelDia(b, ahora);
    let modo = "apagado (DAILY_SUMMARY_ENABLED)";
    if (enabled) {
      const plantilla = process.env.DAILY_SUMMARY_TEMPLATE;
      const res = plantilla
        ? await sendWhatsAppTemplate(t.ownerWhatsapp, plantilla, "es", r.variables.map((v) => v.slice(0, 900)), { tenantId: b.tenantId, a: t.ownerWhatsapp, motivo: "resumen_diario" })
        : await sendWhatsAppText(t.ownerWhatsapp, r.texto, { tenantId: b.tenantId, a: t.ownerWhatsapp, motivo: "resumen_diario" });
      modo = res.ok ? (plantilla ? "plantilla" : "texto (modo prueba: solo dentro de 24 h)") : `error: ${res.detail}`;
    }
    console.log(`[resumen-diario] ${b.slug}: ${r.citas} citas, ${r.huecos} con huecos, ${r.anuladasAyer} anuladas ayer → ${modo}`);
    out.push({ ...r, modo });
  }
  return { enabled, resumenes: out };
}
