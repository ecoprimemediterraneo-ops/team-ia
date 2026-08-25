"use client";

// El menú lateral de una GESTORÍA. Solo de una gestoría.
//
// QUÉ HABÍA ANTES Y POR QUÉ SOBRABA
// ---------------------------------
// Cinco tarjetas grandes de sección con su emoji y su color de fondo, cuatro
// tarjetas de agente con foto, y debajo otras cuatro tarjetas de rayas para
// Perfil, Valor generado, Lecciones aprendidas y Redes sociales. Trece bloques,
// con mostaza, verde y morado compitiendo a la vez, al lado de una portada que
// se ha hecho a propósito vacía y tranquila. El menú gritaba más que el trabajo.
//
// Y la mitad no le sirve a un gestor: "Redes sociales · IG + LinkedIn + TikTok"
// o "Lecciones aprendidas" son de la cuenta comercial de AI-Team, no de alguien
// que lleva cien clientes y presenta modelos trimestrales.
//
// LO QUE QUEDA
//   - Cuatro secciones de trabajo, en texto y sin adornos.
//   - "Tu equipo" plegado: los agentes están, pero no se entra ahí cada día.
//   - "Ajustes" plegado: el perfil se toca una vez y no se vuelve.
//
// EL ROJO SE RESERVA. En todo el lateral solo hay un color, y aparece cuando de
// verdad hay algo vencido o a punto: el número al lado de Vencimientos. Si el
// rojo estuviera también en el fondo de una tarjeta y en un icono, ese número
// no significaría nada.
//
// PERO SIN SALIRSE DE LA CASA. La primera versión de esto quedó en letra fina
// gris de aplicación cualquiera, y al lado del resto del panel —Anton, negro
// sobre crema, bordes de 3 px y sombra dura— parecía otro producto pegado con
// cinta. Bajar el ruido no es cambiar de tipografía: es usar la misma con menos
// cosas. Los recursos son los que ya hay en `globals.css` (`font-stencil`,
// `card-hard`) y el "activo" es el mismo que usa `EnlaceLateral` en el resto de
// sectores: fondo negro y barra mostaza a la izquierda. Nada inventado.
//
// Nada de esto se borra: las pantallas que salen del lateral siguen existiendo y
// se llega a ellas por su URL. Y peluquerías, clínicas y restaurantes conservan
// su menú de siempre, intacto.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { esRutaActiva } from "../EnlaceLateral";
import EnlaceAgente from "../EnlaceAgente";

/** Lo que pide `EnlaceAgente`, que es el cuadradito de siempre. */
type Agente = {
  slug: string;
  nombre: string;
  rol: string;
  avatar: string;
  emoji: string;
  color: string;
  proximamente?: boolean;
};

/** El trabajo del día. En este orden: se entra por la portada. */
/**
 * El trabajo del día. En este orden: se entra por el chat.
 *
 * `principal` marca la herramienta, no un sitio. Los cuatro botones pesaban lo
 * mismo y no se veía cuál era el importante: el chat es donde se trabaja y los
 * otros tres son sitios donde rascar cuando hace falta mirar algo con los ojos.
 *
 * La diferencia es DESCARADA a propósito: 28 px contra 14 px, el doble. Se probó
 * con 18 contra 16 y no se apreciaba —una talla de diferencia se lee como un
 * descuido de maquetación, no como una jerarquía—. Para que una jerarquía se vea
 * sin buscarla tiene que ser evidente de golpe.
 *
 * Y se distingue SOLO por tamaño, no por color ni por estilo: el lateral sigue
 * teniendo un único color y es el rojo del contador.
 */
const SECCIONES = [
  { href: "/dashboard", texto: "Chat IA", principal: true },
  { href: "/dashboard/clientes", texto: "Vencimientos" },
  // Dos líneas: el nombre de verdad arriba y el apodo debajo. "El saco de
  // facturas" en una sola línea a 14 px ocupaba casi todo el ancho y se leía como
  // una frase, no como un botón. Lo que busca el ojo es "FACTURAS".
  { href: "/dashboard/facturas", texto: "Facturas", coletilla: "(saco)" },
  { href: "/dashboard/correo-importante", texto: "Correo importante" },
];

