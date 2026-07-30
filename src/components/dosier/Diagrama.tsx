"use client";

// Dibuja un diagrama Mermaid. Recibe el CÓDIGO del diagrama y pinta el SVG.
//
// La librería se carga con import dinámico para que sus ~500 KB no entren en el
// bundle de ninguna otra ruta: solo se descarga al abrir el dosier.
//
// Mientras se dibuja se enseña un hueco discreto. Si el diagrama tuviera un
// error de sintaxis, se muestra el código en crudo con el aviso: es preferible a
// un hueco en blanco que no explica nada.

import { useEffect, useRef, useState } from "react";

let arranque: Promise<typeof import("mermaid").default> | null = null;

/** Carga e inicializa mermaid UNA sola vez por pestaña, aunque haya 3 diagramas. */
function cargarMermaid() {
  if (!arranque) {
    arranque = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        flowchart: { htmlLabels: true, curve: "basis", useMaxWidth: true },
        sequence: { useMaxWidth: true },
      });
      return m.default;
    });
  }
  return arranque;
}

let contador = 0;

export default function Diagrama({ codigo }: { codigo: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`dosier-mmd-${++contador}`);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const mermaid = await cargarMermaid();
        const { svg } = await mermaid.render(idRef.current, codigo);
        if (vivo) setSvg(svg);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : "no se pudo dibujar");
      }
    })();
    return () => { vivo = false; };
  }, [codigo]);

  if (error) {
    return (
      <figure className="my-6">
        <p className="text-sm text-[color:var(--red)] font-bold mb-2">
          Este diagrama no se ha podido dibujar. Se muestra su código:
        </p>
        <pre className="overflow-x-auto bg-black/5 border border-black/15 p-3 text-xs leading-relaxed">
          <code>{codigo}</code>
        </pre>
      </figure>
    );
  }

  if (!svg) {
    return (
      <div
        className="my-6 border border-black/10 bg-black/[0.03] grid place-items-center text-sm text-black/40"
        style={{ minHeight: 160 }}
        aria-label="Dibujando diagrama"
      >
        Dibujando diagrama…
      </div>
    );
  }

  return (
    // Ancho completo y con scroll propio si el diagrama es más ancho que la
    // columna: así el texto nunca provoca scroll horizontal en la página.
    <figure
      className="dosier-diagrama my-6 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
