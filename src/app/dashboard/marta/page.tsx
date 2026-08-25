import { redirect } from "next/navigation";
// getSessionLocal (no getSession) para ir en línea con el layout del dashboard, que
// ya autoriza con el bypass de desarrollo local. En producción es idéntico a
// getSession (el ramo dev nunca corre en Vercel), así que no cambia la seguridad.
import { getSessionLocal } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { agentBySlug } from "@/lib/agents";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { listProposalsByTenant } from "@/lib/marta-proposals";
import { isPublishEnabled } from "@/lib/marta-publish";
import { getSchedule, DIRECT_PUBLISH_ENABLED, CRON_GRANULARITY } from "@/lib/marta-schedule";
import { getCommentRules, isCommentDmEnabled } from "@/lib/marta-comment-rules";
import { tokenInstagramDeTenant, conexionPendienteDeTenant } from "@/lib/instagram-login";
import BloqueConectar from "./conectar/BloqueConectar";
import BloqueMensajes from "./mensajes/BloqueMensajes";
import { idiomaDe, traductor, conIdioma } from "@/lib/idioma";
import MartaLivePanel from "./MartaLivePanel";
import CalendarioMes from "./calendario/CalendarioMes";

export const dynamic = "force-dynamic";

export default async function MartaPage({
  searchParams,
}: {
  // `ok`, `cuenta` y `error` los trae la vuelta del OAuth (ver
  // /dashboard/marta/conectar, que reenvía aquí con ?tab=arranque).
  searchParams: Promise<{ tab?: string; ok?: string; cuenta?: string; error?: string; lang?: string }>;
}) {
  const s = await getSessionLocal();
  if (!s) redirect("/login");
  const user = await getUser(s.email);
  if (!user.business) redirect("/onboarding");
  const a = agentBySlug.marta;

  // Pestaña inicial (p. ej. la ruta suelta /dashboard/marta/calendario redirige
  // aquí con ?tab=calendario para abrir el calendario directamente).
  const sp = await searchParams;
  // MODO INGLÉS PARA GRABAR EL APP REVIEW. Sin `?lang=en` esto es "es" y no
  // cambia ni una palabra: `idiomaDe` solo acepta el literal "en".
  const idioma = idiomaDe(sp?.lang);
  const t = traductor(idioma);
  const initialTab =
    sp?.tab === "calendario" ? ("calendario" as const)
    : sp?.tab === "arranque" ? ("arranque" as const)
    : sp?.tab === "mensajes" ? ("mensajes" as const)
    : sp?.tab === "comentarios" ? ("comentarios" as const)
    : sp?.tab === "historial" ? ("historial" as const)
    // La vuelta del OAuth abre "Empezar cuenta" aunque no venga `tab`: es donde
    // está el banner que dice si la conexión ha salido bien.
    : sp?.ok || sp?.error ? ("arranque" as const)
    : undefined;

  // Tenant del cliente — single-tenant durante la beta.
  // El tenant sale del contexto del panel, NO de una constante. Con
  // DEFAULT_TENANT_ID a fuego, el panel de cualquier cliente enseñaba el
  // calendario y la marca de AI-Team.
  const ctxPanel = await contextoPanelODefecto();
  const tenantId = ctxPanel.tenantId;
  const proposals = await listProposalsByTenant(tenantId);
  const enabled = isPublishEnabled();
  const schedule = await getSchedule(tenantId);
  const commentRules = await getCommentRules(tenantId);
  // Por TENANT: el envío está encendido en la cuenta propia (hace falta para
  // grabar el vídeo del App Review) y apagado en la de cualquier cliente.
  const commentDmEnabled = isCommentDmEnabled(tenantId);
  // ¿Tiene este cliente su cuenta de Instagram conectada? De aquí sale tanto el
  // rótulo de la cabecera como el aviso de abajo.
  const instagram = await tokenInstagramDeTenant(tenantId);
  // Autorizada en Instagram pero sin confirmar. Es un estado distinto de "no
  // conectada": el cliente ya hizo su parte y lo que falta es un clic suyo, así
  // que el aviso tiene que decir eso y no mandarle a empezar de cero.
  const pendiente = instagram ? null : await conexionPendienteDeTenant(tenantId);

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono flex-wrap">
          <span className="border-2 border-black px-2 py-0.5 font-bold tracking-widest" style={{ background: a.color }}>
            {idioma === "en" ? t("cab_rol") : a.role.toUpperCase()}
          </span>
          {/* ESTE RÓTULO DECÍA "✓ Conectada a Instagram" A FUEGO, siempre, para
              todos. Con una sola cuenta y un token pegado a mano era verdad; con
              clientes es mentira, y es la mentira peor: el cliente lee que está
              conectado y no entiende por qué no pasa nada. Ahora sale de si hay
              token de verdad.

              SIN CUENTA NO SE PONE NADA AQUÍ. Hubo un botón de conectar, y con
              el aviso amarillo de abajo y el del PASO 1 eran TRES llamadas a lo
              mismo en la misma pantalla. Tres botones para una sola acción no
              insisten: dan a entender que son tres cosas distintas. La cabecera
              informa; quien pide algo es el aviso. */}
          {instagram && (
            <span className="ml-auto text-[11px] font-mono text-black/55 hidden md:inline truncate max-w-[55%]">
              {t("cab_conectada_como")} @{instagram.usuario || t("cab_tu_cuenta")} · {t("cab_aprobacion")}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <h1 className="font-stencil text-3xl md:text-4xl leading-none">{a.name}</h1>
            <p className="text-sm text-black/60 mt-0.5">
              {idioma === "en" ? t("cab_subtitulo") : a.short}
            </p>
          </div>
          {instagram && (
            <p className="text-[11px] font-mono text-black/55 md:hidden">
              {t("cab_conectada_como")} @{instagram.usuario || t("cab_tu_cuenta")} · {t("cab_aprobacion")}
            </p>
          )}
        </div>
      </header>

      {/* SIN CUENTA CONECTADA, MARTA NO PUEDE HACER NADA. Va arriba del todo y
          con el amarillo de la casa —el mismo que usa el aviso de publicación
          pausada—, porque es la primera pieza que falta: sin esto, el resto del
          panel es un simulacro. */}
      {!instagram && (
        <div className="card-hard bg-white p-4 border-[3px] border-[color:var(--mustard)]">
          <div className="font-bold mb-1">
            {t(pendiente ? "aviso_pendiente_titulo" : "aviso_sin_conectar_titulo")}
          </div>
          <p className="text-xs text-black/70 leading-snug mb-3">
            {pendiente
              ? t("aviso_pendiente_texto", { cuenta: `@${pendiente.usuario || t("cab_tu_cuenta")}` })
              : t("aviso_sin_conectar_texto")}
          </p>
          <a
            href={conIdioma("/dashboard/marta?tab=arranque", idioma)}
            className="btn-mustard inline-block text-sm px-5 py-2.5 font-bold"
          >
            {t(pendiente ? "aviso_boton_confirmar" : "aviso_boton_conectar")}
          </a>
        </div>
      )}

      <MartaLivePanel
        initialProposals={proposals.slice(0, 10)}
        enabled={enabled}
        initialSchedule={schedule}
        directPublishEnabled={DIRECT_PUBLISH_ENABLED}
        cronDaily={CRON_GRANULARITY === "daily"}
        initialCommentRules={commentRules}
        commentDmEnabled={commentDmEnabled}
        initialTab={initialTab}
        calendario={<CalendarioMes tenantId={tenantId} heading={false} />}
        idioma={idioma}
        conectar={
          <BloqueConectar
            resultado={{ ok: sp?.ok, cuenta: sp?.cuenta, error: sp?.error }}
            idioma={idioma}
          />
        }
        mensajes={<BloqueMensajes idioma={idioma} />}
      />
    </section>
  );
}
