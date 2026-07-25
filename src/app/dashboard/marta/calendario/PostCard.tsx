// Tarjeta de un post del mes: miniatura + fecha/hora + caption + hashtags +
// estado real (scheduled/published/failed) y, si la entrada ya está guardada,
// el botón "Publicar ahora".
// La usan tanto la previsualización (cliente) como el listado ya programado
// (servidor), por eso no lleva hooks ni "use client".

import AccionesPost from "./AccionesPost";
import BorrarPost from "./BorrarPost";
import { TEMA_MANUAL } from "./types";

const FMT = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const CHIP: Record<string, { clase: string; label: string }> = {
  preview:   { clase: "bg-white text-black border-black", label: "PREVISUALIZACIÓN" },
  scheduled: { clase: "bg-[color:var(--mustard)] text-black border-black", label: "PROGRAMADO" },
  proposed:  { clase: "bg-[#14B8A6] text-white border-black", label: "ENVIADO" },
  published: { clase: "bg-black text-[color:var(--mustard)] border-black", label: "PUBLICADO" },
  rejected:  { clase: "bg-black/40 text-white border-black", label: "RECHAZADO" },
  failed:    { clase: "bg-[color:var(--red)] text-white border-black", label: "ERROR" },
  skipped:   { clase: "bg-black/20 text-black border-black", label: "SALTADO" },
};

export default function PostCard({
  scheduledAt,
  imageUrl,
  texto,
  hashtags,
  temaLabel,
  estado,
  entryId,
  tenantId,
  igMediaId,
  errorDetail,
  defaultFecha,
  defaultHora,
}: {
  scheduledAt: string;
  imageUrl: string;
  texto: string;
  hashtags: string[];
  temaLabel?: string;
  estado: string;
  /** Solo para entradas ya guardadas: habilita acciones (reprogramar/publicar). */
  entryId?: string;
  tenantId?: string;
  igMediaId?: string;
  errorDetail?: string;
  /** Fecha/hora local Madrid ya calculadas en el servidor (para no importar server-only aquí). */
  defaultFecha?: string;
  defaultHora?: string;
}) {
  const chip = CHIP[estado] ?? CHIP.scheduled;
  const cuando = FMT.format(new Date(scheduledAt));

  return (
    <article className="card-hard bg-white p-3 flex gap-3 items-start relative">
      {/* Borrar (X) arriba a la derecha — solo para entradas ya guardadas */}
      {entryId && tenantId && (
        <BorrarPost entryId={entryId} tenantId={tenantId} estado={estado} />
      )}

      {/* Miniatura */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`Imagen del post del ${cuando}`}
        width={110}
        height={110}
        className="w-[110px] h-[110px] object-cover border-2 border-black shrink-0 bg-[color:var(--cream)]"
      />

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap pr-7">
          <span className={`text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 font-bold border-2 ${chip.clase}`}>
            {chip.label}
          </span>
          <span className="text-[11px] font-mono text-black/60">{cuando}</span>
        </div>

        {temaLabel && (
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/40 truncate">
            {temaLabel}
          </div>
        )}

        <p className="text-xs text-black/80 whitespace-pre-wrap line-clamp-5 leading-snug">{texto}</p>

        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {hashtags.map((h) => (
              <span key={h} className="text-[10px] font-mono bg-black/5 border border-black/15 px-1 py-0.5">
                {h}
              </span>
            ))}
          </div>
        )}

        {igMediaId && (
          <p className="text-[10px] font-mono text-black/50">igMediaId: {igMediaId}</p>
        )}
        {errorDetail && (
          <p className="text-[10px] text-[color:var(--red)] leading-tight">Error: {errorDetail}</p>
        )}

        {entryId && tenantId && defaultFecha && defaultHora && (
          <AccionesPost
            entryId={entryId}
            tenantId={tenantId}
            defaultFecha={defaultFecha}
            defaultHora={defaultHora}
            estado={estado}
            esManual={temaLabel === TEMA_MANUAL}
          />
        )}
      </div>
    </article>
  );
}
