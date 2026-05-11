"use client";
import { useEffect, useState } from "react";

type WaitItem = {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  preferences?: string;
  addedAt: string;
};

const KEY = "aiteam-pablo-waitlist";

export default function PabloWaitlist() {
  const [items, setItems] = useState<WaitItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [preferences, setPreferences] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function persist(next: WaitItem[]) {
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    persist([
      {
        id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        preferences: preferences.trim() || undefined,
        addedAt: new Date().toISOString(),
      },
      ...items,
    ]);
    setName("");
    setPhone("");
    setNotes("");
    setPreferences("");
  }

  function remove(id: string) {
    persist(items.filter((i) => i.id !== id));
  }

  function copyOfferMessage(item: WaitItem) {
    const msg = `¡Hola ${item.name}! 👋 Recordamos que querías una cita y no había hueco. Me acaba de cancelar alguien y tengo este hueco libre. ¿Te encaja? Avísame ya que se lo voy a ofrecer a otra persona si no me dices nada en 30 min.`;
    navigator.clipboard.writeText(msg);
    alert("Mensaje copiado · pega en WhatsApp de " + (item.phone || item.name));
  }

  return (
    <div className="card-hard p-5 mt-6">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-stencil text-2xl">Lista de espera</h3>
          <p className="text-sm text-black/60 mt-1">Cuando alguien cancele a última hora, Pablo ofrece automáticamente ese hueco a quien esté aquí.</p>
        </div>
        <span className="text-xs font-mono bg-black text-[color:var(--mustard)] px-2 py-1 font-bold tracking-widest">{items.length} EN LISTA</span>
      </div>

      <form onSubmit={add} className="grid sm:grid-cols-2 gap-2 mb-4 border-2 border-black p-3 bg-[color:var(--cream)]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente *" required className="border-2 border-black px-2 py-1.5 text-sm" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" className="border-2 border-black px-2 py-1.5 text-sm" />
        <input value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="Prefiere: mañanas/tardes/Dr. X" className="border-2 border-black px-2 py-1.5 text-sm" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (servicio, motivo)" className="border-2 border-black px-2 py-1.5 text-sm" />
        <button type="submit" className="btn-mustard text-xs sm:col-span-2">+ AÑADIR A LISTA DE ESPERA</button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-black/50 italic">Aún nadie en lista de espera. Cuando un cliente te diga &quot;no hay hueco esta semana&quot;, añádelo aquí.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="border-2 border-black p-3 flex items-start gap-3 bg-white">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{i.name} {i.phone && <span className="text-xs font-mono text-black/50">· {i.phone}</span>}</div>
                {i.preferences && <div className="text-xs text-black/70">Prefiere: {i.preferences}</div>}
                {i.notes && <div className="text-xs text-black/70 italic">{i.notes}</div>}
                <div className="text-[10px] font-mono text-black/40 mt-1">Añadido {new Date(i.addedAt).toLocaleString("es-ES")}</div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => copyOfferMessage(i)} className="text-[10px] font-bold tracking-widest border-2 border-black px-2 py-1 bg-[color:var(--mustard)]">📋 OFRECER HUECO</button>
                <button onClick={() => remove(i.id)} className="text-[10px] font-bold tracking-widest border-2 border-black px-2 py-1 hover:bg-[color:var(--red)] hover:text-white">QUITAR</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-black/40 mt-3 italic">Datos guardados en tu navegador (localStorage). No salen de tu dispositivo.</p>
    </div>
  );
}