export default function LateralGestoria({ agentes }: { agentes: Agente[] }) {
  const pathname = usePathname() || "";
  /** Cuántas cosas vencen ya o casi. Es lo único que se pinta en rojo. */
  const [apremiantes, setApremiantes] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const res = await fetch("/api/gestoria/agenda").catch(() => null);
      const j = res ? await res.json().catch(() => null) : null;
      if (!vivo || !j?.ok) return;
      setApremiantes((j.resumen.vencidas ?? 0) + (j.resumen.rojas ?? 0));
    })();
    return () => { vivo = false; };
  }, [pathname]);

  return (
    <nav className="text-sm">
      <ul className="space-y-1">
        {SECCIONES.map((s) => {
          const activa = esRutaActiva(pathname, s.href);
          const enVencimientos = s.href === "/dashboard/clientes";
          return (
            <li key={s.href}>
              <a
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={[
                  // El principal respira más por dentro; los secundarios van
                  // apretados. El espaciado también cuenta la jerarquía.
                  "flex items-center gap-2 border-[3px] border-black transition",
                  s.principal ? "px-3 py-3" : "px-3 py-1.5",
                  // El MISMO recurso de "activo" que el lateral de peluquería:
                  // negro con barra mostaza. Ni un gris apagado ni un subrayado.
                  activa
                    ? "bg-black text-white border-l-[10px] border-l-[color:var(--mustard)] pl-2"
                    : "bg-white hover:-translate-y-0.5",
                ].join(" ")}
              >
                {/* `leading-tight` y no `leading-none`: a 14 px "El saco de
                    facturas" cabe en una línea en el ancho del lateral (260 px),
                    pero si un día no cabe, con `leading-none` las dos líneas se
                    pisarían. Así parte limpio. */}
                <span className="flex-1 min-w-0">
                  <span
                    className={`block font-stencil ${
                      s.principal ? "text-[28px] leading-none" : "text-[14px] leading-tight"
                    }`}
                  >
                    {s.texto}
                  </span>
                  {s.coletilla && (
                    <span className={`block text-[10px] leading-tight ${activa ? "text-white/55" : "text-black/40"}`}>
                      {s.coletilla}
                    </span>
                  )}
                </span>
                {/* EL ÚNICO ROJO DEL LATERAL. */}
                {enVencimientos && !!apremiantes && (
                  <span
                    title="Vencido o vence en 3 días o menos"
                    className="text-[11px] font-mono font-bold bg-[color:var(--red)] text-white border-2 border-black px-1.5 leading-tight"
                  >
                    {apremiantes}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>

      {/* Plegados los dos. `<details>` y no un desplegable a mano: se abre sin
          JavaScript, recuerda menos estado y pesa nada. */}
      <details className="mt-5 group">
        <summary className="cursor-pointer list-none px-1 py-1 font-stencil text-sm uppercase tracking-wide text-black/55 hover:text-black">
          <span className="inline-block w-3 group-open:rotate-90 transition-transform">›</span> Tu equipo
        </summary>
        {/* LAS TARJETAS DE SIEMPRE, sin tocar.
            Aquí se habían puesto los agentes como una línea de texto con su rol
            en gris pequeño. Eso no estaba pedido y desentonaba: los agentes
            tienen su cuadradito con foto, borde duro y el nombre en Anton desde
            el principio, y es lo que se reconoce. Lo ÚNICO que cambia respecto
            al lateral de antes es que ahora viven dentro de este desplegable,
            plegado: siguen ahí, pero no gritan cada día. */}
        <div className="mt-2 space-y-2">
          {agentes.map((a) => (
            <EnlaceAgente
              key={a.slug}
              slug={a.slug}
              nombre={a.nombre}
              rol={a.rol}
              avatar={a.avatar}
              emoji={a.emoji}
              color={a.color}
              proximamente={a.proximamente}
            />
          ))}
        </div>
      </details>

      <details className="mt-2 group">
        <summary className="cursor-pointer list-none px-1 py-1 font-stencil text-sm uppercase tracking-wide text-black/55 hover:text-black">
          <span className="inline-block w-3 group-open:rotate-90 transition-transform">›</span> Ajustes
        </summary>
        <ul className="mt-2 space-y-1.5">
          {/* Aquí estuvo "El WhatsApp de la mañana": una pantalla para leer el
              aviso diario sin mandarlo. Era una herramienta de revisión, no un
              ajuste, y dentro de Ajustes no pintaba nada. Se ha quitado; el
              aviso se dispara ahora desde /api/admin/aviso-diario-ahora. */}
          {[
            { href: "/dashboard/importar-clientes", texto: "Importar clientes" },
            { href: "/dashboard/perfil", texto: "Perfil del negocio" },
          ].map((a) => {
            const activa = esRutaActiva(pathname, a.href);
            return (
              <li key={a.href}>
                <a
                  href={a.href}
                  aria-current={activa ? "page" : undefined}
                  className={[
                    "block px-3 py-1.5 border-[3px] border-black font-stencil text-sm leading-tight transition",
                    activa
                      ? "bg-black text-white border-l-[10px] border-l-[color:var(--mustard)] pl-2"
                      : "bg-white hover:-translate-y-0.5",
                  ].join(" ")}
                >
                  {a.texto}
                </a>
              </li>
            );
          })}
        </ul>
      </details>
    </nav>
  );
}
