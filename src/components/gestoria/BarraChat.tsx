"use client";

// LA BARRA ROJA Y EL CUADRO DE PREGUNTAR. Un solo sitio, cuatro pantallas.
//
// POR QUÉ ESTO EXISTE
// -------------------
// Había dos versiones: la de la portada y otra copia parecida en las tres
// pantallas de trabajo. Parecidas, no iguales — una con `textarea` y otra con
// `input`, distinto alto, distinto borde, el botón con otra letra — y al pasar
// de una pantalla a otra parecían dos productos pegados con cinta. Dos copias de
// algo visual siempre acaban divergiendo: se retoca una y nadie se acuerda de la
// otra.
//
// Ahora es UN componente. La única diferencia entre la portada y el resto es lo
// que pasa al enviar, y eso viaja como prop:
//   - En la portada (`onEnviar`): contesta ahí mismo, debajo crece el hilo.
//   - En las otras tres: no hay hilo. Se va a /dashboard con la pregunta puesta.
//
// A ANCHO COMPLETO, como todo el producto. Se probó a meterlo en una columna
// estrecha para que la portada y las tres pantallas midieran igual, y el efecto
// fue el contrario del buscado: peluquerías, clínicas y dental van a ancho
// completo, así que la gestoría con su columnita parecía otro producto. Miden
// igual entre sí porque son el MISMO componente, no porque se les fije un ancho.

import { useEffect, useState } from "react";
import BotonMicro from "./BotonMicro";

export type Urgente = { texto: string; href: string } | null;

/** El cartel rojo. Solo si hay algo vencido o que vence en 3 días o menos. */
export function BarraUrgente({ urgente }: { urgente: Urgente }) {
  if (!urgente) return null;
  return (
    <a
      href={urgente.href}
      className="flex items-center gap-3 bg-[color:var(--red)] text-white border-2 border-black px-3 py-2 hover:opacity-90"
    >
      {/* El rótulo. Sin él, una franja roja con una frase suelta no dice si es
          un aviso del sistema o algo que hay que hacer. */}
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest border-2 border-white px-1.5 py-0.5 whitespace-nowrap shrink-0 self-start mt-0.5">
        🚨 Urgente
      </span>
      <span className="text-sm font-bold flex-1 leading-snug">{urgente.texto}</span>
      <span className="text-[10px] font-mono uppercase tracking-widest border-2 border-white px-2 py-1 whitespace-nowrap shrink-0">
        Ver →
      </span>
    </a>
  );
}

/**
 * El cuadro de preguntar, suelto.
 *
 * Se exporta aparte porque en la portada la barra roja va ARRIBA DEL TODO —por
 * encima del saludo— y el cuadro va después. Son dos piezas separadas en la
 * pantalla, pero UNA sola definición: así no pueden volver a divergir aunque
 * estén en sitios distintos.
 */
export function CuadroPreguntar({
  texto,
  onTexto,
  onEnviar,
  pensando = false,
  lanzaAlChat = false,
  className = "",
}: {
  texto?: string;
  onTexto?: (v: string) => void;
  onEnviar?: (q: string) => void;
  pensando?: boolean;
  lanzaAlChat?: boolean;
  className?: string;
}) {
  const [textoPropio, setTextoPropio] = useState("");
  const controlado = texto !== undefined && !!onTexto;
  const valor = controlado ? texto! : textoPropio;
  const ponValor = controlado ? onTexto! : setTextoPropio;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const q = valor.trim();
    if (!q || pensando) return;
    if (lanzaAlChat) {
      // La pregunta viaja en la URL y no en `localStorage`: así el enlace vale
      // aunque se abra en otra pestaña, y la portada no tiene que adivinar si lo
      // guardado es de ahora o de hace tres días.
      window.location.href = `/dashboard?preguntar=${encodeURIComponent(q)}`;
      return;
    }
    onEnviar?.(q);
  }

  // LOS BOTONES VAN DENTRO DEL CAMPO.
  //
  // Estaban fuera, a la derecha: un botón mostaza enorme que ponía "Preguntar"
  // separado del cuadro por un hueco. Así no se lee como "el botón de este
  // cuadro", se lee como otra cosa que hay al lado. Dentro, pegado al texto que
  // acabas de escribir, no hay que explicar para qué sirve.
  //
  // El truco es el `relative` del contenedor y el `pr-24` del `textarea`: el
  // hueco de la derecha lo reserva el propio campo, así el texto nunca pasa por
  // debajo de los botones por largo que sea.
  return (
    <form onSubmit={enviar} className={`relative ${className}`}>
      <textarea
        value={valor}
        onChange={(e) => ponValor(e.target.value)}
        onKeyDown={(e) => {
          // Enter manda, Mayús+Enter salta línea. Es lo que todo el mundo espera.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviar(e as unknown as React.FormEvent);
          }
        }}
        rows={2}
        placeholder="Pregúntame lo que necesites saber…"
        className="w-full card-hard bg-white pl-3 pr-24 py-2 text-sm resize-none"
      />
      <div className="absolute right-2 bottom-3 flex items-center gap-1">
        <BotonMicro onTexto={ponValor} className="py-1 px-2" />
        <button
          type="submit"
          disabled={pensando || !valor.trim()}
          title="Enviar la pregunta"
          className="btn-mustard text-xs px-3 py-1.5 disabled:opacity-40"
        >
          {pensando ? "…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}

/** Las dos piezas juntas: es lo que llevan las tres pantallas de trabajo. */
export default function BarraChat({
  urgente: urgenteProp,
  texto,
  onTexto,
  onEnviar,
  pensando = false,
  /** true = esta pantalla no tiene hilo: al enviar se va a /dashboard. */
  lanzaAlChat = false,
  className = "",
}: {
  /** Si no se pasa, el componente lo pide él mismo. */
  urgente?: Urgente;
  texto?: string;
  onTexto?: (v: string) => void;
  onEnviar?: (q: string) => void;
  pensando?: boolean;
  lanzaAlChat?: boolean;
  className?: string;
}) {
  const [urgentePropio, setUrgentePropio] = useState<Urgente>(null);
  const urgente = urgenteProp !== undefined ? urgenteProp : urgentePropio;

  useEffect(() => {
    // Solo se pide si nadie lo ha pasado: en la portada ya viene con el resumen
    // y pedirlo otra vez sería una llamada de más en cada carga.
    if (urgenteProp !== undefined) return;
    let vivo = true;
    (async () => {
      const res = await fetch("/api/gestoria/portada").catch(() => null);
      const j = res ? await res.json().catch(() => null) : null;
      if (vivo && j?.ok) setUrgentePropio(j.urgente);
    })();
    return () => { vivo = false; };
  }, [urgenteProp]);

  return (
    <div className={className}>
      <BarraUrgente urgente={urgente} />
      <CuadroPreguntar
        texto={texto}
        onTexto={onTexto}
        onEnviar={onEnviar}
        pensando={pensando}
        lanzaAlChat={lanzaAlChat}
        className={urgente ? "mt-3" : ""}
      />
    </div>
  );
}
