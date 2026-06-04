import fs from "node:fs/promises";
import path from "node:path";
import type { BusinessProfile } from "./claude";
import type { ChatMessage } from "./types";
import type { AgentSlug } from "./agents";
import { kvGet, kvSet } from "./supabase";

export type { ChatMessage };

// Fallback local para desarrollo sin Supabase configurado
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

const ALL_AGENTS: AgentSlug[] = ["lucia", "marta", "carmen", "pablo", "rocio", "eva", "sergio"];

export type Contact = { email: string; name?: string; addedAt: string; source?: string };

export type LeadWidget = {
  token: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  ctaLabel: string;
  successMessage: string;
  welcomeEmailEnabled: boolean;
  welcomeSubject: string;
  welcomeBody: string;
};

export type ActivityEvent = {
  ts: string;
  type: "chat" | "email_sent" | "lead_captured" | "contact_added";
  agent?: AgentSlug;
  detail: string;
};

export type Stats = {
  emailsSent: number;
  lastChatAt: Partial<Record<AgentSlug, string>>;
};

export type GmailTokens = {
  refreshToken: string;
  email: string;
  connectedAt: string;
};

// Tokens de Google Business Profile (Rocío). Mismo refresh-token pattern que
// Gmail. `locationName` lo elige el usuario tras conectar (puede tener varias
// ubicaciones); formato `accounts/{ACCOUNT_ID}/locations/{LOCATION_ID}`.
export type GbpTokens = {
  refreshToken: string;
  email: string;
  connectedAt: string;
  locationName?: string;
  locationTitle?: string;
};

export type Feedback = {
  id: string;
  agent: AgentSlug;
  ts: string;
  userMessage: string;
  agentResponse: string;
  rating: "up" | "down";
  correction?: string; // versión corregida por el usuario
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  usedCount: number;
};

export type WelcomeSeries = {
  enabled: boolean;
  emails: { delayHours: number; subject: string; body: string }[];
};

export type ScheduledEmail = {
  id: string;
  to: string | "all";
  subject: string;
  body: string;
  scheduledFor: string; // ISO
  status: "pending" | "sent" | "failed";
  createdAt: string;
  sentAt?: string;
  error?: string;
};

export type WelcomeSend = {
  id: string;
  contactEmail: string;
  stepIndex: number; // qué email de la series
  sendAt: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  sentAt?: string;
};

export type LearnedPattern = {
  id: string;
  agent: AgentSlug;
  ts: string;
  goldStandard: string; // la respuesta correcta validada por el user
  context: string;      // el mensaje del paciente que generó la respuesta
  tags: string[];       // ej: "presupuesto-caro", "urgencia-noche"
};

export type UserData = {
  email: string;
  createdAt: string;
  business?: BusinessProfile;
  chats: Record<AgentSlug, ChatMessage[]>;
  contacts?: Contact[];
  widget?: LeadWidget;
  stats?: Stats;
  activity?: ActivityEvent[];
  gmailTokens?: GmailTokens;
  gbpTokens?: GbpTokens;
  feedback?: Feedback[];
  learned?: LearnedPattern[];
  emailTemplates?: EmailTemplate[];
  welcomeSeries?: WelcomeSeries;
  scheduledEmails?: ScheduledEmail[];
  welcomeSends?: WelcomeSend[];
};

function emptyChats(): Record<AgentSlug, ChatMessage[]> {
  return Object.fromEntries(ALL_AGENTS.map((a) => [a, [] as ChatMessage[]])) as unknown as Record<AgentSlug, ChatMessage[]>;
}

async function readAll(): Promise<Record<string, UserData>> {
  let data: Record<string, UserData> = {};
  if (USE_SUPABASE) {
    data = (await kvGet<Record<string, UserData>>("users")) ?? {};
  } else {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(USERS_FILE, "utf-8").catch(() => "{}");
      data = raw.trim() ? JSON.parse(raw) : {};
    } catch { data = {}; }
  }
  for (const u of Object.values(data)) {
    if (!u.chats) u.chats = emptyChats();
    for (const a of ALL_AGENTS) if (!u.chats[a]) u.chats[a] = [];
  }
  return data;
}

async function writeAll(data: Record<string, UserData>) {
  if (USE_SUPABASE) {
    await kvSet("users", data);
  } else {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
  }
}

export async function getUser(email: string): Promise<UserData> {
  const all = await readAll();
  if (!all[email]) {
    all[email] = {
      email,
      createdAt: new Date().toISOString(),
      chats: emptyChats(),
    };
    await writeAll(all);
  }
  return all[email];
}

export async function saveBusiness(email: string, business: BusinessProfile) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  fresh[email].business = business;
  await writeAll(fresh);
}

export async function appendMessage(email: string, agent: AgentSlug, msg: ChatMessage) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  fresh[email].chats[agent].push(msg);
  await writeAll(fresh);
}

