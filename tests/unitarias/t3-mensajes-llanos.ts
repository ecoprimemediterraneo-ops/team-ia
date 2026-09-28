const R = new URL("../../src/lib/", import.meta.url).href;
delete process.env.BOOKING_SIMULATE; delete process.env.SUPABASE_URL;
import fs from "node:fs";
const B = await import(R + "booking.ts");
const O = await import(R + "orchestrator.ts");
const D = await import(R + "sectores-demo.ts");
const T = await import(R + "reserva-texto.ts");
let ok = 0, total = 0;
const assert = (c: boolean, m: string) => { total++; if (c) { ok++; console.log(`OK   ${m}`); } else console.log(`FAIL ${m}`); };
const REDIR = "https://aiteam.marketing/api/lucia/callback";
const suma = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
const TECNICO = /sin tokens|invalid_grant|insufficient|token|googleapis|scope/i;
const tenantId = "tenant_demo_dental";
await D.sembrarDemoConservando(tenantId);
const negocio = await B.getBusinessByTenant(tenantId);
const sv = negocio.servicios.find((s: any) => s.activo); const sel = B.resolverServicio(sv, {});

// Calendario de Google CONECTADO pero roto (token que ya no vale): no se disfraza de agenda interna
const email = "demo-dental@aiteam.local";
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/users.json", JSON.stringify({ [email]: { email, createdAt: new Date().toISOString(), chats: {}, gmailTokens: { refreshToken: "roto", scope: "x" } } }));
const r = await Promise.race([B.computeFreeSlots(negocio, sel, suma(3), REDIR), new Promise((res) => setTimeout(() => res("TIMEOUT"), 20000))]) as any;
assert(r !== "TIMEOUT", "la consulta con Google roto no se queda colgada");
assert(r.ok === false, "con Google conectado pero roto NO se inventa una agenda interna (los eventos de Google seguirían sin verse)");
assert(!TECNICO.test(r.detail || "") || /desconectado|Reconectar/.test(r.detail), `el detalle que ve la pantalla no lleva texto técnico: «${r.detail}»`);
assert(!/Sin tokens|invalid_grant|insufficient/i.test(r.detail || ""), "ni «Sin tokens para este usuario» ni códigos de Google");

// Reservar con Google roto → mensaje llano y NO se crea nada
const slotFalso = `${suma(3)}T10:00:00`;
const res = await O.reservarSlot({ tenantId, userEmail: "x", redirectUri: REDIR, nombre: "N", motivo: sv.nombre, startIso: slotFalso, agenteOrigen: "dashboard" });
assert(!res.ok, "con Google roto no se reserva a ciegas");
const texto = T.textoFalloReserva(res as any);
assert(!/Sin tokens|invalid_grant|insufficient|googleapis/i.test(texto) && !/no está libre/.test(texto), `y el texto para el dueño es llano y no dice «ocupado» cuando el problema es el calendario: «${texto}»`);
assert((await B.listRecords()).filter((x: any) => x.slug === negocio.slug).length === 0, "no queda ninguna cita a medias");

// Textos por motivo
const t1 = T.textoFalloReserva({ ok: false, reason: "slot_taken", motivo: "fuera_de_horario", suggested: "2026-10-01T09:00:00" });
assert(/horario/.test(t1) && /09:00/.test(t1), "fuera de horario: lo dice y ofrece el siguiente hueco");
assert(/no se ha podido crear/i.test(T.textoFalloReserva({ ok: false, reason: "error", detail: "algo raro" })), "error genérico: frase corta sin detalle técnico");
assert(!/algo raro/.test(T.textoFalloReserva({ ok: false, reason: "error", detail: "algo raro" })), "el detalle técnico no se repite al dueño");
console.log(`\n=== ${ok}/${total} ===`);
if (ok !== total) process.exit(1);
