// Plantillas UTILITY de WhatsApp para confirmación, recordatorio, informe
// semanal de Carmen y aviso de urgencia al dueño, en español e inglés.
//
//   node scripts/whatsapp-plantillas.mjs --estado    # cómo están en Meta
//   node scripts/whatsapp-plantillas.mjs --crear     # las crea y las manda a revisión
//
// Necesita WHATSAPP_ACCESS_TOKEN (con whatsapp_business_management) y
// WHATSAPP_BUSINESS_ACCOUNT_ID. EL TOKEN NO SE IMPRIME NUNCA.
// Cuando estén APPROVED, en Vercel:
//   BOOKING_CONFIRMACION_TEMPLATE=aiteam_cita_confirmacion
//   BOOKING_RECORDATORIO_TEMPLATE=aiteam_cita_recordatorio
//   CARMEN_INFORME_TEMPLATE=aiteam_informe_semanal
//   CARMEN_URGENCIA_TEMPLATE=aiteam_urgencia_dueno
//   BOOKING_AVISO_DUENO_TEMPLATE=aiteam_aviso_dueno_cita (es el valor por defecto)
//   REVIEW_REQUEST_TEMPLATE=aiteam_pedir_resena (por defecto) + REVIEW_REQUEST_ENABLED=true
const token = process.env.WHATSAPP_ACCESS_TOKEN;
const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1409997207694647";
if (!token) { console.error("Falta WHATSAPP_ACCESS_TOKEN"); process.exit(1); }
const G = `https://graph.facebook.com/v21.0/${waba}/message_templates`;
const tapa = (s) => String(s).split(token).join("[token]");
const EJ5 = ["Laura", "Salón Marina", "martes 6 de octubre a las 10:30", "Corte y peinado", "Calle Real 1, Marbella · https://maps.google.com/?q=Marbella"];
const boton = (texto) => ({ type: "BUTTONS", buttons: [{ type: "URL", text: texto, url: "https://aiteam.marketing/reservas/cancelar/{{1}}", example: ["abc123token"] }] });
const P = [
  ["aiteam_cita_confirmacion", "es", "Hola {{1}}, tu cita en {{2}} ha quedado confirmada. Te esperamos el {{3}} para {{4}}. La dirección es {{5}}. Si no puedes venir, puedes anularla o cambiarla desde el botón de abajo.", EJ5, "Anular o cambiar"],
  ["aiteam_cita_confirmacion", "en", "Hi {{1}}, your appointment at {{2}} has been confirmed. We look forward to seeing you on {{3}} for {{4}}. The address is {{5}}. If you cannot make it, you can cancel or change it with the button below.", EJ5, "Cancel or change"],
  ["aiteam_cita_recordatorio", "es", "Hola {{1}}, te recordamos tu cita en {{2}} mañana: {{3}} ({{4}}). Dirección: {{5}}. Contesta SI para confirmar.", EJ5, "Anular o cambiar"],
  ["aiteam_cita_recordatorio", "en", "Hi {{1}}, this is a reminder of your appointment at {{2}} tomorrow: {{3}} ({{4}}). Address: {{5}}. Reply YES to confirm.", EJ5, "Cancel or change"],
  ["aiteam_informe_semanal", "es", "Resumen semanal de Carmen: {{1}} llamadas atendidas, {{2}} citas cerradas, {{3}} perdidas rescatadas y {{4}} euros recuperados.", ["12", "5", "2", "180"]],
  ["aiteam_informe_semanal", "en", "Carmen's weekly summary: {{1}} calls answered, {{2}} appointments booked, {{3}} missed calls recovered and {{4}} euros recovered.", ["12", "5", "2", "180"]],
  ["aiteam_aviso_dueno_cita", "es", "Tienes una nueva cita reservada en {{1}}. La ha pedido {{2}} para el servicio {{3}}, el {{4}}. Si necesitas contactar con el cliente, su teléfono es {{5}}. Puedes verla y gestionarla desde tu panel de citas.", ["Salón Marina", "Laura", "Corte y peinado", "martes 6 de octubre a las 10:30", "+34600000000"]],
  // Pedir reseña: para Meta es MARKETING (no utilidad). Variables: nombre, negocio, enlace de Google.
  ["aiteam_pedir_resena", "es", "Hola {{1}}, gracias por venir ayer a {{2}}. Si te quedaste a gusto, nos ayudaría mucho una reseña en Google: {{3}} Si algo no fue bien, contéstanos a este mensaje y lo vemos.", ["Laura", "Salón Marina", "https://g.page/r/ejemplo/review"], null, "MARKETING"],
  ["aiteam_pedir_resena", "en", "Hi {{1}}, thanks for visiting {{2}} yesterday. If you were happy with us, a Google review would help us a lot: {{3}} If anything wasn't right, just reply to this message and we'll look into it.", ["Laura", "Salón Marina", "https://g.page/r/ejemplo/review"], null, "MARKETING"],
  ["aiteam_urgencia_dueno", "es", "Urgencia en una llamada de Carmen. Cliente: {{1}}. Resumen: {{2}}. Llámale en cuanto puedas.", ["+34600000000", "dolor fuerte tras el tratamiento"]],
  ["aiteam_urgencia_dueno", "en", "Urgent call handled by Carmen. Customer: {{1}}. Summary: {{2}}. Please call them back as soon as possible.", ["+34600000000", "strong pain after the treatment"]],
];
if (process.argv.includes("--crear")) {
  const solo = process.argv.find((a) => a.startsWith("--solo="))?.slice(7);
  for (const [name, language, text, ej, btn, categoria = "UTILITY"] of P) {
    if (solo && name !== solo) continue;
    const components = [{ type: "BODY", text, example: { body_text: [ej] } }];
    if (btn) components.push(boton(btn));
    const r = await fetch(G, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name, language, category: categoria, components }) });
    const j = await r.json().catch(() => ({}));
    console.log(`${name} [${language}] → ${r.status} ${j.status ?? ""} ${j.category ?? ""} ${tapa(j.error?.error_user_msg || j.error?.message || "")}`);
  }
}
const r = await fetch(`${G}?fields=name,language,status,category&limit=100`, { headers: { Authorization: `Bearer ${token}` } });
const j = await r.json().catch(() => ({}));
if (!r.ok) console.log(`estado → ${r.status} ${tapa(j.error?.message || "")}`);
for (const t of (j.data || []).filter((t) => t.name.startsWith("aiteam_"))) console.log(`  ${t.name} [${t.language}] ${t.status} ${t.category}`);
