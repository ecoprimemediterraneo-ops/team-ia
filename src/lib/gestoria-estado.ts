// TODO lo que pasa hoy en la gestoría, en un solo objeto.
//
// PARA QUÉ: la portada le cuenta a Jose cómo está el día en tres frases, y el
// chat le contesta preguntas. Las dos cosas necesitan lo mismo — obligaciones,
// facturas, documentos, banco — y si cada una lo recogiera por su cuenta
// acabarían contando cifras distintas del mismo día. Un solo sitio que mira, y
// los dos leen de ahí.
//
// NO CALCULA NADA NUEVO. Todo sale de los módulos que ya existen: la agenda de
// `gestoria-obligaciones`, las facturas de `gestoria-facturas`, el cruce de
// `gestoria-conciliacion`, los duplicados de `gestoria-duplicados`. Aquí solo se
// junta y se cuenta. Si un número de la portada no cuadra con el de su pantalla,
// es que hay un fallo — no dos formas de contar.

import "server-only";
import { hoyMadrid } from "./gestoria-hoy";
import { construirAgenda, type LineaAgenda } from "./gestoria-obligaciones";
import { venceEl, fechaNatural } from "./gestoria-fechas";
import { listarFacturas, listarMovimientos } from "./gestoria-facturas";
import { listarClientes } from "./gestoria-clientes";
import { duplicadosDelMes } from "./gestoria-duplicados";
import { pagosSinFacturaPorCliente } from "./gestoria-conciliacion";

export type EstadoGestoria = {
  hoy: string;
  /** Nombre de la gestoría, para poder saludar. */
  gestoria: string;
  clientes: number;
  /** Clientes sin NIF: sus facturas no se colocan solas. */
  clientesSinNif: number;

  agenda: {
    total: number;
    vencidas: LineaAgenda[];
    /** Vence en 3 días o menos. */
    urgentes: LineaAgenda[];
    /** Vence esta semana. */
    estaSemana: LineaAgenda[];
    /** Un plazo que no se ha podido leer: hay que mirarlo. */
    sinFecha: LineaAgenda[];
    /** Requerimientos y aplazamientos: si caducan, dejan de ser un trámite. */
    criticas: LineaAgenda[];
    /** Las que salieron de un correo oficial. */
    delCorreo: LineaAgenda[];
    /** Las diez primeras, para poder nombrarlas. */
    proximas: LineaAgenda[];
  };

  documentos: {
    /** Han entrado hoy. */
    hoy: number;
    /** Colocadas solas en su cliente, sin que Jose toque nada. */
    colocadasSolas: number;
    sinIdentificar: number;
    enConflicto: number;
    duplicadosMes: number;
    /** Han entrado y todavía no se han podido leer. */
    sinLeer: number;
  };

  banco: {
    /** Cargos sin ninguna factura que los justifique. */
    cargosSinFactura: number;
    importeSinJustificar: number;
    /** Pagos que cuadran con un albarán o un ticket: falta la factura buena. */
    pagadoSinFactura: Array<{ cliente: string; cuantos: number; total: number }>;
  };
};

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/** Todo el estado del día. Nunca lanza: la portada no puede quedarse en blanco. */
export async function estadoDeLaGestoria(
  tenantId: string,
  nombreGestoria: string,
): Promise<EstadoGestoria> {
  const hoy = hoyMadrid();

  const [agenda, facturas, movimientos, clientes] = await Promise.all([
    construirAgenda(tenantId).catch(() => [] as LineaAgenda[]),
    listarFacturas(tenantId).catch(() => []),
    listarMovimientos(tenantId).catch(() => []),
    listarClientes(tenantId).catch(() => []),
  ]);

  const vivas = agenda.filter((l) => !l.hecho);
  const docsVivos = facturas.filter((f) => f.estado !== "descartada");
  const cuentan = docsVivos.filter((f) => !f.duplicado_de);

  const cargosSinFactura = movimientos.filter(
    (m) => m.signo === "cargo" && m.estado !== "conciliado" && m.estado !== "ignorado",
  );

  const sinFacturaPorCliente = pagosSinFacturaPorCliente(movimientos, facturas);
  const nombreDe = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? id;

  return {
    hoy,
    gestoria: nombreGestoria,
    clientes: clientes.length,
    clientesSinNif: clientes.filter((c) => !c.nif).length,

    agenda: {
      total: vivas.length,
      vencidas: vivas.filter((l) => l.apremio === "vencido"),
      urgentes: vivas.filter((l) => l.apremio === "rojo"),
      estaSemana: vivas.filter((l) => l.apremio === "ambar"),
      sinFecha: vivas.filter((l) => l.apremio === "sin_fecha"),
      criticas: vivas.filter((l) => l.critico),
      delCorreo: vivas.filter((l) => !!l.correoId),
      proximas: vivas.slice(0, 10),
    },

    documentos: {
      hoy: docsVivos.filter((f) => (f.fecha_recepcion || "").slice(0, 10) === hoy).length,
      colocadasSolas: cuentan.filter((f) => f.cliente_id && f.asignado_por && f.asignado_por !== "manual").length,
      sinIdentificar: cuentan.filter((f) => !f.cliente_id).length,
      enConflicto: cuentan.filter((f) => !f.cliente_id && f.conflicto).length,
      duplicadosMes: duplicadosDelMes(docsVivos, hoy).length,
      sinLeer: cuentan.filter((f) => !f.lectura).length,
    },

    banco: {
      cargosSinFactura: cargosSinFactura.length,
      importeSinJustificar: cargosSinFactura.reduce((s, m) => s + m.importe, 0),
      pagadoSinFactura: sinFacturaPorCliente.map((g) => ({
        cliente: nombreDe(g.clienteId),
        cuantos: g.cuantos,
        total: g.total,
      })),
    },
  };
}

