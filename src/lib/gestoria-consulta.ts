// Preguntarle a la gestoría en lenguaje normal.
//
// "¿Qué le falta a Bar El Puerto?", "¿qué vence la semana que viene?",
// "enséñame las facturas de agosto de Vega". Se contesta ahí mismo, en texto, y
// no se navega a ninguna pantalla.
//
// CÓMO FUNCIONA, Y POR QUÉ ASÍ
// ----------------------------
// El modelo NO recibe la base de datos entera. Recibe unas pocas funciones de
// consulta y las llama. Dos motivos, y los dos son serios:
//
//   1. Con cien clientes y cien facturas al mes por cliente, meter todo en el
//      contexto es imposible y además carísimo. Preguntar por un cliente tiene
//      que costar lo que cuesta mirar un cliente.
//   2. Si el modelo solo puede ver lo que las funciones devuelven, no puede
//      inventarse una factura que no existe. La barrera contra el invento no es
//      pedirle por favor que no invente: es no darle sitio donde hacerlo.
//
// Y CUANDO NO SABE, LO DICE. Un gestor que descubre que la respuesta era
// inventada no vuelve a usar el chat, y hace bien.

import "server-only";
import { anthropic, MODELS } from "./claude";
import { hoyMadrid, diasHasta } from "./gestoria-hoy";
import { construirAgenda } from "./gestoria-obligaciones";
import { listarFacturas, listarMovimientos } from "./gestoria-facturas";
import { listarClientes } from "./gestoria-clientes";
import { pagosSinFacturaPorCliente, resumenConciliacion } from "./gestoria-conciliacion";
import { estadoDeLaGestoria, estadoComoTexto } from "./gestoria-estado";
import type { AccionPendiente } from "./gestoria-acciones";
import { venceEl, fechaNatural, fechasEnCristiano } from "./gestoria-fechas";

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/** Un botón debajo de la respuesta. Lleva a una pantalla ya filtrada. */
export type Accion = { texto: string; href: string };

export type Respuesta = {
  texto: string;
  acciones: Accion[];
  /** Qué consultas ha hecho, para poder auditar de dónde sale la respuesta. */
  consultas: string[];
  /**
   * Lo que el chat propone HACER y está esperando un sí. La pantalla pinta el
   * botón de confirmar; hasta que no se pulsa, no ha cambiado nada.
   */
  pendiente?: { resumen: string; accion: AccionPendiente } | null;
};

// -----------------------------------------------------------------------------
// Las funciones que el modelo puede llamar
// -----------------------------------------------------------------------------

