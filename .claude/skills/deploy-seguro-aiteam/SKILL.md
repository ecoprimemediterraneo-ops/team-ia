---
name: deploy-seguro-aiteam
description: Flujo seguro de despliegue del proyecto AI-Team (tropa) en Vercel. Cambios SIEMPRE en local primero (npm run dev → http://localhost:3000), revisión visual del usuario y aprobación explícita ANTES de tocar git/Vercel. Solo entonces commit + push + npx vercel@latest --prod, con verificación post-deploy de que aiteam.marketing devuelve 200. Regla de oro: nunca desplegar sin revisión previa en local. Usar cada vez que el usuario pida "desplegar", "subir a producción", "hacer push", "lanzar el cambio", "deploy", o cuando se termine una tanda de cambios y haya que llevarla a aiteam.marketing.
---

## Cuándo usar esta skill

Úsala SIEMPRE que el usuario pida:
- "Deploy a producción"
- "Sube esto a aiteam.marketing"
- "Haz push y deploy"
- "Lanza el cambio"
- "Despliega lo que has hecho"
- Cualquier variante que implique llevar código a `aiteam.marketing`.

También úsala cuando termines una tanda de cambios y vayas a preguntar si desplegar.

## Regla de oro

**NUNCA hacer commit + push + deploy sin que el usuario haya visto el cambio en `http://localhost:3000` (o equivalente) y haya dado el OK explícito.**

Razones:
- `aiteam.marketing` es la web comercial real con la que se captan las 50 plazas beta. Un cambio roto en producción quema impresiones reales.
- Vercel no tiene staging automático. Lo que pusheas a `main` se despliega.
- Hay tokens reales de Meta y la API de Anthropic en producción: un error mal probado puede costar dinero o romper Pablo / Marta.

## Flujo correcto (paso a paso)

### Fase 1 — Cambios en local

1. **Aplicar el cambio** en el código (Edit/Write).
2. **Build de verificación:**
   ```bash
   cd "/Users/cristobalserrano/EQUIPO DE AGENTES IA/tropa"
   npm run build
   ```
   Si falla → arreglar antes de seguir. Nunca pasar a la fase siguiente con build roto.
3. **Arrancar dev server** si no está corriendo:
   ```bash
   (lsof -ti:3000 | xargs kill -9 2>/dev/null; true) && PORT=3000 npm run dev > /tmp/tropa-dev.log 2>&1 &
   ```
4. **Smoke test** de las rutas tocadas:
   ```bash
   for path in / /login /beta /precios; do
     /usr/bin/curl -s -o /dev/null -w "%{http_code}  %s\n" "http://localhost:3000$path" "$path"
   done
   ```
   Todas deben dar 200.

### Fase 2 — Revisión del usuario (BLOQUEO)

5. **Devolver al usuario la URL de localhost** con un resumen claro de qué cambió y dónde mirarlo.
6. **Esperar OK explícito.** No basta con que pase tiempo o el usuario diga "vale" en otro tema. Necesitas que diga "deploy", "lanza", "súbelo", "OK púshalo", o equivalente claro.

> **NO PUEDES SALTAR ESTE PASO.** Aunque el cambio sea trivial. Aunque el usuario haya dicho "modo autónomo, aprueba tú todos los permisos". El modo autónomo cubre permisos del harness, NO la decisión de desplegar a producción comercial. Si el usuario ha dicho explícitamente algo como "haz commit y deploy a prod" en la misma instrucción que pidió el cambio, eso SÍ es OK explícito y puedes proceder.

### Fase 3 — Commit + push

7. **Mensaje de commit descriptivo.** Estructura:
   - Línea 1: `type(scope): qué hace en imperativo` (≤72 chars).
     - `feat(...)` nueva funcionalidad
     - `fix(...)` arreglo de bug
     - `chore(...)` mantenimiento, deps
     - `refactor(...)` cambio interno sin cambio funcional
     - `docs(...)` documentación
   - Línea en blanco.
   - Cuerpo con bullets explicando los cambios principales y el porqué.
   - NO mencionar a Claude / no añadir co-author salvo que el usuario lo pida.
8. **Commit:**
   ```bash
   git add -A
   git commit -m "$(cat <<'EOF'
   feat(scope): título claro

   - bullet 1
   - bullet 2
   EOF
   )"
   ```
9. **Push:**
   ```bash
   git push origin main
   ```

### Fase 4 — Deploy a producción

10. **Comando único, sin alternativas:**
    ```bash
    npx vercel@latest --prod --yes
    ```
    Espera a "Deployment ... ready." en la salida.

### Fase 5 — Verificación post-deploy

11. **Smoke test del dominio real:**
    ```bash
    /usr/bin/curl -s -o /dev/null -w "aiteam.marketing -> %{http_code}\n" https://aiteam.marketing/
    ```
    Debe responder **200**. Si responde 401, 5xx o se queda colgado, algo va mal — investigar en Vercel dashboard.
12. **Mensaje final al usuario** con:
    - Hash corto del commit.
    - URL pública (`https://aiteam.marketing`).
    - URL del inspector de Vercel (la que escupe `vercel --prod`).
    - Confirmación de 200 OK.

## Comandos rápidos

```bash
# Build local
npm run build

# Dev server en background
(lsof -ti:3000 | xargs kill -9 2>/dev/null; true) && PORT=3000 npm run dev > /tmp/tropa-dev.log 2>&1 &

# Status git
git status --short && git log --oneline -3

# Deploy prod
npx vercel@latest --prod --yes

# Verificación post-deploy
/usr/bin/curl -s -o /dev/null -w "%{http_code}\n" https://aiteam.marketing/

# Logs de Vercel (live)
npx vercel@latest logs https://aiteam.marketing --follow
```

## Errores comunes y cómo evitarlos

| Antipattern | Por qué es malo | Qué hacer en su lugar |
|---|---|---|
| Hacer push antes de probar localmente | Lo que pusheas a `main` aterriza en `aiteam.marketing` directamente | `npm run build` + `npm run dev` y smoke test ANTES |
| Asumir que "modo autónomo" cubre el deploy | Cubre permisos del harness, no decisiones comerciales | Pedir OK explícito antes de Fase 3 |
| `git push --force` a main | Sobrescribe historia, puede tumbar producción si reintroduce un bug que ya estaba arreglado | Nunca. Si necesitas revertir, `git revert <sha>` y push normal |
| Skipping pre-commit hooks (`--no-verify`) | El hook está para algo (lint, build, tests) | Arreglar lo que falla, no saltarlo |
| Commit con secrets (.env, tokens) | Quedan en historia pública de GitHub | Revisar `git status` antes de `add -A`; nunca commitear `.env*` ni `data/` con contenido sensible |
| Deploy sin verificar el dominio después | Te quedas pensando que está bien cuando hay 500 | Siempre Fase 5 |
| Cambiar `.env.local` de prod en Vercel sin avisar | Puede romper Pablo/Marta silenciosamente | Documentar el cambio de env var en el mensaje al usuario |
| Hacer cambios en main "rápidos sin rama" cuando son grandes | Si hay que revertir, arrastras todo | Para cambios grandes/arriesgados: rama feature + PR. Para pequeños: commit directo a main es OK |

## Casos especiales

- **El cambio solo afecta a `.claude/skills/`, docs, README, o ficheros no incluidos en el bundle Next.js:** se puede commitear y pushear sin redeploy obligatorio. Vercel hará su deploy automático igualmente pero la web no cambia.
- **Cambio en `.env` de Vercel:** requiere redeploy explícito (`npx vercel@latest --prod --yes`) para que las nuevas variables apliquen.
- **Hotfix urgente de producción:** sigue el mismo flujo. NUNCA saltarse la revisión local "porque es urgente". 30 segundos de smoke test ahorran horas de rollback.
- **Revertir un deploy:** desde Vercel dashboard → Deployments → "Promote to production" sobre el deploy anterior estable. Esto es instantáneo. Después, `git revert` en local y nuevo deploy limpio.

## Plantilla del mensaje final al usuario

```
✅ Desplegado.

- Commit: <hash> — <titulo>
- Deploy: <vercel-deploy-url> (READY)
- URL pública: https://aiteam.marketing → 200 OK

Cambios en producción:
- <bullet 1>
- <bullet 2>
```
