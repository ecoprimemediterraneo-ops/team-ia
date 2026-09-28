// El Graph de Meta de mentira. Todo lo que el servidor local "manda" a
// WhatsApp o a Instagram acaba aquí y se queda apuntado, para que las pruebas
// puedan comprobar QUÉ se habría mandado, A QUIÉN y DESDE QUÉ número.
//
// Contesta lo mínimo que espera el código: un wamid para WhatsApp, un
// message_id para Instagram, un access_token de página y un username.
import http from "node:http";

export type Llamada = { metodo: string; ruta: string; cuerpo: unknown; ts: number };

export function arrancarGraphFalso(puerto = 4545): Promise<http.Server> {
  const llamadas: Llamada[] = [];
  const server = http.createServer((req, res) => {
    let crudo = "";
    req.on("data", (c) => (crudo += c));
    req.on("end", () => {
      const url = new URL(req.url || "/", "http://x");
      const json = (x: unknown, status = 200) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(x));
      };
      if (url.pathname === "/__llamadas") {
        if (req.method === "DELETE") { llamadas.length = 0; return json({ ok: true }); }
        return json(llamadas);
      }
      let cuerpo: unknown = crudo;
      try { cuerpo = crudo ? JSON.parse(crudo) : null; } catch { /* no es JSON */ }
      llamadas.push({ metodo: req.method || "GET", ruta: url.pathname, cuerpo, ts: Date.now() });
      if (req.method === "GET") {
        return json({ id: url.pathname.split("/").pop(), access_token: "token-pagina-falso", username: "cliente_e2e", name: "Cliente E2E" });
      }
      return json({
        messaging_product: "whatsapp",
        messages: [{ id: `wamid.FALSO.${Date.now()}` }],
        message_id: `mid.FALSO.${Date.now()}`,
        recipient_id: "falso",
        id: `falso_${Date.now()}`,
        success: true,
      });
    });
  });
  return new Promise((ok, ko) => {
    server.once("error", ko);
    server.listen(puerto, "127.0.0.1", () => ok(server));
  });
}
