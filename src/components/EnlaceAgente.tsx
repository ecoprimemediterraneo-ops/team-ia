"use client";

// La tarjeta de un agente en el menú lateral, marcada cuando es la que se está
// mirando. Mismo motivo y misma señal que `EnlaceLateral`: si las cinco
// pestañas de arriba dicen dónde estás, las de los agentes también tienen que
// decirlo, o el menú se contradice a sí mismo a mitad de lista.

import { usePathname } from "next/navigation";
import { esRutaActiva } from "./EnlaceLateral";

export default function EnlaceAgente({
  slug,
  nombre,
  rol,
  avatar,
  emoji,
  color,
  proximamente,
}: {
  slug: string;
  nombre: string;
  rol: string;
  avatar: string;
  emoji: string;
  color: string;
  proximamente?: boolean;
}) {
  const pathname = usePathname() || "";
  const href = `/dashboard/${slug}`;
  const activa = esRutaActiva(pathname, href);

  return (
    <a
      href={href}
      aria-current={activa ? "page" : undefined}
      className={[
        "card-hard flex items-center gap-3 p-2.5 transition relative overflow-hidden",
        activa
          ? "bg-black text-white border-l-[10px] border-l-[color:var(--mustard)] pl-1.5"
          : "hover:-translate-y-0.5",
      ].join(" ")}
      style={activa ? undefined : { background: color }}
    >
      <div className="relative w-12 h-12 border-[2px] border-black overflow-hidden shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar} alt={nombre} className="w-full h-full object-cover" />
        <span className="absolute -bottom-0.5 -right-0.5 bg-white border-2 border-black w-5 h-5 flex items-center justify-center text-[10px]">
          {emoji}
        </span>
      </div>
      <span className="flex-1 min-w-0">
        <span className="block font-stencil text-lg leading-none truncate">{nombre}</span>
        <span className={`block text-[10px] uppercase tracking-widest truncate ${activa ? "text-white/70" : "text-black/70"}`}>
          {rol}
        </span>
      </span>
      {/* Los carteles de estado se quitaron de todas las tarjetas el 6 de
          agosto. Vuelve UNO solo, y solo para Rocío: es la única que sigue sin
          conectar, y enseñarla como el resto haría que un cliente contase con
          las reseñas de Google desde el primer día. */}
      {proximamente && (
        <span className="absolute top-1 right-1 text-[8px] bg-black/70 text-white px-1 py-0.5 font-bold tracking-widest">
          PRÓXIMAMENTE
        </span>
      )}
    </a>
  );
}
