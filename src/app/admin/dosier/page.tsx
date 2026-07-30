// Visor del dosier maestro — /admin/dosier
//
// Lee los .md de docs/dosier/ DEL DISCO en cada petición y los renderiza con los
// diagramas Mermaid ya dibujados. No hay ninguna copia del contenido: editas un
// .md, refrescas, y ves el cambio.
//
// Query param:
//   ?doc=pablo   → abre ese documento (por defecto, 00-general)
//
// Auth: misma protección que el resto de /admin, con el mismo bypass local que
// /admin/informe (getSessionLocal) para poder leerlo en localhost sin login.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { leerTodo, aIndice, esColeccion, ETIQUETA_COLECCION, type Coleccion } from "@/lib/dosier";
import Visor from "@/components/dosier/Visor";
import "./dosier.css";

// Sin caché: el fichero del disco manda siempre.
export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const metadata = { title: "Dosier AI-Team" };

export default async function DosierPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; col?: string }>;
}) {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const todo = await leerTodo();
  const docs = [...todo.tecnico, ...todo.cliente];

  if (docs.length === 0) {
    return (
      <main style={{ padding: 40, maxWidth: 640, margin: "0 auto", fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>No se encuentra el dosier</h1>
        <p style={{ marginTop: 10, lineHeight: 1.6 }}>
          No hay ningún documento en <code>docs/dosier/</code>. Comprueba que la carpeta existe y
          contiene los ficheros <code>.md</code>.
        </p>
      </main>
    );
  }

  const sp = await searchParams;
  // Colección y documento pedidos. Si algo no existe, se cae al primero de todo
  // en vez de dar error.
  const col: Coleccion = esColeccion(sp.col) ? sp.col : "tecnico";
  const activo =
    docs.find((d) => d.coleccion === col && d.slug === sp.doc) ??
    todo[col][0] ??
    docs[0];

  const secciones = ([
    { coleccion: "tecnico" as Coleccion, docs: todo.tecnico },
    { coleccion: "cliente" as Coleccion, docs: todo.cliente },
  ])
    .filter((s) => s.docs.length > 0)
    .map((s) => ({ ...s, etiqueta: ETIQUETA_COLECCION[s.coleccion], docs: aIndice(s.docs) }));

  return (
    <Visor
      secciones={secciones}
      coleccionActiva={activo.coleccion}
      slugActivo={activo.slug}
      titulo={activo.titulo}
      markdown={activo.markdown}
    />
  );
}