/**
 * El estado escrito en texto plano, para dárselo al modelo.
 *
 * Se le dan los DATOS, no un resumen ya hecho: si aquí se escribiera "el día
 * está tranquilo", el modelo solo lo estaría repitiendo y el resumen dejaría de
 * depender de lo que pasa de verdad.
 */
export function estadoComoTexto(e: EstadoGestoria): string {
  const l: string[] = [];
  l.push(`Hoy es ${fechaNatural(e.hoy, e.hoy)}. Gestoría: ${e.gestoria}. ${e.clientes} clientes.`);

  l.push(`\nAGENDA (${e.agenda.total} pendientes):`);
  const listar = (titulo: string, xs: LineaAgenda[]) => {
    if (!xs.length) return;
    l.push(`  ${titulo}:`);
    for (const x of xs.slice(0, 8)) {
      l.push(`    - ${x.titulo} · ${x.clienteNombre ?? "sin cliente asignado"} · ${venceEl(x.vence, x.dias, e.hoy)}${x.critico ? " · CRÍTICO" : ""}`);
    }
  };
  listar("Ya vencidas", e.agenda.vencidas);
  listar("Vencen en 3 días o menos", e.agenda.urgentes);
  listar("Vencen esta semana", e.agenda.estaSemana);
  listar("Sin fecha límite leída (hay que mirarlas)", e.agenda.sinFecha);
  if (e.agenda.delCorreo.length) l.push(`  ${e.agenda.delCorreo.length} salieron de un correo oficial.`);
  if (!e.agenda.vencidas.length && !e.agenda.urgentes.length && !e.agenda.estaSemana.length) {
    l.push("  Nada vence en los próximos 7 días.");
  }

  // Cada cifra dice EXACTAMENTE a qué se refiere y en qué periodo. Sin esto, el
  // modelo juntaba "entrados hoy" con "colocados solos" y escribía "dos entradas
  // hoy colocadas automáticamente" con cero entradas hoy. Un dato ambiguo se lee
  // mal, y en la primera línea de la pantalla eso es mentir.
  l.push(`\nDOCUMENTOS:`);
  l.push(`  Han entrado HOY: ${e.documentos.hoy}`);
  l.push(`  Colocados solos en su cliente por NIF o teléfono, EN TOTAL desde siempre (no solo hoy): ${e.documentos.colocadasSolas}`);
  l.push(`  Sin identificar ahora mismo (no se sabe de quién son): ${e.documentos.sinIdentificar}${e.documentos.enConflicto ? `, de los cuales ${e.documentos.enConflicto} porque el mismo NIF está en dos fichas` : ""}`);
  l.push(`  Guardados pero sin leer todavía: ${e.documentos.sinLeer}`);
  l.push(`  Duplicados detectados en el mes en curso: ${e.documentos.duplicadosMes}`);
  if (e.clientesSinNif) {
    l.push(`  Clientes sin NIF en su ficha: ${e.clientesSinNif} de ${e.clientes}. Consecuencia y ninguna otra: sus facturas no se colocan solas y caen en "sin identificar". No tiene nada que ver con el banco.`);
  }

  l.push(`\nBANCO (esto es conciliación pendiente, NO una emergencia):`);
  l.push(`  Cargos del extracto que todavía no se han cruzado con ninguna factura: ${e.banco.cargosSinFactura} (${euros(e.banco.importeSinJustificar)}). Es el estado normal de un extracto sin conciliar.`);
  if (e.banco.pagadoSinFactura.length) {
    l.push(`  Pagados con albarán o ticket en vez de con factura:`);
    for (const g of e.banco.pagadoSinFactura.slice(0, 5)) {
      l.push(`    - ${g.cliente}: ${g.cuantos} documento(s), ${euros(g.total)}`);
    }
  }

  return l.join("\n");
}

