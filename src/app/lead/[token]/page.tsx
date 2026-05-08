import { notFound } from "next/navigation";
import { findUserByWidgetToken } from "@/lib/store";
import LeadForm from "@/components/LeadForm";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await findUserByWidgetToken(token);
  if (!user || !user.widget?.enabled) notFound();
  const w = user.widget;
  const businessName = user.business?.nombre || "AI-Team";

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[color:var(--cream)]">
      <div className="max-w-md w-full">
        <div className="text-xs font-mono uppercase tracking-widest mb-3 text-black/60">
          {businessName}
        </div>
        <h1 className="font-stencil text-4xl md:text-5xl mb-2 leading-[1]">{w.title}</h1>
        <p className="text-black/70 mb-6">{w.subtitle}</p>

        <LeadForm token={token} ctaLabel={w.ctaLabel} successMessage={w.successMessage} />

        <p className="mt-6 text-[10px] font-mono uppercase tracking-widest text-black/40">
          Powered by AI-Team · aiteam.marketing
        </p>
      </div>
    </main>
  );
}
