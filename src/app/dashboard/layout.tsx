import { redirect } from "next/navigation";
import { getSessionLocal } from "@/lib/auth";
import { getUser } from "@/lib/store";
import Logo from "@/components/Logo";
import { agents, agentBySlug } from "@/lib/agents";
import { contextoPanelODefecto, puedeCambiarDeCuenta } from "@/lib/panel-contexto";
import SelectorCuenta from "@/components/SelectorCuenta";
import { tieneFuncion } from "@/lib/sectores";
import EnlaceLateral from "@/components/EnlaceLateral";
import EnlaceAgente from "@/components/EnlaceAgente";
import MarcoPanel from "@/components/MarcoPanel";
import LateralGestoria from "@/components/gestoria/LateralGestoria";

// Las tarjetas de agente NO llevan insignia de estado. Había un "LIVE" verde en los
// conectados y un "PRÓXIMAMENTE" en Carmen y Rocío: al cliente no le dice nada útil y
// enseñar media plantilla marcada como pendiente resta más de lo que informa. Los
// agentes siguen todos en la lista; lo que se ha quitado es el cartelito.

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // En producción exige sesión real; en desarrollo local entra con dueño por defecto.
  const session = await getSessionLocal();
  if (!session) redirect("/login");
  const user = await getUser(session.email);

  // Perfil de sector del cliente: decide QUÉ agentes ve y EN QUÉ ORDEN.
  // Un salón no necesita a Sergio; una gestoría abre por Lucía.
  // Si el tenant es la cuenta comercial de AI-Team (sector null), se enseñan
  // todos, como hasta ahora.
  const ctx = await contextoPanelODefecto();
  const visibles: typeof agents = ctx.sector
    ? ctx.perfil.agentes.map((slug) => agentBySlug[slug]).filter(Boolean)
    : agents;
  const v = ctx.vocabulario;

  return (
    <div className="min-h-screen bg-[color:var(--cream)]">
      <header className="border-b-[3px] border-black bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 py-3">
          <a href="/dashboard"><Logo size="sm" /></a>
          <div className="flex items-center gap-4 text-sm">
            {session.dev && (
              <span className="text-[9px] uppercase tracking-widest font-bold bg-[color:var(--mustard)] border-2 border-black px-1.5 py-0.5" title="Sesión de desarrollo local (sin login). En producción exige magic link.">DEV</span>
            )}
            {/* Selector de cuenta: SOLO para el fundador. Un cliente no puede ni ver la
                lista de los demás tenants, así que se decide en el servidor. */}
            {puedeCambiarDeCuenta(session.email) && (
              <SelectorCuenta tenantIdActual={ctx.tenantId} mirandoOtro={ctx.mirandoOtro} />
            )}
            <span className="hidden sm:inline font-mono text-black/60">{session.email}</span>
            <form action="/api/auth/logout" method="post">
              <button className="text-xs uppercase tracking-widest font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <MarcoPanel lateral={<>
        {/* EL LATERAL DE UNA GESTORÍA ES OTRO.
            Trece bloques con emojis y tres colores compitiendo no le sirven a
            quien lleva cien clientes: se le ha hecho uno en texto plano, con los
            agentes y los ajustes plegados. El de peluquerías, clínicas y
            restaurantes queda EXACTAMENTE como estaba — es el `else` de abajo. */}
        {ctx.perfil.id === "gestoria" ? (
          <aside>
            <LateralGestoria
              agentes={visibles.map((a) => ({
                slug: a.slug,
                nombre: a.name,
                rol: a.role,
                avatar: a.avatar,
                emoji: a.emoji,
                color: a.color,
                proximamente: a.slug === "rocio",
              }))}
            />
            {!user.business && (
              <div className="mt-4 p-3 border-2 border-dashed border-black text-xs">
                <div className="font-bold mb-1">Sin configurar</div>
                <a href="/onboarding" className="underline">Completa el briefing →</a>
              </div>
            )}
          </aside>
        ) : (
        <aside className="space-y-2">
          <EnlaceLateral
            href="/dashboard/clientes"
            emoji="📅"
            fondo="var(--mustard)"
            /* Se llamaba "AGENDA": no se identificaba como el módulo de reservas online
               y no había forma de llegar a esta pantalla salvo tecleando la URL.
               Después se le puso "EXPEDIENTES" en gestoría y quedaron DOS entradas
               seguidas con el mismo rótulo: esta —agenda, clientes, compartir e
               informes— y la de abajo, que es la de verdad (estado, documentación,
               vencimientos). Cambia SOLO el rótulo: la ruta, el icono y quién la ve
               siguen igual. */
            /* Aquí ya no puede ser una gestoría: esta rama es el `else` del
               lateral, y la gestoría tiene el suyo. Antes ponía
               `id === "gestoria" ? "CLIENTES" : "RESERVAS"` y era código muerto. */
            titulo="RESERVAS"
            /* Mismo orden que las pestañas de ReservasPanel: informes al final. */
            subtitulo={`Agenda · ${v.clientePlural} · compartir · informes mensuales`}
          />
          {/* SERVICIO DE HOY: solo en restauración. Es la pantalla que se mira
              antes de abrir, y va la primera por eso mismo. */}
          {tieneFuncion(ctx.sector, "panelDelDia") && (
            <EnlaceLateral
              href="/dashboard/servicio"
              emoji="🍽️"
              titulo="SERVICIO DE HOY"
              subtitulo="Reservas · comensales · no-shows"
              fondo="#ffffff"
            />
          )}
          {/* HOY: solo en gestoría, y la PRIMERA de todas. Es el sitio por el
              que se entra: la secretaria no te enseña el archivo, te dice qué
              te queda por hacer. */}
          {tieneFuncion(ctx.sector, "estadoExpediente") && (
            <EnlaceLateral
              href="/dashboard/hoy"
              emoji="☑️"
              titulo="HOY"
              subtitulo="Lo que toca · por fecha límite"
              fondo="var(--mustard)"
            />
          )}
          {/* EXPEDIENTES: solo en gestoría. Va la primera porque es donde se
              contesta la pregunta que más llamadas genera: "¿cómo va lo mío?". */}
          {tieneFuncion(ctx.sector, "estadoExpediente") && (
            <EnlaceLateral
              href="/dashboard/expedientes"
              emoji="📁"
              titulo="EXPEDIENTES"
              subtitulo="Estado · documentación · vencimientos"
              fondo="#ffffff"
            />
          )}
          {/* FACTURAS: solo en gestoría. Es el saco del cliente y la conciliación
              contra el banco, que es donde se ve qué salió sin justificar. */}
          {tieneFuncion(ctx.sector, "estadoExpediente") && (
            <EnlaceLateral
              href="/dashboard/facturas"
              emoji="🧾"
              titulo="FACTURAS"
              subtitulo="Saco · banco · conciliación"
              fondo="#ffffff"
            />
          )}
          {/* CORREO IMPORTANTE: solo en gestoría. La lista de remitentes que
              hace que una notificación de Hacienda no se pierda entre 200
              correos. */}
          {tieneFuncion(ctx.sector, "clasificacionCorreo") && (
            <EnlaceLateral
              href="/dashboard/correo-importante"
              emoji="🔴"
              titulo="CORREO IMPORTANTE"
              subtitulo="Hacienda · Seguridad Social · juzgados"
              fondo="#ffffff"
            />
          )}
          {/* Seguimiento (recall + presupuestos): solo donde el sector lo enciende.
              En un salón no existe la revisión a seis meses y enseñarlo vacío
              solo confunde. */}
          {(tieneFuncion(ctx.sector, "recall") || tieneFuncion(ctx.sector, "seguimientoPresupuestos")) && (
            <EnlaceLateral
              href="/dashboard/seguimiento"
              emoji="🔁"
              titulo="SEGUIMIENTO"
              subtitulo="Revisiones · presupuestos"
              fondo="#ffffff"
            />
          )}
          <div className="text-xs font-mono uppercase tracking-widest text-black/50 px-1 mb-2">
            Tu equipo · {visibles.length} {visibles.length === 1 ? "agente" : "agentes"}
          </div>
          {visibles.map((a) => (
            <EnlaceAgente
              key={a.slug}
              slug={a.slug}
              nombre={a.name}
              rol={a.role}
              avatar={a.avatar}
              emoji={a.emoji}
              color={a.color}
              proximamente={a.slug === "rocio"}
            />
          ))}
          <a
            href="/dashboard/perfil"
            className="block mt-4 p-3 border-2 border-dashed border-black text-xs hover:bg-[color:var(--mustard)]/30"
          >
            <div className="font-bold mb-0.5">⚙️ Perfil del negocio</div>
            <div className="text-black/60">Edita tono, servicios, público</div>
          </a>
          <a
            href="/dashboard/valor"
            className="block mt-2 p-3 border-2 border-dashed border-black text-xs hover:bg-[color:var(--mustard)]/30"
          >
            <div className="font-bold mb-0.5">💰 Valor generado</div>
            <div className="text-black/60">Tiempo y € que te ahorra</div>
          </a>
          <a
            href="/dashboard/lecciones"
            className="block mt-2 p-3 border-2 border-dashed border-black text-xs hover:bg-[color:var(--mustard)]/30"
          >
            <div className="font-bold mb-0.5">📚 Lecciones aprendidas</div>
            <div className="text-black/60">Cómo evolucionan tus agentes</div>
          </a>
          {!user.business && (
            <div className="mt-4 p-3 border-2 border-dashed border-black text-xs">
              <div className="font-bold mb-1">Sin configurar</div>
              <a href="/onboarding" className="underline">Completa el briefing →</a>
            </div>
          )}
        </aside>
        )}
      </>}>

        <main>{children}</main>
      </MarcoPanel>
    </div>
  );
}
