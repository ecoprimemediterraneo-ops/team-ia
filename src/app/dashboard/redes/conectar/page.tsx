import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function ConectarRedesPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  const igConectado = !!(process.env.META_ACCESS_TOKEN && process.env.META_INSTAGRAM_USER_ID);
  const fbConectado = !!(process.env.META_ACCESS_TOKEN && process.env.META_FACEBOOK_PAGE_ID);
  const liConectado = !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORG_URN);

  return (
    <div className="min-h-screen bg-[color:var(--cream)] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <span className="inline-block bg-black text-[color:var(--mustard)] px-2 py-1 text-xs font-mono font-bold tracking-widest mb-2">
              SETUP · MARTA · APIs PROPIAS
            </span>
            <h1 className="font-stencil text-4xl">Conectar redes sociales</h1>
            <p className="text-sm text-black/60 mt-2">
              Sistema 100% propio. Cero terceros. Cero coste recurrente. Cuando termines, Marta publica sola.
            </p>
          </div>
          <a href="/dashboard/redes" className="border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-[color:var(--mustard)]">
            ← Redes
          </a>
        </div>

        {/* Estado actual */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <Estado nombre="Instagram" emoji="📷" conectado={igConectado} color="#E1306C" />
          <Estado nombre="Facebook" emoji="📘" conectado={fbConectado} color="#1877F2" />
          <Estado nombre="LinkedIn" emoji="💼" conectado={liConectado} color="#0A66C2" />
        </div>

        {/* Modo asistido nota */}
        {!igConectado && !liConectado && (
          <div className="card-hard p-5 bg-[color:var(--mustard)] mb-6">
            <h3 className="font-stencil text-xl mb-2">⚠️ Mientras no haya APIs conectadas</h3>
            <p className="text-sm">
              Trabajamos en <strong>modo asistido</strong>: Marta genera el contenido, tú lo apruebas en{" "}
              <a href="/dashboard/redes/aprobar" className="underline">/dashboard/redes/aprobar</a>, y el sistema te ayuda a publicar
              con un click (copia al portapapeles + abre la red). Solo tienes que pegar.
            </p>
          </div>
        )}

        {/* INSTAGRAM */}
        <Paso
          numero={1}
          titulo="Instagram + Facebook (Meta Graph API)"
          tiempo="1-3 semanas burocracia + 30 min setup"
          coste="0€ para siempre"
        >
          <ol className="list-decimal pl-6 space-y-3 text-sm">
            <li>
              <strong>Verificar empresa en Meta Business.</strong> Ve a{" "}
              <a href="https://business.facebook.com/settings/security" target="_blank" rel="noopener noreferrer" className="underline text-blue-700">business.facebook.com → Seguridad → Verificación</a>.
              Sube CIF + DNI del administrador. Tarda 1-3 semanas.
            </li>
            <li>
              <strong>Crear página Facebook</strong> para AI-Team si no existe (es requisito para publicar en IG vía API).
            </li>
            <li>
              <strong>Conectar Instagram Business a la página.</strong> Tu cuenta IG debe ser tipo "Empresa" (no personal). Configuración IG → Cuenta → Cuenta profesional → conectar a la Page de Facebook.
            </li>
            <li>
              <strong>Crear app en Meta for Developers:</strong>{" "}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline text-blue-700">developers.facebook.com/apps</a>{" "}
              → Crear app → Tipo "Empresa" → añadir productos "Instagram Graph API" + "Facebook Login".
            </li>
            <li>
              <strong>Generar long-lived token</strong> con los permisos:
              <ul className="list-disc pl-6 mt-1 text-xs">
                <li><code className="bg-black/5 px-1">instagram_basic</code></li>
                <li><code className="bg-black/5 px-1">instagram_content_publish</code></li>
                <li><code className="bg-black/5 px-1">pages_show_list</code></li>
                <li><code className="bg-black/5 px-1">pages_read_engagement</code></li>
                <li><code className="bg-black/5 px-1">pages_manage_posts</code></li>
              </ul>
            </li>
            <li>
              <strong>Obtener IDs:</strong>
              <ul className="list-disc pl-6 mt-1 text-xs">
                <li><strong>META_INSTAGRAM_USER_ID:</strong> en Graph API Explorer →{" "}
                <code className="bg-black/5 px-1">GET /me/accounts</code> → buscar tu Page → mirar campo{" "}
                <code className="bg-black/5 px-1">instagram_business_account.id</code></li>
                <li><strong>META_FACEBOOK_PAGE_ID:</strong> mismo endpoint, campo <code className="bg-black/5 px-1">id</code> de la Page</li>
              </ul>
            </li>
            <li>
              <strong>Pegar en Vercel:</strong> Settings → Environment Variables:
              <pre className="bg-black/5 p-3 mt-2 text-xs overflow-x-auto rounded">{`META_ACCESS_TOKEN=EAAxxxxx...
META_INSTAGRAM_USER_ID=178414xxxxxxxxxxx
META_FACEBOOK_PAGE_ID=1052xxxxxxxxxx`}</pre>
            </li>
            <li>
              <strong>Redeploy</strong> y probar desde el dashboard de aprobación.
            </li>
          </ol>
        </Paso>

        {/* LINKEDIN */}
        <Paso
          numero={2}
          titulo="LinkedIn Marketing API"
          tiempo="1-2 semanas aprobación + 30 min setup"
          coste="0€"
        >
          <ol className="list-decimal pl-6 space-y-3 text-sm">
            <li>
              <strong>Crear Company Page</strong> de AI-Team si no existe.
            </li>
            <li>
              <strong>Crear app en LinkedIn Developer:</strong>{" "}
              <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline text-blue-700">linkedin.com/developers/apps</a>{" "}
              → New app → asociar a tu Company Page.
            </li>
            <li>
              <strong>Pedir productos:</strong>
              <ul className="list-disc pl-6 mt-1 text-xs">
                <li>"Share on LinkedIn" (instantáneo)</li>
                <li>"Marketing Developer Platform" (1-2 semanas de aprobación)</li>
              </ul>
            </li>
            <li>
              <strong>OAuth flow:</strong> generar access token con scope{" "}
              <code className="bg-black/5 px-1">w_organization_social</code>.
            </li>
            <li>
              <strong>Obtener ORG_URN:</strong>{" "}
              <code className="bg-black/5 px-1">GET https://api.linkedin.com/v2/organizationAcls?q=roleAssignee</code>
            </li>
            <li>
              <strong>Pegar en Vercel:</strong>
              <pre className="bg-black/5 p-3 mt-2 text-xs overflow-x-auto rounded">{`LINKEDIN_ACCESS_TOKEN=AQVxxxxx...
LINKEDIN_ORG_URN=urn:li:organization:12345678`}</pre>
            </li>
          </ol>
        </Paso>

        {/* CRON SECRET */}
        <Paso
          numero={3}
          titulo="Configurar secreto del cron"
          tiempo="2 min"
          coste="0€"
        >
          <ol className="list-decimal pl-6 space-y-3 text-sm">
            <li>
              Generar un string aleatorio largo (p.ej. <code className="bg-black/5 px-1">openssl rand -hex 32</code>).
            </li>
            <li>
              Pegar en Vercel env como <code className="bg-black/5 px-1">CRON_SECRET=...</code>.
            </li>
            <li>
              Vercel inyecta automáticamente este secret en los crons (header Authorization Bearer).
            </li>
            <li>
              Cron <code className="bg-black/5 px-1">/api/cron/publicar</code> ya está configurado en{" "}
              <code className="bg-black/5 px-1">vercel.json</code> (cada hora).
            </li>
          </ol>
        </Paso>

        <div className="card-hard p-5 bg-white mt-6">
          <h3 className="font-stencil text-xl mb-2">📚 Por qué hacemos esto en vez de pagar Ayrshare</h3>
          <p className="text-sm text-black/70 mb-3">
            <strong>Ayrshare es solo un intermediario.</strong> Conecta a las mismas APIs de Meta/LinkedIn que ya tenemos integradas. Cobra $49/mes por ahorrarte el trámite de Meta Business Verification.
          </p>
          <p className="text-sm text-black/70">
            Como AI-Team vende automatización, hacerlo nosotros tiene 3 ventajas: (1) coste 0€ recurrente, (2) control total de los datos, (3) podemos ofrecérselo a nuestros clientes como ventaja competitiva en el plan Pro.
          </p>
        </div>
      </div>
    </div>
  );
}

function Estado({ nombre, emoji, conectado, color }: { nombre: string; emoji: string; conectado: boolean; color: string }) {
  return (
    <div className="card-hard p-4 bg-white flex items-center gap-3">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <div className="font-bold" style={{ color }}>{nombre}</div>
        <div className={`text-xs font-mono uppercase tracking-widest ${conectado ? "text-green-700" : "text-black/40"}`}>
          {conectado ? "● CONECTADO" : "○ NO CONECTADO"}
        </div>
      </div>
    </div>
  );
}

function Paso({ numero, titulo, tiempo, coste, children }: { numero: number; titulo: string; tiempo: string; coste: string; children: React.ReactNode }) {
  return (
    <details className="card-hard p-5 bg-white mb-4" open={numero === 1}>
      <summary className="cursor-pointer">
        <span className="font-stencil text-2xl">{numero}. {titulo}</span>
        <div className="flex gap-2 mt-2 text-[10px] font-mono uppercase tracking-widest">
          <span className="bg-black text-[color:var(--mustard)] px-2 py-1">⏱ {tiempo}</span>
          <span className="bg-[color:var(--mustard)] text-black px-2 py-1">💸 {coste}</span>
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
