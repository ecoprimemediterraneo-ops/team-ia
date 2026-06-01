// Botón flotante de WhatsApp, visible en todas las páginas (montado en layout.tsx).
// El número se gestiona en src/lib/constants.ts (WHATSAPP_NUMBER / WHATSAPP_LINK).
import { WHATSAPP_LINK } from "@/lib/constants";

export default function WhatsAppFloat() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-5 right-5 z-50 w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-lg shadow-black/30 transition-transform duration-200 hover:scale-110 animate-pulse"
      style={{ backgroundColor: "#25D366" }}
    >
      {/* Icono oficial de WhatsApp */}
      <svg
        viewBox="0 0 32 32"
        width="28"
        height="28"
        fill="white"
        aria-hidden="true"
      >
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.045 2.293v.143c-.014.99.4 1.962.99 2.751 1.49 2.035 3.466 3.7 5.732 4.49.674.23 2.137.674 2.81.674.616 0 1.49-.244 1.762-.846.272-.6.272-1.117.187-1.234-.077-.111-.276-.176-.575-.32zM16.001 27.726c-1.61 0-3.103-.346-4.476-.99-.487-.245-3.6 1.49-3.6 1.49l1.49-3.476a11.95 11.95 0 0 1-1.49-5.732c0-6.633 5.39-12.023 12.023-12.023 6.633 0 12.024 5.39 12.024 12.023 0 6.633-5.39 12.023-12.024 12.023zm0-26.05C8.085 1.676 1.65 8.112 1.65 16.018c0 2.477.645 4.91 1.836 7.043L1.578 30.302l7.43-1.95a14.31 14.31 0 0 0 6.991 1.835h.014c7.918 0 14.353-6.434 14.353-14.34 0-3.836-1.49-7.43-4.2-10.124C23.456 3.018 19.863 1.676 16 1.676z" />
      </svg>
    </a>
  );
}
