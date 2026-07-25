// Cuerpo REUTILIZABLE del calendario mensual de Marta (Nivel 3).
// Server component asíncrono: hace su propio fetching y monta todo el calendario
//   · pauta por día + generar el mes (AutomaticoForm)
//   · identidad visual del negocio (IdentidadVisual)
//   · subir un post propio (SubirPost)
//   · listado del mes con hacer cambios / regenerar texto / regenerar imagen / publicar ahora (PostCard)
// Se usa en DOS sitios sin duplicar código:
//   · la pestaña "Calendario" del panel de Marta (heading=false, el panel ya tiene su cabecera)
//   · [histórico] la ruta /dashboard/marta/calendario, que hoy redirige al panel
import { DEFAULT_TENANT_ID, getTenant, getPautaPublicacion, getMarcaVisual } from "@/lib/tenants";
import { listCalendar } from "@/lib/marta-calendar";
import { separarHashtags, martaAutoEnabled, utcToMadridFields } from "@/lib/marta-mes";
import { martaAutoPublishEnabled } from "@/lib/marta-auto-publish";
import { isPublishEnabled } from "@/lib/marta-publish";
import PostCard from "./PostCard";
import AutomaticoForm from "./AutomaticoForm";
import SubirPost from "./SubirPost";
import IdentidadVisual from "./IdentidadVisual";

export default async function CalendarioMes({
  tenantId = DEFAULT_TENANT_ID,
  heading = true,
}: {
  tenantId?: string;
  /** true = cabecera grande (página propia); false = intro compacta (dentro del panel). */
  heading?: boolean;
}) {
  const tenant = await getTenant(tenantId);
  const autoEnabled = martaAutoEnabled();
  const autoPublish = martaAutoPublishEnabled();
  const publishOn = isPublishEnabled();
  const pauta = await getPautaPublicacion(tenantId);
  const marca = await getMarcaVisual(tenantId);
  const nombreNegocio = tenant?.ficha?.nombreNegocio || tenant?.name || "AI-Team";

  // Solo el mes en curso (es lo que genera el orquestador).
  const ahora = new Date();
  const mesActual = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, "0")}`;
  const todas = await listCalendar(tenantId);
  // `hidden` = posts publicados que el usuario quitó de la vista (se conserva el
  // registro en el store, pero no se muestran en el calendario).
  const delMes = todas.filter((e) => e.scheduledAt.slice(0, 7) === mesActual && !e.hidden);

  // Valor por defecto del formulario manual: mañana a la primera hora de la pauta.
  const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  const defaultFecha = utcToMadridFields(manana).fecha;
  const defaultHora = `${String(pauta.dias[0]?.hora ?? 10).padStart(2, "0")}:00`;

  const flags = (
    <div className="flex flex-wrap gap-2 text-[10px] font-mono">
      {([
        ["MARTA_AUTO_ENABLED", autoEnabled, "generar el mes solo"],
        ["MARTA_AUTO_PUBLISH_ENABLED", autoPublish, "publicar solo a su hora"],
        ["MARTA_PUBLISH_ENABLED", publishOn, "publicador real de Instagram"],
      ] as const).map(([nombre, on, que]) => (
        <span
          key={nombre}
          title={que}
          className={`border-2 px-1.5 py-0.5 font-bold ${
            on ? "border-black bg-green-700 text-white" : "border-black bg-white text-[color:var(--red)]"
          }`}
        >
          {nombre}={String(on)}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {heading ? (
        <header>
          <div className="text-[10px] font-mono tracking-[0.25em] text-black/60 mb-2">
            MARTA · INSTAGRAM · CALENDARIO DEL MES
          </div>
          <h1 className="font-stencil text-3xl md:text-4xl leading-none uppercase">Calendario del mes</h1>
          <p className="text-sm text-black/60 mt-2 max-w-2xl">
            Una sola llamada genera el mes entero: imagen de marca, texto, hashtags y hora de publicación.
            Los posts quedan <strong>programados</strong> y el flujo de publicación existente los recoge a su
            hora. Aquí los revisas antes de que salga nada.
          </p>
          <p className="text-xs font-mono mt-2 text-black/45">
            {tenant?.name ?? tenantId} · mes {mesActual}
          </p>
          <div className="mt-2">{flags}</div>
          <p className="text-[11px] text-black/50 mt-2 max-w-2xl leading-relaxed">
            La publicación automática la dispara n8n llamando a{" "}
            <code className="bg-black/5 px-1">/api/cron/marta-calendar-publicar</code> (Bearer CRON_SECRET).
            Publica de verdad <strong>solo con los dos flags de publicación en true</strong>; si no, hace
            dry-run y te dice qué publicaría.
          </p>
        </header>
      ) : (
        <div className="card-hard bg-white p-4 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-black/45">
            Marta · Instagram · calendario del mes
          </div>
          <p className="text-sm text-black/70 leading-snug max-w-2xl">
            Genera el <strong>mes entero</strong> de una vez (imagen de marca + texto + hashtags + hora), sube
            posts propios y ajusta la marca. Cada post se puede reprogramar, regenerar (texto o imagen) o
            publicar al momento. <span className="text-black/45">{tenant?.name ?? tenantId} · mes {mesActual}</span>
          </p>
          {flags}
        </div>
      )}

      <AutomaticoForm tenantId={tenantId} dias={pauta.dias} autoEnabled={autoEnabled} />

      <IdentidadVisual
        tenantId={tenantId}
        nombre={nombreNegocio}
        fondo={marca.fondo}
        acento={marca.acento}
        texto={marca.texto}
        logoUrl={marca.logoUrl}
        plantilla={marca.plantilla}
        cta={marca.cta}
      />

      <SubirPost tenantId={tenantId} defaultFecha={defaultFecha} defaultHora={defaultHora} />

      <section className="space-y-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="font-stencil text-2xl uppercase">Programado este mes</h2>
          <span className="text-[11px] font-mono uppercase tracking-widest text-black/45">
            {delMes.length} posts
          </span>
        </div>

        {delMes.length === 0 ? (
          <div className="card-hard bg-white p-6 text-sm text-black/50">
            Todavía no hay nada programado en {mesActual}. Marca los días en la pauta de arriba y pulsa{" "}
            <strong>Generar posts del mes</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {delMes.map((e) => {
              const { texto, hashtags } = separarHashtags(e.caption);
              const { fecha, hora } = utcToMadridFields(new Date(e.scheduledAt));
              return (
                <PostCard
                  key={e.id}
                  scheduledAt={e.scheduledAt}
                  imageUrl={e.imageUrl}
                  texto={texto}
                  hashtags={hashtags}
                  temaLabel={e.tema}
                  estado={e.status}
                  entryId={e.id}
                  tenantId={tenantId}
                  igMediaId={e.igMediaId}
                  errorDetail={e.errorDetail}
                  defaultFecha={fecha}
                  defaultHora={hora}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