export async function clearChat(email: string, agent: AgentSlug) {
  const all = await readAll();
  if (!all[email]) return;
  all[email].chats[agent] = [];
  await writeAll(all);
}

export async function getContacts(email: string): Promise<Contact[]> {
  const u = await getUser(email);
  return u.contacts ?? [];
}

export async function addContact(email: string, contact: { email: string; name?: string }) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  fresh[email].contacts = fresh[email].contacts ?? [];
  if (!fresh[email].contacts!.some((c) => c.email.toLowerCase() === contact.email.toLowerCase())) {
    fresh[email].contacts!.push({ ...contact, addedAt: new Date().toISOString() });
  }
  await writeAll(fresh);
}

export async function removeContact(email: string, contactEmail: string) {
  const all = await readAll();
  if (!all[email]) return;
  all[email].contacts = (all[email].contacts ?? []).filter(
    (c) => c.email.toLowerCase() !== contactEmail.toLowerCase()
  );
  await writeAll(all);
}

function makeToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 14);
}

function defaultWidget(business?: BusinessProfile): LeadWidget {
  const nombre = business?.nombre || "nuestro equipo";
  return {
    token: makeToken(),
    enabled: true,
    title: `Hablemos`,
    subtitle: `Déjanos tu correo y te respondemos en menos de 24 horas.`,
    ctaLabel: `Quiero saber más`,
    successMessage: `¡Gracias! Te hemos enviado un correo de bienvenida. Revisa tu bandeja.`,
    welcomeEmailEnabled: true,
    welcomeSubject: `Bienvenido a ${nombre}`,
    welcomeBody: `Hola,\n\nGracias por dejarnos tus datos. Hemos guardado tu petición y nos pondremos en contacto contigo lo antes posible.\n\nMientras tanto, si tienes cualquier duda, contesta a este correo y te leemos.\n\nUn saludo,\n${nombre}`,
  };
}

export async function getOrCreateWidget(email: string): Promise<LeadWidget> {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  if (!fresh[email].widget) {
    fresh[email].widget = defaultWidget(fresh[email].business);
    await writeAll(fresh);
  }
  return fresh[email].widget!;
}

export async function updateWidget(email: string, patch: Partial<LeadWidget>): Promise<LeadWidget> {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  const current = fresh[email].widget ?? defaultWidget(fresh[email].business);
  fresh[email].widget = { ...current, ...patch, token: current.token };
  await writeAll(fresh);
  return fresh[email].widget!;
}

export async function findUserByWidgetToken(token: string): Promise<UserData | null> {
  const all = await readAll();
  for (const u of Object.values(all)) {
    if (u.widget?.token === token) return u;
  }
  return null;
}

export async function findEmailByWidgetToken(token: string): Promise<string | null> {
  const all = await readAll();
  for (const [email, u] of Object.entries(all)) {
    if (u.widget?.token === token) return email;
  }
  return null;
}

const MAX_ACTIVITY = 50;

export async function logActivity(email: string, event: Omit<ActivityEvent, "ts">) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  if (!fresh[email].activity) fresh[email].activity = [];
  fresh[email].activity!.unshift({ ...event, ts: new Date().toISOString() });
  fresh[email].activity = fresh[email].activity!.slice(0, MAX_ACTIVITY);
  await writeAll(fresh);
}