const HERRAMIENTAS = [
  {
    name: "buscar_cliente",
    description:
      "Encuentra clientes de la gestoría por nombre o por NIF. Úsala SIEMPRE antes de preguntar por un cliente concreto, para tener su identificador exacto.",
    input_schema: {
      type: "object" as const,
      properties: { texto: { type: "string", description: "Parte del nombre o el NIF" } },
      required: ["texto"],
    },
  },
  {
    name: "estado_de_cliente",
    description:
      "Todo lo de un cliente: sus vencimientos pendientes con fechas, sus documentos, lo que le falta y sus cargos del banco sin justificar.",
    input_schema: {
      type: "object" as const,
      properties: { clienteId: { type: "string", description: "El id exacto que devuelve buscar_cliente" } },
      required: ["clienteId"],
    },
  },
  {
    name: "obligaciones",
    description:
      "Los vencimientos pendientes de toda la gestoría, ordenados por fecha límite. Puedes acotar por días.",
    input_schema: {
      type: "object" as const,
      properties: {
        hastaDias: { type: "number", description: "Solo las que vencen dentro de N días. Sin esto, todas." },
        clienteId: { type: "string", description: "Solo las de un cliente." },
      },
    },
  },
  {
    name: "documentos",
    description:
      "Facturas y documentos guardados. Se puede filtrar por cliente, por mes (AAAA-MM) y por estado.",
    input_schema: {
      type: "object" as const,
      properties: {
        clienteId: { type: "string" },
        mes: { type: "string", description: "AAAA-MM. Filtra por la fecha de la factura." },
        soloSinIdentificar: { type: "boolean" },
        soloDuplicados: { type: "boolean" },
      },
    },
  },
  {
    name: "resumen_general",
    description:
      "El panorama de toda la gestoría: agenda, documentos y banco. Úsala para preguntas generales del tipo '¿cómo va todo?'.",
    input_schema: { type: "object" as const, properties: {} },
  },

  // --- ACCIONES: estas CAMBIAN datos ---------------------------------------
  // Ninguna ejecuta nada. Todas PREPARAN y devuelven una propuesta que el gestor
  // tiene que aprobar. Ver `gestoria-acciones.ts` para el porqué.
  {
    name: "preparar_marcar_hecho",
    description:
      "PREPARA marcar una obligación de la agenda como hecha. No la marca: devuelve una propuesta para que el gestor la apruebe. Úsala cuando te digan cosas como 'márcame hecho el 303 de Bar El Puerto' o 'ya presenté el 111'.",
    input_schema: {
      type: "object" as const,
      properties: {
        queCosa: { type: "string", description: "Lo que hay que marcar: '303', 'requerimiento', 'modelo 111'…" },
        deQuien: { type: "string", description: "El cliente, si lo dicen." },
      },
      required: ["queCosa"],
    },
  },
  {
    name: "preparar_asignar_documento",
    description:
      "PREPARA asignar un documento sin identificar a un cliente. Úsala con 'el documento sin identificar es de Distribuciones Vega'.",
    input_schema: {
      type: "object" as const,
      properties: {
        cliente: { type: "string", description: "Nombre del cliente al que va." },
        queDocumento: { type: "string", description: "Pista de cuál, si la dan: proveedor, importe, nombre del fichero." },
      },
      required: ["cliente"],
    },
  },
  {
    name: "preparar_resolver_conflicto",
    description:
      "PREPARA resolver un conflicto de NIF duplicado, dejándoselo al cliente al que de verdad pertenece y quitándoselo al otro.",
    input_schema: {
      type: "object" as const,
      properties: { clienteQueSeQueda: { type: "string", description: "El cliente de quien SÍ es ese NIF. Si no lo dicen, manda cadena vacía y te devolveré las opciones." } },
      required: ["clienteQueSeQueda"],
    },
  },
  {
    name: "preparar_no_es_duplicado",
    description: "PREPARA quitarle a un documento la marca de duplicado, para que vuelva a contar.",
    input_schema: {
      type: "object" as const,
      properties: { cual: { type: "string", description: "Pista de cuál: proveedor, importe o nombre." } },
    },
  },
  {
    name: "preparar_ficha_cliente",
    description:
      "PREPARA apuntar el NIF, un teléfono o un correo en la ficha de un cliente. Úsala con 'el NIF de Carmen es 12345678Z' o 'apúntale este teléfono a Vega'.",
    input_schema: {
      type: "object" as const,
      properties: {
        cliente: { type: "string" },
        nif: { type: "string" },
        telefono: { type: "string" },
        email: { type: "string" },
      },
      required: ["cliente"],
    },
  },
  {
    name: "preparar_reclamar",
    description:
      "PREPARA reclamarle por WhatsApp a un cliente las facturas que faltan de sus cargos del banco. Úsala con 'reclámale las facturas a Talleres Ruiz'.",
    input_schema: {
      type: "object" as const,
      properties: { cliente: { type: "string" } },
      required: ["cliente"],
    },
  },
] as const;

type Args = Record<string, unknown>;

/** Lo que una herramienta le devuelve al modelo, más la acción si la preparó. */
type SalidaHerramienta = { texto: string; propuesta?: { resumen: string; accion: AccionPendiente } };

/**
 * Las acciones se preparan aquí y NO se ejecutan.
 *
 * Devuelven al modelo una frase para que se la lea al gestor, y aparte la acción
 * ya resuelta, que se guarda para cuando el gestor diga que sí. El modelo nunca
 * toca los datos: como mucho, propone.
 */
