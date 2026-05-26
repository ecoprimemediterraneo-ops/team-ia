# Pendientes externos · plan para llegar al 100% real

Cada bloque incluye: qué pasos manuales tienes que dar tú, en qué URL, qué tiempos esperar, qué te tengo que pedir cuando lo tengas y qué desbloquea.

---

## 1. Meta App Review · desbloquea Pablo (WhatsApp) y Marta (Instagram)

### Estado actual
- App "AI-Team Publisher" creada en `developers.facebook.com`
- Permisos básicos añadidos: `instagram_business_basic`, `instagram_manage_comments`, `instagram_business_manage_messages`
- Instagram Tester `ai.team.marketing` aceptado
- **FALTA**: permisos avanzados con App Review

### Permisos que necesitamos pedir

| Permiso | Para qué | Para quién |
|---|---|---|
| `instagram_content_publish` | Publicar posts/reels en IG automáticamente | Marta |
| `pages_manage_posts` | Publicar en página Facebook | Marta |
| `pages_read_engagement` | Leer engagement de los posts | Marta |
| `whatsapp_business_management` | Gestionar la cuenta WhatsApp Business | Pablo |
| `whatsapp_business_messaging` | Enviar/recibir mensajes WhatsApp | Pablo |

### Pasos manuales

1. **Verificación de negocio (Business Verification)** — requisito previo a App Review.
   - URL: https://business.facebook.com/settings/security
   - Necesitas: NIE/CIF, certificado bancario o factura del autónomo a nombre del negocio, dirección verificable
   - Tiempo: 1-5 días laborables

2. **App Review formal**
   - URL: https://developers.facebook.com/apps/[APP_ID]/app-review/permissions/
   - Por cada permiso: rellenar un formulario y subir un **screencast** mostrando cómo se va a usar (instrucciones literales de Meta)
   - Tiempo de aprobación: 2-8 semanas (Meta tiene cola)

3. **Cuando llegue la aprobación**: me pasas el `META_ACCESS_TOKEN` de larga duración y los IDs (`META_INSTAGRAM_USER_ID`, `META_FACEBOOK_PAGE_ID`). Yo conecto adapters de `src/lib/redes.ts` que ya están programados.