export async function addFeedback(email: string, fb: Omit<Feedback, "id" | "ts">) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  if (!fresh[email].feedback) fresh[email].feedback = [];
  const newFb: Feedback = {
    ...fb,
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
  };
  fresh[email].feedback!.unshift(newFb);
  // Si hay corrección, guardarla como gold standard
  if (fb.correction && fb.correction.trim()) {
    if (!fresh[email].learned) fresh[email].learned = [];
    fresh[email].learned!.unshift({
      id: `learn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agent: fb.agent,
      ts: new Date().toISOString(),
      goldStandard: fb.correction.trim(),
      context: fb.userMessage,
      tags: [],
    });
  }
  await writeAll(fresh);
  return newFb;
}

export async function getFeedback(email: string, agent?: AgentSlug, limit = 50): Promise<Feedback[]> {
  const u = await getUser(email);
  const all = u.feedback ?? [];
  const filtered = agent ? all.filter((f) => f.agent === agent) : all;
  return filtered.slice(0, limit);
}

export async function getLearnedPatterns(email: string, agent?: AgentSlug, limit = 20): Promise<LearnedPattern[]> {
  const u = await getUser(email);
  const all = u.learned ?? [];
  const filtered = agent ? all.filter((p) => p.agent === agent) : all;
  return filtered.slice(0, limit);
}

// Plantillas de email (Eva)
export async function listEmailTemplates(email: string): Promise<EmailTemplate[]> {
  const u = await getUser(email);
  return u.emailTemplates ?? [];
}

export async function saveEmailTemplate(email: string, t: Omit<EmailTemplate, "id" | "createdAt" | "usedCount">): Promise<EmailTemplate> {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  if (!fresh[email].emailTemplates) fresh[email].emailTemplates = [];
  const newT: EmailTemplate = {
    ...t,
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    usedCount: 0,
  };
  fresh[email].emailTemplates!.unshift(newT);
  await writeAll(fresh);
  return newT;
}

export async function deleteEmailTemplate(email: string, id: string) {
  const all = await readAll();
  if (!all[email]?.emailTemplates) return;
  all[email].emailTemplates = all[email].emailTemplates!.filter((t) => t.id !== id);
  await writeAll(all);
}

export async function incrementTemplateUsage(email: string, id: string) {
  const all = await readAll();
  const t = all[email]?.emailTemplates?.find((x) => x.id === id);
  if (t) {
    t.usedCount++;
    await writeAll(all);
  }
}

// Scheduled emails
export async function listScheduledEmails(email: string): Promise<ScheduledEmail[]> {
  const u = await getUser(email);
  return u.scheduledEmails ?? [];
}

export async function addScheduledEmail(email: string, s: Omit<ScheduledEmail, "id" | "createdAt" | "status">): Promise<ScheduledEmail> {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  if (!fresh[email].scheduledEmails) fresh[email].scheduledEmails = [];
  const newS: ScheduledEmail = {
    ...s,
    id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  fresh[email].scheduledEmails!.push(newS);
  await writeAll(fresh);
  return newS;
}

export async function updateScheduledEmail(email: string, id: string, patch: Partial<ScheduledEmail>) {
  const all = await readAll();
  const s = all[email]?.scheduledEmails?.find((x) => x.id === id);
  if (s) {
    Object.assign(s, patch);
    await writeAll(all);
  }
}

export async function deleteScheduledEmail(email: string, id: string) {
  const all = await readAll();
  if (!all[email]?.scheduledEmails) return;
  all[email].scheduledEmails = all[email].scheduledEmails!.filter((s) => s.id !== id);
  await writeAll(all);
}

// Welcome sends
export async function queueWelcomeSends(email: string, contactEmail: string, series: WelcomeSeries) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  if (!fresh[email].welcomeSends) fresh[email].welcomeSends = [];
  const now = Date.now();
  for (let i = 0; i < series.emails.length; i++) {
    const e = series.emails[i];
    fresh[email].welcomeSends!.push({
      id: `welc_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      contactEmail,
      stepIndex: i,
      sendAt: new Date(now + e.delayHours * 3600 * 1000).toISOString(),
      status: "pending",
    });
  }
  await writeAll(fresh);
}

export async function listPendingWelcomeSends(email: string): Promise<WelcomeSend[]> {
  const u = await getUser(email);
  return (u.welcomeSends ?? []).filter((w) => w.status === "pending");
}

export async function updateWelcomeSend(email: string, id: string, patch: Partial<WelcomeSend>) {
  const all = await readAll();
  const w = all[email]?.welcomeSends?.find((x) => x.id === id);
  if (w) {
    Object.assign(w, patch);
    await writeAll(all);
  }
}

export async function getWelcomeSeries(email: string): Promise<WelcomeSeries | null> {
  const u = await getUser(email);
  return u.welcomeSeries ?? null;
}

export async function saveWelcomeSeries(email: string, w: WelcomeSeries) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  fresh[email].welcomeSeries = w;
  await writeAll(fresh);
}

export async function saveGmailTokens(email: string, tokens: GmailTokens) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  fresh[email].gmailTokens = tokens;
  await writeAll(fresh);
}

export async function getGmailTokens(email: string): Promise<GmailTokens | null> {
  const u = await getUser(email);
  return u.gmailTokens ?? null;
}

export async function clearGmailTokens(email: string) {
  const all = await readAll();
  if (!all[email]) return;
  delete all[email].gmailTokens;
  await writeAll(all);
}

// -----------------------------------------------------------------------------
// Google Business Profile (Rocío) — same refresh-token pattern as Gmail.
// -----------------------------------------------------------------------------
export async function saveGbpTokens(email: string, tokens: GbpTokens) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  fresh[email].gbpTokens = tokens;
  await writeAll(fresh);
}

export async function getGbpTokens(email: string): Promise<GbpTokens | null> {
  const u = await getUser(email);
  return u.gbpTokens ?? null;
}

export async function clearGbpTokens(email: string) {
  const all = await readAll();
  if (!all[email]) return;
  delete all[email].gbpTokens;
  await writeAll(all);
}

export async function bumpStats(email: string, patch: { emailsSent?: number; lastChatAgent?: AgentSlug }) {
  const all = await readAll();
  if (!all[email]) await getUser(email);
  const fresh = await readAll();
  if (!fresh[email].stats) fresh[email].stats = { emailsSent: 0, lastChatAt: {} };
  if (patch.emailsSent) fresh[email].stats!.emailsSent += patch.emailsSent;
  if (patch.lastChatAgent) fresh[email].stats!.lastChatAt[patch.lastChatAgent] = new Date().toISOString();
  await writeAll(fresh);
}
