"use client";

// Página de impresión: todos los documentos seguidos, para guardar como PDF.
//
// El PDF lo genera el propio navegador (Imprimir → Guardar como PDF). No hace
// falta ningún servicio ni librería de servidor, y los diagramas salen dibujados
// porque para cuando se abre el diálogo ya son SVG en la página.
//
// Por eso NO se llama a print() nada más cargar: primero hay que esperar a que
// los 11 diagramas terminen de dibujarse. Se espera a que aparezcan todos (o a
// que pase un tiempo prudencial) y entonces se ofrece el botón.

import { useEffect, useState } from "react";
import Markdown from "@/components/dosier/Markdown";

type Doc = { slug: string; titulo: string; markdown: string };

export default function ImprimirCliente({
  docs,
  totalDiagramas,
  titulo,
  unSoloDocumento,
}: {
  docs: Doc[];
  totalDiagramas: number;
  titulo: string;
  /** Un dosier suelto para entregar: sin portada ni índice, va al grano. */
  unSoloDocumento: boolean;
}) {
  const [listos, setListos] = useState(0);
  // Sin diagramas no hay nada que esperar: preparado desde el primer pintado.
  // Se calcula aquí y no dentro del efecto, para no encadenar renders.
  const [preparado, setPreparado] = useState(totalDiagramas === 0);

  // Cuenta los diagramas ya dibujados. Cuando están todos (o se agota la
  // espera), la página queda lista para imprimir.
  useEffect(() => {
    if (totalDiagramas === 0) return;
    const tope = Date.now() + 30_000; // no esperar indefinidamente
    const t = setInterval(() => {
      const n = document.querySelectorAll(".dosier-diagrama svg").length;
      setListos(n);
      if (n >= totalDiagramas || Date.now() > tope) {
        setPreparado(true);
        clearInterval(t);
      }
    }, 300);
    return () => clearInterval(t);
  }, [totalDiagramas]);

  return (
    <div className="dosier-print">
      {/* Barra de control — no se imprime */}
      <div className="dosier-print-barra">
        <a href="/admin/dosier" className="dosier-print-volver">← Volver al visor</a>
        <span className="dosier-print-que">{titulo}</span>
        <span className="dosier-print-estado">
          {totalDiagramas === 0
            ? "Listo para imprimir"
            : preparado
            ? `${listos} de ${totalDiagramas} diagramas dibujados · listo`
            : `Dibujando diagramas… ${listos} de ${totalDiagramas}`}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!preparado}
          className="dosier-print-btn"
        >
          {preparado ? "Guardar como PDF" : "Preparando…"}
        </button>
      </div>

      <div className="dosier-print-aviso">
        Se abrirá el diálogo de impresión. Elige <b>&laquo;Guardar como PDF&raquo;</b> como destino.
        En el móvil, la opción está en el menú de compartir.
      </div>

      {/* Portada — solo cuando se imprime una colección entera. Un dosier
          suelto para un cliente no necesita portada ni índice. */}
      {!unSoloDocumento && (
        <section className="dosier-print-portada">
          <h1>{titulo}</h1>
          <p className="sub">AI-Team · {docs.length} documentos</p>
          <ol className="dosier-print-indice">
            {docs.map((d) => <li key={d.slug}>{d.titulo}</li>)}
          </ol>
        </section>
      )}

      {/* Todos los documentos, uno detrás de otro */}
      {docs.map((d) => (
        <article key={d.slug} className="dosier-print-doc">
          <Markdown>{d.markdown}</Markdown>
        </article>
      ))}
    </div>
  );
}
