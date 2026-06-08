import { google } from "googleapis";
import { getGmailTokens } from "./store";

// Calendar.events: read + write (crear/modificar eventos en el calendario
// "primary" del usuario). Cambio desde calendar.readonly: los usuarios que ya
// estaban conectados tendrán que re-autorizar para que la agenda funcione.
// El flow OAuth ya usa prompt:"consent" → al pulsar de nuevo "Conectar Gmail"
// Google les pedirá el nuevo permiso ampliado.
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function makeOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function getRedirectUri(host: string, proto: string) {
  return `${proto}://${host}/api/lucia/callback`;
}

export async function getAuthedGmail(userEmail: string, redirectUri: string) {
  const tokens = await getGmailTokens(userEmail);
  if (!tokens) return null;
  const oauth2 = makeOAuthClient(redirectUri);
  oauth2.setCredentials({ refresh_token: tokens.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  return { gmail, connectedEmail: tokens.email };
}

export type InboxMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
};

export async function createDraft(
  userEmail: string,
  redirectUri: string,
  args: { to: string; subject: string; body: string; threadId?: string }
): Promise<{ draftId: string; messageId: string } | null> {
  const ctx = await getAuthedGmail(userEmail, redirectUri);
  if (!ctx) return null;
  const { gmail } = ctx;
  const lines = [
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    args.body,
  ];
  const raw = Buffer.from(lines.join("\r\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const draft = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw, ...(args.threadId ? { threadId: args.threadId } : {}) },
    },
  });
  return { draftId: draft.data.id!, messageId: draft.data.message?.id ?? "" };
}

export async function fetchMessageBody(userEmail: string, redirectUri: string, id: string): Promise<{ from: string; subject: string; body: string } | null> {
  const ctx = await getAuthedGmail(userEmail, redirectUri);
  if (!ctx) return null;
  const { gmail } = ctx;
  const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const headers = msg.data.payload?.headers ?? [];
  const get = (n: string) => headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? "";
  const collect = (part: { mimeType?: string | null; body?: { data?: string | null } | null; parts?: unknown[] | null } | undefined): string => {
    if (!part) return "";
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      for (const p of part.parts) {
        const t = collect(p as { mimeType?: string; body?: { data?: string }; parts?: unknown[] });
        if (t) return t;
      }
    }
    return "";
  };
  const body = collect(msg.data.payload as { mimeType?: string; body?: { data?: string }; parts?: unknown[] }) || msg.data.snippet || "";
  return { from: get("From"), subject: get("Subject"), body: body.slice(0, 4000) };
}

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
};

export async function fetchTodayCalendar(userEmail: string, redirectUri: string): Promise<CalendarEvent[] | null> {
  const tokens = await (await import("./store")).getGmailTokens(userEmail);
  if (!tokens) return null;
  const { google } = await import("googleapis");
  const oauth2 = makeOAuthClient(redirectUri);
  oauth2.setCredentials({ refresh_token: tokens.refreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  try {
    const list = await calendar.events.list({
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });
    return (list.data.items ?? []).map((e) => ({
      id: e.id || "",
      summary: e.summary || "(sin título)",
      start: e.start?.dateTime || e.start?.date || "",
      end: e.end?.dateTime || e.end?.date || "",
      location: e.location || undefined,
      attendees: (e.attendees ?? []).map((a) => a.email || "").filter(Boolean),
    }));
  } catch {
    return null;
  }
}

export async function archiveMessages(userEmail: string, redirectUri: string, ids: string[]): Promise<number> {
  const ctx = await getAuthedGmail(userEmail, redirectUri);
  if (!ctx) return 0;
  const { gmail } = ctx;
  if (ids.length === 0) return 0;
  // Asegurar etiqueta "Lucía-Promos"
  const labels = await gmail.users.labels.list({ userId: "me" });
  let label = labels.data.labels?.find((l) => l.name === "Lucía-Promos");
  if (!label) {
    const created = await gmail.users.labels.create({
      userId: "me",
      requestBody: { name: "Lucía-Promos", labelListVisibility: "labelShow", messageListVisibility: "show" },
    });
    label = created.data;
  }
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: {
      ids,
      addLabelIds: [label.id!],
      removeLabelIds: ["INBOX"],
    },
  });
  return ids.length;
}

export async function fetchInbox(userEmail: string, redirectUri: string, max = 20): Promise<{ connectedEmail: string; messages: InboxMessage[] } | null> {
  const ctx = await getAuthedGmail(userEmail, redirectUri);
  if (!ctx) return null;
  const { gmail, connectedEmail } = ctx;
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: max,
    q: "in:inbox",
  });
  const ids = list.data.messages ?? [];
  const messages = await Promise.all(
    ids.map(async (m) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = full.data.payload?.headers ?? [];
      const get = (n: string) => headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? "";
      return {
        id: full.data.id!,
        threadId: full.data.threadId!,
        from: get("From"),
        subject: get("Subject"),
        snippet: full.data.snippet ?? "",
        date: get("Date"),
        unread: (full.data.labelIds ?? []).includes("UNREAD"),
      } satisfies InboxMessage;
    })
  );
  return { connectedEmail, messages };
}
