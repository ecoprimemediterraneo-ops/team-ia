// Un proceso aparte que intenta UNA reserva (lo lanza t10). Cada proceso es como
// una instancia distinta de Vercel: no comparte memoria con los demás, solo la
// base de datos (Supabase de mentira) o los ficheros de data/ (local).
//   argv: <canal> <tenantId> <slug> <serviceId> <startIso> <disparoEpochMs> <n>
const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.BOOKING_SIMULATE;
const [canal, tenantId, slug, serviceId, startIso, disparo, n] = process.argv.slice(2);
const B = await import(R + "booking.ts");
const O = await import(R + "orchestrator.ts");
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const negocio = await B.getBusinessBySlug(slug);
const sv = negocio.servicios.find((s: any) => s.id === serviceId);
// Todos los procesos disparan en el MISMO instante.
await new Promise((r) => setTimeout(r, Math.max(0, Number(disparo) - Date.now())));
const cliente = { nombre: `Cliente ${n}`, telefono: `6000000${String(n).padStart(2, "0")}` };
let r: any;
const t0 = Date.now();
try {
  if (canal === "carmen" || canal === "pablo") {
    r = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: cliente.nombre, motivo: sv.nombre, startIso, agenteOrigen: canal, customerPhone: cliente.telefono });
  } else if (canal === "web") {
    r = await B.crearReserva({ slug, serviceId, startIso, cliente, redirectUri: REDIR });
  } else {
    r = await B.crearReservaManual({ slug, serviceId, startIso, cliente, redirectUri: REDIR });
  }
} catch (e) {
  r = { ok: false, reason: "excepcion", detail: String(e) };
}
process.stdout.write(`RESULTADO ${JSON.stringify({ canal, n, ok: r.ok, reason: r.ok ? undefined : r.reason, detail: r.ok ? undefined : r.detail, ms: Date.now() - t0 })}\n`);
process.exit(0);
