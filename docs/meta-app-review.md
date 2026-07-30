# Meta App Review — llamadas de prueba de permisos de Instagram

Cuenta: **@ai.team.marketing** · IG User ID `17841410811816797` · Page ID `1110804952118807` · Graph API **v21.0**
App: AI-Team · Permisos objetivo (4): `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_contents`, `instagram_business_manage_messages`.

Script reutilizable: [`scripts/meta-app-review-test-calls.sh`](../scripts/meta-app-review-test-calls.sh)

---

## ⚠️ Estado (27 jul 2026): BLOQUEADO por el token — las llamadas NO se pudieron ejecutar

El token real **no es accesible desde el entorno local**:

| Fuente | Resultado |
|---|---|
| `.env.local` | `INSTAGRAM_ACCESS_TOKEN` **vacío** (0 caracteres) |
| `.env.development.local` | `INSTAGRAM_ACCESS_TOKEN` **vacío** |
| `WHATSAPP_ACCESS_TOKEN` (fuente del token IG en el código) | **vacío** en local |
| `vercel env pull --environment=production` | Devuelve el literal **`[SENSITIVE]`** (11 chars) — la variable está marcada como **Sensitive** en Vercel y su valor **no se puede descargar** |

Como el valor efectivo era `[SENSITIVE]`, Meta rechazó la publicación con:

```json
{"error":{"message":"Invalid OAuth access token - Cannot parse access token","type":"OAuthException","code":190}}
```

**No se aplicó ningún workaround** (no se desplegó un endpoint temporal en producción ni se desmarcó la variable como Sensitive), según lo pedido.

### Para desbloquear (elige una)
1. **Recomendado:** pega el token real (System User EAA con los 4 permisos) en `.env.local` como `INSTAGRAM_ACCESS_TOKEN=EAAG...` **o** expórtalo antes de ejecutar: `export TOKEN='EAAG...'`. Luego:
   ```bash
   OUTDIR=/tmp/meta bash scripts/meta-app-review-test-calls.sh
   ```
   El script hace las 4 llamadas, publica de verdad y escribe el `permalink` + `media_id` + códigos HTTP en `OUTDIR/summary.txt` (el token nunca se imprime ni se guarda).
2. En Vercel, marcar `INSTAGRAM_ACCESS_TOKEN` (o `WHATSAPP_ACCESS_TOKEN`) como **no Sensitive** y volver a `vercel env pull` (reduce seguridad; menos recomendable).

> **Nota:** hasta ejecutar el paso 1/2 con un token válido **no hay `permalink` real** que dar al revisor. Los borradores de abajo dejan `<PERMALINK_DEL_POST>` como marcador; rellénalo con la URL que devuelva el script.

---

## Resultado de esta ejecución (con token `[SENSITIVE]` → todas fallan)

| # | Permiso | Llamada | HTTP | Resultado |
|---|---|---|---|---|
| 0 | (verificación) | `GET /debug_token` | — | Sin respuesta (token no parseable) → **scopes desconocidos** |
| 1 | `instagram_content_publish` | `POST /{IG_USER_ID}/media` | **400** | `code 190` "Cannot parse access token" → no hubo `creation_id`, no se publicó |
| 2 | `instagram_manage_comments` | `GET /{MEDIA_ID}/comments` | — | No ejecutable (sin `media_id`) |
| 3 | `instagram_manage_contents` | `POST /{MEDIA_ID} comment_enabled=true` | — | No ejecutable (sin `media_id`); fallback `GET /{IG_USER_ID}/media` también depende del token |
| 4 | `instagram_business_manage_messages` | `GET /{PAGE_ID}/conversations?platform=instagram` | — | Depende del token |

**Permalink publicado:** `<PENDIENTE — requiere token válido>`
**media_id:** `<PENDIENTE>`

> Verificación de scopes (tarea 2): **no se pudo confirmar** qué permisos lleva el token porque el token no era legible. Al ejecutar con un token real, revisa `scopes=` en `summary.txt`; si falta alguno de los 4, ese permiso no se podrá probar aunque esté "Listo para prueba".

---

## Las 4 llamadas (parametrizadas en el script)

