/**
 * Cron cada 15 min — dispara emails programados y welcome series pendientes.
 *
 * Configurar en vercel.json:
 *   { "path": "/api/cron/eva-dispatcher", "schedule": "* /15 * * * *" }
 */

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import type { UserData } from "@/lib/store";
import { checkCronAuth } from "@/lib/cron-auth";

const DATA_DIR = process.env.VERCEL ? "/tmp/aiteam-data" : path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function readUsers(): Promise<Record<string, UserData>> {
  try { return JSON.parse(await fs.readFile(USERS_FILE, "utf-8")); }
  catch { return {}; }
}

async function writeUsers(data: Record<string, UserData>) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
}

function fillVars(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

export async function GET(req: Request) {
  const a = checkCronAuth(req);
  if (!a.ok) return NextResponse.json({ error: a.reason }, { status: 401 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No Resend key" }, { status: 200 });
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Eva (AI-Team) <eva@aiteam.marketing>";

  const users = await readUsers();
  const now = Date.now();
  let scheduledSent = 0;
  let welcomeSent = 0;
  let failed = 0;

  for (const [userEmail, user] of Object.entries(users)) {
    if (!user.business) continue;
    const negocio = user.business.nombre;

    // 1. Scheduled emails que les ha llegado el momento
    const sched = user.scheduledEmails ?? [];
    for (const s of sched) {
      if (s.status !== "pending") continue;
      if (new Date(s.scheduledFor).getTime() > now) continue;
      try {
        const recipients: string[] = s.to === "all"
          ? (user.contacts ?? []).map((c) => c.email)
          : [s.to];
        if (recipients.length === 0) {
          s.status = "failed";
          s.error = "Sin destinatarios";
          continue;
        }
        for (const r of recipients) {
          const cName = user.contacts?.find((c) => c.email === r)?.name || "";
          await resend.emails.send({
            from,
            to: r,
            subject: fillVars(s.subject, { negocio, nombre: cName }),
            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:20px;white-space:pre-wrap">${fillVars(s.body, { negocio, nombre: cName }).replace(/\n/g, "<br>")}</div>`,
          });
        }
        s.status = "sent";
        s.sentAt = new Date().toISOString();
        scheduledSent++;
      } catch (e) {
        s.status = "failed";
        s.error = e instanceof Error ? e.message : "Error";
        failed++;
      }
    }

    // 2. Welcome series pendientes
    const sends = user.welcomeSends ?? [];
    const series = user.welcomeSeries;
    for (const w of sends) {
      if (w.status !== "pending") continue;
      if (new Date(w.sendAt).getTime() > now) continue;
      if (!series || !series.enabled || !series.emails[w.stepIndex]) {
        w.status = "cancelled";
        continue;
      }
      try {
        const e = series.emails[w.stepIndex];
        const cName = user.contacts?.find((c) => c.email === w.contactEmail)?.name || "";
        await resend.emails.send({
          from,
          to: w.contactEmail,
          subject: fillVars(e.subject, { negocio, nombre: cName }),
          html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:20px;white-space:pre-wrap">${fillVars(e.body, { negocio, nombre: cName }).replace(/\n/g, "<br>")}</div>`,
        });
        w.status = "sent";
        w.sentAt = new Date().toISOString();
        welcomeSent++;
      } catch (e) {
        w.status = "failed";
        failed++;
        console.error("welcome send failed", e);
      }
    }
  }

  await writeUsers(users);
  return NextResponse.json({ scheduledSent, welcomeSent, failed });
}
