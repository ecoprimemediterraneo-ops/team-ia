// La vuelta de Instagram. Founder-only.
//
// Recibe el `code`, lo canjea por el token de 60 días y lo guarda. Devuelve una
// página, no JSON, porque aquí aterriza un navegador y lo que hace falta es leer
// si ha salido bien y qué hacer después.
//
// Nunca se enseña el token, ni el código, ni el App Secret. Tampoco dentro de un
// error de Instagram, que los devuelve enteros.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireFounder } from "@/lib/admin-auth";
import { canjearCodigo, estadoToken, REDIRECT_URI, SCOPES, tapar, COOKIE_STATE } from "@/lib/instagram-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function pagina(titulo: string, cuerpo: string, bien: boolean) {
  const color = bien ? "#1a7f37" : "#C8202A";
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<style>
 body{font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#FDF8EF;color:#111;
      margin:0;padding:2.5rem 1.25rem;display:flex;justify-content:center}
 main{max-width:44rem;width:100%;background:#fff;border:3px solid #111;box-shadow:6px 6px 0 #111;padding:1.75rem}
 h1{margin:0 0 1rem;font-size:1.5rem;color:${color}}
 code{background:#f3efe6;padding:.1rem .3rem;border:1px solid #ddd6c6}
 li{margin:.35rem 0} a{color:#C8202A}
 .dato{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85rem}
</style></head><body><main><h1>${titulo}</h1>${cuerpo}</main></body></html>`,
    { status: bien ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return pagina(
      "Instagram no ha dado el permiso",
      `<p>Instagram ha respondido: <code>${tapar(error)}</code> · <code>${tapar(url.searchParams.get("error_reason") ?? "")}</code></p>
       <p>${tapar(url.searchParams.get("error_description") ?? "")}</p>
       <p>Si has cancelado tú, vuelve a empezar en <a href="/api/instagram/login">/api/instagram/login</a>.</p>
       <p>Si NO has cancelado tú, casi siempre es que la cuenta no tiene papel en la app: en el panel de Meta,
          <em>App roles &gt; Roles</em>, la cuenta de Instagram tiene que estar añadida mientras la app no esté aprobada.</p>`,
      false,
    );
  }

  if (!code) {
    return pagina(
      "No ha llegado ningún código",
      `<p>Esta dirección no se abre a mano: es a donde vuelve Instagram después de autorizar.</p>
       <p>Empieza por <a href="/api/instagram/login">/api/instagram/login</a>.</p>`,
      false,
    );
  }

  // El `state` tiene que ser el mismo que se puso al salir.
  const galletas = await cookies();
  const esperado = galletas.get(COOKIE_STATE)?.value;
  if (!esperado || esperado !== state) {
    return pagina(
      "La vuelta no cuadra",
      `<p>El <code>state</code> no coincide con el que se guardó al empezar. O la vuelta ha tardado más de
        diez minutos, o esta vuelta no la has empezado tú.</p>
       <p>Vuelve a empezar en <a href="/api/instagram/login">/api/instagram/login</a> y hazlo del tirón.</p>`,
      false,
    );
  }
  galletas.delete(COOKIE_STATE);

  const r = await canjearCodigo(code);

  if (!r.ok) {
    return pagina(
      "No se ha podido canjear el código",
      `<p class="dato">${tapar(r.error)}</p>
       <p>Lo que más veces es:</p>
       <ul>
         <li>El <code>redirect_uri</code> dado de alta en Meta no es exactamente
             <code>${REDIRECT_URI}</code>. Tiene que coincidir letra por letra, con la barra final igual.</li>
         <li><code>INSTAGRAM_APP_ID</code> o <code>INSTAGRAM_APP_SECRET</code> traen los valores de Meta y no
             los de Instagram. Son distintos.</li>
         <li>El código ya se había usado. Solo vale una vez, y una hora.</li>
       </ul>
       <p>Vuelve a empezar en <a href="/api/instagram/login">/api/instagram/login</a>.</p>`,
      false,
    );
  }

  const e = await estadoToken();
  const faltan = e.faltanPermisos ?? [];

  return pagina(
    "Token de Instagram guardado",
    `<ul>
       <li>Cuenta: <strong>${r.valor.usuario ? `@${r.valor.usuario}` : "sin nombre"}</strong>
           <span class="dato">(${r.valor.user_id || "sin id"})</span></li>
       <li>Caduca: <span class="dato">${new Date(r.valor.caduca_en).toLocaleString("es-ES")}</span>
           — ${e.diasQueQuedan} días</li>
       <li>Permisos que trae: <span class="dato">${r.valor.permisos.length ? r.valor.permisos.join(", ") : "no los ha dicho"}</span></li>
     </ul>
     ${
       faltan.length
         ? `<p style="color:#C8202A"><strong>Ojo:</strong> faltan ${faltan.join(", ")}.
            Las llamadas de esos permisos no contarán. Vuelve a autorizar marcando todas las casillas.</p>`
         : `<p>Están los cuatro <code>instagram_business_*</code>.</p>`
     }
     <p><strong>Ahora:</strong> abre
        <a href="/api/admin/instagram-app-review?llamar=1">/api/admin/instagram-app-review?llamar=1</a>
        para hacer las cuatro llamadas. Publicará de verdad en la cuenta.</p>
     <p>El estado del token se ve siempre en <a href="/admin">/admin</a> y en
        <a href="/api/admin/instagram-token">/api/admin/instagram-token</a>.</p>
     <p style="font-size:.85rem;color:#666">Este token caduca a los 60 días. Refréscalo antes con
        <code>/api/admin/instagram-token?refrescar=1</code>; si caduca hay que repetir todo el login a mano.
        Meta no deja refrescar un token con menos de 24 horas de vida, así que hoy dirá que no.</p>
     <p style="font-size:.85rem;color:#666">Pedidos: <span class="dato">${SCOPES.join(", ")}</span></p>`,
    true,
  );
}
