// REDES — Marta y Rocío en primer plano, con pestaña propia. En un salón
// Instagram es el escaparate (de ahí te ven y te escriben) y las reseñas de Google
// pesan mucho en quién entra por la puerta. Publicaciones, comentario→DM,
// mensajes y reseñas son trabajo de todos los días, no un rincón del menú.
//
// NO SE REESCRIBE NADA. Se monta el mismo `MartaLivePanel` (con los mismos bloques
// y datos que `/dashboard/marta`) y el mismo `RocioLivePanel` que `/dashboard/rocio`
// y la pestaña Reseñas de dental. Lo que se deja fuera son las cabeceras de agente
// de aquellas pantallas: el panel del salón ya tiene la suya arriba.

import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { listProposalsByTenant } from "@/lib/marta-proposals";
import { isPublishEnabled } from "@/lib/marta-publish";
import { getSchedule, DIRECT_PUBLISH_ENABLED, CRON_GRANULARITY } from "@/lib/marta-schedule";
import { getCommentRules, isCommentDmEnabled } from "@/lib/marta-comment-rules";
import { historialComentarios } from "@/lib/marta-comment-historial";
import { tokenInstagramDeTenant, conexionPendienteDeTenant } from "@/lib/instagram-login";
import MartaLivePanel from "@/app/dashboard/marta/MartaLivePanel";
import CalendarioMes from "@/app/dashboard/marta/calendario/CalendarioMes";
import BloqueConectar from "@/app/dashboard/marta/conectar/BloqueConectar";
import BloqueMensajes from "@/app/dashboard/marta/mensajes/BloqueMensajes";
import RocioTools from "@/components/RocioTools";
import RocioTracker from "@/components/RocioTracker";
import { isMockMode } from "@/lib/google-business";
import { isRocioLive, resolveTenantForRocio } from "@/lib/rocio-flow";
import { listRocioByTenant } from "@/lib/rocio-proposals";
import RocioLivePanel from "@/app/dashboard/rocio/RocioLivePanel";

export const dynamic = "force-dynamic";

export default async function RedesSalonPage({
  searchParams,
}: {
  // `ok`, `cuenta` y `error` los trae la vuelta del OAuth de Instagram.
  searchParams: Promise<{ tab?: string; ok?: string; cuenta?: string; error?: string }>;
}) {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const ctx = await contextoPanelODefecto();

  if (ctx.perfil.id !== "salon") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-stencil text-3xl leading-none mb-2">Redes</h1>
        <div className="card-hard bg-white p-6 text-sm text-black/70">Esta pantalla es para salones de belleza.</div>
      </div>
    );
  }

  const sp = await searchParams;
  const initialTab =
    sp?.tab === "calendario" ? ("calendario" as const)
    : sp?.tab === "arranque" ? ("arranque" as const)
    : sp?.tab === "mensajes" ? ("mensajes" as const)
    : sp?.tab === "comentarios" ? ("comentarios" as const)
    : sp?.tab === "historial" ? ("historial" as const)
    : sp?.ok || sp?.error ? ("arranque" as const)
    : undefined;

  const tenantId = ctx.tenantId;
  const [proposals, schedule, commentRules, historial, instagram] = await Promise.all([
    listProposalsByTenant(tenantId),
    getSchedule(tenantId),
    getCommentRules(tenantId),
    historialComentarios(tenantId, 20),
    tokenInstagramDeTenant(tenantId),
  ]);
  const pendiente = instagram ? null : await conexionPendienteDeTenant(tenantId);

  // Reseñas (Rocío).
  const rocioLive = await isRocioLive(s.email);
  const mock = isMockMode();
  const autoReply = (process.env.ROCIO_AUTO_REPLY || "").toLowerCase() === "true";
  const tenantRocio = await resolveTenantForRocio(s.email);
  const propuestasRocio = rocioLive ? await listRocioByTenant(tenantRocio) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-stencil text-3xl md:text-4xl leading-none">Redes y reseñas</h1>
        <p className="text-sm text-black/60 mt-1">
          {instagram
            ? `Marta, conectada como @${instagram.usuario || "tu cuenta"} · nada se publica sin tu aprobación.`
            : "Conecta Instagram para que Marta publique y conteste los DM."}
        </p>
      </div>

      {/* SIN CUENTA CONECTADA, MARTA NO PUEDE HACER NADA. Mismo aviso que en
          `/dashboard/marta`, con el amarillo de la casa. */}
      {!instagram && (
        <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)]">
          <div className="font-bold mb-1">
            {pendiente ? "Te falta un clic para terminar" : "Conecta tu cuenta de Instagram"}
          </div>
          <p className="text-xs text-black/70 leading-snug mb-3">
            {pendiente
              ? `Ya autorizaste @${pendiente.usuario || "tu cuenta"} en Instagram. Falta confirmarlo aquí.`
              : "Sin cuenta conectada, Marta no puede publicar ni contestar comentarios ni DM."}
          </p>
          <a href="/dashboard/redes-salon?tab=arranque" className="btn-mustard inline-block text-sm px-5 py-2.5 font-bold">
            {pendiente ? "Confirmar la cuenta" : "Conectar Instagram"}
          </a>
        </div>
      )}

      <MartaLivePanel
        initialProposals={proposals.slice(0, 10)}
        enabled={isPublishEnabled()}
        initialSchedule={schedule}
        directPublishEnabled={DIRECT_PUBLISH_ENABLED}
        cronDaily={CRON_GRANULARITY === "daily"}
        initialCommentRules={commentRules}
        commentDmEnabled={isCommentDmEnabled(tenantId)}
        historialComentarios={historial}
        initialTab={initialTab}
        calendario={<CalendarioMes tenantId={tenantId} heading={false} />}
        conectar={<BloqueConectar resultado={{ ok: sp?.ok, cuenta: sp?.cuenta, error: sp?.error }} />}
        mensajes={<BloqueMensajes />}
      />

      <div className="border-t-2 border-black/10 pt-4 space-y-3">
        <h2 className="font-stencil text-2xl">Reseñas</h2>
        <p className="text-sm text-black/60 -mt-1">
          {rocioLive ? "Rocío, conectada a Google Business · aprobación por WhatsApp." : "Conecta Google Business para que Rocío lea y conteste tus reseñas."}
        </p>
        {!rocioLive ? (
          <div className="card-hard bg-white p-4 flex flex-col items-start gap-2">
            <h3 className="font-stencil text-xl leading-tight">Conecta tu ficha de Google Business</h3>
            <p className="text-sm text-black/70 max-w-xl leading-snug">
              Rocío necesita acceso a Google Business Profile para leer tus reseñas y publicar respuestas. Nada se publica sin tu aprobación.
            </p>
            <a href="/api/rocio/auth" className="btn-mustard inline-block text-sm px-4 py-2">Conectar mi Google Business →</a>
          </div>
        ) : (
          <RocioLivePanel proposals={propuestasRocio} mockMode={mock} autoReplyEnabled={autoReply} />
        )}
        <div className="space-y-3">
          <h3 className="font-stencil text-xl">Pedir reseñas y generar respuestas</h3>
          <RocioTools />
          <RocioTracker />
        </div>
      </div>
    </div>
  );
}
