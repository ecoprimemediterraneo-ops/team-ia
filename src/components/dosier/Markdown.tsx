"use client";

// Render de un documento del dosier.
//
// Es el ÚNICO sitio donde se convierte el markdown a HTML, y lo usan tanto el
// visor de pantalla como la página de impresión. Así lo que se lee y lo que sale
// en el PDF son exactamente lo mismo.
//
// Dos cosas a medida:
//   1. Los bloques ```mermaid no se pintan como código: se dibujan (Diagrama).
//   2. Los encabezados llevan ancla, calculada con la MISMA función que usa el
//      índice lateral (anclaDe), para que los saltos funcionen.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Diagrama from "./Diagrama";
import { anclaDe } from "@/lib/dosier-ancla";

function textoDe(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textoDe).join("");
  if (children && typeof children === "object" && "props" in children) {
    return textoDe((children as { props: { children?: React.ReactNode } }).props?.children);
  }
  return "";
}

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="dosier-prosa">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="dosier-h1">{children}</h1>,
          h2: ({ children }) => (
            <h2 id={anclaDe(textoDe(children))} className="dosier-h2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 id={anclaDe(textoDe(children))} className="dosier-h3">{children}</h3>
          ),
          // Las tablas van envueltas en un contenedor con scroll propio: en móvil
          // una tabla ancha se desplaza sola sin arrastrar toda la página.
          table: ({ children }) => (
            <div className="dosier-tabla-wrap">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => {
            const externo = !!href && /^https?:\/\//.test(href);
            // Los enlaces entre documentos del dosier (pablo.md, soporte.md…)
            // apuntan al visor, no al fichero.
            const interno = !!href && /^[a-z0-9-]+\.md$/i.test(href);
            const destino = interno ? `/admin/dosier?doc=${href!.replace(/\.md$/i, "")}` : href;
            return (
              <a
                href={destino}
                {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
          code: ({ className, children, ...props }) => {
            const codigo = String(children ?? "").replace(/\n$/, "");
            if (className === "language-mermaid") return <Diagrama codigo={codigo} />;
            // Código en línea (sin lenguaje y sin saltos) vs bloque.
            if (!className && !codigo.includes("\n")) {
              return <code className="dosier-code-inline" {...props}>{children}</code>;
            }
            return <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
