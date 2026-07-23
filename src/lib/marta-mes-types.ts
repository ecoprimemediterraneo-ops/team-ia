// Tipos PUROS del calendario de Marta (sin "server-only" ni node:*), para poder
// importarlos tanto desde el servidor (marta-mes) como desde componentes cliente
// (la página del calendario) sin arrastrar el módulo server-only al bundle del
// navegador. En dev (turbopack) `import type` no siempre borra la arista, así que
// aislamos el tipo aquí.

export type PostMes = {
  scheduledAt: string;   // ISO UTC
  tema: string;
  temaLabel: string;
  caption: string;       // completo (texto + hashtags) — es lo que se publica
  texto: string;         // solo el cuerpo, para revisar
  hashtags: string[];    // separados, para revisar
  imageUrl: string;
};
