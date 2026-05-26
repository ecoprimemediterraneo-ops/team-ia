"use client";
import { useState, type ReactNode } from "react";

export default function MartaSection({
  title,
  emoji,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  emoji: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-6 border-[3px] border-black bg-[color:var(--cream)]">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-black/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <h2 className="font-stencil text-2xl md:text-3xl leading-none">{title}</h2>
            {subtitle && <p className="text-xs font-mono text-black/60 mt-1">{subtitle}</p>}
          </div>
        </div>
        <span className={`text-2xl font-bold transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && <div className="p-5 pt-2 space-y-6 bg-white border-t-[3px] border-black">{children}</div>}
    </section>
  );
}
