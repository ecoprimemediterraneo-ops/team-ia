// LA AGENDA DE LAS DEMOS, DE PUNTA A PUNTA, en el tenant de pruebas y contra el
// servidor local (nada sale a Meta ni a Retell; ver `playwright.config.ts`):
//   11. El dueño crea, mueve y cancela una cita A MANO en el panel.
//   12. Una cita de Carmen (API de voz) y otra de Pablo (WhatsApp) aparecen
//       SOLAS en el panel abierto, sin recargar.
//   13. Carmen cancela y mueve una cita POR TELÉFONO; el hueco queda libre al instante.
//   14. 20 peticiones a la vez (10 por teléfono, 10 por WhatsApp) al mismo hueco:
//       entra una y las llamadas que pierden ofrecen dos huecos libres de verdad.
//   15. El enlace público de huecos no enseña nada de nadie.
//   16. El recordatorio del día antes sale UNA vez aunque el cron se dispare dos a la vez.
import { test, expect, type Page } from "@playwright/test";
import {
  BASE, E2E, whatsapp, carmenAgendar, esperarWhatsapps, whatsappsA, citas, crearCita, huecos, horas,
  diaLaborable, diasHasta, fechaHablada, movilNuevo, hoyMadrid, sumarDias,
} from "./ayuda";

async function panelComoFundador(page: Page, ruta: string): Promise<void> {
  await page.goto(`/admin/ver-panel/${E2E.tenantId}?volver=${encodeURIComponent(ruta)}`);
  await page.waitForURL((u) => u.pathname.startsWith("/dashboard"));
}
async function agendaEnDia(page: Page, fecha: string): Promise<void> {
  await panelComoFundador(page, "/dashboard/agenda-salon");
  await expect(page.getByRole("button", { name: "Siguiente" }).first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  // Vista de lista del día (la que tiene los botones de cada cita).
  await page.getByRole("button", { name: /^Día$/ }).first().click().catch(() => {});
  for (let i = 0; i < diasHasta(fecha); i++) {
    await page.getByRole("button", { name: "Siguiente" }).first().click();
    await page.waitForLoadState("networkidle");
  }
  const [, m, d] = fecha.split("-").map(Number);
  const mes = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][m - 1];
  await expect(page.getByText(new RegExp(`${d} de ${mes}`, "i")).first()).toBeVisible();
}
const activas = async () => (await citas()).filter((c) => c.tipo === "cita" && c.estado !== "cancelada");
const tarjeta = (page: Page, nombre: string) => page.locator("div.card-hard", { hasText: nombre }).filter({ has: page.getByRole("button", { name: "Mover" }) }).first();