async function prepararAccion(tenantId: string, nombre: string, args: Args): Promise<SalidaHerramienta | null> {
  const A = await import("./gestoria-acciones");
  const str = (k: string) => {
    const v = args[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };

  let r: import("./gestoria-acciones").Preparada | null = null;
  if (nombre === "preparar_marcar_hecho") r = await A.prepararMarcarHecho(tenantId, str("queCosa") ?? "", str("deQuien"));
  else if (nombre === "preparar_asignar_documento") r = await A.prepararAsignarDocumento(tenantId, str("cliente") ?? "", str("queDocumento"));
  else if (nombre === "preparar_resolver_conflicto") r = await A.prepararResolverConflicto(tenantId, str("clienteQueSeQueda") ?? "");
  else if (nombre === "preparar_no_es_duplicado") r = await A.prepararNoEsDuplicado(tenantId, str("cual"));
  else if (nombre === "preparar_ficha_cliente") r = await A.prepararFichaCliente(tenantId, str("cliente") ?? "", { nif: str("nif"), telefono: str("telefono"), email: str("email") });
  else if (nombre === "preparar_reclamar") r = await A.prepararReclamar(tenantId, str("cliente") ?? "");
  else return null;

  if (r.tipo === "propuesta") {
    return {
      texto: `PROPUESTA LISTA. Dile al gestor exactamente esto y pídele que confirme: "${r.resumen}". No digas que ya está hecho: no lo está hasta que él confirme.`,
      propuesta: { resumen: r.resumen, accion: r.accion },
    };
  }
  if (r.tipo === "ambiguo") {
    return { texto: `NO ESTÁ CLARO A QUÉ SE REFIERE. Pregúntaselo: ${r.pregunta}\nOpciones:\n- ${r.opciones.join("\n- ")}` };
  }
  return { texto: r.tipo === "error" ? `NO SE PUEDE: ${r.motivo}` : `NO HAY NADA QUE HACER: ${r.motivo}` };
}

async function ejecutar(tenantId: string, nombre: string, args: Args): Promise<string> {
  const clientes = await listarClientes(tenantId).catch(() => []);
  const nombreDe = (id: string | null | undefined) =>
    clientes.find((c) => c.id === id)?.nombre ?? (id || "sin cliente");

  if (nombre === "buscar_cliente") {
    const q = String(args.texto || "").toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, "");
    if (!q) return "Dime qué cliente buscas.";
    const hallados = clientes.filter((c) => {
      const n = c.nombre.toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, "");
      const nif = (c.nif || "").toLowerCase();
      return n.includes(q) || q.includes(n) || (nif && nif.includes(q));
    });
    if (!hallados.length) return `No hay ningún cliente que case con "${args.texto}". Los que hay: ${clientes.map((c) => c.nombre).join(", ") || "ninguno"}.`;
    return hallados.map((c) => `id "${c.id}": ${c.nombre}${c.nif ? ` (NIF ${c.nif})` : " (sin NIF en su ficha)"}`).join("\n");
  }

  if (nombre === "estado_de_cliente") {
    const id = String(args.clienteId || "");
    const c = clientes.find((x) => x.id === id);
    if (!c) return `No existe ningún cliente con id "${id}".`;

    const [agenda, facturas, movimientos] = await Promise.all([
      construirAgenda(tenantId),
      listarFacturas(tenantId, id),
      listarMovimientos(tenantId, id),
    ]);
    const suyas = agenda.filter((l) => !l.hecho && l.clienteId === id);
    const docs = facturas.filter((f) => f.estado !== "descartada" && !f.duplicado_de);
    const cargos = movimientos.filter((m) => m.signo === "cargo" && m.estado !== "conciliado" && m.estado !== "ignorado");
    const sinFactura = pagosSinFacturaPorCliente(movimientos, facturas).find((g) => g.clienteId === id);

    const l = [`CLIENTE: ${c.nombre}${c.nif ? ` · NIF ${c.nif}` : " · sin NIF en su ficha"}`];
    l.push(`\nVencimientos pendientes (${suyas.length}):`);
    if (!suyas.length) l.push("  ninguna");
    for (const x of suyas.slice(0, 12)) {
      l.push(`  - ${x.titulo} · ${venceEl(x.vence, x.dias)}${x.critico ? " · CRÍTICO" : ""}`);
    }
    l.push(`\nDocumentos guardados: ${docs.length}. Sin leer: ${docs.filter((f) => !f.lectura).length}. Duplicados marcados: ${facturas.filter((f) => f.duplicado_de).length}.`);

    // Los dos grupos NO se solapan y hay que decirlo, porque puestos uno debajo
    // del otro se leen como si el segundo explicara el primero. Ya pasó: el chat
    // contestó que "los 524 cargos ya tienen albarán", y no tienen nada.
    l.push(
      `\nBANCO — son DOS grupos distintos que NO se solapan:`,
    );
    l.push(
      `  (a) Cargos SIN NINGÚN DOCUMENTO que los justifique: ${cargos.length} (${euros(cargos.reduce((s, m) => s + m.importe, 0))}). De estos no hay ni albarán ni ticket ni nada: están sin cruzar con nada. Es el estado normal de un extracto que todavía no se ha conciliado, no una emergencia.`,
    );
    l.push(
      sinFactura
        ? `  (b) Pagos que SÍ tienen un papel, pero es un albarán o un ticket en vez de una factura: ${sinFactura.cuantos} (${euros(sinFactura.total)}). Estos son los que hay que reclamarle al cliente: el gasto está pagado pero no deduce IVA.`
        : `  (b) Pagos documentados solo con albarán o ticket: ninguno.`,
    );
    return l.join("\n");
  }

  if (nombre === "obligaciones") {
    const agenda = (await construirAgenda(tenantId)).filter((l) => !l.hecho);
    let xs = agenda;
    if (args.clienteId) xs = xs.filter((l) => l.clienteId === String(args.clienteId));
    if (typeof args.hastaDias === "number") {
      xs = xs.filter((l) => l.dias !== null && l.dias <= (args.hastaDias as number));
    }
    if (!xs.length) return "No hay ningún vencimiento pendiente que cumpla eso.";
    return xs
      .slice(0, 25)
      .map((l) => `- ${l.titulo} · ${nombreDe(l.clienteId)} · ${venceEl(l.vence, l.dias)}${l.critico ? " · CRÍTICO" : ""}`)
      .join("\n");
  }

  if (nombre === "documentos") {
    const todas = await listarFacturas(tenantId, args.clienteId ? String(args.clienteId) : undefined);
    let xs = todas.filter((f) => f.estado !== "descartada");
    if (args.soloSinIdentificar) xs = xs.filter((f) => !f.cliente_id);
    if (args.soloDuplicados) xs = xs.filter((f) => !!f.duplicado_de);
    if (args.mes) xs = xs.filter((f) => (f.fecha_factura || "").startsWith(String(args.mes)));
    if (!xs.length) return "No hay ningún documento que cumpla eso.";

    const cuentan = xs.filter((f) => !f.duplicado_de);
    const total = cuentan.reduce((s, f) => s + (f.importe ?? 0), 0);
    const l = [`${xs.length} documento(s). Suman ${euros(total)} (sin contar duplicados).`];
    for (const f of xs.slice(0, 20)) {
      l.push(
        `- ${f.proveedor ?? f.nombre_original} · ${f.importe != null ? euros(f.importe) : "sin importe"} · ${f.fecha_factura ? fechaNatural(f.fecha_factura) : "sin fecha"} · ${f.clase ?? "sin clasificar"} · ${nombreDe(f.cliente_id)}${f.duplicado_de ? " · DUPLICADO, no cuenta" : ""}`,
      );
    }
    return l.join("\n");
  }

  if (nombre === "resumen_general") {
    const facturas = await listarFacturas(tenantId);
    const movimientos = await listarMovimientos(tenantId);
    const e = await estadoDeLaGestoria(tenantId, "");
    const r = resumenConciliacion(movimientos, facturas);
    return `${estadoComoTexto(e)}\n\nCONCILIACIÓN: ${r.conciliados.length} cargos cuadrados con su factura, ${r.cargosSinFactura.length} sin justificar (${euros(r.sumaSinFactura)}), ${r.facturasSinMovimiento.length} facturas sin cargo que las pague, ${r.sugerencias.length} parejas propuestas a falta de un clic.`;
  }

  return `No conozco esa consulta: ${nombre}.`;
}

