"use client";

// Dictar en vez de escribir.
//
// Jose habla mucho más de lo que escribe: se lo dicta a Pablo por WhatsApp en el
// coche. Pedirle que teclee en el panel es pedirle justo lo que evita.
//
// USA EL DICTADO DEL PROPIO NAVEGADOR (Web Speech API), no una API de pago: es
// gratis, no manda el audio a ningún servidor nuestro y va escribiendo mientras
// se habla. A cambio, no está en todos los navegadores — en Chrome sí, en
// Firefox no—. Cuando no está, EL BOTÓN NO SE PINTA: un botón que al pulsarlo
// dice "tu navegador no puede" es peor que no tenerlo, porque promete algo.

import { useEffect, useRef, useState } from "react";

/** Lo poco que se usa de la API, tipado a mano: no está en los tipos del DOM. */
type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function crearReconocimiento(): Reconocimiento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "es-ES";
  // `continuous`: no se corta a la primera pausa. Un gestor dictando se para a
  // pensar a mitad de frase y no por eso ha terminado.
  r.continuous = true;
  // `interimResults`: el texto va apareciendo mientras habla. Sin esto el cuadro
  // se queda vacío diez segundos y parece que no está funcionando.
  r.interimResults = true;
  return r;
}

export default function BotonMicro({
  onTexto,
  className = "",
}: {
  /** Se llama con lo que se lleva dictado. Sustituye, no acumula. */
  onTexto: (texto: string) => void;
  className?: string;
}) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef<Reconocimiento | null>(null);
  const base = useRef("");

  useEffect(() => {
    // Se comprueba en el navegador, no en el servidor: el servidor no tiene
    // `window` y pintaría el botón siempre. El `setSoportado` va tras un salto
    // de tarea para no tocar el estado de forma síncrona dentro del efecto.
    let vivo = true;
    queueMicrotask(() => { if (vivo) setSoportado(!!crearReconocimiento()); });
    return () => {
      vivo = false;
      try { rec.current?.stop(); } catch { /* ya estaba parado */ }
    };
  }, []);

  if (!soportado) return null;

  function alternar(textoActual: string) {
    if (escuchando) {
      try { rec.current?.stop(); } catch { /* da igual */ }
      setEscuchando(false);
      return;
    }
    const r = crearReconocimiento();
    if (!r) return;
    rec.current = r;
    // Lo que ya hubiera escrito se respeta: el dictado se añade detrás.
    base.current = textoActual ? `${textoActual.trim()} ` : "";

    r.onresult = (e) => {
      let dicho = "";
      for (let i = 0; i < e.results.length; i++) {
        dicho += e.results[i][0]?.transcript ?? "";
      }
      onTexto(base.current + dicho);
    };
    r.onend = () => setEscuchando(false);
    r.onerror = () => setEscuchando(false);
    try {
      r.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
    }
  }

  return (
    <button
      type="button"
      data-micro
      onClick={(e) => {
        // El texto actual sale del propio formulario, para no tener que
        // pasárselo por props desde tres sitios distintos.
        const form = (e.currentTarget as HTMLElement).closest("form");
        const ta = form?.querySelector("textarea, input[type=text]") as HTMLInputElement | HTMLTextAreaElement | null;
        alternar(ta?.value ?? "");
      }}
      title={escuchando ? "Parar de dictar" : "Dictar en voz alta"}
      aria-pressed={escuchando}
      className={[
        "border-[3px] border-black px-2 shrink-0 transition",
        // Escuchando: rojo y latiendo. Tiene que verse SIN ninguna duda, porque
        // lo que hay al otro lado es un micrófono abierto.
        escuchando
          ? "bg-[color:var(--red)] text-white animate-pulse"
          : "bg-white hover:bg-[color:var(--cream)]",
        className,
      ].join(" ")}
    >
      <span className="text-base leading-none">{escuchando ? "●" : "🎙"}</span>
      <span className="sr-only">{escuchando ? "Escuchando" : "Dictar"}</span>
    </button>
  );
}
