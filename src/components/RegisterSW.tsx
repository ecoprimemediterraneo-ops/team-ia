"use client";
import { useEffect } from "react";

/**
 * Registra el Service Worker en el cliente.
 * Es lo que Chrome Android exige para considerar la web "instalable" como PWA.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (e) {
        console.error("[sw] no se pudo registrar", e);
      }
    };

    // Esperar a load para no competir con recursos críticos
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