// -----------------------------------------------------------------------------
// La conversación
// -----------------------------------------------------------------------------

const SISTEMA = (hoy: string, gestoria: string) => `Eres la secretaria de ${gestoria}, una gestoría española. Hoy es ${hoy}.

Contestas al gestor lo que te pregunta sobre SUS datos. Tienes funciones para consultarlos: úsalas siempre antes de responder. Puedes llamar a varias.

CÓMO CONTESTAS:
- Español de España, tuteando. Frases cortas. Como quien contesta de viva voz.
- LLÁMALO "VENCIMIENTOS", nunca "obligaciones": es la palabra que usa un gestor de verdad.
- A la pantalla donde caen los documentos llámala "el saco de facturas", no "Facturas" a secas: es donde cae TODO lo que entra, venga por WhatsApp, por correo o subido a mano.
- Registro PROFESIONAL, aunque sea cercano. Nada de "hermano", "tío", "colega", "chaval" ni coletillas de bar. Eres su secretaria, no su cuñado: le hablas con confianza pero delante de un cliente no tendría que sonrojarse.
- Directo al dato: nombres de clientes, importes y fechas concretas.
- Si la respuesta son varias cosas, una lista corta está bien. Si es una, una frase.
- Sin exclamaciones, sin emojis, sin vocabulario de software.
- TEXTO PLANO. Nada de asteriscos, negritas, almohadillas ni markdown: esto se pinta tal cual y los asteriscos se ven. Para una lista, un guion al principio de la línea y ya.
- Las fechas y los plazos, COPIADOS TAL CUAL de lo que te devuelven las funciones. Ya vienen escritas en español ("el lunes 24 de agosto"): no las reescribas, no las pases a números, no calcules tú el día de la semana ni si algo es mañana. Cada vez que lo has hecho de cabeza te has equivocado.
- NUNCA escribas una fecha con guiones (2026-08-24). Si en algún sitio te llega así, dila como "24 de agosto".

LO MÁS IMPORTANTE:
- NO TE INVENTES NADA. Si las funciones no devuelven el dato, di que no lo tienes y qué haría falta para tenerlo.
- No mezcles dos cifras distintas como si fueran la misma, ni supongas que una explica la otra. Cada cifra que te devuelven dice a qué se refiere: respétalo literalmente.
- Si te preguntan por un cliente, búscalo primero con buscar_cliente. Si no aparece, dilo: no supongas cuál es.
- No des consejos fiscales ni interpretes la ley. Tú dices lo que hay en los datos.
- Si la pregunta no va de la gestoría, dilo en una frase y ya.

CUANDO TE PIDEN HACER ALGO (marcar hecho, asignar, apuntar un NIF, reclamar):
- Usa la herramienta "preparar_..." que toque. Esas herramientas NO hacen nada: dejan la acción propuesta.
- Después, dile al gestor en una línea qué vas a hacer y pídele que lo confirme. Tal cual te lo devuelve la herramienta.
- NUNCA digas que ya está hecho, ni "listo", ni "marcado", ni "hecho": no lo está. Está esperando su confirmación, y él la da con un botón.
- Si la herramienta te dice que no está claro a qué se refiere, PREGÚNTASELO con las opciones que te da. No elijas tú.
- Si te dice que no se puede, explícale por qué en una línea.`;

