// Versión imprimible del dosier — /admin/dosier/imprimir
//
// Los 9 documentos seguidos, con los diagramas dibujados, listos para
// "Guardar como PDF" desde el diálogo de impresión del navegador.
//
// Lee del disco igual que el visor: una sola fuente, sin copias.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { leerDosier, leerDocumento, esColeccion, ETIQUETA_COLECCION, type Coleccion } from "@/lib/dosier";
import ImprimirCliente from "./ImprimirCliente";
import "./imprimir.css";

export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || "ecoprimemediterraneo@gmail.com";

export const metadata = { title: "Dosier AI-Team (PDF)" };

// ?col=cliente         → todos los de cliente
// ?col=cliente&doc=salon → SOLO ese, para entregárselo a un cliente concreto
export default async function ImprimirPage({
  searchParams,
}: {
  searchParams: Promise<{ col?: string; doc?: string }>;
}) {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  if (s.email !== FOUNDER_EMAIL && s.email !== "crisasky@gmail.com") redirect("/admin");

  const sp = await searchParams;
  const col: Coleccion = esColeccion(sp.col) ? sp.col : "tecnico";

  // Un solo documento (para entregar) o la colección entera.
  const uno = sp.doc ? await leerDocumento(col, sp.doc) : null;
  const docs = uno ? [uno] : await leerDosier(col);
  const totalDiagramas = docs.reduce((n, d) => n + d.diagramas, 0);

  return (
    <ImprimirCliente
      docs={docs.map(({ slug, titulo, markdown }) => ({ slug, titulo, markdown }))}
      totalDiagramas={totalDiagramas}
      titulo={uno ? uno.titulo : ETIQUETA_COLECCION[col]}
      unSoloDocumento={!!uno}
    />
  );
}