/**
 * La frase de la barra de arriba: lo más urgente que haya, o null.
 *
 * Se escribe AQUÍ y no con IA a propósito: es la línea que Jose va a leer de
 * refilón cien veces, tiene que decir siempre lo mismo con las mismas palabras y
 * no puede depender de que un modelo esté de buen humor ni de que responda.
 */
export function fraseUrgente(e: EstadoGestoria): { texto: string; href: string } | null {
  const candidatas = [...e.agenda.vencidas, ...e.agenda.urgentes];
  if (!candidatas.length) return null;

  // La primera de la lista ya viene ordenada por fecha límite.
  const x = candidatas[0];
  const cuando =
    x.dias === null ? "sin fecha"
    : x.dias < 0 ? `venció hace ${Math.abs(x.dias)} día${Math.abs(x.dias) === 1 ? "" : "s"}`
    : x.dias === 0 ? "vence hoy"
    : x.dias === 1 ? "vence mañana"
    : `vence el ${fechaNatural(x.vence, e.hoy)}`;

  const dequien = x.clienteNombre ? ` de ${x.clienteNombre}` : "";
  const resto = candidatas.length - 1;
  const cola = resto > 0 ? ` · y ${resto} más ${resto === 1 ? "apretando" : "apretando"}` : "";

  return {
    texto: `${cuando[0].toUpperCase()}${cuando.slice(1)}: ${x.titulo}${dequien}${cola}`,
    href: "/dashboard/clientes",
  };
}

// -----------------------------------------------------------------------------
// Los ASUNTOS del día, ordenados por lo que de verdad aprieta
// -----------------------------------------------------------------------------
//
// El resumen dejó de ser un párrafo. Un párrafo de cinco frases seguidas no se
// lee: se empieza, se pierde el hilo a la segunda y se abandona. Ahora es una
// lista de puntos, y para que sea una lista hay que decidir QUÉ puntos y EN QUÉ
// ORDEN. Eso se decide aquí, en código, no pidiéndoselo al modelo.
//
// POR QUÉ NO SE LE PIDE AL MODELO: se le pidió, con el orden escrito en el
// prompt, y unas veces obedecía y otras empezaba por los cargos del banco.
// Lo que ordena el día de un gestor no puede depender de eso. El modelo redacta
// cada punto; cuáles y en qué orden, no lo decide él.

export type Asunto = {
  /** Para ordenar: cuanto más bajo, antes. */
  peso: number;
  /** Los datos crudos con los que el modelo redactará la línea. */
  texto: string;
};

