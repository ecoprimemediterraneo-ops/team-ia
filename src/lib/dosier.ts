// Lectura del dosier maestro desde docs/dosier/.
//
// SIN COPIAS: esta capa lee los .md del disco en cada petición. No hay una
// segunda versión del contenido en el código ni en base de datos. Si se edita un
// .md, la página lo refleja en el siguiente refresco (las rutas que la usan van
// con `dynamic = "force-dynamic"`, así que no se cachea).
//
// En producción los .md tienen que viajar dentro de la función serverless: por
// eso `next.config.ts` los añade a `outputFileTracingIncludes` para las rutas
// del dosier, igual que ya se hacía con los .md de assets/.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

// Dos colecciones distintas y con público distinto:
//   · TÉCNICO  (docs/dosier/)         → para dentro. Dice lo que está apagado y por qué.
//   · CLIENTE  (docs/dosier-cliente/) → para entregar. Uno por sector, sin jerga.
// Se leen igual, se listan por separado y no se mezclan nunca.
export type Coleccion = "tecnico" | "cliente";

const DIRS: Record<Coleccion, string> = {
  tecnico: path.join(process.cwd(), "docs", "dosier"),
  cliente: path.join(process.cwd(), "docs", "dosier-cliente"),
};

export const ETIQUETA_COLECCION: Record<Coleccion, string> = {
  tecnico: "Dosier técnico (interno)",
  cliente: "Dosier de cliente",
};

/** Orden de lectura de cada colección. Solo se sirven estos nombres. */
const ORDENES: Record<Coleccion, string[]> = {
  tecnico: ["00-general", "pablo", "marta", "eva", "lucia", "rocio", "carmen", "sergio", "soporte"],
  cliente: ["salon", "estetica", "dental", "gestoria"],
};

export type Seccion = { id: string; texto: string; nivel: 2 | 3 };

export type Documento = {
  coleccion: Coleccion;
  slug: string;          // "pablo"
  titulo: string;        // el primer # del fichero
  markdown: string;
  secciones: Seccion[];  // los ## y ### para el índice lateral
  diagramas: number;
};

// El ancla se calcula en `dosier-ancla.ts`, que NO es server-only: el visor del
// navegador usa exactamente la misma función al pintar los encabezados.
export { anclaDe } from "./dosier-ancla";
import { anclaDe } from "./dosier-ancla";

/** Saca los encabezados de nivel 2 y 3, ignorando los que estén dentro de un bloque de código. */
function extraerSecciones(md: string): Seccion[] {
  const out: Seccion[] = [];
  let dentroDeCodigo = false;
  const vistos = new Map<string, number>();

  for (const linea of md.split("\n")) {
    if (linea.trimStart().startsWith("```")) {
      dentroDeCodigo = !dentroDeCodigo;
      continue;
    }
    if (dentroDeCodigo) continue;

    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(linea);
    if (!m) continue;

    const nivel = m[1].length === 2 ? 2 : 3;
    const texto = m[2].replace(/[*_`]/g, "").trim();
    let id = anclaDe(texto);
    // Dos secciones con el mismo nombre → se desempata con sufijo.
    const n = vistos.get(id) ?? 0;
    vistos.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;

    out.push({ id, texto, nivel: nivel as 2 | 3 });
  }
  return out;
}

function extraerTitulo(md: string, slug: string): string {
  const m = /^#\s+(.+?)\s*$/m.exec(md);
  return m ? m[1].replace(/[*_`]/g, "").trim() : slug;
}

/** Lee un documento suelto. Devuelve null si no existe. */
export async function leerDocumento(coleccion: Coleccion, slug: string): Promise<Documento | null> {
  // Cortafuegos de ruta: solo nombres de la lista. Nada de "../".
  if (!ORDENES[coleccion]?.includes(slug)) return null;
  try {
    const markdown = await fs.readFile(path.join(DIRS[coleccion], `${slug}.md`), "utf-8");
    return {
      coleccion,
      slug,
      titulo: extraerTitulo(markdown, slug),
      markdown,
      secciones: extraerSecciones(markdown),
      diagramas: (markdown.match(/```mermaid/g) || []).length,
    };
  } catch {
    return null;
  }
}

/** Lee TODOS los documentos de una colección, en orden. Los que falten se omiten. */
export async function leerDosier(coleccion: Coleccion): Promise<Documento[]> {
  const docs = await Promise.all(ORDENES[coleccion].map((s) => leerDocumento(coleccion, s)));
  return docs.filter((d): d is Documento => d !== null);
}

/** Las dos colecciones de una vez, para el visor. */
export async function leerTodo(): Promise<Record<Coleccion, Documento[]>> {
  const [tecnico, cliente] = await Promise.all([leerDosier("tecnico"), leerDosier("cliente")]);
  return { tecnico, cliente };
}

export function esColeccion(v: unknown): v is Coleccion {
  return v === "tecnico" || v === "cliente";
}

/** Solo la lista para la barra lateral (sin cargar el markdown entero dos veces). */
export type EntradaIndice = {
  coleccion: Coleccion;
  slug: string;
  titulo: string;
  secciones: Seccion[];
  diagramas: number;
};

export function aIndice(docs: Documento[]): EntradaIndice[] {
  return docs.map(({ coleccion, slug, titulo, secciones, diagramas }) =>
    ({ coleccion, slug, titulo, secciones, diagramas }));
}
