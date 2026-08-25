// Lo que el chat puede HACER, no solo contar.
//
// EL CAMBIO DE IDEA
// -----------------
// El chat empezó siendo una ventanilla de consulta: preguntabas y te contestaba,
// y para hacer algo había que irse al panel. Eso convierte la portada en un
// escaparate: en cuanto pinchas, te expulsa a las pantallas de siempre. La idea
// ahora es la contraria — que el grueso del trabajo se haga escribiendo, y que
// las pantallas queden para lo que hay que ver con los ojos (un PDF, un cuadre).
//
// LA REGLA QUE NO SE SALTA: NADA A LA PRIMERA
// -------------------------------------------
// Toda acción que cambie datos se propone antes en una frase y espera un "sí".
// No es burocracia: el modelo entiende mal de vez en cuando, y "márcame hecho el
// 303" con dos clientes que tienen 303 es una equivocación silenciosa que se
// descubre en el trimestre. Lo que se propone se puede leer en un segundo; lo
// que se ejecuta a ciegas, no.
//
// Y SI NO ESTÁ SEGURO, PREGUNTA. Cuando la frase encaja con dos obligaciones o
// con tres documentos, no se elige la primera: se devuelven las opciones para
// que el gestor diga cuál. Adivinar acierta la mitad de las veces.
//
// AQUÍ NO SE DUPLICA LÓGICA. Cada acción llama a la función que ya existe:
// `marcarHecho` de HOY, `asignarCliente` y `noEsDuplicado` de facturas,
// `guardarIdentidad` de la ficha, la ruta de reclamación con sus tres candados.

import "server-only";
import { marcarHecho } from "./gestoria-hoy";
import { construirAgenda } from "./gestoria-obligaciones";
import { listarFacturas, asignarCliente, noEsDuplicado } from "./gestoria-facturas";
import { listarClientes } from "./gestoria-clientes";
import { guardarIdentidad } from "./gestoria-identidad";
import { venceEl, fechaNatural, fechasEnCristiano } from "./gestoria-fechas";

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/**
 * Lo que devuelve preparar una acción.
 *
 *   propuesta → hay una sola cosa clara: se describe y se espera el "sí".
 *   ambiguo   → encaja con varias: se devuelven para que elija.
 *   nada      → no encaja con ninguna.
 *   error     → no se puede hacer (por ejemplo, el envío está apagado).
 */
export type Preparada =
  | { tipo: "propuesta"; resumen: string; accion: AccionPendiente }
  | { tipo: "ambiguo"; pregunta: string; opciones: string[] }
  | { tipo: "nada"; motivo: string }
  | { tipo: "error"; motivo: string };

/** La acción ya resuelta, lista para ejecutarse en cuanto el gestor diga que sí. */
export type AccionPendiente =
  | { clase: "marcar_hecho"; id: string; etiqueta: string }
  | { clase: "asignar_documento"; facturaId: string; clienteId: string; etiqueta: string }
  | { clase: "no_es_duplicado"; facturaId: string; etiqueta: string }
  | { clase: "ficha_cliente"; clienteId: string; nif?: string; telefono?: string; email?: string; etiqueta: string }
  | { clase: "reclamar"; clienteId: string; movimientoIds: string[]; etiqueta: string };

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** ¿El texto que ha escrito el gestor apunta a esta cosa? Coincidencia laxa. */
function encaja(texto: string, ...campos: Array<string | null | undefined>): boolean {
  const t = norm(texto);
  if (!t) return false;
  return campos.some((c) => {
    const n = norm(c || "");
    return !!n && (n.includes(t) || t.includes(n));
  });
}

// -----------------------------------------------------------------------------
// Preparar cada acción
// -----------------------------------------------------------------------------

