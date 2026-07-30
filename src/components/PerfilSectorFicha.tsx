// Ficha del PERFIL DE SECTOR en el panel del cliente.
//
// Sustituye al selector antiguo (`SectorSelector`), que listaba los tres
// sectores viejos —dental, estética y "vendedor"— con sus descripciones. Un
// despacho de abogados veía ahí una descripción que hablaba de ortodoncia, y
// además ese campo ya no es el que decide nada: lo que manda es el `sector` del
// tenant.
//
// Es de solo lectura a propósito: cambiar de sector reordena el panel entero,
// cambia el vocabulario y cambia las prohibiciones de las IAs. No es una casilla
// que deba tocar el cliente por su cuenta.

import { getPerfilSector, type SectorNegocio } from "@/lib/sectores";

export default function PerfilSectorFicha({ sector }: { sector: SectorNegocio | null }) {
  // Cuenta comercial de AI-Team: no es un negocio de cliente, no tiene perfil.
  if (!sector) {
    return (
      <div className="card-hard bg-white p-4">
        <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-1">Perfil de sector</div>
        <p className="text-sm text-black/70">
          Esta cuenta es la de AI-Team, no la de un negocio de cliente: no tiene perfil de sector.
        </p>
      </div>
    );
  }

  const p = getPerfilSector(sector);
  const v = p.vocabulario;

  return (
    <div className="card-hard bg-white p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-black/50">Perfil de sector</div>
          <div className="font-stencil text-2xl leading-none mt-0.5">{p.label}</div>
        </div>
        <span className="text-[11px] font-mono border-2 border-black px-2 py-1">SOLO LECTURA</span>
      </div>

      <p className="text-sm text-black/70">{p.descripcion}</p>

      <div className="grid sm:grid-cols-2 gap-4 text-sm pt-1">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-1">Tus agentes, en orden</div>
          <p className="capitalize">{p.agentes.join(" · ")}</p>

          <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-1 mt-3">Cómo llamamos a las cosas</div>
          <ul className="text-black/70 space-y-0.5">
            <li>A quien te escribe: <b>{v.cliente}</b></li>
            <li>A un encuentro: <b>{v.cita}</b></li>
            <li>A lo que ofreces: <b>{v.servicio}</b></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-1">Cómo hablan tus agentes</div>
          <p className="text-black/70">{p.personalidad}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-black/10">
        <div className="text-xs font-mono uppercase tracking-widest text-[color:var(--red)] mb-1">
          Lo que tus agentes NUNCA harán
        </div>
        <ul className="list-disc pl-5 text-sm text-black/70 space-y-0.5">
          {p.prohibiciones.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>

      <p className="text-xs text-black/50 pt-1">
        ¿Tu negocio no encaja con este perfil? Escríbenos y lo cambiamos: afecta a todo el panel y a
        cómo responden tus agentes, así que no se toca a la ligera.
      </p>
    </div>
  );
}
