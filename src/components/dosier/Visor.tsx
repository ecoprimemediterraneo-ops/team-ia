"use client";

// Visor del dosier: barra lateral con los documentos, índice de secciones del
// documento abierto, y el texto.
//
// En móvil la barra lateral no ocupa sitio: se abre con el botón "Documentos" y
// se cierra sola al elegir. En escritorio queda fija a la izquierda.
//
// El contenido llega ya leído del disco desde el servidor. Este componente no
// guarda ninguna copia.

import { useState } from "react";
import Markdown from "./Markdown";
import type { EntradaIndice, Coleccion } from "@/lib/dosier";

export default function Visor({
  secciones,
  coleccionActiva,
  slugActivo,
  titulo,
  markdown,
}: {
  /** Las dos colecciones, cada una con su etiqueta. Se listan por separado. */
  secciones: { coleccion: Coleccion; etiqueta: string; docs: EntradaIndice[] }[];
  coleccionActiva: Coleccion;
  slugActivo: string;
  titulo: string;
  markdown: string;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const actual = secciones
    .flatMap((s) => s.docs)
    .find((d) => d.slug === slugActivo && d.coleccion === coleccionActiva);
  const enlace = (c: Coleccion, slug: string) => `/admin/dosier?col=${c}&doc=${slug}`;

  // Cambiar de documento es un enlace normal (<a href>), o sea una carga
  // completa de página: el scroll vuelve arriba y el menú se cierra solos. No
  // hace falta ningún efecto para eso.

  return (
    <div className="dosier-layout">
      {/* Barra superior — en móvil trae el botón del menú */}
      <header className="dosier-topbar">
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          className="dosier-btn-menu"
          aria-expanded={menuAbierto}
        >
          {menuAbierto ? "✕ Cerrar" : "☰ Documentos"}
        </button>
        <span className="dosier-topbar-titulo">Dosier AI-Team</span>
        <a
          href={`/admin/dosier/imprimir?col=${coleccionActiva}`}
          className="dosier-btn-pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          PDF de todo
        </a>
      </header>

      <div className="dosier-cuerpo">
        {/* Lateral */}
        <nav className={`dosier-lateral ${menuAbierto ? "abierta" : ""}`} aria-label="Documentos del dosier">
          {secciones.map((sec, i) => (
            <div key={sec.coleccion} className={i > 0 ? "dosier-bloque-2" : undefined}>
              <p className="dosier-lateral-tit">{sec.etiqueta}</p>
              <ul className="dosier-doclist">
                {sec.docs.map((d) => (
                  <li key={`${d.coleccion}-${d.slug}`}>
                    <a
                      href={enlace(d.coleccion, d.slug)}
                      className={d.slug === slugActivo && d.coleccion === coleccionActiva ? "activo" : ""}
                    >
                      {d.titulo}
                      {d.diagramas > 0 && (
                        <span className="dosier-badge">{d.diagramas} {d.diagramas === 1 ? "diagrama" : "diagramas"}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
              {/* Cada dosier de cliente se entrega por separado: su propio PDF. */}
              {sec.coleccion === "cliente" && (
                <ul className="dosier-doclist dosier-pdfs">
                  {sec.docs.map((d) => (
                    <li key={`pdf-${d.slug}`}>
                      <a href={`/admin/dosier/imprimir?col=cliente&doc=${d.slug}`} target="_blank" rel="noopener noreferrer">
                        ⬇ PDF · {d.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* Índice del documento abierto */}
          {actual && actual.secciones.length > 0 && (
            <>
              <p className="dosier-lateral-tit dosier-lateral-tit-2">En este documento</p>
              <ul className="dosier-toc">
                {actual.secciones.map((s) => (
                  <li key={s.id} className={s.nivel === 3 ? "n3" : "n2"}>
                    <a href={`#${s.id}`} onClick={() => setMenuAbierto(false)}>{s.texto}</a>
                  </li>
                ))}
              </ul>
            </>
          )}

          <a href="/admin" className="dosier-volver">← Volver a admin</a>
        </nav>

        {/* Capa oscura detrás del menú en móvil */}
        {menuAbierto && <div className="dosier-velo" onClick={() => setMenuAbierto(false)} aria-hidden="true" />}

        {/* Documento */}
        <main className="dosier-main">
          <article>
            <Markdown>{markdown}</Markdown>
          </article>
          <hr className="dosier-sep" />
          <p className="dosier-pie">
            Documento <b>{titulo}</b> · leído de{" "}
            <code>docs/{coleccionActiva === "cliente" ? "dosier-cliente" : "dosier"}/{slugActivo}.md</code>{" "}
            en el momento de abrir la página.
            Si editas el fichero, refresca y verás el cambio.
          </p>
        </main>
      </div>
    </div>
  );
}
