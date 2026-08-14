// Cuántos correos críticos han entrado hoy y siguen sin abrir.
//
// Se resuelve con UNA sola llamada a Gmail: en vez de bajarse la bandeja y
// contar, se le pregunta directamente por los remitentes críticos del día
// (`is:unread after:hoy from:a OR from:b …`). La portada del panel llama aquí en
// cada carga, así que tenía que ser barato.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSessionLocal } from "@/lib/auth";
import { getAuthedGmail, getRedirectUri } from "@/lib/gmail";
import { contextoPanelODefecto } from "@/lib/panel-contexto";
import { tieneFuncion } from "@/lib/sectores";
import { listarRemitentes, patronesCriticos } from "@/lib/lucia-remitentes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `after:` de Gmail quiere AAAA/MM/DD y cuenta en la zona del usuario. */
function hoyGmail(): string {
  const d = new Date();
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// Gmail admite consultas largas, pero no infinitas: con más de 40 patrones se
// corta y se avisa, en vez de mandar una consulta que el servidor rechace.
const MAX_PATRONES = 40;

export async function GET() {
  const s = await getSessionLocal();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ctx = await contextoPanelODefecto();
  if (!tieneFuncion(ctx.sector, "clasificacionCorreo")) {
    return NextResponse.json({ ok: true, aplica: false, total: 0 });
  }

  const lista = await listarRemitentes(ctx.tenantId);
  const patrones = patronesCriticos(lista);
  if (!patrones.length) return NextResponse.json({ ok: true, aplica: true, conectado: true, total: 0 });

  const usados = patrones.slice(0, MAX_PATRONES);

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const gm = await getAuthedGmail(s.email, getRedirectUri(host, proto));
    if (!gm) return NextResponse.json({ ok: true, aplica: true, conectado: false, total: 0 });

    const q = `is:unread in:inbox after:${hoyGmail()} (${usados.map((p) => `from:${p}`).join(" OR ")})`;
    const res = await gm.gmail.users.messages.list({ userId: "me", q, maxResults: 50 });

    return NextResponse.json({
      ok: true,
      aplica: true,
      conectado: true,
      total: (res.data.messages ?? []).length,
      recortada: patrones.length > MAX_PATRONES,
    });
  } catch (e) {
    // Un fallo contando no puede tumbar la portada del panel.
    console.error("[lucia/criticos] no se pudo contar:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, aplica: true, conectado: true, total: 0 });
  }
}
