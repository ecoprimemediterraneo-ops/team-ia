/**
 * Generador de imágenes server-side para posts de redes de Marta.
 *
 * Uso: GET /api/og/post?frase=...&bg=...&acento=...&texto=...&marca=...&logo=...
 *      &plantilla=marcada|suave&cta=...&handle=...&codename=...&rol=...
 *
 * Dos plantillas con la MISMA estructura de información:
 *   - "marcada": estilo AI-Team (barras negras, caja con borde grueso, esquinas
 *     rectas). Es la de por defecto y reproduce EXACTAMENTE lo de siempre → los
 *     posts de AI-Team se ven idénticos.
 *   - "suave": neutro tipo Instagram (redondeado, sin borde grueso ni barras
 *     negras, más aireado).
 *
 * Todo cae a su valor por defecto si no se pasa. Devuelve PNG 1080x1080.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Negro o blanco según lo claro que sea el color de fondo del chip (contraste). */
function contraste(hex: string): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.6 ? "#000000" : "#FFFFFF";
}

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const frase = p.get("frase") || "Tu negocio merece un equipo IA";
    // Colores (defaults = los de AI-Team de siempre). `color` es alias de `acento`.
    const bg = p.get("bg") || "#FAF7F0";
    const acento = p.get("acento") || p.get("color") || "#F5C518";
    const texto = p.get("texto") || "#0A0A0A";
    // Identidad + composición.
    const marca = p.get("marca") || "AI-TEAM";
    const handle = p.get("handle") || "AITEAM.MARKETING";
    const logo = p.get("logo") || "";
    const codename = p.get("codename") || "HOTEL-D8";
    const rol = p.get("rol") || "AUDITORA";
    const plantilla = p.get("plantilla") === "suave" ? "suave" : "marcada";
    // `cta`: si el parámetro está presente (aunque sea ""), se respeta; si no, el de AI-Team.
    const cta = p.has("cta") ? (p.get("cta") ?? "") : "DIAGNÓSTICO GRATIS · 2 MIN";

    const size = { width: 1080, height: 1080 } as const;

    // -------------------------------------------------------------------------
    // SUAVE — neutro estilo Instagram: redondeado, sin barras negras ni borde grueso.
    // -------------------------------------------------------------------------
    if (plantilla === "suave") {
      const acentoFg = contraste(acento);
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: bg,
              padding: "72px 76px",
            }}
          >
            {/* Cabecera: nombre + logo, sin barra */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", color: texto, fontSize: 30, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
                {marca}
              </div>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" height={64} style={{ height: 64, objectFit: "contain" }} />
              ) : (
                <div style={{ display: "flex" }} />
              )}
            </div>

            {/* Cuerpo: titular + chip del handle (redondeado) */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, paddingTop: 24 }}>
              <div style={{ display: "flex", fontSize: 82, lineHeight: 1.18, fontWeight: 700, color: texto, letterSpacing: -1, marginBottom: 44 }}>
                {frase}
              </div>
              <div
                style={{
                  display: "flex",
                  backgroundColor: acento,
                  color: acentoFg,
                  padding: "18px 42px",
                  fontSize: 33,
                  fontWeight: 700,
                  letterSpacing: 1,
                  alignSelf: "flex-start",
                  borderRadius: 999,
                }}
              >
                {handle}
              </div>
            </div>

            {/* CTA inferior: pastilla redondeada (o nada si está vacío) */}
            {cta ? (
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  backgroundColor: texto,
                  color: bg,
                  padding: "16px 38px",
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: 3,
                  borderRadius: 999,
                }}
              >
                {cta}
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
          </div>
        ),
        size,
      );
    }

    // -------------------------------------------------------------------------
    // MARCADA — estilo AI-Team (idéntico al de siempre). NO tocar la composición.
    // -------------------------------------------------------------------------
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: bg,
          }}
        >
          {/* Barra superior */}
          <div
            style={{
              backgroundColor: "#000",
              color: acento,
              padding: "30px 50px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 28,
              letterSpacing: 6,
              fontWeight: 800,
            }}
          >
            <div style={{ display: "flex" }}>{codename} · {rol}</div>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" height={52} style={{ height: 52, objectFit: "contain" }} />
            ) : (
              <div style={{ display: "flex", color: "#fff" }}>● {marca}</div>
            )}
          </div>

          {/* Cuerpo */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "60px 80px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 90,
                lineHeight: 1.1,
                fontWeight: 900,
                color: texto,
                textTransform: "uppercase",
                letterSpacing: -2,
                marginBottom: 40,
              }}
            >
              {frase}
            </div>
            <div
              style={{
                display: "flex",
                backgroundColor: acento,
                color: "#000",
                padding: "20px 40px",
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: 4,
                alignSelf: "flex-start",
                border: "6px solid #000",
              }}
            >
              {handle}
            </div>
          </div>

          {/* Cinta inferior */}
          <div
            style={{
              backgroundColor: "#0A0A0A",
              color: bg,
              padding: "30px 50px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 26,
              letterSpacing: 5,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex" }}>{cta}</div>
            <div style={{ display: "flex", color: acento }}>👉 LINK EN BIO</div>
          </div>
        </div>
      ),
      size,
    );
  } catch (e) {
    return new Response(`Error generando imagen: ${e instanceof Error ? e.message : "unknown"}`, { status: 500 });
  }
}
