// Un Supabase DE MENTIRA para las pruebas: la tabla `kv_store` detrás de la
// misma API REST (PostgREST) que usa `@supabase/supabase-js`, en memoria.
//
// Sirve para probar el camino de PRODUCCIÓN (Supabase + varias instancias a la
// vez) sin tocar la base de datos real. Imita lo que importa:
//   - clave primaria: un INSERT de una clave que ya existe da 409 / 23505;
//   - filtros eq / like / lt, también sobre campos del JSON (`value->>campo`);
//   - PostgREST corta en 1000 filas por consulta (hay que paginar);
//   - cada petición tarda un poco (latencia de red) y se puede hacer fallar.
// Cada petición se resuelve de una vez (el estado cambia de golpe), como una
// sentencia SQL: las carreras que aparezcan son las del código, no del falso.
import http from "node:http";

const filas = new Map(); // key -> { key, value, updated_at }
const opciones = { latenciaMs: [15, 60], fallarListados: false, fallarTodo: false, maxFilas: 1000 };
export const peticiones = { total: 0 };

const campo = (fila, col) => {
  const m = /^value->>(.+)$/.exec(col);
  if (!m) return fila[col];
  const v = fila.value?.[m[1]];
  return v === undefined || v === null ? null : String(v);
};
const casa = (fila, col, expr) => {
  const i = expr.indexOf(".");
  const op = expr.slice(0, i), val = expr.slice(i + 1); // searchParams ya viene decodificado
  const v = campo(fila, col);
  if (op === "eq") return v !== null && String(v) === val;
  if (op === "lt") return v !== null && String(v) < val;
  if (op === "like") {
    const re = new RegExp("^" + val.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*") + "$");
    return v !== null && re.test(String(v));
  }
  throw new Error(`operador no soportado: ${op}`);
};
function filtrar(url) {
  const reservados = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
  const filtros = [...url.searchParams.entries()].filter(([k]) => !reservados.has(k));
  return [...filas.values()].filter((f) => filtros.every(([k, v]) => casa(f, k, v)));
}
const proyectar = (f, select) => {
  if (!select || select === "*") return { ...f };
  const o = {};
  for (const c of select.split(",")) o[c.trim()] = f[c.trim()];
  return o;
};

function responder(res, status, cuerpo) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(cuerpo === undefined ? "" : JSON.stringify(cuerpo));
}

export function arrancarSupabaseFalso(puerto = 0) {
  const servidor = http.createServer((req, res) => {
    let texto = "";
    req.on("data", (c) => (texto += c));
    req.on("end", () => {
      const [a, b] = opciones.latenciaMs;
      setTimeout(() => {
        peticiones.total++;
        try {
          const url = new URL(req.url, "http://x");
          if (!url.pathname.endsWith("/rest/v1/kv_store")) return responder(res, 404, { message: "tabla desconocida" });
          if (opciones.fallarTodo) return responder(res, 503, { message: "servicio no disponible (simulado)", code: "PGRST503" });
          const prefer = req.headers["prefer"] || "";
          const accept = req.headers["accept"] || "";
          if (req.method === "GET") {
            const esListado = url.searchParams.get("key")?.startsWith("like.");
            if (esListado && opciones.fallarListados) return responder(res, 500, { message: "fallo de lectura (simulado)", code: "XX000" });
            let r = filtrar(url);
            if (url.searchParams.get("order")?.startsWith("key")) r.sort((x, y) => x.key.localeCompare(y.key));
            const off = Number(url.searchParams.get("offset") || 0);
            const lim = Math.min(Number(url.searchParams.get("limit") || opciones.maxFilas), opciones.maxFilas);
            r = r.slice(off, off + lim).map((f) => proyectar(f, url.searchParams.get("select")));
            if (accept.includes("vnd.pgrst.object+json")) {
              if (r.length !== 1) return responder(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
              return responder(res, 200, r[0]);
            }
            return responder(res, 200, r);
          }
          const cuerpo = texto ? JSON.parse(texto) : null;
          if (req.method === "POST") {
            const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
            const upsert = /resolution=merge-duplicates/.test(prefer);
            if (!upsert && lista.some((f) => filas.has(f.key))) {
              return responder(res, 409, { code: "23505", message: 'duplicate key value violates unique constraint "kv_store_pkey"' });
            }
            for (const f of lista) filas.set(f.key, { key: f.key, value: f.value, updated_at: f.updated_at });
            return /return=representation/.test(prefer) ? responder(res, 201, lista) : responder(res, 201);
          }
          if (req.method === "PATCH") {
            const r = filtrar(url);
            for (const f of r) filas.set(f.key, { ...f, ...cuerpo });
            if (/return=representation/.test(prefer)) return responder(res, 200, r.map((f) => proyectar(filas.get(f.key), url.searchParams.get("select"))));
            return responder(res, 204);
          }
          if (req.method === "DELETE") {
            for (const f of filtrar(url)) filas.delete(f.key);
            return responder(res, 204);
          }
          responder(res, 405, { message: "método no soportado" });
        } catch (e) {
          responder(res, 500, { message: String(e) });
        }
      }, a + Math.floor(Math.random() * (b - a)));
    });
  });
  return new Promise((ok) =>
    servidor.listen(puerto, "127.0.0.1", () => ok({ servidor, url: `http://127.0.0.1:${servidor.address().port}`, filas, opciones })),
  );
}
