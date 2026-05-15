"use client";
import { useEffect, useState } from "react";

const KEY = "aiteam-cookie-consent";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setShow(true);
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
        Usamos cookies esenciales para que la web funcione y, si nos lo permites, analítica para mejorar.{" "}
        <a href="/legal/privacidad" className="underline hover:text-[color:var(--red)]">Más info</a>.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => accept("all")}
          className="btn-mustard text-xs flex-1"
        >
          ACEPTAR TODO
        </button>
        <button
          onClick={() => accept("essential")}
          className="border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white"
        >
          SOLO ESENCIALES
        </button>
      </div>
    </div>
  );
}
