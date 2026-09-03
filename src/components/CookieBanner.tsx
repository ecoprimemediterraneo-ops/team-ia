"use client";
import { useEffect, useState } from "react";
import { traductor, idiomaDe, type Idioma } from "@/lib/idioma";

const KEY = "aiteam-cookie-consent";

export default function CookieBanner() {
  const [show, setShow] = useState(false);
  /**
   * El idioma se lee de `window.location`, NO con `useSearchParams()`.
   *
   * Se probó con el hook y el build se cayó: este banner vive en el layout
   * raíz, así que lo arrastran también las páginas estáticas (`/_not-found`,
   * `/dentistas/[ciudad]`…), y `useSearchParams()` en una página
   * prerenderizada exige un Suspense boundary — «Export encountered an error,
   * exiting the build». Habría roto el sitio entero por traducir un cartel.
   *
   * Leyéndolo dentro del efecto no hay bailout: el banner solo se pinta
   * después de ese efecto, así que el idioma ya está decidido y no parpadea.
   */
  const [idioma, setIdioma] = useState<Idioma>("es");
  const t = traductor(idioma);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Tras un salto de tarea, como en `Portada.tsx`: llamar a setState de forma
    // sincrona dentro del efecto es lo que React avisa como cascada de pintadas.
    queueMicrotask(() => {
      setIdioma(idiomaDe(new URLSearchParams(window.location.search).get("lang")));
      if (!localStorage.getItem(KEY)) setShow(true);
    });
  }, []);

  function accept(value: "all" | "essential") {
    localStorage.setItem(KEY, value);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 card-hard p-5 bg-white">
      <h3 className="font-stencil text-xl mb-2">🍪 Cookies</h3>
      <p className="text-sm text-black/70 mb-4">
        {t("cookies_texto")}{" "}
        <a href="/legal/privacidad" className="underline hover:text-[color:var(--red)]">{t("cookies_mas")}</a>.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => accept("all")}
          className="btn-mustard text-xs flex-1"
        >
          {t("cookies_todo")}
        </button>
        <button
          onClick={() => accept("essential")}
          className="border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white"
        >
          {t("cookies_esenciales")}
        </button>
      </div>
    </div>
  );
}
