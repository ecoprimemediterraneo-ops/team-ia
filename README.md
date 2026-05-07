# Tropa

Landing de captación (Fase 0) para **Tropa** — equipo de 4 agentes IA: Lucía, Marta, Diego y Carmen.

## Arrancar en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Waitlist (Resend)

1. Crea cuenta gratis en https://resend.com
2. Saca una API key.
3. (Opcional) crea una Audience y copia su ID.
4. Copia `.env.local.example` a `.env.local` y rellena.

Sin API key configurada, los emails se guardan en `waitlist.local.txt`.

## Deploy en Vercel

```bash
npx vercel
```

Añade las mismas variables de entorno en el dashboard de Vercel.
