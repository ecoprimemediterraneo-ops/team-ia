/**
 * Generador de imágenes server-side para posts de redes con plantilla AI-Team.
 *
 * Uso: GET /api/og/post?frase=Tu+texto&personaje=diana&color=%2314B8A6
 *
 * Devuelve PNG 1080x1080 con estética cómic militar.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const frase = searchParams.get("frase") || "Tu negocio merece un equipo IA";
    const color = searchParams.get("color") || "#F5C518";
    const codename = searchParams.get("codename") || "HOTEL-D8";
    const rol = searchParams.get("rol") || "AUDITORA";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#FAF7F0",
          }}
        >
          {/* Codename bar */}
          <div
            style={{
              backgroundColor: "#000",
              color: color,
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
            <div style={{ display: "flex", color: "#fff" }}>● AI-TEAM</div>
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
                color: "#0A0A0A",
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
                backgroundColor: color,
                color: "#000",
                padding: "20px 40px",
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: 4,
                alignSelf: "flex-start",
                border: "6px solid #000",
              }}
            >
              AITEAM.MARKETING
            </div>
          </div>

          {/* Cinta inferior */}
          <div
            style={{
              backgroundColor: "#0A0A0A",
              color: "#FAF7F0",
              padding: "30px 50px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 26,
              letterSpacing: 5,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex" }}>DIAGNÓSTICO GRATIS · 2 MIN</div>
            <div style={{ display: "flex", color: color }}>👉 LINK EN BIO</div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
      },
    );
  } catch (e) {
    return new Response(`Error generando imagen: ${e instanceof Error ? e.message : "unknown"}`, { status: 500 });
  }
}
