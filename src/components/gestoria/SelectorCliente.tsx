"use client";

// El cliente que se está mirando. MANDA SOBRE TODO LO DE ABAJO.
//
// POR QUÉ VIVE EN LA URL Y NO EN UN ESTADO DE REACT
// -------------------------------------------------
// El selector estaba dentro de la pantalla de Facturas, con su propio estado, y
// el aviso rojo de "pagado sin factura" se pintaba FUERA de ese componente. Dos
// piezas de la misma pantalla mirando a clientes distintos: elegías Bar El
// Puerto y el aviso te seguía enseñando también Distribuciones Vega.
//
// Con el cliente en la URL (`?cliente=…`) no hay dos verdades: lo leen el
// servidor y el navegador, sobrevive a recargar, y un enlace a "las facturas de
// Bar El Puerto" es simplemente una dirección que se puede guardar.

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type ClienteBreve = { id: string; nombre: string };

export default function SelectorCliente({
  clientes,
  className = "",
}: {
  clientes: ClienteBreve[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";
  const sp = useSearchParams();
  const actual = sp?.get("cliente") ?? "";

  function elegir(id: string) {
    const q = new URLSearchParams(sp?.toString() ?? "");
    if (id) q.set("cliente", id);
    else q.delete("cliente");
    // `scroll: false` para no saltar arriba: se cambia de cliente mirando algo
    // concreto, y perder el sitio obliga a buscarlo otra vez.
    router.push(q.toString() ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  if (!clientes.length) return null;

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="text-[10px] font-mono uppercase tracking-widest text-black/50 shrink-0">
        Cliente
      </span>
      <select
        value={actual}
        onChange={(e) => elegir(e.target.value)}
        className="flex-1 min-w-0 border-2 border-black bg-white px-2 py-1.5 text-sm"
      >
        {/* "Todos" no es un cliente: es no haber elegido. Va el primero porque
            es el estado de partida. */}
        <option value="">Todos los clientes</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
