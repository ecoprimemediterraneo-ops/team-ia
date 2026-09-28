"use client";

// EL PANEL EN VIVO. Pregunta cada pocos segundos a `/api/panel/latido` si ha
// cambiado algo (citas, mensajes, cancelaciones) y, si sí, refresca:
//   - `router.refresh()` vuelve a pedir los datos de las pantallas de servidor
//     (Hoy, la bandeja de mensajes, las conversaciones) sin perder lo que haya
//     escrito en el chat ni ningún formulario abierto;
//   - el evento `aiteam:datos` avisa a los componentes que cargan sus propios
//     datos (la agenda, los números de las pestañas) para que los vuelvan a pedir.
// Con la pestaña en segundo plano no pregunta: no gasta nada.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export const EVENTO_DATOS = "aiteam:datos";
const CADA_MS = 6000;

export default function LatidoPanel() {
  const router = useRouter();
  const ultima = useRef<string | null>(null);
  useEffect(() => {
    let vivo = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    const latir = async () => {
      if (!vivo) return;
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/panel/latido", { cache: "no-store" });
          const j = await r.json();
          if (j?.ok && j.v) {
            if (ultima.current && ultima.current !== j.v) {
              router.refresh();
              window.dispatchEvent(new Event(EVENTO_DATOS));
            }
            ultima.current = j.v;
          }
        } catch { /* sin red: se reintenta en la siguiente */ }
      }
      t = setTimeout(latir, CADA_MS);
    };
    latir();
    const alVolver = () => { if (document.visibilityState === "visible") { clearTimeout(t); latir(); } };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; clearTimeout(t); document.removeEventListener("visibilitychange", alVolver); };
  }, [router]);
  return null;
}

/** Para los componentes que cargan sus propios datos: vuelve a llamar a `cb` cuando cambia algo. */
export function useDatosCambiados(cb: () => void): void {
  const ref = useRef(cb);
  useEffect(() => { ref.current = cb; }, [cb]);
  useEffect(() => {
    const f = () => ref.current();
    window.addEventListener(EVENTO_DATOS, f);
    return () => window.removeEventListener(EVENTO_DATOS, f);
  }, []);
}
