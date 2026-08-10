// Freno anti-bot para formularios PÚBLICOS.
//
// Nace de un caso real: el formulario de /diagnostico llevaba meses abierto sin
// ningún freno y de 103 registros captados prácticamente todos eran basura
// automatizada, con nombres tipo "WwrDKJsHFWeyuWLuDsGh" y correos de relleno.
// El formulario funcionaba; lo que no había era portero.
//
// SIN CAPTCHA, a propósito. Un captcha visible es fricción para el visitante de
// verdad —justo el que interesa— y los bots modernos los resuelven. Las tres
// medidas de aquí no las ve nadie:
//
//   1. HONEYPOT: un campo oculto que un humano no puede rellenar porque no lo
//      ve, y que un bot que completa todo lo que encuentra sí rellena.
//   2. LÍMITE POR IP en ventana deslizante.
//   3. VALIDACIÓN de que lo que llega tiene forma de dato real.
//
// El contador vive EN MEMORIA del proceso. Es una decisión consciente y tiene
// su límite: en serverless cada instancia lleva su propia cuenta, así que un
// atacante repartido entre instancias podría pasar más de lo que dice el tope.
// Aun así corta en seco el caso que tenemos —un bot dando de alta en bucle desde
// la misma IP— sin añadir una dependencia ni una tabla. Si algún día hace falta
// algo estricto, el sitio es `kvTryLock`/Supabase, no este fichero.

import "server-only";

/** Cuántas peticiones se admiten por IP dentro de la ventana. */
export const MAX_POR_VENTANA = 5;
/** Tamaño de la ventana, en minutos. */
export const VENTANA_MIN = 30;

type Registro = { marcas: number[] };
const porIp = new Map<string, Registro>();

/**
 * IP de quien llama, mirando las cabeceras que pone el proxy de Vercel.
 * `x-forwarded-for` puede traer una cadena: la primera es la del cliente.
 */
export function ipDe(h: Headers): string {
  const fwd = h.get("x-forwarded-for") || "";
  const primera = fwd.split(",")[0]?.trim();
  return primera || h.get("x-real-ip") || "desconocida";
}

export type ResultadoFreno = { ok: true } | { ok: false; esperaSeg: number };

/**
 * ¿Puede pasar esta IP? Cuenta las peticiones de la ventana y decide.
 *
 * Limpia las marcas viejas en cada llamada, así que el Map no crece sin fin
 * mientras haya tráfico.
 */
export function pasaElFreno(ip: string, ahora = Date.now()): ResultadoFreno {
  const ventanaMs = VENTANA_MIN * 60_000;
  const reg = porIp.get(ip) ?? { marcas: [] };
  const vivas = reg.marcas.filter((t) => ahora - t < ventanaMs);

  if (vivas.length >= MAX_POR_VENTANA) {
    const masVieja = Math.min(...vivas);
    const esperaSeg = Math.max(1, Math.ceil((ventanaMs - (ahora - masVieja)) / 1000));
    porIp.set(ip, { marcas: vivas });
    return { ok: false, esperaSeg };
  }

  vivas.push(ahora);
  porIp.set(ip, { marcas: vivas });

  // Barrido perezoso: si el Map se ha llenado de IPs que ya no vuelven, se
  // limpian las que no tienen ninguna marca viva.
  if (porIp.size > 500) {
    for (const [clave, valor] of porIp) {
      if (!valor.marcas.some((t) => ahora - t < ventanaMs)) porIp.delete(clave);
    }
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Validación de forma
// -----------------------------------------------------------------------------

/**
 * ¿Esto parece una web de verdad?
 *
 * Vacío vale: el campo es opcional y hay negocios sin web. Lo que se rechaza es
 * la cadena de relleno que mandan los bots ("nJjCLSjkjZlWNtehusydDr"): sin
 * punto, sin extensión y sin nada que se parezca a un dominio.
 */
export function webParecePlausible(web?: string): boolean {
  const v = (web || "").trim();
  if (!v) return true;
  const sinEsquema = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const dominio = sinEsquema.split(/[/?#]/)[0];
  // Un dominio real tiene al menos un punto y una extensión de 2 letras o más.
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(dominio)) return false;
  // Y no tiene espacios.
  return !/\s/.test(v);
}

/**
 * ¿El nombre del negocio parece escrito por una persona?
 *
 * Los de los bots son cadenas de consonantes al azar sin vocales ni espacios.
 * Se usa para MARCAR spam, no para rechazar: un nombre raro no puede costarle
 * el diagnóstico a nadie.
 */
export function nombreParecePersona(nombre?: string): boolean {
  const v = (nombre || "").trim();
  if (!v) return true;
  if (v.length < 4) return false;
  const soloLetras = /^[A-Za-z]{12,}$/.test(v);
  const vocales = (v.toLowerCase().match(/[aeiouáéíóú]/g) || []).length;
  const proporcion = vocales / v.length;
  // Una cadena larga de solo letras pegadas y con muy pocas vocales no es el
  // nombre de un negocio, es relleno.
  return !(soloLetras && proporcion < 0.3);
}