### Qué desbloquea cuando esté
- Pablo 20% → 90% (necesita además número WhatsApp activo, ver #2)
- Marta 40% → 90% (publicación auto Instagram + Facebook)

---

## 2. WhatsApp Business Cloud API · desbloquea Pablo al 100%

### Pasos manuales

1. **Verificar el negocio en Meta Business Manager** (mismo paso que #1)

2. **Comprar/asignar un número dedicado a WhatsApp**
   - Opción A: tu número actual (debe estar libre de WhatsApp personal o vamos a perder los mensajes anteriores)
   - Opción B: comprar número nuevo (~10€/mes) en Vonage o Twilio
   - **Recomendación**: número nuevo. Tu personal no lo arriesgues.

3. **Alta WhatsApp Business Account**
   - URL: https://business.facebook.com/wa/manage/
   - Asociar número, verificar por SMS o llamada
   - Crear plantillas de mensaje (botón "Templates"): aprobación de cada plantilla 24-48h

4. **Pedir permisos avanzados** (ya cubierto en App Review #1)

### Pasos cuando esté listo
- Me pasas `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_BUSINESS_ACCOUNT_ID`
- Yo monto: webhook entrante (`/api/webhooks/whatsapp`), envío outbound, plantillas, mensajeo libre dentro de ventana de 24h del cliente

### Coste
- Meta cobra por conversación abierta: 0,02-0,08€ por conversación 24h (depende tipo)
- Llamadas: gratis si el cliente las inicia, ~0,06€ si las iniciamos nosotros con plantilla

---

## 3. Google OAuth Verification · desbloquea Lucía al 100%

### Estado actual
- Cliente OAuth creado en Google Cloud
- Scopes Gmail + Calendar funcionando
- **PROBLEMA**: la app está en "Testing" → solo los emails añadidos a la lista de testers pueden usarla. Máximo 100.

### Pasos manuales

1. **Página de privacidad pública**
   - URL: https://aiteam.marketing/legal/privacidad (ya existe en el repo, revísala)
   - Google exige que mencione específicamente Gmail/Calendar y para qué se usan

2. **Solicitud de verificación**
   - URL: https://console.cloud.google.com/apis/credentials/consent
   - Pestaña "OAuth consent screen" → "Publish App" → "Submit for verification"
   - Necesitas: dominio verificado en Search Console, vídeo (1-2 min) mostrando uso de cada scope sensible
   - Tiempo: 2-6 semanas

3. **Si quieres acelerar (sin verificación)**
   - Mantén la app en "Testing" y añade el email de cada piloto manualmente
   - Hasta 100 usuarios → suficiente para los primeros meses
   - La pantalla dirá "Google no ha verificado esta app" pero funciona

### Qué desbloquea
- Lucía 75% → 95% (95 porque el auto-envío sigue siendo decisión de producto: dejar drafts es mejor)

---

## 4. Google Business Profile API · desbloquea Rocío al 100%

### Pasos manuales

1. **El cliente debe ser propietario verificado de su ficha en Google Maps**
   - URL: https://business.google.com/
   - Si no la tiene verificada, Google manda postal a la dirección (5-14 días)

2. **Habilitar la API en Google Cloud**
   - URL: https://console.cloud.google.com/apis/library/mybusiness.googleapis.com
   - Es de **acceso restringido**: hay que rellenar un formulario explicando por qué queremos acceder
   - Tiempo: 1-3 semanas
   - URL del form: https://support.google.com/business/contact/api_default

3. **OAuth scopes**
   - `https://www.googleapis.com/auth/business.manage`
   - Se valida en la misma verificación que Lucía (#3) si lo hacemos en la misma app

### Qué desbloquea cuando esté
- Rocío 20% → 95%: lee reseñas reales de cada cliente, propone respuesta, publica con su aprobación

### Esfuerzo dev mío cuando llegue
- 3-5 días: OAuth flow + endpoint `reviews.list` + `reviews.reply` + UI dashboard

---

## 5. Vapi (o Twilio Voice) · desbloquea Carmen conversacional

### Por qué no lo haremos todavía

- **Coste**: 0,07-0,10$/min. Una clínica con 10 llamadas × 2 min = ~20€/mes/cliente → margen muy ajustado.
- **Complejidad**: 3-4 semanas de dev (IVR + transcripción + agenda + WhatsApp callback).
- **Producto**: aún no hemos validado que los clientes quieran realmente conversación IA frente a "captura + WhatsApp automático".

### Estrategia recomendada

**Fase A (hoy → 1 mes)**: Carmen "captura" usando Twilio Voice básico
- Coste: ~0,01€/min
- Flujo: número dedicado → si nadie coge → IVR breve → grabar mensaje → transcribir (Deepgram, 0,004$/min) → WhatsApp automático al cliente + notificar al dueño
- Tarifa: **49€/mes** (Carmen Esencial)
- Dev: 5-7 días

**Fase B (cuando haya >5 clientes pidiendo voz)**: Carmen "conversacional" con Vapi
- Carmen habla y agenda directamente
- Tarifa: **199€/mes**
- Dev: 3-4 semanas adicionales

### Pasos manuales para Fase A

1. **Alta Twilio**
   - URL: https://www.twilio.com/try-twilio
   - Verificación KYC: NIE + selfie + comprobante (2-5 días)
   - **Estás logueado ya?** Si no: te paso checklist cuando vayas

2. **Comprar número español**
   - 1-2€/mes por número
   - Verificación de uso comercial: subir documento explicando el caso de uso
   - Tiempo: 3-7 días

3. **Cuando esté**: me pasas `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Yo monto el flujo.

---

## 6. Sergio multi-tenant · 0 dependencias externas

### Por qué este es el siguiente que cerramos al 100%

- No depende de Meta, Google, Twilio ni nadie.
- 100% dev.
- 1-2 semanas de trabajo.
- Pasa de 70% → 100% real.

### Qué hace falta

1. **Schema Supabase**: añadir columna `owner_email` a `sergio_sources` y a `sergio_changes`
2. **API**: filtrar todas las queries por `owner_email = session.email`
3. **Dashboard cliente**: pantalla "Mis competidores" con CRUD (añadir, pausar, eliminar)
4. **Cron**: ya está bien, escanea todas las sources activas
5. **Email semanal**: pasa de "founder" a "owner del source"

Esto lo hago yo cuando me digas. Es el siguiente paso lógico.

---

## Tabla resumen — orden recomendado

| # | Acción | Tiempo total | Dev mío | Quién bloquea | Sube agente de → a |
|---|--------|--------------|---------|---------------|--------------------|
| 1 | Iniciar Verificación Negocio Meta | 1-5 días | 0 | Meta | (prerequisito #2 y #5) |
| 2 | App Review Meta (Pablo + Marta) | 2-8 sem | 5 días | Meta | Pablo 20→90, Marta 40→90 |
| 3 | WhatsApp Cloud API | 1-3 sem (paralelo) | 3 días | Meta + número | Pablo 90→100 |
| 4 | Google OAuth Verification | 2-6 sem | 1 día | Google | Lucía 75→95 |
| 5 | Google Business Profile API | 1-3 sem | 4 días | Google | Rocío 20→95 |
| 6 | **Sergio multi-tenant** | **1-2 sem** | **8 días** | **NADIE** | **Sergio 70→100** |
| 7 | Twilio + Carmen captura | 1-2 sem | 6 días | Twilio KYC | Carmen 15→70 |
| 8 | Vapi + Carmen conversacional | 3-4 sem | 15 días | Vapi + producto | Carmen 70→100 |

### Plan de ataque sugerido

**Esta semana (lo arrancas tú HOY)**:
- Verificación Negocio Meta (#1) — abre los demás
- Solicitud Google OAuth Verification (#4) — papeleo en paralelo
- Solicitud Google Business Profile API access (#5) — formulario y a esperar

**Mientras Meta y Google revisan (1-6 semanas)**:
- Yo cierro Sergio multi-tenant (#6) → primer agente al 100% real
- Eva dominio-por-cliente → pasa de 85 a 100

**Cuando vuelvan aprobaciones (semanas 4-8)**:
- Yo cierro Pablo + Marta + Rocío + Lucía
- En 2-3 semanas más → 6 agentes al 100%

**Después (mes 3+)**:
- Twilio + Carmen captura → 7 agentes operativos
- Vapi cuando haya demanda

### Resultado realista

- **Hoy**: 2 agentes al 100% (Diana + Eva en cuanto Eva tenga dominio por cliente)
- **+2 semanas**: 3 agentes al 100% (+ Sergio)
- **+6-8 semanas**: 6 agentes al 100% (+ Pablo + Marta + Rocío + Lucía)
- **+10-12 semanas**: 7 agentes al 100% (+ Carmen captura)
- **+4-6 meses**: 8 agentes al 100% (+ Carmen conversacional)

Sin humo. Sin vender lo que no funciona. Cuando lleguemos a 6/8 al 100% real, ahí abrimos pilotos en serio.

---

## Acción inmediata HOY (lo que solo puedes hacer tú)

1. **Meta Business Verification**
   - https://business.facebook.com/settings/security
   - Subir NIE + documento de empresa + dirección
   - Pulsa "Send" y deja que cocine

2. **Google OAuth Verification**
   - https://console.cloud.google.com/apis/credentials/consent
   - Si el proyecto AI-Team no tiene "Publish App" disponible, antes hay que rellenar el OAuth consent screen completo y verificar dominio en Search Console
   - 30-45 min de trabajo

3. **Google Business Profile API Access Request**
   - https://support.google.com/business/contact/api_default
   - Rellenar formulario (~20 min): caso de uso = "queremos responder reseñas en nombre de nuestros clientes con su aprobación, no haremos cambios destructivos"

Cuando hayas iniciado los 3, me lo dices y yo arranco con Sergio multi-tenant en paralelo.
