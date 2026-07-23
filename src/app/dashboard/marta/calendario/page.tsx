// Página de revisión del calendario mensual de Marta (Nivel 3).
// Muestra el mes ya programado (miniatura + caption + hashtags + fecha/hora)
// y permite disparar la generación a mano para revisarla antes de nada.

import { DEFAULT_TENANT_ID, getTenant, getPautaPublicacion } from "@/lib/tenants";
import { listCalendar } from "@/lib/marta-calendar";
import { separarHashtags, martaAutoEnabled, utcToMadridFields } from "@/lib/marta-mes";
import { martaAutoPublishEnabled } from "@/lib/marta-auto-publish";
import { isPublishEnabled } from "@/lib/marta-publish";
import PostCard from "./PostCard";
import AutomaticoForm from "./AutomaticoForm";
import SubirPost from "./SubirPost";

export const dynamic = "force-dynamic";

export default async function MartaCalendarioMesPage() {
  const tenantId = DEFAULT_TENANT_ID;
  const tenant = await getTenant(tenantId);
  const autoEnabled = martaAutoEnabled();
  const autoPublish = martaAutoPublishEnabled();
  const publishOn = isPublishEnabled();
  const pauta = await getPautaPublicacion(tenantId);

  // Solo el mes en curso (es lo que genera el orquestador).
  const ahora = new Date();
  const mesActual = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, "0")}`;
  const todas = await listCalendar(tenantId);
  const delMes = todas.filter((e) => e.scheduledAt.slice(0, 7) === mesActual);

  // Valor por defecto del formulario manual: mañana a la primera hora de la pauta.
  const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  const defaultFecha = utcToMadridFields(manana).fecha;
  const defaultHora = `${String(pauta.dias[0]?.hora ?? 10).padStart(2, "0")}:00`;

  return (
    <div className="space-y-6">
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
        <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-mono">
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
        <p className="text-[11px] text-black/50 mt-2 max-w-2xl leading-relaxed">
          La publicación automática la dispara n8n llamando a{" "}
          <code className="bg-black/5 px-1">/api/cron/marta-calendar-publicar</code> (Bearer CRON_SECRET).
          Publica de verdad <strong>solo con los dos flags de publicación en true</strong>; si no, hace
          dry-run y te dice qué publicaría.
        </p>
      </header>

      <AutomaticoForm tenantId={tenantId} dias={pauta.dias} autoEnabled={autoEnabled} />

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
            Todavía no hay nada programado en {mesActual}. Usa <strong>Previsualizar</strong> para ver
            cómo quedaría el mes sin guardar nada.
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