/** "márcame hecho el 303 de Bar El Puerto" */
export async function prepararMarcarHecho(
  tenantId: string,
  queCosa: string,
  deQuienStr?: string,
): Promise<Preparada> {
  const agenda = (await construirAgenda(tenantId)).filter((l) => !l.hecho);
  let candidatas = agenda.filter((l) => encaja(queCosa, l.titulo, l.etiqueta, l.detalle));

  if (deQuienStr) {
    const filtradas = candidatas.filter((l) => encaja(deQuienStr, l.clienteNombre));
    // Si el filtro por cliente deja cero, se ignora: mejor preguntar entre
    // varias que decir que no hay nada cuando sí lo hay.
    if (filtradas.length) candidatas = filtradas;
  }

  if (!candidatas.length) {
    return { tipo: "nada", motivo: `No encuentro nada pendiente que sea "${queCosa}"${deQuienStr ? ` de ${deQuienStr}` : ""}.` };
  }
  if (candidatas.length > 1) {
    return {
      tipo: "ambiguo",
      pregunta: "Hay varias que encajan. ¿Cuál de estas?",
      opciones: candidatas.slice(0, 6).map(
        (l) => `${l.titulo} · ${l.clienteNombre ?? "sin cliente"} · ${venceEl(l.vence, l.dias)}`,
      ),
    };
  }

  const l = candidatas[0];
  return {
    tipo: "propuesta",
    resumen: `Marcar como hecho "${l.titulo}"${l.clienteNombre ? ` de ${l.clienteNombre}` : ""}. Desaparecerá de la agenda y de Hoy.`,
    accion: { clase: "marcar_hecho", id: l.id, etiqueta: `${l.titulo}${l.clienteNombre ? ` de ${l.clienteNombre}` : ""}` },
  };
}

/** "el documento sin identificar es de Distribuciones Vega" */
export async function prepararAsignarDocumento(
  tenantId: string,
  cliente: string,
  queDocumento?: string,
): Promise<Preparada> {
  const clientes = await listarClientes(tenantId);
  const dest = clientes.filter((c) => encaja(cliente, c.nombre, c.nif));
  if (!dest.length) return { tipo: "nada", motivo: `No tengo ningún cliente que se llame "${cliente}".` };
  if (dest.length > 1) {
    return { tipo: "ambiguo", pregunta: "¿A cuál de estos clientes?", opciones: dest.map((c) => c.nombre) };
  }

  const sinDueno = (await listarFacturas(tenantId)).filter(
    (f) => !f.cliente_id && f.estado !== "descartada",
  );
  if (!sinDueno.length) return { tipo: "nada", motivo: "Ahora mismo no hay ningún documento sin identificar." };

  let candidatos = sinDueno;
  if (queDocumento) {
    // Se busca también por IMPORTE y por fecha: cuando hay dos sin identificar,
    // el gestor no dice "el de factura-agosto.pdf", dice "el de 508,20". Sin
    // esto se quedaba en ambiguo para siempre y no había forma de salir.
    const f = sinDueno.filter((x) =>
      encaja(queDocumento, x.nombre_original, x.proveedor, x.lectura?.numero?.valor, x.fecha_factura) ||
      (x.importe != null && encaja(queDocumento, String(x.importe), x.importe.toFixed(2).replace(".", ","))),
    );
    if (f.length) candidatos = f;
  }
  if (candidatos.length > 1) {
    return {
      tipo: "ambiguo",
      pregunta: `Hay ${candidatos.length} documentos sin identificar. ¿Cuál de ellos?`,
      opciones: candidatos.slice(0, 6).map(
        (f) => `${f.proveedor ?? f.nombre_original}${f.importe != null ? ` · ${euros(f.importe)}` : ""} · ${f.fecha_factura ? fechaNatural(f.fecha_factura) : "sin fecha"}`,
      ),
    };
  }

  const f = candidatos[0];
  return {
    tipo: "propuesta",
    resumen: `Asignar "${f.proveedor ?? f.nombre_original}"${f.importe != null ? ` (${euros(f.importe)})` : ""} a ${dest[0].nombre}.`,
    accion: {
      clase: "asignar_documento",
      facturaId: f.id,
      clienteId: dest[0].id,
      etiqueta: `${f.proveedor ?? f.nombre_original} → ${dest[0].nombre}`,
    },
  };
}

/**
 * Resolver un conflicto de NIF: el mismo NIF está en dos fichas.
 *
 * NO se arregla asignando el documento a uno de los dos: eso deja el conflicto
 * vivo y el siguiente documento vuelve a caer igual. Se arregla quitándole el
 * NIF a quien no le toca, que es donde está el fallo de verdad.
 */
