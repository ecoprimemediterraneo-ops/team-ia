"use client";

// La lista de remitentes importantes, para que la lleve el gestor.
//
// Todo a la vista y sin pasos: una fila por remitente, la etiqueta y el nivel
// se cambian ahí mismo. Lo que decide qué correo salta es esta lista y nada
// más, así que tiene que poder leerse entera de un vistazo.

import { useCallback, useEffect, useState } from "react";

type Nivel = "critico" | "importante";

type Remitente = {
  id: string;
  patron: string;
  etiqueta: string;
  nivel: Nivel;
  oficial?: boolean;
};

const ETIQUETAS_SUGERIDAS = [
  "Hacienda", "Seguridad Social", "Juzgados", "Banco",
  "Notificaciones oficiales", "Ayuntamiento", "Mutua", "Asesoría",
];

export default function RemitentesImportantes() {
  const [lista, setLista] = useState<Remitente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  const [patron, setPatron] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [nivel, setNivel] = useState<Nivel>("critico");

  const pintar = useCallback((datos: Remitente[]) => {
    setLista([...datos].sort((a, b) =>
      a.nivel !== b.nivel
        ? a.nivel === "critico" ? -1 : 1
        : a.etiqueta.localeCompare(b.etiqueta, "es") || a.patron.localeCompare(b.patron),
    ));
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/lucia/remitentes");
        const json = await res.json();
        if (vivo && json.remitentes) pintar(json.remitentes);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [pintar]);

  async function llamar(init: RequestInit & { url?: string }) {
    setGuardando(true);
    setAviso("");
    try {
      const res = await fetch(init.url ?? "/api/lucia/remitentes", init);
      const json = await res.json();
      if (!res.ok) {
        setAviso(json.error === "unauthorized" ? "Tu sesión ha caducado. Vuelve a entrar." : "No se pudo guardar.");
        return;
      }
      pintar(json.remitentes ?? []);
    } catch {
      setAviso("No se pudo guardar. Inténtalo otra vez.");
    } finally {
      setGuardando(false);
    }
  }

  async function anadir(e: React.FormEvent) {
    e.preventDefault();
    if (!patron.trim()) return;
    await llamar({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patron, etiqueta, nivel }),
    });
    setPatron("");
    setEtiqueta("");
  }

  const cambiar = (r: Remitente, cambios: Partial<Pick<Remitente, "etiqueta" | "nivel">>) =>
    llamar({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, ...cambios }),
    });

  async function borrar(r: Remitente) {
    if (!confirm(`¿Quitar "${r.patron}" de la lista? Sus correos dejarán de destacarse, pero seguirán llegando igual.`)) return;
    await llamar({ url: `/api/lucia/remitentes?id=${encodeURIComponent(r.id)}`, method: "DELETE" });
  }

  async function restaurar() {
    if (!confirm("¿Volver a la lista de partida? Se pierden los cambios que hayas hecho.")) return;
    await llamar({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurar: true }),
    });
  }

  const criticos = lista.filter((r) => r.nivel === "critico");
  const importantes = lista.filter((r) => r.nivel === "importante");

  return (
    <div className="space-y-4">
      {aviso && (
        <div className="border-2 border-black bg-red-200 px-3 py-2 text-sm font-bold">⚠ {aviso}</div>
      )}

      {/* Añadir */}
      <form onSubmit={anadir} className="card-hard bg-white p-4 space-y-3">
        <h2 className="font-stencil text-2xl leading-none">Añadir un remitente</h2>
        <p className="text-xs text-black/60">
          Puedes poner un dominio entero (<span className="font-mono">agenciatributaria.es</span>) o una dirección
          concreta (<span className="font-mono">notificaciones@mibanco.es</span>). Con el dominio entran también sus
          subdominios.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_auto_auto] gap-2">
          <input
            value={patron}
            onChange={(e) => setPatron(e.target.value)}
            placeholder="Dominio o dirección de correo"
            className="border-2 border-black px-3 py-2 text-sm font-mono"
          />
          <input
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Etiqueta (Hacienda, Banco…)"
            list="etiquetas-sugeridas"
            className="border-2 border-black px-3 py-2 text-sm"
          />
          <datalist id="etiquetas-sugeridas">
            {ETIQUETAS_SUGERIDAS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value as Nivel)}
            className="border-2 border-black px-3 py-2 text-sm bg-white"
          >
            <option value="critico">Crítico (arriba y en rojo)</option>
            <option value="importante">Importante (destacado)</option>
          </select>
          <button type="submit" disabled={guardando || !patron.trim()} className="btn-mustard text-sm px-4 py-2 disabled:opacity-60">
            Añadir
          </button>
        </div>
      </form>

      {/* LA LISTA, PLEGADA.
          Quince filas desplegadas, cada una con su etiqueta, su selector y su
          botón de quitar, eran una pared: ocupaban la pantalla entera para algo
          que se toca una vez y no se vuelve a mirar. Dentro de un `details` el
          contenido es EXACTAMENTE el mismo —no se ha quitado ni una fila ni un
          control—, solo deja de estar abierto de partida. El número del resumen
          se cuenta, no se escribe. */}
      <details className="card-hard bg-white p-4">
        <summary className="font-stencil text-2xl leading-none cursor-pointer select-none marker:text-black">
          Tu lista {cargando ? "· cargando…" : `· ${lista.length} ${lista.length === 1 ? "remitente" : "remitentes"}`}
        </summary>
        <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
          <button
            type="button" onClick={restaurar} disabled={guardando}
            className="text-[10px] font-mono uppercase tracking-widest border-2 border-black px-2 py-1 hover:bg-black hover:text-white disabled:opacity-60"
          >
            Volver a la lista de partida
          </button>
        </div>
        <p className="text-xs text-black/60 mb-3">
          Esta lista es tuya: quita lo que no uses y añade lo que te falte —tu banco, tu mutua, el juzgado con el que
          más trabajas—. Nadie más la ve.
        </p>

        {[
          { titulo: "Críticos · salen arriba del todo y en rojo", filas: criticos },
          { titulo: "Importantes · destacados, debajo de los críticos", filas: importantes },
        ].map((grupo) => (
          <div key={grupo.titulo} className="mb-4 last:mb-0">
            <div className="text-[11px] font-mono uppercase tracking-widest text-black/50 mb-1">{grupo.titulo}</div>
            {grupo.filas.length === 0 ? (
              <p className="text-sm text-black/50">Ninguno todavía.</p>
            ) : (
              <div className="space-y-2">
                {grupo.filas.map((r) => (
                  <div key={r.id} className="border-2 border-black p-2 flex items-center gap-2 flex-wrap">
                    <span
                      className={`w-3 h-3 border-2 border-black shrink-0 ${r.nivel === "critico" ? "bg-[color:var(--red)]" : "bg-[color:var(--mustard)]"}`}
                      aria-hidden
                    />
                    <span className="font-mono text-sm flex-1 min-w-[12rem] break-all">{r.patron}</span>
                    <input
                      defaultValue={r.etiqueta}
                      onBlur={(e) => e.target.value.trim() !== r.etiqueta && cambiar(r, { etiqueta: e.target.value })}
                      className="border-2 border-black px-2 py-1 text-xs w-40"
                      aria-label={`Etiqueta de ${r.patron}`}
                    />
                    <select
                      value={r.nivel}
                      onChange={(e) => cambiar(r, { nivel: e.target.value as Nivel })}
                      className="border-2 border-black px-2 py-1 text-xs bg-white"
                      aria-label={`Nivel de ${r.patron}`}
                    >
                      <option value="critico">Crítico</option>
                      <option value="importante">Importante</option>
                    </select>
                    <button
                      type="button" onClick={() => borrar(r)} disabled={guardando}
                      className="text-[10px] font-mono uppercase border-2 border-black px-2 py-1 hover:bg-[color:var(--red)] hover:text-white disabled:opacity-60"
                    >
                      quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        </div>
      </details>
    </div>
  );
}