```bash
API=https://graph.facebook.com/v21.0
IG_USER_ID=17841410811816797
PAGE_ID=1110804952118807

# 1) instagram_content_publish  (publica de verdad)
curl -sg -X POST "$API/$IG_USER_ID/media" \
  --data-urlencode "image_url=<JPEG_PUBLICO>" \
  --data-urlencode "caption=<CAPTION>" \
  --data-urlencode "access_token=$TOKEN"          # -> {"id":"<CREATION_ID>"}
curl -sg -X POST "$API/$IG_USER_ID/media_publish" \
  --data-urlencode "creation_id=<CREATION_ID>" \
  --data-urlencode "access_token=$TOKEN"          # -> {"id":"<MEDIA_ID>"}

# 2) instagram_manage_comments
curl -sg "$API/<MEDIA_ID>/comments?access_token=$TOKEN"

# 3) instagram_manage_contents
curl -sg -X POST "$API/<MEDIA_ID>" \
  --data-urlencode "comment_enabled=true" \
  --data-urlencode "access_token=$TOKEN"
#   (si falla) fallback:
curl -sg "$API/$IG_USER_ID/media?fields=id,caption,media_type,permalink&access_token=$TOKEN"

# 4) instagram_business_manage_messages
curl -sg "$API/$PAGE_ID/conversations?platform=instagram&fields=id,updated_time&access_token=$TOKEN"
```

Imagen usada por defecto: la imagen de marca del propio proyecto (`/api/og/post`) convertida a **JPEG 1080×1080** vía wsrv.nl (Instagram exige JPEG). Respaldo: `https://picsum.photos/1080`.

---

## Borradores para el App Review (rellenar `<PERMALINK_DEL_POST>` tras publicar)

### 1. `instagram_content_publish`
**Permitted use (EN):**
> AI-Team ("Marta") schedules and publishes feed posts (image + caption) to the business's own connected Instagram Business account, on the owner's behalf. Each post is AI-generated from the business profile and **approved by the owner** in the AI-Team dashboard (or via WhatsApp) before publishing. We never publish to accounts we do not manage.

**Instructions for reviewer (EN):**
> 1. A post published by our app on the test account **@ai.team.marketing** is here: **<PERMALINK_DEL_POST>**.
> 2. To reproduce: log in to https://aiteam.marketing with the provided test credentials → open **Marta → "Calendario de posts"** → open any scheduled post → press **"Publicar ahora"**.
> 3. Under the hood we call `POST /{ig-user-id}/media` (image_url + caption) then `POST /{ig-user-id}/media_publish` (v21.0).

### 2. `instagram_manage_comments`
**Permitted use (EN):**
> AI-Team reads comments on the business's **own** posts to (a) power a keyword-triggered auto-DM ("comment-to-DM") and (b) let the owner review and reply to comments from the dashboard. Only comments on the business's own media are accessed.

**Instructions for reviewer (EN):**
> 1. On the post **<PERMALINK_DEL_POST>**, leave a comment containing the exact keyword **`INFO`**.
> 2. Our app detects it via `GET /{media-id}/comments` and triggers an automated private reply (see permission #4).
> 3. Configured keywords in the demo: **`INFO`**, **`PRECIO`**, **`QUIERO`**. Reviewer keyword to use: **`INFO`**.

### 3. `instagram_manage_contents`
**Permitted use (EN):**
> AI-Team manages settings of the business's **own** media on its behalf — e.g. enabling/disabling comments on a post (`comment_enabled`) and listing the account's media in the dashboard to schedule and organize content.

**Instructions for reviewer (EN):**
> 1. In the dashboard (Marta), open the settings of the post **<PERMALINK_DEL_POST>** and toggle **"Comentarios"** on/off. Our app calls `POST /{media-id}` with `comment_enabled`.
> 2. We also list the account's media with `GET /{ig-user-id}/media?fields=id,caption,media_type,permalink`.

### 4. `instagram_business_manage_messages`
**Permitted use (EN):**
> AI-Team's assistant "Marta" reads and responds to **Instagram Direct Messages** for the business's own account: an AI auto-reply to inbound DMs, and the comment→DM flow (when someone comments a keyword, we send them a private reply). Always the business's own account, never third parties.

**Instructions for reviewer (EN):**
> 1. Send a Direct Message with the text **`INFO`** to **@ai.team.marketing**, **or** comment **`INFO`** on **<PERMALINK_DEL_POST>**.
> 2. Marta replies automatically within seconds. We read/send via `GET /{page-id}/conversations?platform=instagram` and `POST /{page-id}/messages` (private replies use `recipient={comment_id}`).
> 3. The webhook handling this is `POST /api/marta/webhook` on our server.

---

## Cómo re-ejecutar
```bash
# 1. Token real disponible como $TOKEN o INSTAGRAM_ACCESS_TOKEN (o en .env.local)
export TOKEN='EAAG...'            # NO lo commitees

# 2. Ejecuta (publica de verdad en @ai.team.marketing)
OUTDIR=/tmp/meta bash scripts/meta-app-review-test-calls.sh

# 3. Lee el resumen (permalink, media_id, códigos HTTP; sin token)
cat /tmp/meta/summary.txt
```