export async function prepararResolverConflicto(
  tenantId: string,
  clienteQueSeQueda: string,
): Promise<Preparada> {
  const enConflicto = (await listarFacturas(tenantId)).filter((f) => !f.cliente_id && f.conflicto);
  if (!enConflicto.length) return { tipo: "nada", motivo: "No hay ningún conflicto de NIF ahora mismo." };

  const c = enConflicto[0].conflicto!;
  const clientes = await listarClientes(tenantId);
  const seQueda = c.clientes.filter((x) => encaja(clienteQueSeQueda, x.nombre));
  if (!seQueda.length) {
    return {
      tipo: "ambiguo",
      pregunta: `El NIF ${c.valor} está en dos fichas. ¿De cuál de los dos es de verdad?`,
      opciones: c.clientes.map((x) => x.nombre),
    };
  }
  if (seQueda.length > 1) {
    return { tipo: "ambiguo", pregunta: "¿Cuál de los dos?", opciones: seQueda.map((x) => x.nombre) };
  }

  const pierde = c.clientes.find((x) => x.id !== seQueda[0].id);
  if (!pierde) return { tipo: "nada", motivo: "No he sabido ver a quién habría que quitarle el NIF." };
  const nombrePierde = clientes.find((x) => x.id === pierde.id)?.nombre ?? pierde.nombre;

  return {
    tipo: "propuesta",
    resumen: `Dejar el NIF ${c.valor} solo en ${seQueda[0].nombre} y quitárselo a ${nombrePierde}. Después los documentos con ese NIF se colocarán solos.`,
    accion: {
      clase: "ficha_cliente",
      clienteId: pierde.id,
      nif: "",
      etiqueta: `quitar el NIF ${c.valor} a ${nombrePierde}`,
    },
  };
}

/** "ese no es duplicado" */
export async function prepararNoEsDuplicado(tenantId: string, cual?: string): Promise<Preparada> {
  const dups = (await listarFacturas(tenantId)).filter((f) => !!f.duplicado_de);
  if (!dups.length) return { tipo: "nada", motivo: "No hay ningún documento marcado como duplicado." };

  let candidatos = dups;
  if (cual) {
    const f = dups.filter((x) =>
      encaja(cual, x.nombre_original, x.proveedor, x.lectura?.numero?.valor, x.fecha_factura) ||
      (x.importe != null && encaja(cual, String(x.importe), x.importe.toFixed(2).replace(".", ","))),
    );
    if (f.length) candidatos = f;
  }
  if (candidatos.length > 1) {
    return {
      tipo: "ambiguo",
      pregunta: "¿Cuál de estos no es duplicado?",
      opciones: candidatos.slice(0, 6).map(
        (f) => `${f.proveedor ?? f.nombre_original}${f.importe != null ? ` · ${euros(f.importe)}` : ""} · ${f.fecha_factura ? fechaNatural(f.fecha_factura) : "sin fecha"}`,
      ),
    };
  }

  const f = candidatos[0];
  return {
    tipo: "propuesta",
    resumen: `Quitarle la marca de duplicado a "${f.proveedor ?? f.nombre_original}"${f.importe != null ? ` (${euros(f.importe)})` : ""}. Volverá a contar en los totales y en el cruce con el banco.`,
    accion: { clase: "no_es_duplicado", facturaId: f.id, etiqueta: f.proveedor ?? f.nombre_original },
  };
}

/** "el NIF de Carmen es 12345678Z", "apúntale el teléfono 34600..." */
export async function prepararFichaCliente(
  tenantId: string,
  cliente: string,
  datos: { nif?: string; telefono?: string; email?: string },
): Promise<Preparada> {
  const clientes = await listarClientes(tenantId);
  const dest = clientes.filter((c) => encaja(cliente, c.nombre, c.nif));
  if (!dest.length) return { tipo: "nada", motivo: `No tengo ningún cliente que se llame "${cliente}".` };
  if (dest.length > 1) {
    return { tipo: "ambiguo", pregunta: "¿A cuál de estos?", opciones: dest.map((c) => c.nombre) };
  }
  if (!datos.nif && !datos.telefono && !datos.email) {
    return { tipo: "nada", motivo: "Dime qué le apunto: el NIF, un teléfono o un correo." };
  }

  const que = [
    datos.nif ? `el NIF ${datos.nif}` : "",
    datos.telefono ? `el teléfono ${datos.telefono}` : "",
    datos.email ? `el correo ${datos.email}` : "",
  ].filter(Boolean).join(" y ");

  return {
    tipo: "propuesta",
    resumen: `Apuntar ${que} en la ficha de ${dest[0].nombre}. A partir de ahí sus facturas se colocarán solas.`,
    accion: {
      clase: "ficha_cliente",
      clienteId: dest[0].id,
      nif: datos.nif,
      telefono: datos.telefono,
      email: datos.email,
      etiqueta: `${que} a ${dest[0].nombre}`,
    },
  };
}

