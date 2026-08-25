// La FECHA LÍMITE que trae un correo oficial.
//
// El correo importante ya se marca por REMITENTE: si escribe Hacienda, la
// Seguridad Social, el ayuntamiento o un juzgado, el correo salta. Eso dice que
// hay que mirarlo; no dice CUÁNDO vence. Y lo que ordena el día del gestor es
// la fecha, no quién escribe.
//
// Aquí se lee el texto y se saca el plazo. Tres reglas, y las tres son de no
// inventar:
//
//   1. Si NO hay fecha, se dice y se deja sin plazo. Una fecha inventada en una
//      lista ordenada por fecha es peor que no tener fecha: coloca el trabajo en
//      el sitio equivocado y el gestor se fía.
//   2. Si no se sabe de qué cliente es, va SIN cliente. Atribuir mal un
//      vencimiento fiscal es peor que dejarlo sin dueño.
//   3. Solo se eligen clientes de la lista que se le pasa. No se inventan
//      nombres a partir del texto.

import "server-only";
import { anthropic, MODELS } from "./claude";

export type PlazoCorreo = {
  /** "AAAA-MM-DD" o null si el correo no lo dice. */
  fechaLimite: string | null;
  /** Cómo se ha llegado a esa fecha: la traía el correo o se ha calculado. */
  fechaCalculada?: boolean;
  /** El plazo tal y como lo escribe el correo, para poder enseñarlo. */
  plazo?: { dias: number; habiles: boolean; desde: string } | null;
  /** El NIF que venía en el correo, sin normalizar. */
  nifEnElCorreo?: string | null;
  /** Por qué se ha atribuido a ese cliente. Dato duro o nada. */
  motivoCliente?: string | null;
  /** Por qué esa fecha, o por qué no hay ninguna. Se enseña al gestor. */
  porQue: string;
  /** De qué va, en una línea que se entienda sin abrir el correo. */
  deQueVa: string;
  /** Id del cliente (su teléfono en dígitos) o null. Nunca se fuerza. */
  clienteId: string | null;
  clienteNombre: string | null;
  /** Pago, presentación, requerimiento, notificación… tal y como lo llama el correo. */
  tipo: string | null;
  modelo: string;
  tokens?: { entrada: number; salida: number };
};

export type ResultadoPlazo = { ok: true; plazo: PlazoCorreo } | { ok: false; error: string };

const INSTRUCCIONES = `Eres el ayudante de una gestoría española. Te dan un correo de un organismo oficial (Hacienda, Seguridad Social, un ayuntamiento, un juzgado) y una lista de clientes de la gestoría.

Saca TRES cosas:

1. La FECHA LÍMITE de pago o de presentación, si el correo la dice. En formato AAAA-MM-DD.
   - Si no hay ninguna fecha límite, pon null. NO INVENTES UNA FECHA. Es la regla más importante.
   - Una fecha de emisión, de registro o de la propia notificación NO es una fecha límite.

2. EL PLAZO RELATIVO, si el correo lo da en vez de una fecha ("diez días hábiles desde la
   notificación", "quince días naturales"). NO lo calcules tú: dime los tres datos y ya lo
   calculo yo, que sé qué días son hábiles.
   - plazoDias: el número de días.
   - plazoHabiles: true si dice "hábiles", false si dice "naturales" o no lo aclara.
   - plazoDesde: la fecha desde la que corre, en AAAA-MM-DD (la de notificación, recepción o
     puesta a disposición). Si el correo no la dice, null.

3. DE QUÉ VA, en una línea corta y clara, como se lo dirías a un gestor con prisa.

4. EL NIF que aparezca en el correo (el del obligado tributario, no el del organismo).
   Cópialo tal cual salga. Si no hay ninguno, null.
   NO intentes adivinar de qué cliente es por el nombre: de eso me encargo yo comparando el
   NIF y el correo del remitente. Un parecido de nombre no vale.

Responde SOLO con este JSON, sin texto alrededor y sin markdown:
{
  "fechaLimite": "2026-09-20" o null,
  "plazoDias": 10 o null,
  "plazoHabiles": true,
  "plazoDesde": "2026-03-12" o null,
  "porQue": "una frase: de dónde sale la fecha o el plazo, o por qué no hay",
  "deQueVa": "una línea",
  "nifEnElCorreo": "B12345678" o null,
  "tipo": "pago" | "presentacion" | "requerimiento" | "notificacion" | null
}`;

