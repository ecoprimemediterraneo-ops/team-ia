import { redirect } from "next/navigation";
import { getSession, isFounder } from "@/lib/auth";
import { listTickets } from "@/lib/tomas-chat";
import AdminTicketsTable from "@/components/AdminTicketsTable";

export default async function AdminTicketsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isFounder(s.email)) redirect("/dashboard");
  const items = await listTickets({ limit: 200 });
  return (
    <section className="max-w-6xl mx-auto px-5 py-8">
      <h1 className="font-stencil text-4xl mb-2">🎫 Tickets soporte</h1>
      <p className="text-sm text-black/60 mb-6">Tomás escala aquí lo que no puede resolver. Cada ticket viene pre-investigado.</p>
      <AdminTicketsTable initialItems={items} />
    </section>
  );
}
