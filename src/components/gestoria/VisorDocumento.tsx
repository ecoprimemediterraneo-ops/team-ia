"use client";

// Ver el documento SIN salir del panel.
//
// Antes el botón "ver" era un enlace con `target="_blank"`: se abría otra
// pestaña con la foto sola. Para comprobar un NIF había que saltar a la pestaña,
// mirar, volver, y encontrarse el listado como lo habías dejado o no. Con cien
// facturas al mes eso es un salto por documento, y lo que pasa de verdad es que
// se deja de comprobar a los tres.
//
// Ahora se abre encima del listado. La página no se recarga, así que al cerrar
// se vuelve exactamente a donde estabas: mismo cliente elegido, mismo scroll,
// mismos filtros. No hay nada que "restaurar" porque nunca se perdió.
//
// El PDF va en un <iframe> con el visor del propio navegador —que ya trae zoom,
// páginas y buscador, y hacerlo a mano sería peor— y la imagen con zoom propio.

import { useEffect, useState } from "react";

export default function VisorDocumento({
  url,
  nombre,
  tipo,
  onCerrar,
}: {
  url: string;
  nombre: string;
  tipo: "imagen" | "pdf";
  onCerrar: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  // Escape cierra. Es lo que todo el mundo prueba primero.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(6, z + 0.25));
      if (e.key === "-") setZoom((z) => Math.max(0.25, z - 0.25));
    };
    window.addEventListener("keydown", alPulsar);
    // El fondo no se mueve mientras el visor está abierto: si no, al cerrar
    // apareces en otro punto del listado y parece que se ha perdido el sitio.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  const botón =
    "text-[10px] font-mono uppercase tracking-widest border-2 border-black bg-white px-2 py-1 hover:bg-black hover:text-white";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3"
      // Clic en el fondo = cerrar. En el contenido, no.
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Documento ${nombre}`}
    >
      <div
        className="bg-[color:var(--cream)] border-[3px] border-black w-full max-w-5xl h-full max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 flex-wrap border-b-[3px] border-black bg-white px-3 py-2">
          <span className="font-stencil text-lg leading-none flex-1 min-w-[8rem] truncate">{nombre}</span>

          {tipo === "imagen" && (
            <>
              <button type="button" className={botón} onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
                −
              </button>
              <span className="text-[10px] font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button type="button" className={botón} onClick={() => setZoom((z) => Math.min(6, z + 0.25))}>
                +
              </button>
              <button type="button" className={botón} onClick={() => setZoom(1)}>
                ajustar
              </button>
            </>
          )}

          {/* Sigue existiendo la salida a pestaña nueva, para quien la quiera
              (una pantalla grande, imprimir). Es una opción, ya no la única. */}
          <a href={url} target="_blank" rel="noreferrer" className={botón}>
            abrir aparte
          </a>
          <button type="button" onClick={onCerrar} className="btn-mustard text-[10px] px-3 py-1.5">
            CERRAR
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-black/10 grid place-items-start justify-center p-3">
          {tipo === "pdf" ? (
            <iframe src={url} title={nombre} className="w-full h-full min-h-[70vh] border-2 border-black bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={nombre}
              style={{ width: `${zoom * 100}%` }}
              className="max-w-none border-2 border-black bg-white"
            />
          )}
        </div>

        <div className="border-t-2 border-black bg-white px-3 py-1 text-[10px] font-mono text-black/50">
          Esc para cerrar{tipo === "imagen" ? " · + y − para el zoom" : ""} · al cerrar vuelves al listado donde estabas
        </div>
      </div>
    </div>
  );
}