/** Máximo de vueltas de consulta. Sin tope, una pregunta rara podría no acabar. */
const MAX_VUELTAS = 5;

export async function preguntar(opts: {
  tenantId: string;
  gestoria: string;
  pregunta: string;
  /** El hilo anterior, para poder decir "y de ese, ¿qué más?". */
  historial?: Array<{ rol: "usuario" | "secretaria"; texto: string }>;
}): Promise<Respuesta> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      texto: "No puedo contestar: falta la clave de la IA en el servidor. Avisa al administrador de AI-Team.",
      acciones: [],
      consultas: [],
    };
  }

  const consultas: string[] = [];
  let pendiente: { resumen: string; accion: AccionPendiente } | null = null;
  const mensajes: Array<{ role: "user" | "assistant"; content: unknown }> = [];

  // El hilo previo, recortado: con seis intervenciones ya hay contexto de sobra
  // y cada una que se añade se paga en cada pregunta siguiente.
  for (const h of (opts.historial ?? []).slice(-6)) {
    mensajes.push({ role: h.rol === "usuario" ? "user" : "assistant", content: h.texto });
  }
  mensajes.push({ role: "user", content: opts.pregunta });

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const res = await anthropic.messages.create(
        {
          model: MODELS.fast,
          max_tokens: 1200,
          system: SISTEMA(hoyMadrid(), opts.gestoria),
          tools: HERRAMIENTAS as never,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: mensajes as any,
        },
        { timeout: 45_000 },
      );

      const { anotarLectura } = await import("./gestoria-coste");
      await anotarLectura({
        tenantId: opts.tenantId, modelo: MODELS.fast,
        entrada: res.usage.input_tokens, salida: res.usage.output_tokens,
      }).catch(() => {});

      const usos = res.content.filter((b) => b.type === "tool_use");
      if (!usos.length) {
        const texto = res.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("")
          .trim();
        return {
          // ÚLTIMO FILTRO. Da igual quién haya escrito la fecha —una función de
          // consulta, una de acción, o el propio modelo copiando algo mal—: por
          // aquí pasa todo lo que va a leer el gestor, y aquí no salen guiones.
          texto: fechasEnCristiano(texto || "No he sabido contestar a eso."),
          // Con una propuesta encima de la mesa NO se ofrecen atajos a otras
          // pantallas: lo único que toca es decir sí o no.
          acciones: pendiente ? [] : accionesDe(opts.pregunta, texto),
          consultas,
          pendiente,
        };
      }

      mensajes.push({ role: "assistant", content: res.content });
      const resultados = [];
      for (const u of usos) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uu = u as any;
        consultas.push(`${uu.name}(${JSON.stringify(uu.input)})`);

        // Primero se mira si es una ACCIÓN: esas se preparan, no se ejecutan.
        const preparada: SalidaHerramienta | null = await prepararAccion(
          opts.tenantId, uu.name, uu.input as Args,
        ).catch((e) => ({ texto: `Error preparando: ${e instanceof Error ? e.message : String(e)}` }));
        if (preparada) {
          // Solo una propuesta viva a la vez: dos botones de confirmar en la
          // misma respuesta es pedirle al gestor que apruebe a ciegas.
          if (preparada.propuesta && !pendiente) pendiente = preparada.propuesta;
          resultados.push({ type: "tool_result", tool_use_id: uu.id, content: preparada.texto });
          continue;
        }

        const salida = await ejecutar(opts.tenantId, uu.name, uu.input as Args).catch(
          (e) => `Error consultando: ${e instanceof Error ? e.message : String(e)}`,
        );
        resultados.push({ type: "tool_result", tool_use_id: uu.id, content: salida });
      }
      mensajes.push({ role: "user", content: resultados });
    }

    return {
      texto: "Me he liado dando vueltas a esa pregunta. Pruébame con algo más concreto.",
      acciones: [],
      consultas,
      pendiente: null,
    };
  } catch (e) {
    console.error("[gestoria/consulta]", e);
    return {
      texto: "No he podido contestar ahora mismo. Inténtalo otra vez en un momento.",
      acciones: [],
      consultas,
      pendiente: null,
    };
  }
}

