import { ImageResponse } from "next/og";

// Imagen social (Open Graph) generada por código: se regenera si cambias el diseño,
// sin binarios que mantener. 1200×630, colores de marca. Fuente del sistema (la marca
// real usa Anton/Impact, no embebida aquí para no depender de un .ttf; se puede subir luego).
export const alt = "AI-Team — Tu negocio sigue respondiendo aunque estés ocupado";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#FAF8F3",
          padding: 56,
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              backgroundColor: "#C8202A",
              border: "6px solid #0c0c0c",
              padding: "8px 28px",
            }}
          >
            <div style={{ display: "flex", color: "#FAF8F3", fontSize: 58, fontWeight: 800, letterSpacing: -1 }}>
              AI-TEAM
            </div>
          </div>
        </div>

        {/* Titular */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#0c0c0c", fontSize: 76, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1 }}>
            Tu negocio sigue
          </div>
          <div style={{ display: "flex", color: "#C8202A", fontSize: 76, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1 }}>
            respondiendo
          </div>
          <div style={{ display: "flex", color: "#0c0c0c", fontSize: 76, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1 }}>
            aunque estés ocupado.
          </div>
        </div>

        {/* Barra inferior: canales + precio */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#F5C518",
            border: "6px solid #0c0c0c",
            padding: "16px 28px",
          }}
        >
          <div style={{ display: "flex", color: "#0c0c0c", fontSize: 29, fontWeight: 700 }}>
            WhatsApp · Llamadas · Instagram · Agenda
          </div>
          <div style={{ display: "flex", color: "#0c0c0c", fontSize: 29, fontWeight: 800 }}>
            Desde 149€/mes
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
