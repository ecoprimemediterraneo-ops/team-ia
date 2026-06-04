"use server";

import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { processNewReviews, resolveTenantForRocio } from "@/lib/rocio-flow";
import { getRedirectUri } from "@/lib/google-business";
import type { ProcessState } from "./types";

export async function scanReviewsAction(
  _prev: ProcessState,
  formData: FormData,
): Promise<ProcessState> {
  const s = await getSession();
  if (!s) return { ts: Date.now(), variant: "error", title: "Inicia sesión" };

  const recipient = String(formData.get("recipient") || "").replace(/\D/g, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const redirectUri = getRedirectUri(host, proto);

  const tenantId = await resolveTenantForRocio();
  const result = await processNewReviews({
    userEmail: s.email,
    redirectUri,
    recipientWhatsapp: recipient || undefined,
    tenantId,
  });

  return {
    ts: Date.now(),
    variant: "ok",
    title: `Escaneadas ${result.scanned} reseñas`,
    detail: [
      `${result.autoPublished} auto-publicadas`,
      `${result.proposedToClient} enviadas a tu WhatsApp para aprobar`,
      `${result.newAlreadyAnswered} ya estaban respondidas`,
      result.errors.length ? `${result.errors.length} aviso(s)` : "",
    ].filter(Boolean).join(" · "),
    result,
  };
}
