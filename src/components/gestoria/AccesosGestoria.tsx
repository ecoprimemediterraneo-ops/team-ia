"use client";

// Las tres secciones de trabajo, debajo del chat.
//
// SUSTITUYEN AL LATERAL. Había un menú a la izquierda con Chat IA, Vencimientos,
// Facturas y Correo importante, y además estos mismos tres enlaces al pie de la
// portada: dos formas de ir al mismo sitio, y ninguna de las dos evidente. Ahora
// hay una.
//
// Y NO CAMBIAN DE PÁGINA. Al pulsar, la sección se despliega DEBAJO y el chat se
// queda donde estaba: si te has escrito tres preguntas y quieres mirar una
// factura, perder la conversación por mirarla es perder el trabajo hecho. La
// sección abierta viaja en la URL (`?seccion=…`), así que el servidor la puede
// pintar y recargar no la cierra.
//
// Las pantallas sueltas (/dashboard/facturas y compañía) siguen existiendo tal
// cual: lo que cambia es que ya no hace falta ir hasta ellas.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type Seccion = "vencimientos" | "facturas" | "correo";

const SECCIONES: Array<{ id: Seccion; texto: string }> = [
  { id: "vencimientos", texto: "Vencimientos" },
  { id: "facturas", texto: "Facturas" },
  { id: "correo", texto: "Correo importante" },
];

export default function AccesosGestoria({
  abierta,
  pagadosSinFactura,
}: {
  abierta: Seccion | null;
  /**
   * Cuántos pagos cuadran con un albarán o un ticket. Viene calculado del
   * servidor y no se pide aquí porque NO hay ninguna ruta que lo devuelva: se
   * calcula cruzando todo el extracto contra todas las facturas, y montar un
   * endpoint nuevo solo para pintar un número sería trabajo de más.
   */
  pagadosSinFactura: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  // Los tres números. Se piden en el navegador y no en el servidor porque son
  // lentos (uno va a Gmail) y no vale la pena retrasar la portada por ellos.
  const [venc, setVenc] = useState<number | null>(null);
  const [fact, setFact] = useState<number | null>(null);
  const [correo, setCorreo] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const j = async (u: string) => {
        const r = await fetch(u).catch(() => null);
        return r ? await r.json().catch(() => null) : null;
      };

      // VENCIMIENTOS: el mismo criterio que ya usaba el contador rojo del
      // lateral. Vencido o vence en 3 días o menos.
      const ag = await j("/api/gestoria/agenda");
      if (vivo && ag?.ok) setVenc((ag.resumen?.vencidas ?? 0) + (ag.resumen?.rojas ?? 0));

      // FACTURAS: lo que le queda a Jose por tocar. Documentos que no se han
      // sabido asignar (esto sí tiene ruta) más los pagados sin factura, que
      // llegan ya contados desde el servidor.
      const rec = await j("/api/gestoria/facturas?sinAsignar=1");
      if (vivo) {
        const sinId = rec?.recuento?.sinIdentificar;
        if (typeof sinId === "number") setFact(sinId + pagadosSinFactura);
        else if (pagadosSinFactura) setFact(pagadosSinFactura);
      }

      // CORREO: correos críticos sin leer de hoy. Solo sale si Gmail está
      // conectado: sin conexión no hay dato, y un cero ahí diría "no tienes
      // nada" cuando lo que pasa es que no lo sabemos.
      const cr = await j("/api/lucia/criticos");
      if (vivo && cr?.ok && cr.aplica && cr.conectado) setCorreo(cr.total ?? 0);
    })();
    return () => { vivo = false; };
  }, [pagadosSinFactura]);

  function alternar(id: Seccion) {
    const q = new URLSearchParams(sp?.toString() ?? "");
    // Pulsar la que ya está abierta la cierra.
    if (abierta === id) q.delete("seccion");
    else q.set("seccion", id);
    router.push(q.toString() ? `/dashboard?${q}` : "/dashboard", { scroll: false });
  }

  const numero = (id: Seccion) =>
    id === "vencimientos" ? venc : id === "facturas" ? fact : correo;

  return (
    // LOS TRES JUNTOS Y A LA IZQUIERDA.
    // Se probó a repartirlos con `justify-between` para que ocuparan el ancho
    // del campo de escribir, y el efecto fue el contrario: separados por medio
    // palmo dejan de leerse como un grupo de tres y hay que ir a buscar cada uno
    // con la vista. Pegados, con la misma separación entre ellos, se leen de una
    // pasada.
    <div className="mt-2 pt-2 border-t-2 border-black/10 flex items-center gap-x-5 gap-y-1 flex-wrap">
      {SECCIONES.map((s) => {
        const n = numero(s.id);
        const on = abierta === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => alternar(s.id)}
            aria-expanded={on}
            className={`text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5 hover:text-black hover:underline ${
              on ? "text-black font-bold underline" : "text-black/40"
            }`}
          >
            <span className={`inline-block transition-transform ${on ? "rotate-90" : ""}`}>›</span>
            {s.texto}
            {/* EL MISMO CONTADOR QUE HABÍA EN EL LATERAL, sin reinventarlo. */}
            {!!n && (
              <span className="text-[11px] font-mono font-bold bg-[color:var(--red)] text-white border-2 border-black px-1.5 leading-tight">
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
