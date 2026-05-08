import fs from "node:fs/promises";
import path from "node:path";
import type { BusinessProfile } from "./claude";
import type { ChatMessage } from "./types";
import type { AgentSlug } from "./agents";

export type { ChatMessage };

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const ALL_AGENTS: AgentSlug[] = ["lucia", "marta", "carmen", "pablo", "rocio", "eva"];

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

export type UserData = {
  email: string;
  createdAt: string;
  business?: BusinessProfile;
  chats: Record<AgentSlug, ChatMessage[]>;
  contacts?: Contact[];
  widget?: LeadWidget;
};

function emptyChats(): Record<AgentSlug, ChatMessage[]> {
  return Object.fromEntries(ALL_AGENTS.map((a) => [a, [] as ChatMessage[]])) as unknown as Record<AgentSlug, ChatMessage[]>;
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, "{}");
  }
}

async function readAll(): Promise<Record<string, UserData>> {
  await ensureFile();
  const raw = await fs.readFile(USERS_FILE, "utf-8");
  const data: Record<string, UserData> = raw.trim() ? JSON.parse(raw) : {};
  // Backfill chats for new agents in users created before
  for (const u of Object.values(data)) {
    if (!u.chats) u.chats = emptyChats();
    for (const a of ALL_AGENTS) if (!u.chats[a]) u.chats[a] = [];
  }
  return data;
}

async function writeAll(data: Record<string, UserData>) {
  await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
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
