// Los recorridos de punta a punta. Cada uno es lo que haría una persona real:
// escribir por WhatsApp, llamar por teléfono, mandar un DM, comentar un post o
// entrar al panel. Nada sale a Meta ni a Retell: ver `playwright.config.ts`.
import { test, expect, type Page } from "@playwright/test";
import {
  E2E, PASSWORD, whatsapp, instagramDM, instagramComentario, carmenAgendar, esperarWhatsapps,
  llamadasGraph, citas, crearCita, huecos, horas, diaLaborable, diasHasta, fechaHablada, movilNuevo,
  hoyMadrid, marca,
} from "./ayuda";

/** Entra al panel del tenant de pruebas como el fundador (en local no hay login). */
async function panelComoFundador(page: Page, ruta: string): Promise<void> {
  await page.goto(`/admin/ver-panel/${E2E.tenantId}?volver=${encodeURIComponent(ruta)}`);
  await page.waitForURL((u) => u.pathname.startsWith("/dashboard"));
}

/** En la agenda, avanza día a día hasta `fecha`. */
async function agendaEnDia(page: Page, fecha: string): Promise<void> {
  await panelComoFundador(page, "/dashboard/agenda-salon");
  await expect(page.getByRole("button", { name: "Siguiente" }).first()).toBeVisible({ timeout: 60_000 });
  // Con el servidor recién arrancado, la primera carga compila la página: se
  // espera a que la agenda termine de cargar antes de avanzar días.
  await page.waitForLoadState("networkidle");
  for (let i = 0; i < diasHasta(fecha); i++) {
    await page.getByRole("button", { name: "Siguiente" }).first().click();
    await page.waitForLoadState("networkidle");
  }
  const [y, m, d] = fecha.split("-").map(Number);
  const mes = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][m - 1];
  await expect(page.getByText(new RegExp(`${d} de ${mes}`, "i")).first()).toBeVisible();
  void y;
}

const citasActivas = async () => (await citas()).filter((c) => c.tipo === "cita" && c.estado !== "cancelada");

test("1. WhatsApp: pide cita, Pablo ofrece huecos reales, reserva y sale en el panel", async ({ page }) => {
  const D = diaLaborable(0);
  const movil = movilNuevo();
  // Las 11:00 de ese día, ocupadas para las dos que cortan: así Pablo tiene que ofrecer.
  await crearCita({ startIso: `${D}T11:00`, nombre: "Ocupa Ana", empleadoId: "emp_ana" });
  await crearCita({ startIso: `${D}T11:00`, nombre: "Ocupa Carla", empleadoId: "emp_carla" });

  await whatsapp(movil, `Hola, soy Lucía Prueba. Quiero cita para un corte ${fechaHablada(D)} a las 11:00`, "Lucía Prueba");
  const r1 = await esperarWhatsapps(movil, 1);
  expect(r1.length, "Pablo contesta").toBeGreaterThan(0);
  // La respuesta sale DESDE EL NÚMERO DEL SALÓN, no desde el de AI-Team.
  expect(r1[0].ruta, "responde desde el número del negocio").toContain(E2E.waPhoneId);
  const ofrecidas = horas(r1.map((x) => x.texto).join(" ")).filter((h) => h !== "11:00");
  expect(ofrecidas.length, `ofrece dos huecos reales: «${r1.at(-1)?.texto}»`).toBeGreaterThanOrEqual(2);
  const libres = await huecos("sv_corte", D);
  for (const h of ofrecidas.slice(0, 2)) expect(libres, `el hueco ofrecido ${h} está libre de verdad`).toContain(h);
  expect((await citasActivas()).some((c) => c.cliente.telefono.includes(movil)), "todavía no ha reservado nada").toBeFalsy();

  await whatsapp(movil, `Vale, la primera, a las ${ofrecidas[0]}`, "Lucía Prueba");
  await esperarWhatsapps(movil, 2);
  const mia = (await citasActivas()).find((c) => c.cliente.telefono.includes(movil));
  expect(mia, "la cita está en la agenda del salón").toBeTruthy();
  expect(mia!.startIso.slice(0, 16)).toBe(`${D}T${ofrecidas[0]}`);
  expect(mia!.empleadoId, "con una profesional asignada").toBeTruthy();

  await agendaEnDia(page, D);
  await expect(page.getByText("Lucía Prueba").first()).toBeVisible();
});