/** "reclámale las facturas a Talleres Ruiz" */
export async function prepararReclamar(tenantId: string, cliente: string): Promise<Preparada> {
  const { reclamacionSendEnabled } = await import("./gestoria-conciliacion");
  const { listarMovimientos } = await import("./gestoria-facturas");

  const clientes = await listarClientes(tenantId);
  const dest = clientes.filter((c) => encaja(cliente, c.nombre, c.nif));
  if (!dest.length) return { tipo: "nada", motivo: `No tengo ningún cliente que se llame "${cliente}".` };
  if (dest.length > 1) {
    return { tipo: "ambiguo", pregunta: "¿A cuál de estos?", opciones: dest.map((c) => c.nombre) };
  }
  const c = dest[0];

  const movimientos = await listarMovimientos(tenantId, c.id);
  const aReclamar = movimientos
    .filter((m) => m.signo === "cargo" && m.estado !== "conciliado" && m.estado !== "ignorado" && !m.pedido_en)
    .sort((a, b) => b.importe - a.importe)
    .slice(0, 10);

  if (!aReclamar.length) {
    return { tipo: "nada", motivo: `A ${c.nombre} no le queda ningún cargo sin justificar por reclamar.` };
  }
  if (!c.telefono && !c.email) {
    return { tipo: "error", motivo: `${c.nombre} no tiene ni teléfono ni correo en su ficha: no hay por dónde escribirle.` };
  }

  const suma = aReclamar.reduce((s, m) => s + m.importe, 0);
  const apagado = !reclamacionSendEnabled();

  return {
    tipo: "propuesta",
    // El estado del interruptor se dice EN LA PROPUESTA, no después de darle al
    // sí: prometer un envío y luego contar que estaba apagado es lo peor de los
    // dos mundos.
    resumen:
      `Reclamar a ${c.nombre} ${aReclamar.length} cargo(s) sin factura por ${euros(suma)}.` +
      (apagado
        ? " OJO: el envío automático está APAGADO, así que se preparará el mensaje y te lo daré para que lo mandes tú."
        : " Se le mandará por WhatsApp con la plantilla aprobada."),
    accion: {
      clase: "reclamar",
      clienteId: c.id,
      movimientoIds: aReclamar.map((m) => m.id),
      etiqueta: `${aReclamar.length} cargo(s) a ${c.nombre}`,
    },
  };
}

// -----------------------------------------------------------------------------
// Ejecutar, ya con el "sí" del gestor delante
// -----------------------------------------------------------------------------

export type Resultado = { ok: boolean; texto: string };

export async function ejecutar(tenantId: string, a: AccionPendiente): Promise<Resultado> {
  const r = await ejecutarInterno(tenantId, a);
  // Mismo filtro que en el chat: lo que confirma una acción también lo lee el
  // gestor, y también puede traer una fecha cruda arrastrada de una etiqueta.
  return { ...r, texto: fechasEnCristiano(r.texto) };
}

