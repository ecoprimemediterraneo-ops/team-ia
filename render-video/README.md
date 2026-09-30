# Render de vídeos de Marta (Remotion)

Tres plantillas 9:16 (`oferta`, `antes_despues`, `hueco_libre`) con música
propia sintetizada en `musica/generar.mjs` (sin derechos de terceros).

- **Local:** `node servidor.mjs` → http://localhost:3900 (la app usa `MARTA_RENDER_URL`, por defecto ese).
- **VPS:** contenedor `aiteam-render` en `/opt/aiteam-render`, HTTPS en
  `https://api.aiteam.marketing:8790` con el certificado de Let's Encrypt de
  Nginx montado en solo lectura. Limitado a 2 CPU y 3 GB para no ahogar n8n.
- **Auth:** `Authorization: Bearer $MARTA_RENDER_SECRET` (el mismo valor en Vercel).
- **Studio para diseñar:** `npx remotion studio src/index.ts`.
- **Licencia de Remotion:** gratis para empresas de hasta 3 personas; por encima hace falta licencia de empresa.

Actualizar en el VPS:
```bash
rsync -a --exclude node_modules --exclude prueba ./ root@72.62.190.108:/opt/aiteam-render/
ssh root@72.62.190.108 'cd /opt/aiteam-render && docker build -t aiteam-render . && docker rm -f aiteam-render && ./arrancar.sh'
```