/**
 * Los botones de debajo de la respuesta.
 *
 * Se deciden AQUÍ, con reglas, y no se le piden al modelo: un botón que lleva a
 * una pantalla que no existe es peor que no tener botón, y un modelo inventando
 * URLs las inventa. Son pocas y llevan a sitios que existen de verdad.
 */
function accionesDe(pregunta: string, respuesta: string): Accion[] {
  const t = `${pregunta} ${respuesta}`.toLowerCase();
  const out: Accion[] = [];

  if (/albar[áa]n|sin factura|falta.*factura|ticket/.test(t)) {
    out.push({ texto: "Ver los pagos sin factura", href: "/dashboard/facturas" });
  }
  if (/vence|plazo|obligaci|requerimiento|aplazamiento|modelo (111|115|303|130)|trimestr/.test(t)) {
    out.push({ texto: "Abrir los vencimientos", href: "/dashboard/clientes" });
  }
  if (/duplicad/.test(t)) {
    out.push({ texto: "Ver los duplicados en el saco", href: "/dashboard/facturas" });
  }
  if (/sin identificar|sin asignar|no se sabe de qui[ée]n/.test(t)) {
    out.push({ texto: "Ver los sin identificar", href: "/dashboard/facturas" });
  }
  if (/banco|cargo|concilia|extracto/.test(t)) {
    out.push({ texto: "Abrir la conciliación", href: "/dashboard/facturas/conciliacion" });
  }
  // Antes había aquí un botón a "Fichas de clientes". Se ha quitado: poner un
  // NIF o un teléfono ya se pide escribiendo, y mandar al gestor a la pantalla
  // de Expedientes para eso es devolverlo al ERP del que se viene huyendo.

  // Dos como mucho: tres botones debajo de un párrafo ya es un menú.
  const vistos = new Set<string>();
  return out.filter((a) => !vistos.has(a.href) && vistos.add(a.href)).slice(0, 2);
}

export { diasHasta };
