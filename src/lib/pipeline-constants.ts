/**
 * Pipeline constants — safe to import from client components.
 */

export type LeadStage =
  | "new"
  | "enriched"
  | "contacted"
  | "engaged"
  | "qualified"
  | "demo_booked"
  | "demo_done"
  | "trial"
  | "client"
  | "lost"
  | "nurture";

export const STAGE_ORDER: LeadStage[] = [
  "new", "enriched", "contacted", "engaged", "qualified",
  "demo_booked", "demo_done", "trial", "client", "lost", "nurture",
];

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "🆕 Nuevo",
  enriched: "📊 Enriquecido",
  contacted: "📤 Contactado",
  engaged: "👀 Engaged",
  qualified: "✅ Cualificado",
  demo_booked: "📅 Demo agendada",
  demo_done: "🎯 Demo hecha",
  trial: "🧪 Trial",
  client: "💰 Cliente",
  lost: "❌ Perdido",
  nurture: "🌱 Nurture",
};

export type LeadActivity = {
  id: string;
  type: "email_sent" | "email_opened" | "email_replied" | "whatsapp_sent" | "whatsapp_replied" | "call" | "demo" | "stage_change" | "note";
  ts: string;
  data?: Record<string, unknown>;
};

export type Lead = {
  id: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  sector: string;
  subsector?: string;
  size?: "1-3" | "4-10" | "11-50" | "50+";
  website?: string;
  rating?: number;
  reviewCount?: number;
  instagram?: string;
  linkedin?: string;
  stage: LeadStage;
  source: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  lastTouchAt?: string;
  activities: LeadActivity[];
  notes?: string;
  tags?: string[];
};
