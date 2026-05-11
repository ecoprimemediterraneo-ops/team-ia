import { NextResponse } from "next/server";
import { listLeads, moveLead, addLeadActivity } from "@/lib/pipeline";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const recipientEmail = data.to?.[0] || data.email;
    if (!recipientEmail) return NextResponse.json({ ok: true });

    const leads = await listLeads();
    const lead = leads.find((l) => l.email === recipientEmail);
    if (!lead) return NextResponse.json({ ok: true });

    switch (type) {
      case "email.opened": {
        if (lead.stage === "contacted") {
          await moveLead(lead.id, "engaged");
        }
        await addLeadActivity(lead.id, {
          type: "email_opened",
          data: { subject: data.subject },
        });
        break;
      }
      case "email.clicked": {
        if (lead.stage === "contacted" || lead.stage === "engaged") {
          await moveLead(lead.id, "engaged");
        }
        await addLeadActivity(lead.id, {
          type: "email_opened",
          data: { subject: data.subject, clicked: true, url: data.click?.url },
        });
        break;
      }
      case "email.bounced": {
        await addLeadActivity(lead.id, {
          type: "note",
          data: { note: `Email rebotado: ${data.bounce?.message || "unknown"}` },
        });
        break;
      }
      case "email.complained": {
        await moveLead(lead.id, "lost");
        await addLeadActivity(lead.id, {
          type: "note",
          data: { note: "Marcó como spam" },
        });
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Resend webhook error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