async function ejecutarInterno(tenantId: string, a: AccionPendiente): Promise<Resultado> {
  try {
    if (a.clase === "marcar_hecho") {
      await marcarHecho(tenantId, a.id, true);
      return { ok: true, texto: `Hecho. He marcado "${a.etiqueta}" y ya no sale ni en la agenda ni en Hoy.` };
    }

    if (a.clase === "asignar_documento") {
      const r = await asignarCliente(tenantId, a.facturaId, a.clienteId);
      return r
        ? { ok: true, texto: `Asignado: ${a.etiqueta}. Ya cuenta en su cuadre.` }
        : { ok: false, texto: "No he podido asignarlo: ese documento ya no está." };
    }

    if (a.clase === "no_es_duplicado") {
      const r = await noEsDuplicado(tenantId, a.facturaId);
      return r
        ? { ok: true, texto: `Quitada la marca de duplicado a "${a.etiqueta}". Vuelve a contar y no se le volverá a marcar.` }
        : { ok: false, texto: "No he podido quitarle la marca: ese documento ya no está." };
    }

    if (a.clase === "ficha_cliente") {
      const r = await guardarIdentidad({
        tenantId,
        clienteId: a.clienteId,
        // `undefined` deja el campo como estaba; cadena vacía lo borra. Es lo que
        // permite que "quitar el NIF" y "poner el NIF" sean la misma acción.
        nif: a.nif,
        telefonos: a.telefono ? [a.telefono] : undefined,
        emails: a.email ? [a.email] : undefined,
      });
      if (!r.ok) return { ok: false, texto: r.error };
      return {
        ok: true,
        texto: `Apuntado: ${a.etiqueta}.` + (r.aviso ? ` Un aviso: ${r.aviso}` : ""),
      };
    }

    if (a.clase === "reclamar") {
      // Se llama a la MISMA ruta que usa el botón del panel, con sus tres
      // candados. Montar aquí un segundo camino de envío sería la forma más
      // rápida de saltarse el interruptor sin querer.
      const { reclamacionSendEnabled, textoReclamacion } = await import("./gestoria-conciliacion");
      const { listarMovimientos, guardarMovimientos } = await import("./gestoria-facturas");
      const movimientos = await listarMovimientos(tenantId);
      const elegidos = movimientos.filter((m) => a.movimientoIds.includes(m.id));
      if (!elegidos.length) return { ok: false, texto: "Esos cargos ya no están." };

      if (!reclamacionSendEnabled()) {
        const texto = elegidos.map((m) => textoReclamacion(m)).join("\n\n---\n\n");
        return {
          ok: true,
          texto:
            `El envío automático está apagado, así que no he mandado nada. Este es el mensaje preparado para ${a.etiqueta}, cópialo y mándalo tú:\n\n${texto}`,
        };
      }

      const { sendWhatsAppTemplate } = await import("./whatsapp-sender");
      const { paramsReclamacion, RECLAMACION_TEMPLATE, RECLAMACION_TEMPLATE_LANG } =
        await import("./gestoria-conciliacion");
      const { getTenant } = await import("./tenants");
      const clientes = await listarClientes(tenantId);
      const cliente = clientes.find((c) => c.id === a.clienteId);
      const t = await getTenant(tenantId).catch(() => null);
      if (!cliente?.telefono) return { ok: false, texto: `${a.etiqueta}: no tiene teléfono en su ficha.` };

      let enviados = 0;
      const ahora = new Date().toISOString();
      const marcados = new Set<string>();
      for (const m of elegidos) {
        const r = await sendWhatsAppTemplate(
          cliente.telefono,
          RECLAMACION_TEMPLATE,
          RECLAMACION_TEMPLATE_LANG,
          paramsReclamacion(cliente.nombre, t?.name ?? "tu gestoría", m),
        ).catch(() => ({ ok: false as const }));
        if (r.ok) { enviados++; marcados.add(m.id); }
      }
      if (marcados.size) {
        await guardarMovimientos(
          tenantId,
          movimientos.map((m) =>
            marcados.has(m.id)
              ? { ...m, pedido_a: cliente.telefono, pedido_canal: "whatsapp" as const, pedido_en: ahora }
              : m,
          ),
        );
      }
      return {
        ok: enviados > 0,
        texto: enviados
          ? `Reclamado: ${enviados} de ${elegidos.length} por WhatsApp a ${cliente.nombre}.`
          : `No he podido mandarle nada a ${cliente.nombre}. Míralo en la pantalla de conciliación.`,
      };
    }

    return { ok: false, texto: "No sé hacer eso." };
  } catch (e) {
    console.error("[gestoria/acciones]", e);
    return { ok: false, texto: `No he podido hacerlo: ${e instanceof Error ? e.message : "error"}` };
  }
}
