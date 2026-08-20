#!/usr/bin/env node
// Pasa tres documentos por la lectura y enseña QUÉ DICE QUE SON.
//
// El que importa es el primero: un ticket de bar real —Café de Ronda, con NIF
// del emisor, IVA desglosado y SIN NIF del destinatario— que tiene que salir
// clasificado como TICKET y avisado. Si sale como factura completa, el gestor
// se deduciría un IVA que Hacienda le va a quitar meses después.
//
// Los otros dos son un albarán y un abono inventados, para ver que uno se queda
// fuera del cruce con el banco y el otro resta en vez de sumar.
//
//   node scripts/probar-lectura-documentos.mjs
//
// Necesita el servidor local levantado y ANTHROPIC_API_KEY en el entorno del
// servidor. Sube los documentos por la MISMA ruta que usa el panel, así que lo
// que se prueba es el camino de verdad, no la función suelta.

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CLIENTE = process.argv[2] || "600110011"; // Talleres Ruiz SL en la demo

/** Un PDF de una página con las líneas dadas. Sin comprimir, para no depender de nada. */
function pdf(lineas) {
  const texto = lineas
    .map((l, i) => `BT /F1 ${l.grande ? 14 : 10} Tf 40 ${780 - i * 18} Td (${String(l.t ?? l).replace(/([()\\])/g, "\\$1")}) Tj ET`)
    .join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const pos = [];
  objetos.forEach((o, i) => { pos.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of pos) out += `${String(p).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

const DOCS = [
  {
    nombre: "cafe-de-ronda.pdf",
    esperado: "ticket",
    porQue: "no lleva NIF del destinatario",
    lineas: [
      { t: "CAFE DE RONDA", grande: true },
      "PROYECTO COSTABELLA 2009 S.L.",
      "C.I.F.: B-93035848",
      "Avda. Ricardo Soriano, Marbella",
      "",
      "FACTURA SIMPLIFICADA  N. 004521",
      "Fecha: 14/08/2026   Mesa 7",
      "",
      "2 CAFE CON LECHE ............ 3,60",
      "1 TOSTADA ACEITE ............ 2,80",
      "2 ZUMO NARANJA .............. 6,40",
      "1 AGUA MINERAL .............. 1,90",
      "",
      "BASE IMPONIBLE ............. 15,18",
      "IVA 10% .................... 1,52",
      "TOTAL ...................... 16,70",
      "",
      "Gracias por su visita",
    ],
  },
  {
    nombre: "albaran-hosteleria.pdf",
    esperado: "albaran",
    porQue: "no lleva IVA ni importe fiscal",
    lineas: [
      { t: "ALBARAN DE ENTREGA N. 2026/4471", grande: true },
      "DISTRIBUCIONES COSTA DEL SOL S.L.",
      "C.I.F.: B-29887654",
      "",
      "Cliente: BAR EL PUERTO",
      "Fecha de entrega: 12/08/2026",
      "",
      "CANT  ARTICULO",
      "  12  Caja cerveza 33cl",
      "   6  Garrafa aceite girasol 5L",
      "  24  Bolsa patatas 1kg",
      "   3  Saco cafe grano 1kg",
      "",
      "Mercancia recibida conforme.",
      "Firma del receptor: ______________",
      "",
      "ESTE DOCUMENTO NO ES FACTURA",
    ],
  },
  {
    nombre: "abono-suministros.pdf",
    esperado: "abono",
    porQue: "va en negativo y rectifica una factura anterior",
    lineas: [
      { t: "FACTURA RECTIFICATIVA (ABONO)", grande: true },
      "SUMINISTROS HOSTELEROS DEL SUR S.L.",
      "C.I.F.: B-92114477",
      "",
      "Numero: R-2026/018    Fecha: 18/08/2026",
      "Rectifica a la factura: SUM-2026-0803",
      "",
      "Cliente: BAR EL PUERTO S.L.",
      "N.I.F.: B-29554433",
      "Motivo: devolucion de mercancia en mal estado",
      "",
      "BASE IMPONIBLE ........... -260,00",
      "IVA 21% .................. -54,60",
      "TOTAL .................... -314,60",
    ],
  },
];

const linea = (t) => console.log(t);

// --- MODO COMPARACIÓN: el mismo documento por dos modelos, campo a campo ------
if (process.argv.includes("--comparar")) {
  const CAMPOS = ["emisor", "nifEmisor", "nifDestinatario", "numero", "fecha", "total"];
  const val = (c) => (c?.valor == null ? "—" : `${c.valor}${c.seguro ? "" : " (no seguro)"}`);
  let discrepancias = 0;

  for (const d of DOCS) {
    const form = new FormData();
    form.append("fichero", new Blob([pdf(d.lineas)], { type: "application/pdf" }), d.nombre);
    const res = await fetch(`${BASE}/api/admin/lectura-comparar`, { method: "POST", body: form });
    const j = await res.json();
    if (!res.ok) { linea(`✗ ${d.nombre}: HTTP ${res.status} ${JSON.stringify(j).slice(0, 200)}`); continue; }

    const [a, b] = j.modelos;
    const A = j.lecturas[a], B = j.lecturas[b];
    linea(`\n${"=".repeat(78)}\n${d.nombre}   (se espera: ${d.esperado})\n${"=".repeat(78)}`);
    linea(`  ${"campo".padEnd(18)} ${String(a).padEnd(26)} ${b}`);
    linea(`  ${"-".repeat(18)} ${"-".repeat(26)} ${"-".repeat(26)}`);

    const fila = (etiqueta, x, y) => {
      const igual = String(x) === String(y);
      if (!igual) discrepancias++;
      linea(`  ${igual ? " " : "\x1b[31m≠\x1b[0m"}${etiqueta.padEnd(17)} ${String(x).padEnd(26)} ${String(y)}`);
    };

    fila("CLASE", A.clase, B.clase);
    fila("confianza", A.confianza, B.confianza);
    fila("contable", A.contable ? "si" : "no", B.contable ? "si" : "no");
    for (const c of CAMPOS) fila(c, val(A[c]), val(B[c]));
    fila("lineas IVA", (A.lineas || []).map((l) => `${l.tipo}%:${l.base}/${l.cuota}`).join(" ") || "—",
                       (B.lineas || []).map((l) => `${l.tipo}%:${l.base}/${l.cuota}`).join(" ") || "—");
    fila("avisos", (A.avisos || []).length, (B.avisos || []).length);
    linea(`   ${"tokens".padEnd(17)} ${`${A.tokens?.entrada}/${A.tokens?.salida}`.padEnd(26)} ${B.tokens?.entrada}/${B.tokens?.salida}`);
    linea(`   ${"coste $".padEnd(17)} ${String(A.dolares?.toFixed(5)).padEnd(26)} ${B.dolares?.toFixed(5)}`);
    linea(`   acierta la clase: ${A.clase === d.esperado ? "si" : "NO"} / ${B.clase === d.esperado ? "si" : "NO"}`);
  }

  linea(`\n${discrepancias === 0 ? "\x1b[32mNINGUNA DISCREPANCIA\x1b[0m" : `\x1b[31m${discrepancias} DISCREPANCIA(S)\x1b[0m`}\n`);
  process.exit(0);
}

for (const d of DOCS) {
  const form = new FormData();
  form.append("clienteId", CLIENTE);
  form.append("ficheros", new Blob([pdf(d.lineas)], { type: "application/pdf" }), d.nombre);

  linea(`\n${"=".repeat(64)}\n${d.nombre}  (se espera: ${d.esperado} — ${d.porQue})\n${"=".repeat(64)}`);

  const res = await fetch(`${BASE}/api/gestoria/facturas`, { method: "POST", body: form });
  const j = await res.json();
  if (!res.ok || !j.facturas?.length) {
    linea(`  ✗ no se ha podido subir: HTTP ${res.status} ${JSON.stringify(j).slice(0, 200)}`);
    continue;
  }
  const f = j.facturas[0];
  const l = f.lectura;
  if (!l) {
    linea(`  ✗ no se ha leído. ${f.lectura_error || "sin motivo"}`);
    continue;
  }

  const bien = l.clase === d.esperado;
  linea(`  ${bien ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} CLASE: ${l.clase}  (confianza ${l.confianza})`);
  linea(`     por que: ${l.porQue}`);
  linea(`     contable: ${f.contable ? "SI, entra en el cruce con el banco" : "NO, fuera del cruce"}`);
  const c = (x) => (x?.valor == null ? "—" : `${x.valor}${x.seguro ? "" : "  (no seguro)"}`);
  linea(`     proveedor ....... ${c(l.emisor)}`);
  linea(`     NIF emisor ...... ${c(l.nifEmisor)}`);
  linea(`     NIF destinatario  ${c(l.nifDestinatario)}`);
  linea(`     numero .......... ${c(l.numero)}`);
  linea(`     fecha ........... ${c(l.fecha)}`);
  linea(`     total ........... ${c(l.total)}`);
  for (const li of l.lineas) linea(`     IVA ${li.tipo ?? "?"}% · base ${li.base} · cuota ${li.cuota}`);
  if (l.rectificaA?.valor) linea(`     rectifica a ..... ${l.rectificaA.valor}`);
  linea(`     importe guardado: ${f.importe}`);
  for (const a of l.avisos) linea(`     AVISO: ${a}`);
}
linea("");