test("2. Voz: Carmen reserva por la API de agenda, sale en el panel y no acepta horas imposibles", async ({ page }) => {
  const D = diaLaborable(1);
  const ok = await carmenAgendar({ nombre: "Carmen Voz Prueba", motivo: "manicura", fecha_hora: `${D}T17:00:00` });
  expect(ok.json.success, JSON.stringify(ok.json)).toBe(true);
  const mia = (await citasActivas()).find((c) => c.cliente.nombre === "Carmen Voz Prueba");
  expect(mia, "la cita de Carmen está en la agenda").toBeTruthy();
  expect(mia!.serviceId, "con el servicio real (manicura), no uno inventado").toBe("sv_manicura");

  const noche = await carmenAgendar({ nombre: "Madrugadora", motivo: "manicura", fecha_hora: `${D}T03:00:00` });
  expect(noche.json.success, "a las 3 de la mañana el salón está cerrado").toBe(false);
  const domingo = (() => { let f = D; while (new Date(`${f}T12:00:00Z`).getUTCDay() !== 0) f = new Date(Date.parse(`${f}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10); return f; })();
  const dom = await carmenAgendar({ nombre: "Dominguera", motivo: "manicura", fecha_hora: `${domingo}T11:00:00` });
  expect(dom.json.success, "el domingo el salón no abre").toBe(false);
  expect((await citasActivas()).some((c) => c.cliente.nombre === "Madrugadora" || c.cliente.nombre === "Dominguera")).toBeFalsy();

  await agendaEnDia(page, D);
  await expect(page.getByText("Carmen Voz Prueba").first()).toBeVisible();
});

test("3. Pablo y Carmen piden el mismo hueco a la vez: solo entra una", async () => {
  const D = diaLaborable(2);
  const movil = movilNuevo();
  // Color: solo lo hace Ana. Un único hueco posible a esa hora.
  const hora = "12:00";
  const [, a, b] = await Promise.all([
    whatsapp(movil, `Hola, soy Pedro Carrera. Quiero cita para color ${fechaHablada(D)} a las ${hora}`, "Pedro Carrera"),
    carmenAgendar({ nombre: "Carmen Carrera 1", motivo: "color", fecha_hora: `${D}T${hora}:00` }),
    carmenAgendar({ nombre: "Carmen Carrera 2", motivo: "color", fecha_hora: `${D}T${hora}:00` }),
  ]);
  void a; void b;
  await esperarWhatsapps(movil, 1);
  const enEseHueco = (await citasActivas()).filter((c) => c.startIso.slice(0, 16) === `${D}T${hora}`);
  expect(enEseHueco.length, `citas a las ${hora}: ${enEseHueco.map((c) => `${c.cliente.nombre}/${c.empleadoId}`).join(", ")}`).toBe(1);
});

test("4. WhatsApp: cambia la hora y luego cancela; el hueco queda libre solo", async () => {
  const D = diaLaborable(3);
  const movil = movilNuevo();
  await crearCita({ startIso: `${D}T10:00`, nombre: "Marta Cambios", telefono: movil, empleadoId: "emp_ana", serviceId: "sv_corte" });
  expect(await huecos("sv_corte", D, "emp_ana")).not.toContain("10:00");

  await whatsapp(movil, `Hola, quiero cambiar mi cita a las 17:00 del mismo día`, "Marta Cambios");
  await esperarWhatsapps(movil, 1);
  let mia = (await citas()).find((c) => c.cliente.telefono.includes(movil) && c.estado !== "cancelada");
  expect(mia?.startIso.slice(11, 16), "la cita se ha movido a las 17:00").toBe("17:00");
  expect(await huecos("sv_corte", D, "emp_ana"), "las 10:00 vuelven a estar libres").toContain("10:00");

  await whatsapp(movil, "Al final no puedo ir, quiero cancelar la cita", "Marta Cambios");
  const r = await esperarWhatsapps(movil, 2);
  // Pide confirmación antes de cancelar; se contesta que sí.
  if ((await citas()).some((c) => c.cliente.telefono.includes(movil) && c.estado !== "cancelada")) {
    expect(r.at(-1)?.texto, "pregunta antes de cancelar").toMatch(/cancel/i);
    await whatsapp(movil, "sí", "Marta Cambios");
    await esperarWhatsapps(movil, 3);
  }
  mia = (await citas()).find((c) => c.cliente.telefono.includes(movil));
  expect(mia?.estado, "la cita está cancelada").toBe("cancelada");
  expect(await huecos("sv_corte", D, "emp_ana"), "las 17:00 vuelven a estar libres").toContain("17:00");
});

test("5. DM de Instagram: llega al panel y Marta contesta", async ({ page }) => {
  const igsid = `e2e-igsid-${Date.now()}`;
  const texto = `Hola! Cuánto cuesta un corte? (${igsid.slice(-5)})`;
  await instagramDM(igsid, texto);
  const salida = (await llamadasGraph()).filter((l) => l.metodo === "POST" && JSON.stringify(l.cuerpo).includes(igsid));
  expect(salida.length, "Marta ha mandado su respuesta a Instagram").toBeGreaterThan(0);

  await panelComoFundador(page, "/dashboard/marta?tab=mensajes");
  await expect(page.getByText(texto.slice(0, 25)).first()).toBeVisible();
});

test("6. Comentario en un post con la palabra clave: DM automático", async () => {
  const commentId = `c_e2e_${Date.now()}`;
  await instagramComentario(commentId, `e2e-comenta-${Date.now()}`, "comenta_e2e", "INFO por favor");
  const dm = (await llamadasGraph()).find((l) => l.metodo === "POST" && (l.cuerpo as { recipient?: { comment_id?: string } })?.recipient?.comment_id === commentId);
  expect(dm, "sale el DM privado en respuesta al comentario").toBeTruthy();
  expect(JSON.stringify(dm!.cuerpo)).toContain("te paso la info");
});

test("7. Login del dueño: entra y ve la agenda del día", async ({ browser }) => {
  await crearCita({ startIso: `${hoyMadrid()}T20:00`, nombre: "Clienta De Hoy", empleadoId: "emp_berta", serviceId: "sv_manicura" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(E2E.usuario);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => u.pathname.startsWith("/dashboard"), { timeout: 30_000 });
  await page.goto("/dashboard");
  await expect(page.getByText("Salón de Pruebas E2E").first()).toBeVisible();
  await expect(page.getByText("Clienta De Hoy").first()).toBeVisible();
  await ctx.close();
});

test("8. Panel en vivo: una cita nueva aparece sin recargar", async ({ page }) => {
  const D = diaLaborable(1);
  await agendaEnDia(page, D);
  await page.waitForTimeout(1500);
  const r = await carmenAgendar({ nombre: "Aparece En Vivo", motivo: "pedicura", fecha_hora: `${D}T18:00:00` });
  expect(r.json.success, JSON.stringify(r.json)).toBe(true);
  await expect(page.getByText("Aparece En Vivo").first()).toBeVisible({ timeout: 30_000 });
});

test("9. Multi-marca: logo y colores propios, y solo los agentes contratados", async ({ page }) => {
  await marca({ marcaPanel: { nombre: "Estudio Rosa", colorPrincipal: "#ff4fa3", colorAcento: "#1e7a5a" }, agentesContratados: ["pablo", "marta"] });
  try {
    await panelComoFundador(page, "/dashboard");
    await expect(page.getByText("Estudio Rosa").first()).toBeVisible();
    const color = await page.evaluate(() => getComputedStyle(document.querySelector("#marca-tenant") || document.body).getPropertyValue("--mustard").trim().toLowerCase());
    expect(color).toBe("#ff4fa3");
    const r = await carmenAgendar({ nombre: "Sin Carmen", motivo: "manicura", fecha_hora: `${diaLaborable(2)}T17:00:00` });
    expect(r.json.success, "Carmen no está contratada: no reserva").toBe(false);
  } finally {
    await marca({ marcaPanel: null, agentesContratados: null });
  }
});
