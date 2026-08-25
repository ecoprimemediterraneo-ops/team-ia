import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { getUser } from "@/lib/store";
import { agents, agentBySlug, type AgentSlug } from "@/lib/agents";
import { getFeed } from "@/lib/feed";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { calcularKpis } from "@/lib/kpis-sector";
import PorQueEstePanel from "@/components/PorQueEstePanel";
import AvisoCriticos from "@/components/gestoria/AvisoCriticos";
import Portada from "@/components/gestoria/Portada";
import { tieneFuncion } from "@/lib/sectores";

const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function startOfWeek(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // monday=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * El panel de tarjetas de siempre.
 *
 * Sigue siendo la entrada de peluquerías, clínicas y restaurantes. En gestoría
 * ya no: allí se entra por la portada (ver abajo), y a esto se llega solo por
 * `/dashboard/panel`, sin ningún enlace que lleve. No se borra nada.
 */
export async function PanelClasico() {
  const session = await getSessionLocal();
  if (!session) redirect("/login");
  const user = await getUser(session.email);

  if (!user.business) redirect("/onboarding");

  const contacts = user.contacts ?? [];
  const activity = user.activity ?? [];
  const stats = user.stats ?? { emailsSent: 0, lastChatAt: {} };
  const weekStart = startOfWeek();
  const emailsThisWeek = activity.filter(
    (a) => a.type === "email_sent" && new Date(a.ts) >= weekStart
  ).reduce((sum, a) => {
    const match = a.detail.match(/^(\d+)\s/);
    return sum + (match ? parseInt(match[1]) : 1);
  }, 0);

  // Perfil de sector: decide con qué KPIs abre el panel y con qué palabras habla.
  const ctx = await contextoPanelODefecto();
  const v = ctx.vocabulario;
  const kpis = await calcularKpis(ctx.tenantId, ctx.perfil);
  /**
   * En gestoría este panel enseña MENOS.
   *
   * Nada se borra: los bloques que se apagan aquí siguen en el código y los
   * siguen viendo peluquerías, clínicas y restaurantes exactamente igual. Lo que
   * cambia es que a un gestor con cien clientes no le dice nada "Leads esta
   * semana" ni "Emails enviados" —son de la parte comercial— y el equipo ya está
   * en el menú lateral, así que repetirlo abajo es relleno.
   */
  const esGestoria = ctx.perfil.id === "gestoria";

  // Feed real del event-log (este mes + anterior) — agenda + Pablo + Marta + Eva + Rocío
  const feed = await getFeed(ctx.tenantId, 12);
  const recentActivity = feed.entries;

  // Contadores: combinamos legacy (contacts/activity/stats) con event-log.
  const leadsThisWeek = contacts.filter((c) => new Date(c.addedAt) >= weekStart).length + feed.counters.leads;
  const chatsThisWeek = activity.filter(
    (a) => a.type === "chat" && new Date(a.ts) >= weekStart
  ).length;
  // Mensajes IN del event-log (entrantes de clientes vía Pablo/Marta) — refleja tráfico real
  const mensajesIn = feed.counters.mensajesIn;
  const citasMes = feed.counters.citas;

  // (helpers legacy quedan para el panel de Últimos leads más abajo si los necesitásemos)
  void agentBySlug;
  // Aviso a TS: AgentSlug se sigue usando indirectamente; mantenemos el import.
  type _Keep = AgentSlug;

  return (
    <div className="space-y-6">
      {/* Lo primero de la portada, por encima del banner: si hay una
          notificación crítica sin abrir, es lo único que importa hoy. Solo en
          gestoría, y solo cuando la hay. */}
      {tieneFuncion(ctx.sector, "clasificacionCorreo") && <AvisoCriticos />}

      {/* LA CABECERA, EN UNA LÍNEA — SOLO EN GESTORÍA.
          Aquí había un banner enorme: seis avatares en fila, los rótulos PANEL y
          TU CUENTA, un "¿Por qué este panel?" y "HOLA, ECOPRIMEMEDITERRANEO." en
          letras de cartel —el prefijo del correo, que no es el nombre de nadie—.
          Ocupaba la primera pantalla entera para no decir nada que el gestor no
          supiera ya. Se queda el nombre del negocio y su sector, que es lo único
          que sitúa, y el aviso de vista de prueba, que sí hace falta.
          El resto de sectores conservan su banner intacto. */}
      {esGestoria ? (
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-sm text-black/60 flex-1">
              {ctx.tenant?.ficha?.nombreNegocio || ctx.tenant?.name || user.business.nombre} ·{" "}
              {ctx.sector ? ctx.perfil.label : ctx.tenant?.ficha?.sector || user.business.sector}
            </p>
            {/* LA VUELTA. Igual de discreta que la de ida: desde el panel no
                había forma de volver a la portada salvo tecleando la URL. */}
            <a
              href="/dashboard"
              className="text-[11px] font-mono uppercase tracking-widest text-black/40 hover:text-black hover:underline whitespace-nowrap"
            >
              ← Volver a la portada
            </a>
          </div>
          {ctx.mirandoOtro && (
            <p className="mt-2 text-[11px] font-mono bg-[color:var(--mustard)] border-2 border-black inline-block px-2 py-1">
              VISTA DE PRUEBA · estás mirando el panel de {ctx.tenantId} ·{" "}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ver-panel es un
                  route handler que pone una cookie y redirige: necesita navegación completa,
                  no la del router del cliente. */}
              <a href="/admin/ver-panel/propio" className="underline">volver al tuyo</a>
            </p>
          )}
        </div>
      ) : (
      <div className="relative card-hard overflow-hidden">
        <div className="brick absolute inset-0 opacity-30" />
        <div className="relative p-5 flex items-center gap-5 flex-wrap">
          <div className="flex -space-x-3">
            {(ctx.sector ? ctx.perfil.agentes.map((sl) => agents.find((x) => x.slug === sl)!).filter(Boolean) : agents).map((a) => (
              <div
                key={a.slug}
                className="relative w-14 h-14 border-[3px] border-black overflow-hidden shrink-0"
                style={{ background: a.color }}
                title={`${a.name} · ${a.role}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 text-xs font-mono">
              <span className="bg-black text-[color:var(--mustard)] px-2 py-0.5 font-bold tracking-widest">PANEL</span>
              <span className="border-2 border-[color:var(--red)] text-[color:var(--red)] px-2 py-0.5 font-bold tracking-widest hidden sm:inline">TU CUENTA</span>
              {/* El texto sale del perfil de sector, no de aquí. */}
              {ctx.sector && <PorQueEstePanel perfil={ctx.perfil} />}
            </div>
            <h1 className="font-stencil text-3xl md:text-5xl leading-[1]">
              Hola{session.email ? `, ${session.email.split("@")[0]}` : ""}.
            </h1>
            <p className="text-black/70 mt-1 text-sm">
              {ctx.tenant?.ficha?.nombreNegocio || user.business.nombre} ·{" "}
              {/* Sin sector de negocio (cuenta comercial de AI-Team) no se enseña la
                  etiqueta del perfil por defecto: diría "Salón de belleza" y sería falso. */}
              {ctx.sector ? ctx.perfil.label : ctx.tenant?.ficha?.sector || user.business.sector}
            </p>
            {ctx.mirandoOtro && (
              <p className="mt-2 text-[11px] font-mono bg-[color:var(--mustard)] border-2 border-black inline-block px-2 py-1">
                VISTA DE PRUEBA · estás mirando el panel de {ctx.tenantId} ·{" "}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ver-panel es un
                    route handler que pone una cookie y redirige: necesita navegación completa,
                    no la del router del cliente. */}
                <a href="/admin/ver-panel/propio" className="underline">volver al tuyo</a>
              </p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* KPIs DEL SECTOR — con lo que abre el panel de este tipo de negocio.

          EN GESTORÍA, DOS PESAN Y EL RESTO NO (bloque de abajo). Siete recuadros
          del mismo tamaño no son siete datos: son cero, porque ninguno destaca y
          la vista no sabe dónde posarse. No se borra ni una cifra —las cinco que
          salen del recuadro siguen abajo, en una línea— pero solo dos se leen de
          lejos: cuántos mensajes entran y cuánto se tarda en contestar, que es la
          promesa del producto. Los demás sectores conservan su rejilla intacta. */}
      {!esGestoria && (
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-2">
          Lo que importa en {v.negocio}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpis.map((k) => (
            <div key={k.id} className="card-hard p-4">
              <div className="text-xs font-mono uppercase tracking-widest text-black/60">{k.etiqueta}</div>
              {k.valor === null ? (
                <>
                  <div className="font-stencil text-4xl mt-1 text-black/25">—</div>
                  {/* Sin dato de verdad: se dice, no se rellena con un número parecido. */}
                  <div className="text-[11px] text-black/50 mt-1 leading-snug">{k.motivo}</div>
                </>
              ) : (
                <>
                  <div className="font-stencil text-4xl mt-1">{k.valor}</div>
                  <div className="text-xs text-black/50 mt-1">{k.ayuda}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {esGestoria && (() => {
        // El de tiempo de respuesta sale de los KPIs del sector; los otros del
        // event-log. Se buscan por id, no por posición: si mañana cambia el
        // orden en `sectores.ts`, esto sigue enseñando lo que dice enseñar.
        const kpi = (id: string) => kpis.find((k) => k.id === id);
        const tiempo = kpi("tiempo_respuesta");
        const consultas = kpi("consultas_recibidas");
        const resueltos = kpi("estados_resueltos_solos");
        // Un guion cuando no hay dato, nunca un cero: son cosas distintas.
        const cifra = (k?: { valor: number | string | null }) =>
          !k || k.valor === null ? "—" : String(k.valor);
        const menudo = [
          `Consultas ${cifra(consultas)}`,
          `${cap(v.citaPlural)} ${citasMes}`,
          `Emails ${emailsThisWeek}`,
          `Leads ${leadsThisWeek}`,
          `Resueltos solos ${cifra(resueltos)}`,
        ].join(" · ");
        return (
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-black/50 mb-2">
              Lo que importa en {v.negocio}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card-hard p-4">
                <div className="text-xs font-mono uppercase tracking-widest text-black/60">
                  Mensajes de {v.clientePlural}
                </div>
                <div className="font-stencil text-4xl mt-1">{mensajesIn}</div>
                <div className="text-xs text-black/50 mt-1">Pablo + Marta · mes</div>
              </div>
              <div className="card-hard p-4">
                <div className="text-xs font-mono uppercase tracking-widest text-black/60">
                  {tiempo?.etiqueta ?? "Tiempo de respuesta"}
                </div>
                {tiempo && tiempo.valor === null ? (
                  <>
                    <div className="font-stencil text-4xl mt-1 text-black/25">—</div>
                    <div className="text-[11px] text-black/50 mt-1 leading-snug">{tiempo.motivo}</div>
                  </>
                ) : (
                  <>
                    <div className="font-stencil text-4xl mt-1">{cifra(tiempo)}</div>
                    <div className="text-xs text-black/50 mt-1">{tiempo?.ayuda}</div>
                  </>
                )}
              </div>
            </div>
            {/* Las otras cinco. Siguen ahí, pero no compiten. */}
            <p className="text-xs text-black/50 mt-2">{menudo}</p>
          </div>
        );
      })()}

      {/* STATS generales — FUERA EN GESTORÍA.
          "Trámites este mes", "Mensajes de clientes", "Leads esta semana" y
          "Emails enviados" son números de la parte comercial. Arriba ya están
          los tres que sí le importan a un gestor (consultas recibidas, estados
          resueltos solos y tiempo de respuesta), y cuatro cifras más al lado
          solo consiguen que no se mire ninguna. */}
      {!esGestoria && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">{cap(v.citaPlural)} este mes</div>
          <div className="font-stencil text-4xl mt-1">{citasMes}</div>
          <div className="text-xs text-black/50 mt-1">Agenda central</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Mensajes de {v.clientePlural}</div>
          <div className="font-stencil text-4xl mt-1">{mensajesIn}</div>
          <div className="text-xs text-black/50 mt-1">Pablo + Marta · mes</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Leads esta semana</div>
          <div className="font-stencil text-4xl mt-1">{leadsThisWeek}</div>
          <div className="text-xs text-black/50 mt-1">Total contactos: {contacts.length}</div>
        </div>
        <div className="card-hard p-4">
          <div className="text-xs font-mono uppercase tracking-widest text-black/60">Emails enviados</div>
          <div className="font-stencil text-4xl mt-1">{emailsThisWeek}</div>
          <div className="text-xs text-black/50 mt-1">Total: {stats.emailsSent}</div>
        </div>
      </div>
      )}

      {/* ACTIVIDAD RECIENTE — FUERA EN GESTORÍA.
          Es un registro de lo que YA pasó: adjuntos que entraron, acuses que
          mandó Pablo. Está bien para ver que el sistema respira, pero a Jose no
          le dice qué tiene que hacer, y en esta pantalla ocupaba el sitio
          principal. Lo que hay que hacer está en Vencimientos y en la portada. */}
      {!esGestoria && (
      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        {/* ACTIVIDAD RECIENTE — feed del event-log */}
        <div className="card-hard p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-stencil text-xl">Actividad reciente</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/50">últimos {recentActivity.length}</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-black/60 italic py-6 text-center">
              Aún no hay actividad. Cuando tu equipo IA empiece a recibir mensajes, agendar citas o publicar
              respuestas, aparecerán aquí.
            </p>
          ) : (
            <ul className="space-y-1">
              {recentActivity.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-3 text-sm border-b border-black/10 pb-2 last:border-0"
                >
                  {/* Avatar/emoji del agente con su color */}
                  <span
                    className="shrink-0 w-9 h-9 border-2 border-black flex items-center justify-center text-lg"
                    style={{ background: e.agentColor }}
                    title={e.agentName}
                  >
                    {e.agentEmoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold leading-tight">{e.label}</span>
                    {e.detail && (
                      <span className="block text-xs text-black/60 truncate">{e.detail}</span>
                    )}
                    {e.htmlLink && (
                      <a
                        href={e.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-[11px] font-bold underline mt-0.5"
                      >
                        Ver en Google Calendar →
                      </a>
                    )}
                  </span>
                  <span className="text-[11px] font-mono text-black/50 whitespace-nowrap pt-1">
                    {timeAgo(e.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ÚLTIMOS LEADS — FUERA EN GESTORÍA.
            Los leads son contactos captados por el formulario de Eva: es la
            parte comercial de AI-Team, no el trabajo de una gestoría. A Jose no
            le entran leads, le entran facturas. */}
        {!esGestoria && (
        <div className="card-hard p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-stencil text-xl">Últimos leads</h2>
            <a href="/dashboard/eva" className="text-[10px] font-mono uppercase tracking-widest text-black/50 underline">ver todos</a>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-black/60 italic py-6 text-center">
              Aún no has captado ningún lead. Activa el formulario en Eva.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...contacts].reverse().slice(0, 5).map((c) => (
                <li key={c.email} className="text-sm border-b border-black/10 pb-2 last:border-0">
                  <div className="font-bold truncate">{c.name || c.email}</div>
                  <div className="flex items-center justify-between text-xs text-black/60">
                    <span className="truncate">{c.email}</span>
                    <span className="font-mono whitespace-nowrap pl-2">{timeAgo(c.addedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </div>
      )}

      {/* EL EQUIPO OTRA VEZ — FUERA EN GESTORÍA.
          Los mismos cuatro agentes ya están en el menú lateral, así que esto es
          la segunda vez que se ven en la misma pantalla. Y peor: aquí se pintan
          los SEIS de la casa, así que a una gestoría le aparecían Rocío y Marta,
          que no llevan nada suyo. */}
      {!esGestoria && (
      <div>
        <h2 className="font-stencil text-2xl mb-3">Tu equipo</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((a) => {
            const last = stats.lastChatAt[a.slug];
            return (
              <a
                key={a.slug}
                href={`/dashboard/${a.slug}`}
                className="card-hard p-4 hover:-translate-y-0.5 transition flex items-center gap-3"
              >
                <span
                  className="w-12 h-12 border-[3px] border-black flex items-center justify-center text-2xl shrink-0"
                  style={{ background: a.color }}
                >
                  {a.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-black/60">{a.role}</div>
                  <div className="font-stencil text-lg leading-none">{a.name}</div>
                  <div className="text-[11px] text-black/60">
                    {last ? `Último uso: ${timeAgo(last)}` : "Sin estrenar"}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * LA ENTRADA DEL PANEL.
 *
 * Había DOS pantallas de inicio compitiendo: esta, con sus tarjetas y sus
 * cifras, y `/dashboard/portada`, con el resumen y el chat. Dos puertas para la
 * misma casa significan que la mitad de las veces entras por la que no querías,
 * y que hay que mantener las dos al día.
 *
 * En gestoría gana la portada, y se sirve AQUÍ MISMO en vez de redirigir: un
 * `redirect` cambiaría la URL, dejaría `/dashboard` como un sitio que nunca se
 * ve y metería un salto de más en cada entrada. Así `/dashboard` es la portada
 * y punto.
 *
 * Los demás sectores entran exactamente a lo de siempre.
 */
export default async function DashboardHome() {
  const session = await getSessionLocal();
  if (!session) redirect("/login");
  const user = await getUser(session.email);
  if (!user.business) redirect("/onboarding");

  const ctx = await contextoPanelODefecto();
  if (ctx.perfil.id !== "gestoria") return <PanelClasico />;

  // Con qué nombre se saluda. Igual que en /dashboard/portada.
  const nombre = (ctx.tenant?.ownerName || "").trim();
  return <Portada nombreGestor={nombre} tenantId={ctx.tenantId} />;
}
