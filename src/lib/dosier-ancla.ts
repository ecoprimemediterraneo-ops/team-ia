// Ancla de los encabezados del dosier.
//
// Vive en su propio módulo, SIN "server-only", porque la necesitan los dos
// lados: el servidor (para construir el índice lateral) y el navegador (para
// poner el mismo id al pintar el encabezado). Si cada uno calculara el ancla a
// su manera, los saltos del índice no llevarían a ninguna parte.

export function anclaDe(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // quita acentos
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}