async function carmenCita(args: Record<string, unknown>, desde: string) {
  const r = await fetch(`${BASE}/api/carmen/cita?secret=${encodeURIComponent(process.env.CARMEN_WEBHOOK_SECRET || "")}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call: { call_id: `call_e2e_${Date.now()}`, from_number: desde, to_number: E2E.carmenNumero }, args }),
  });
  return (await r.json()) as { success: boolean; message: string; reason?: string; alternativas?: string[] };
}

test("11. Panel: el dueño crea, mueve y cancela una cita a mano", async ({ page }) => {
  const D = diaLaborable(4);
  await agendaEnDia(page, D);

  // Crear
  await page.getByRole("button", { name: "＋ Cita" }).click();
  await page.locator("select:has(option[value='__custom'])").selectOption("sv_corte");
  await page.locator("select:has(option:text('Sin asignar'))").selectOption("emp_ana");
  await page.locator("input[type='date']").last().fill(D);
  await page.locator("input[type='time']").last().fill("16:00");
  await page.getByPlaceholder("Nombre", { exact: true }).fill("Panel Manual");
  await page.getByPlaceholder("Teléfono").fill("611223344");
  await page.getByRole("button", { name: "Crear cita" }).click();
  await expect(page.getByText("Panel Manual").first()).toBeVisible();
  let mia = (await activas()).find((c) => c.cliente.nombre === "Panel Manual");
  expect(mia?.startIso.slice(0, 16), "creada a las 16:00 con Ana").toBe(`${D}T16:00`);
  expect(mia?.empleadoId).toBe("emp_ana");
  expect(await huecos("sv_corte", D, "emp_ana"), "las 16:00 de Ana ya no se ofrecen").not.toContain("16:00");

  // Mover
  await tarjeta(page, "Panel Manual").getByRole("button", { name: "Mover" }).click();
  await expect(page.getByText("Reprogramar cita")).toBeVisible();
  await page.locator("input[type='time']").last().fill("17:30");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(async () => (await activas()).find((c) => c.cliente.nombre === "Panel Manual")?.startIso.slice(11, 16), { message: "movida a las 17:30" }).toBe("17:30");
  const libres = await huecos("sv_corte", D, "emp_ana");
  expect(libres, "las 16:00 quedan libres").toContain("16:00");
  expect(libres, "y las 17:30 ocupadas").not.toContain("17:30");

  // Cancelar
  await tarjeta(page, "Panel Manual").getByRole("button", { name: "Cancelar" }).click();
  await expect.poll(async () => (await citas()).find((c) => c.cliente.nombre === "Panel Manual")?.estado, { message: "cancelada" }).toBe("cancelada");
  expect(await huecos("sv_corte", D, "emp_ana"), "las 17:30 vuelven a estar libres").toContain("17:30");
  mia = (await citas()).find((c) => c.cliente.nombre === "Panel Manual");
  expect(mia?.estado).toBe("cancelada");
});

test("12. Panel en vivo: una cita de Carmen y otra de Pablo aparecen solas, sin recargar", async ({ page }) => {
  const D = diaLaborable(5);
  await agendaEnDia(page, D);
  await expect(page.getByText("Voz En Vivo")).toHaveCount(0);
  // Marca en la página: si se recargara de verdad, desaparecería. (El refresco
  // suave del panel, `router.refresh()`, no recarga la página: la marca sigue.)
  await page.evaluate(() => { (window as unknown as { __sinRecargar?: number }).__sinRecargar = 42; });

  const voz = await carmenAgendar({ nombre: "Voz En Vivo", motivo: "manicura", fecha_hora: `${D}T10:00:00` }, "+34611555001");
  expect(voz.json.success, JSON.stringify(voz.json)).toBe(true);
  const movil = movilNuevo();
  await whatsapp(movil, `Hola, soy Wasap En Vivo. Quiero cita para un corte ${fechaHablada(D)} a las 12:30`, "Wasap En Vivo");
  await esperarWhatsapps(movil, 1);
  await expect.poll(async () => (await activas()).some((c) => c.cliente.telefono.includes(movil)), { message: "Pablo ha reservado", timeout: 60_000 }).toBeTruthy();

  await expect(page.getByText("Voz En Vivo").first(), "la de Carmen aparece sola").toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Wasap En Vivo").first(), "la de Pablo aparece sola").toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as unknown as { __sinRecargar?: number }).__sinRecargar), "sin recargar la página").toBe(42);
});

test("13. Carmen por teléfono: consulta, mueve y cancela; el hueco queda libre al instante", async () => {
  const D = diaLaborable(6);
  const movil = movilNuevo();
  const tel = `+${movil}`;
  await crearCita({ startIso: `${D}T10:00`, nombre: "Voz Cambios", telefono: movil, empleadoId: "emp_ana", serviceId: "sv_corte" });

  const c = await carmenCita({ accion: "consultar" }, tel);
  expect(c.success, c.message).toBe(true);
  expect(c.message).toMatch(/10:00/);

  const m = await carmenCita({ accion: "mover", fecha_hora: `${D}T12:30:00` }, tel);
  expect(m.success, m.message).toBe(true);
  expect((await activas()).find((x) => x.cliente.telefono.includes(movil))?.startIso.slice(11, 16), "movida a las 12:30").toBe("12:30");
  expect(await huecos("sv_corte", D, "emp_ana"), "las 10:00 quedan libres al momento").toContain("10:00");

  // A una hora ocupada: no la mueve y ofrece dos huecos libres de verdad.
  await crearCita({ startIso: `${D}T17:00`, nombre: "Ocupa Ana 17", empleadoId: "emp_ana", serviceId: "sv_corte" });
  await crearCita({ startIso: `${D}T17:00`, nombre: "Ocupa Carla 17", empleadoId: "emp_carla", serviceId: "sv_corte" });
  const ocupada = await carmenCita({ accion: "mover", fecha_hora: `${D}T17:00:00` }, tel);
  expect(ocupada.success, "a una hora ocupada no se mueve").toBe(false);
  expect(ocupada.alternativas?.length, `ofrece 2 alternativas: ${ocupada.message}`).toBe(2);

  const x = await carmenCita({ accion: "cancelar" }, tel);
  expect(x.success, x.message).toBe(true);
  expect((await citas()).find((y) => y.cliente.telefono.includes(movil))?.estado).toBe("cancelada");
  expect(await huecos("sv_corte", D, "emp_ana"), "las 12:30 quedan libres al momento").toContain("12:30");
});

test("14. 20 a la vez (10 llamadas y 10 WhatsApps) al mismo hueco: entra una", async () => {
  const D = diaLaborable(7);
  const hora = "11:30";
  // Color: solo lo hace Ana → un único hueco posible a esa hora.
  const moviles = Array.from({ length: 10 }, () => movilNuevo());
  const [voces] = await Promise.all([
    Promise.all(Array.from({ length: 10 }, (_, i) => carmenAgendar({ nombre: `Voz Carrera ${i}`, motivo: "color", fecha_hora: `${D}T${hora}:00` }, `+3461177${String(i).padStart(4, "0")}`))),
    Promise.all(moviles.map((m, i) => whatsapp(m, `Hola, soy Wasap Carrera ${i}. Quiero cita para color ${fechaHablada(D)} a las ${hora}`, `Wasap Carrera ${i}`))),
  ]);
  await Promise.all(moviles.map((m) => esperarWhatsapps(m, 1)));
  const enHueco = (await activas()).filter((c) => c.startIso.slice(0, 16) === `${D}T${hora}`);
  expect(enHueco.length, `citas a las ${hora}: ${enHueco.map((c) => c.cliente.nombre).join(", ")}`).toBe(1);
  const perdidas = voces.filter((v) => v.json.success !== true);
  const libres = await huecos("sv_color", D);
  for (const v of perdidas) {
    const msg = String(v.json.message);
    expect(v.json.reason, `Carmen dice "ocupado", no un fallo: «${msg}»`).toBe("slot_taken");
    const ofrecidas = horas(msg);
    expect(ofrecidas.length, `ofrece 2 horas: «${msg}»`).toBeGreaterThanOrEqual(2);
    for (const h of ofrecidas.slice(0, 2)) expect(libres, `la alternativa ${h} está libre`).toContain(h);
  }
});

test("15. El enlace público de huecos solo enseña huecos", async ({ page }) => {
  const D = diaLaborable(8);
  await crearCita({ startIso: `${D}T10:00`, nombre: "Nombre Secreto", telefono: "699887766", empleadoId: "emp_ana", serviceId: "sv_corte" });
  await page.goto(`/reservas/${E2E.slug}/huecos`);
  await expect(page.locator("body")).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain("Nombre Secreto");
  expect(html).not.toContain("699887766");
  for (const c of await citas()) {
    if (c.cliente?.nombre) expect(html, `no aparece ${c.cliente.nombre}`).not.toContain(c.cliente.nombre);
  }
  const api = await (await fetch(`${BASE}/api/booking/${E2E.slug}/slots?serviceId=sv_corte&date=${D}`)).text();
  expect(api).not.toContain("Nombre Secreto");
  expect(api).not.toContain("699887766");
});

test("16. El recordatorio del día antes sale una vez aunque el cron se dispare dos veces a la vez", async () => {
  const manana = sumarDias(hoyMadrid(), 1);
  const movil = movilNuevo();
  await crearCita({ startIso: `${manana}T18:00`, nombre: "Recordame", telefono: movil, empleadoId: "emp_ana", serviceId: "sv_corte" });
  const antes = (await whatsappsA(movil)).length;
  const [a, b] = await Promise.all([
    fetch(`${BASE}/api/cron/booking-recordatorios`).then((r) => r.json()),
    fetch(`${BASE}/api/cron/booking-recordatorios`).then((r) => r.json()),
  ]);
  expect(a.ok && b.ok, JSON.stringify([a, b]).slice(0, 300)).toBeTruthy();
  const cita = (await citas()).find((c) => c.cliente.telefono.includes(movil));
  expect((cita as unknown as { recordatorioEnviado?: boolean })?.recordatorioEnviado, "la cita queda con el recordatorio apuntado").toBe(true);
  const nuevos = (await whatsappsA(movil)).length - antes;
  expect(nuevos, "un solo WhatsApp de recordatorio").toBe(1);
  // Una tercera pasada ya no manda nada.
  await fetch(`${BASE}/api/cron/booking-recordatorios`);
  expect((await whatsappsA(movil)).length - antes).toBe(nuevos);
});
