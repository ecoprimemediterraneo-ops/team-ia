/**
 * Importador de publicaciones desde los .md a la cola.
 *
 * Parsea:
 * - assets/instagram/posts.md  (30 posts)
 * - assets/linkedin/posts.md   (20 posts)
 *
 * Crea borradores en data/queue.json con fechas distribuidas según el calendario
 * (4 posts/semana IG · 3 posts/semana LI · empezando mañana).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { crear, listar } from "@/lib/redes";

const ASSETS = path.join(process.cwd(), "assets");

type ParsedPost = {
  numero: number;
  contenido: string;
  red: "instagram" | "linkedin";
};

function extraerCaptionIG(bloque: string): string {
  // Captions IG vienen tras "**CAPTION:**\n> ..." o entre líneas con >
  const match = bloque.match(/\*\*CAPTION:\*\*\s*\n([\s\S]*?)(\n---|\n\*\*PROMPT|\n##|$)/);
  if (!match) return "";
  // Cada línea suele empezar con "> " — quitar el prefijo
  return match[1]
    .split("\n")
    .map((l) => l.replace(/^\s*>\s?/, ""))
    .join("\n")
    .trim();
}

function extraerContenidoLI(bloque: string): string {
  // LinkedIn: contenido entre los primeros ``` y los siguientes ```
  const match = bloque.match(/```\s*\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : "";
}

async function leerIGPosts(): Promise<ParsedPost[]> {
  try {
    const md = await fs.readFile(path.join(ASSETS, "instagram", "posts.md"), "utf-8");
    const out: ParsedPost[] = [];
    // Buscar bloques "### POST NN — ..."
    const blocks = md.split(/(?=### POST \d{2})/g);
    for (const b of blocks) {
      const numMatch = b.match(/### POST (\d{2})/);
      if (!numMatch) continue;
      const numero = parseInt(numMatch[1], 10);
      const contenido = extraerCaptionIG(b);
      if (contenido) out.push({ numero, contenido, red: "instagram" });
    }
    return out;
  } catch {
    return [];
  }
}

async function leerLIPosts(): Promise<ParsedPost[]> {
  try {
    const md = await fs.readFile(path.join(ASSETS, "linkedin", "posts.md"), "utf-8");
    const out: ParsedPost[] = [];
    const blocks = md.split(/(?=## POST \d{2})/g);
    for (const b of blocks) {
      const numMatch = b.match(/## POST (\d{2})/);
      if (!numMatch) continue;
      const numero = parseInt(numMatch[1], 10);
      const contenido = extraerContenidoLI(b);
      if (contenido) out.push({ numero, contenido, red: "linkedin" });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Distribución temporal:
 * - IG: lunes/martes/jueves/viernes a las 18:30 (4/semana)
 * - LI: martes/jueves/sábado a las 09:00 (3/semana desde personal)
 */
function fechaIG(indice: number, startDate: Date): Date {
  const diasSemana = [1, 2, 4, 5]; // L M J V
  const semana = Math.floor(indice / 4);
  const dia = diasSemana[indice % 4];
  const d = new Date(startDate);
  // Encontrar el próximo lunes
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + semana * 7 + (dia - 1));
  d.setHours(18, 30, 0, 0);
  return d;
}

function fechaLI(indice: number, startDate: Date): Date {
  const diasSemana = [2, 4, 6]; // M J S
  const semana = Math.floor(indice / 3);
  const dia = diasSemana[indice % 3];
  const d = new Date(startDate);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + semana * 7 + (dia - 1));
  d.setHours(9, 0, 0, 0);
  return d;
}

export async function importarTodo(): Promise<{ importados: number; saltados: number; ig: number; li: number }> {
  const existentes = await listar();
  const setExistente = new Set(existentes.map((p) => `${p.red}::${p.contenido.slice(0, 60)}`));

  const igPosts = await leerIGPosts();
  const liPosts = await leerLIPosts();

  // Empezar desde mañana (UTC para evitar líos)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  let importados = 0, saltados = 0, ig = 0, li = 0;

  for (let i = 0; i < igPosts.length; i++) {
    const p = igPosts[i];
    const key = `${p.red}::${p.contenido.slice(0, 60)}`;
    if (setExistente.has(key)) { saltados++; continue; }
    await crear({
      red: p.red,
      contenido: p.contenido,
      fechaProgramada: fechaIG(i, tomorrow).toISOString(),
      metadata: { autor: "Marta", campaña: `IG-Mes1-Post${String(p.numero).padStart(2, "0")}` },
    });
    importados++; ig++;
  }

  for (let i = 0; i < liPosts.length; i++) {
    const p = liPosts[i];
    const key = `${p.red}::${p.contenido.slice(0, 60)}`;
    if (setExistente.has(key)) { saltados++; continue; }
    await crear({
      red: p.red,
      contenido: p.contenido,
      fechaProgramada: fechaLI(i, tomorrow).toISOString(),
      metadata: { autor: "Marta", campaña: `LI-Mes1-Post${String(p.numero).padStart(2, "0")}` },
    });
    importados++; li++;
  }

  return { importados, saltados, ig, li };
}
