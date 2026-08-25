// Las fechas, escritas como las escribe una persona.
//
// El chat y el resumen escupían "2026-08-24". Es exacto y no se presta a
// confusión, que era el motivo de usarlo, pero nadie habla así: en una frase
// como "el requerimiento vence el 2026-08-24" el número te para en seco y hay
// que traducirlo mentalmente. "Vence el lunes 24 de agosto" se lee de corrido.
//
// EL DÍA DE LA SEMANA NO ES ADORNO. Un gestor no piensa en números de día,
// piensa en "el lunes" y "el viernes": saber que algo cae en viernes cambia
// cuándo se pide la documentación. Por eso va delante.
//
// Y SE FORMATEA AQUÍ, NO EN EL MODELO. Cuando se le pedía al modelo que
// tradujera la fecha, calculaba el día de la semana de cabeza y se equivocaba
// —llegó a llamar "mañana" a algo que caía en tres días—. Aquí sale de la fecha,
// que es lo único que no se equivoca.

import "server-only";

/** "lunes 24 de agosto" · "lunes 24 de agosto de 2027" si no es este año. */
export function fechaNatural(iso: string | null | undefined, hoy?: string): string {
  if (!iso) return "sin fecha";
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;

  const esteAño = (hoy ?? new Date().toISOString()).slice(0, 4) === iso.slice(0, 4);
  const t = d.toLocaleDateString("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    // El año solo cuando NO es el de hoy: ponerlo siempre alarga cada línea del
    // resumen con un dato que ya se sabe.
    ...(esteAño ? {} : { year: "numeric" }),
  });
  // `es-ES` mete una coma tras el día de la semana ("lunes, 24 de agosto"). Se
  // quita: dentro de una frase corta esa coma parte la lectura en dos.
  return t.replace(/^(\p{L}+),\s/u, "$1 ");
}

/**
 * Cuándo vence, en cristiano y contando desde hoy.
 *
 * "quedan 3 días" es más útil que la fecha para decidir si se mira ahora o
 * después, así que va junto a ella, no en su lugar.
 */
export function cuandoVence(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return "sin fecha límite";
  if (dias < 0) return `venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`;
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias <= 7) return `quedan ${dias} días`;
  return `quedan ${dias} días`;
}

/** "vence el lunes 24 de agosto (quedan 3 días)". Las dos cosas, en una. */
export function venceEl(iso: string | null | undefined, dias: number | null | undefined, hoy?: string): string {
  if (!iso) return cuandoVence(dias);
  const cuando = cuandoVence(dias);
  // Lo vencido y lo de hoy o mañana se dicen SIN la fecha: "venció hace 2 días"
  // ya lo dice todo y la fecha solo estorba.
  if (dias !== null && dias !== undefined && dias <= 1) return cuando;
  return `vence el ${fechaNatural(iso, hoy)} (${cuando})`;
}


/**
 * LA RED DE SEGURIDAD: convierte cualquier fecha con guiones que se haya colado
 * en un texto ya escrito.
 *
 * POR QUÉ HACE FALTA, SI YA SE FORMATEA EN CADA SITIO
 * ---------------------------------------------------
 * Porque ya se arregló una vez y volvió. Se formateaba en las tres funciones de
 * consulta, y una ronda posterior añadió funciones de ACCIÓN que devuelven
 * opciones al modelo ("¿cuál de estas?") con la fecha cruda dentro. El modelo
 * las copia tal cual —y hace bien, se le pidió que copiara— y "2026-08-24"
 * reaparece en la pantalla.
 *
 * Confiar en que cada función nueva se acuerde de formatear es confiar en que
 * nadie olvide nada nunca. Esto se aplica en el ÚLTIMO punto por el que pasa
 * todo lo que se le enseña al gestor, así que da igual quién lo escriba.
 */
export function fechasEnCristiano(texto: string, hoy?: string): string {
  return texto.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (crudo) => {
    const bonita = fechaNatural(crudo, hoy);
    // Si no se ha podido interpretar, se deja lo que había: mejor una fecha fea
    // que una fecha inventada.
    return bonita === crudo ? crudo : bonita;
  });
}
