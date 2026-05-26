/**
 * Twilio · Provisión automática de números españoles.
 * Compra número + configura webhook → todo via API, sin intervención humana.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getAuth(): { sid: string; token: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token };
}

function authHeader(sid: string, token: string) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

export type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality?: string;
  region?: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
};

/**
 * Busca números disponibles en España.
 * type: "local" (geográfico Madrid 91, BCN 93, etc), "mobile" (6xx), "tollfree" (900)
 * areaCode: prefijo opcional (91 = Madrid, 93 = Barcelona, 95 = Sevilla, etc.)
 */
export async function listAvailableNumbers(input: { type?: "local" | "mobile" | "tollfree"; areaCode?: string; limit?: number } = {}): Promise<AvailableNumber[]> {
  const auth = getAuth();
  if (!auth) throw new Error("TWILIO_ACCOUNT_SID/TOKEN no configurados");
  const type = input.type || "local";
  const limit = input.limit || 10;
  const params = new URLSearchParams();
  params.append("VoiceEnabled", "true");
  if (input.areaCode) params.append("AreaCode", input.areaCode);
  params.append("PageSize", String(limit));

  const url = `https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/AvailablePhoneNumbers/ES/${type === "mobile" ? "Mobile" : type === "tollfree" ? "TollFree" : "Local"}.json?${params}`;
  const res = await fetch(url, { headers: { Authorization: authHeader(auth.sid, auth.token) } });
  if (!res.ok) { const t = await res.text(); throw new Error(`Twilio search ${res.status}: ${t.slice(0, 200)}`); }
  const j = await res.json();
  return (j.available_phone_numbers || []).map((n: Row) => ({
    phone_number: n.phone_number,
    friendly_name: n.friendly_name,
    locality: n.locality,
    region: n.region,
    capabilities: n.capabilities,
  }));
}

/**
 * Compra un número y lo configura con el webhook de Carmen automáticamente.
 * Devuelve el número asignado.
 */
export async function buyAndConfigureNumber(input: { phoneNumber: string; webhookUrl: string; friendlyName?: string }): Promise<{ sid: string; phone_number: string }> {
  const auth = getAuth();
  if (!auth) throw new Error("TWILIO_ACCOUNT_SID/TOKEN no configurados");

  const form = new URLSearchParams();
  form.append("PhoneNumber", input.phoneNumber);
  form.append("VoiceUrl", input.webhookUrl);
  form.append("VoiceMethod", "POST");
  if (input.friendlyName) form.append("FriendlyName", input.friendlyName);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/IncomingPhoneNumbers.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader(auth.sid, auth.token), "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Twilio buy ${res.status}: ${t.slice(0, 200)}`); }
  const j = await res.json();
  return { sid: j.sid, phone_number: j.phone_number };
}

/**
 * Actualiza el webhook de un número ya comprado.
 */
export async function updateNumberWebhook(input: { sid: string; webhookUrl: string }): Promise<void> {
  const auth = getAuth();
  if (!auth) throw new Error("TWILIO_ACCOUNT_SID/TOKEN no configurados");
  const form = new URLSearchParams();
  form.append("VoiceUrl", input.webhookUrl);
  form.append("VoiceMethod", "POST");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/IncomingPhoneNumbers/${input.sid}.json`, {
    method: "POST",
    headers: { Authorization: authHeader(auth.sid, auth.token), "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
}

/**
 * Libera/borra un número (cancela el alquiler mensual).
 */
export async function releaseNumber(sid: string): Promise<void> {
  const auth = getAuth();
  if (!auth) throw new Error("TWILIO_ACCOUNT_SID/TOKEN no configurados");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/IncomingPhoneNumbers/${sid}.json`, {
    method: "DELETE",
    headers: { Authorization: authHeader(auth.sid, auth.token) },
  });
}

/**
 * Dispara una llamada de test al móvil del cliente para verificar que todo funciona.
 * Esta llamada saliente le marca a su móvil y al descolgar oye "Carmen funciona correctamente".
 */
export async function testCall(input: { to: string; from: string; messageText?: string }): Promise<string> {
  const auth = getAuth();
  if (!auth) throw new Error("TWILIO_ACCOUNT_SID/TOKEN no configurados");
  const msg = input.messageText || "Hola. Soy Carmen. He recibido tu llamada correctamente. Carmen está configurada y lista. Gracias.";
  const form = new URLSearchParams();
  form.append("To", input.to);
  form.append("From", input.from);
  form.append("Twiml", `<Response><Say language="es-ES">${msg}</Say><Hangup/></Response>`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${auth.sid}/Calls.json`, {
    method: "POST",
    headers: { Authorization: authHeader(auth.sid, auth.token), "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Twilio test call ${res.status}: ${t.slice(0, 200)}`); }
  const j = await res.json();
  return j.sid;
}

// ===== Helper: detectar operadora por prefijo ES =====
export function detectarOperadoraSpain(numero: string): string {
  const n = numero.replace(/\D/g, "");
  // Prefijos móvil España (orientativo, los clientes pueden ser portados)
  if (/^(34)?6/.test(n) || /^(34)?7/.test(n)) {
    // Sin lookup MNP real, devolvemos guía genérica
    return "movil";
  }
  return "fijo";
}

export const INSTRUCCIONES_DESVIO = {
  movistar: {
    nombre: "Movistar",
    codigo: (numero: string) => `**61*${numero.replace(/^\+/, "+")}**30#`,
    descripcion: "Marca este código en tu móvil y pulsa llamar. Activa el desvío si no contestas en 30 segundos.",
  },
  vodafone: {
    nombre: "Vodafone",
    codigo: (numero: string) => `**61*${numero.replace(/^\+/, "+")}**30#`,
    descripcion: "Marca este código en tu móvil y pulsa llamar. Activa el desvío si no contestas en 30 segundos.",
  },
  orange: {
    nombre: "Orange",
    codigo: (numero: string) => `**61*${numero.replace(/^\+/, "+")}**30#`,
    descripcion: "Marca este código en tu móvil y pulsa llamar. Activa el desvío si no contestas en 30 segundos.",
  },
  yoigo: {
    nombre: "Yoigo / MásMóvil / Pepephone",
    codigo: (numero: string) => `**61*${numero.replace(/^\+/, "+")}**30#`,
    descripcion: "Marca este código y pulsa llamar. Si no funciona, ve a Ajustes → Llamadas → Desvío de llamadas → Si no contesto → ${numero}.",
  },
  digi: {
    nombre: "Digi / O2",
    codigo: (numero: string) => `**61*${numero.replace(/^\+/, "+")}**30#`,
    descripcion: "Marca este código. Si no va, llama al 1212 (Digi) o 1551 (O2) y pide que activen 'desvío si no contestas' al número que te damos.",
  },
  otra: {
    nombre: "Otra operadora",
    codigo: (numero: string) => `**61*${numero.replace(/^\+/, "+")}**30#`,
    descripcion: "Prueba este código universal. Si no funciona, ve a Ajustes → Llamadas → Desvío de llamadas → Si no contesto → introduce el número.",
  },
} as const;

export type OperadoraKey = keyof typeof INSTRUCCIONES_DESVIO;