/**
 * De qué cliente es el correo. SOLO por dato duro.
 *
 * Dos comparaciones y ninguna más: el NIF que viene impreso en el correo, y la
 * dirección desde la que llega si está apuntada en la ficha de un cliente.
 * Nunca por parecido de nombre — "Talleres Ruiz" y "Talleres Ruiz e Hijos" son
 * dos clientes, y colgarle a uno el requerimiento del otro es peor que dejarlo
 * sin dueño: uno se arregla con un clic y el otro con una sanción.
 *
 * Si el mismo NIF está en dos fichas tampoco se elige: mejor sin dueño.
 */
function identificarPorDatoDuro(
  clientes: Array<{ id: string; nombre: string; nif?: string; emails?: string[] }>,
  nifDelCorreo: string | null,
  remitente: string,
): { id: string; nombre: string; motivo: string } | null {
  const norm = (v: string | null | undefined) => (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const nif = norm(nifDelCorreo);
  if (nif.length >= 8) {
    const casan = clientes.filter((c) => c.nif && norm(c.nif) === nif);
    if (casan.length === 1) {
      return { id: casan[0].id, nombre: casan[0].nombre, motivo: `el NIF ${nifDelCorreo?.trim()} es suyo` };
    }
  }

  const de = (remitente.match(/<([^>]+)>/)?.[1] ?? remitente).trim().toLowerCase();
  if (de.includes("@")) {
    const casan = clientes.filter((c) => (c.emails || []).includes(de));
    if (casan.length === 1) {
      return { id: casan[0].id, nombre: casan[0].nombre, motivo: `llegó de ${de}, que es un correo suyo` };
    }
  }

  return null;
}

export async function leerPlazoDeCorreo(opts: {
  remitente: string;
  asunto: string;
  cuerpo: string;
  clientes: Array<{ id: string; nombre: string; nif?: string; emails?: string[] }>;
}): Promise<ResultadoPlazo> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "No hay ANTHROPIC_API_KEY: el correo no se puede leer." };
  }

  // Al modelo ya NO se le pasa la lista de clientes para que elija: la elección
  // se hace aquí abajo con el NIF y el correo del remitente. Lo único que se le
  // pide es que copie el NIF que vea en el papel.

  // El cuerpo se recorta: las notificaciones oficiales traen pies de página
  // kilométricos y el plazo siempre va arriba.
  const cuerpo = opts.cuerpo.slice(0, 6000);

  try {
    const res = await anthropic.messages.create(
      {
        model: MODELS.fast,
        max_tokens: 600,
        system: INSTRUCCIONES,
        messages: [{
          role: "user",
          content: `DE: ${opts.remitente}\nASUNTO: ${opts.asunto}\n\n${cuerpo}`,
        }],
      },
      { timeout: 40_000 },
    );

    const texto = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const desde = texto.indexOf("{");
    const hasta = texto.lastIndexOf("}");
    if (desde < 0 || hasta <= desde) return { ok: false, error: `no ha devuelto JSON: ${texto.slice(0, 160)}` };

    const j = JSON.parse(texto.slice(desde, hasta + 1)) as Record<string, unknown>;

    // Red de seguridad: solo se acepta una fecha con forma de fecha.
    const esFecha = (v: unknown): v is string =>
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

    let fechaLimite = esFecha(j.fechaLimite) ? j.fechaLimite : null;
    let fechaCalculada = false;

    // EL PLAZO RELATIVO SE CALCULA AQUÍ, no en el modelo. "Diez días hábiles"
    // requiere saber qué días son festivos, y eso es una tabla, no una
    // intuición: un modelo que cuenta días de cabeza se equivoca, y aquí
    // equivocarse un día es la diferencia entre presentar y que sea sanción.
    const dias = typeof j.plazoDias === "number" && j.plazoDias > 0 && j.plazoDias <= 365
      ? Math.round(j.plazoDias) : null;
    const habiles = j.plazoHabiles !== false;
    const corriendoDesde = esFecha(j.plazoDesde) ? j.plazoDesde : null;
    const plazo = dias && corriendoDesde ? { dias, habiles, desde: corriendoDesde } : null;

    if (!fechaLimite && plazo) {
      const { sumarDiasHabiles } = await import("./gestoria-obligaciones");
      const calculada = plazo.habiles
        ? sumarDiasHabiles(plazo.desde, plazo.dias)
        : new Date(Date.parse(`${plazo.desde}T00:00:00Z`) + plazo.dias * 86_400_000)
            .toISOString().slice(0, 10);
      if (calculada) { fechaLimite = calculada; fechaCalculada = true; }
    }

    // EL CLIENTE, SOLO POR DATO DURO. Misma regla que con las facturas: el NIF
    // que viene impreso, o el correo del remitente si está en su ficha. Nunca
    // por parecido de nombre — "Talleres Ruiz" y "Talleres Ruiz e Hijos" son dos
    // clientes distintos, y colgarle a uno el requerimiento del otro es peor que
    // dejarlo sin dueño.
    const nifCorreo = typeof j.nifEnElCorreo === "string" ? j.nifEnElCorreo : null;
    const duro = identificarPorDatoDuro(opts.clientes, nifCorreo, opts.remitente);

    return {
      ok: true,
      plazo: {
        fechaLimite,
        fechaCalculada,
        plazo,
        nifEnElCorreo: nifCorreo,
        porQue: typeof j.porQue === "string" ? j.porQue : "",
        deQueVa: typeof j.deQueVa === "string" && j.deQueVa.trim() ? j.deQueVa.trim() : opts.asunto,
        clienteId: duro?.id ?? null,
        clienteNombre: duro?.nombre ?? null,
        motivoCliente: duro?.motivo ?? null,
        tipo: typeof j.tipo === "string" ? j.tipo : null,
        modelo: MODELS.fast,
        tokens: { entrada: res.usage.input_tokens, salida: res.usage.output_tokens },
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Lee el correo y lo apunta en la lista de HOY.
 *
 * Devuelve la tarea creada, o null si no se ha podido leer. No lanza: un fallo
 * leyendo un correo no puede romper la bandeja de Lucía.
 */
/**
 * ¿Se leen los correos oficiales para sacarles el plazo?
 *
 * Fail-closed, como el resto de interruptores del módulo: si la variable no
 * está, no se lee nada. Cuesta una llamada de IA por correo abierto y escribe en
 * la agenda del gestor; encenderlo es una decisión, no un descuido.
 */
export const correoPlazosEnabled = (): boolean =>
  (process.env.GESTORIA_CORREO_PLAZOS_ENABLED || "").toLowerCase() === "true";

export async function apuntarPlazoDeCorreo(opts: {
  tenantId: string;
  remitente: string;
  asunto: string;
  cuerpo: string;
  /** Id del correo en Gmail, para poder volver a él desde la agenda. */
  correoId?: string;
}): Promise<{ ok: true; tarea: import("./gestoria-hoy").Tarea; plazo: PlazoCorreo } | { ok: false; error: string }> {
  if (!correoPlazosEnabled()) {
    return { ok: false, error: "La lectura de plazos del correo está apagada (GESTORIA_CORREO_PLAZOS_ENABLED)." };
  }

  const { listarClientes } = await import("./gestoria-clientes");
  const { apuntarTarea } = await import("./gestoria-hoy");
  const { anotarLectura } = await import("./gestoria-coste");
  const { apuntarObligacion, existeDeCorreo } = await import("./gestoria-obligaciones");

  // Abrir dos veces el mismo correo no puede crear dos obligaciones.
  if (opts.correoId && (await existeDeCorreo(opts.tenantId, opts.correoId))) {
    return { ok: false, error: "Ese correo ya está apuntado en la agenda." };
  }

  const clientes = await listarClientes(opts.tenantId).catch(() => []);
  const r = await leerPlazoDeCorreo({
    remitente: opts.remitente, asunto: opts.asunto, cuerpo: opts.cuerpo,
    clientes: clientes.map((c) => ({ id: c.id, nombre: c.nombre, nif: c.nif, emails: c.emails })),
  });
  if (!r.ok) return r;

  if (r.plazo.tokens) {
    await anotarLectura({
      tenantId: opts.tenantId, modelo: r.plazo.modelo,
      entrada: r.plazo.tokens.entrada, salida: r.plazo.tokens.salida,
    });
  }

  // De dónde salió, escrito. Igual que con las facturas: una obligación que
  // aparece sola en la agenda sin decir de dónde viene no se cree.
  const dia = new Date().toLocaleDateString("es-ES");
  const quien = (opts.remitente.match(/<([^>]+)>/)?.[1] ?? opts.remitente).trim();
  const motivo = [
    `Detectado en correo de ${quien} del ${dia}`,
    r.plazo.motivoCliente ? `· cliente: ${r.plazo.motivoCliente}` : "· sin cliente: dime tú de quién es",
    r.plazo.fechaCalculada && r.plazo.plazo
      ? `· plazo de ${r.plazo.plazo.dias} días ${r.plazo.plazo.habiles ? "hábiles" : "naturales"} desde el ${r.plazo.plazo.desde}`
      : "",
  ].filter(Boolean).join(" ");

  // Un requerimiento con plazo va a la AGENDA como obligación: es lo más grave
  // que hay en ella, porque si el plazo caduca se convierte en sanción.
  // CRÍTICO no es solo lo que se llama "requerimiento": es todo lo que, si se
  // deja pasar, deja de ser un trámite y pasa a ser una sanción o una deuda
  // apremiada. Un plazo relativo corto —diez días hábiles, tres días— es
  // exactamente eso, se llame como se llame en el papel.
  const esRequerimiento = r.plazo.tipo === "requerimiento";
  const plazoCorto = !!r.plazo.plazo && r.plazo.plazo.dias <= 10;
  await apuntarObligacion({
    tenantId: opts.tenantId,
    tipo: esRequerimiento ? "requerimiento" : "otra",
    titulo: r.plazo.deQueVa,
    detalle: r.plazo.fechaLimite
      ? r.plazo.porQue
      : `SIN FECHA LÍMITE en el correo — míralo. ${r.plazo.porQue}`,
    clienteId: r.plazo.clienteId,
    clienteNombre: r.plazo.clienteNombre,
    vence: r.plazo.fechaLimite,
    motivo,
    correoId: opts.correoId,
    // Un requerimiento sin atender no se arregla al día siguiente: se convierte
    // en sanción. Sube por encima de todo lo demás.
    critico: esRequerimiento || plazoCorto,
  });

  const tarea = await apuntarTarea(opts.tenantId, {
    titulo: r.plazo.deQueVa,
    // Sin fecha se dice AQUÍ, en el detalle, para que el gestor lo mire en vez
    // de que pase por una tarea sin plazo cualquiera.
    detalle: r.plazo.fechaLimite
      ? `De ${opts.remitente}. ${r.plazo.porQue}`
      : `De ${opts.remitente}. SIN FECHA LÍMITE en el correo — míralo. ${r.plazo.porQue}`,
    vence: r.plazo.fechaLimite,
    clienteId: r.plazo.clienteId,
    clienteNombre: r.plazo.clienteNombre,
    origen: "correo",
  });

  return { ok: true, tarea, plazo: r.plazo };
}