/**
 * Todo lo que merece una línea, de lo más urgente a lo menos.
 *
 * EL ORDEN ES LA FECHA. Lo vencido primero, y después lo que venza antes. Punto.
 *
 * Se probó a subir lo CRÍTICO por encima —requerimientos, aplazamientos— y
 * quedaba mal: un requerimiento a catorce días aparecía por encima de un
 * contrato que vencía en cinco, y una lista que dice estar ordenada por urgencia
 * y no lo está deja de poder leerse de un vistazo, que es lo único que tiene que
 * saber hacer. Lo crítico se marca en su propia línea; no se cuela delante.
 *
 * Al final, y solo al final, lo que no tiene fecha: facturas que faltan de pagos
 * ya hechos, documentos sin identificar y duplicados. Es trabajo real, pero
 * ninguno caduca esta semana.
 */
export function asuntosDelDia(e: EstadoGestoria): Asunto[] {
  const out: Asunto[] = [];
  const linea = (l: LineaAgenda) =>
    `${l.titulo} · cliente: ${l.clienteNombre ?? "sin asignar"} · ${venceEl(l.vence, l.dias, e.hoy)}${l.critico ? " · CRÍTICO" : ""}`;

  // Un asunto no puede salir dos veces: lo vencido que además es crítico sale
  // una sola vez.
  const yaPuesto = new Set<string>();
  const candidatas: LineaAgenda[] = [];
  for (const l of [
    ...e.agenda.vencidas,
    ...e.agenda.urgentes,
    ...e.agenda.criticas,
    ...e.agenda.estaSemana,
    ...e.agenda.sinFecha,
  ]) {
    if (yaPuesto.has(l.id)) continue;
    yaPuesto.add(l.id);
    candidatas.push(l);
  }

  // AGRUPADO, igual que en la pantalla. Con cien clientes, cinco de los cinco
  // puntos del resumen serían el mismo modelo 303 cambiando el nombre, y no
  // quedaría sitio para el requerimiento que sí es único. Una línea que diga
  // "el 303 de 87 clientes" deja las otras cuatro para lo que de verdad varía.
  const porTipo = new Map<string, LineaAgenda[]>();
  const orden: string[] = [];
  for (const l of candidatas) {
    const k = `${l.tipo}|${l.titulo}|${l.vence ?? "sin"}`;
    if (!porTipo.has(k)) { porTipo.set(k, []); orden.push(k); }
    porTipo.get(k)!.push(l);
  }

  for (const k of orden) {
    const xs = porTipo.get(k)!;
    const p = xs[0];
    // El peso ES la fecha: los días que faltan. Lo vencido sale negativo y por
    // tanto primero, que es justo lo que se quiere. Lo que no tiene fecha leída
    // se queda con los demás sin fecha, al final.
    const peso = p.dias ?? 9000;
    if (xs.length === 1 || !p.clienteId) {
      for (const l of xs) out.push({ peso, texto: linea(l) });
      continue;
    }
    out.push({
      peso,
      texto: `${p.titulo} · ${xs.length} clientes · ${venceEl(p.vence, p.dias, e.hoy)}${xs.some((x) => x.critico) ? " · CRÍTICO" : ""}`,
    });
  }

  // Lo que no caduca, después de todo lo que sí. Los pesos son mayores que
  // cualquier plazo real para que nunca se cuelen delante de una fecha.
  for (const g of e.banco.pagadoSinFactura) {
    out.push({
      peso: 9100,
      texto: `A ${g.cliente} le faltan ${g.cuantos} factura(s) de pagos que ya están hechos, ${euros(g.total)} · sin fecha límite`,
    });
  }

  if (e.documentos.sinIdentificar) {
    out.push({
      peso: 9200,
      texto:
        `${e.documentos.sinIdentificar} documento(s) sin identificar: no se sabe de qué cliente son` +
        (e.documentos.enConflicto ? `, ${e.documentos.enConflicto} porque el mismo NIF está en dos fichas` : "") +
        " · sin fecha límite",
    });
  }

  if (e.documentos.duplicadosMes) {
    out.push({
      peso: 9300,
      texto: `${e.documentos.duplicadosMes} duplicado(s) detectados este mes, ya marcados para que no cuenten dos veces · sin fecha límite`,
    });
  }

  return out.sort((a, b) => a.peso - b.peso);
}
