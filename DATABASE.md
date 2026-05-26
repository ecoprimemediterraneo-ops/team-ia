# DATABASE — estado actual y plan de migración

## Estado actual: JSON híbrido

Persistencia mixta. La capa `src/lib/store.ts` (476 LOC) decide en runtime: si hay `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` usa la tabla `kv_store` de Supabase (`kvGet`/`kvSet` con upsert por clave); si no, cae a JSON en `data/`. Sergio es la única feature con tablas propias en Supabase.

### Archivos JSON (todos en `data/`, gitignored, en Vercel viven en `/tmp/aiteam-data`)

| Archivo | Uso | Donde se escribe |
|---|---|---|
| `data/users.json` | Sesiones / perfiles / mensajes / contactos por usuario | `src/lib/store.ts` |
| `data/queue.json` | Publicaciones en cola (runtime, merge sobre seed) | `src/lib/redes.ts` |
| `data/diagnosticos.json` | Leads de Diana con informe completo | `src/app/api/diagnostico/route.ts` |
| `data/newsletter.json` | Suscriptores newsletter (email + fecha) | `src/app/api/newsletter/route.ts` |
| `data/magic-links.json` | Tokens magic-link con TTL 15 min | `src/lib/magic-link.ts` |

### Seeds bundled (commit en repo)

| Archivo | Contenido |
|---|---|
| `src/data/queue-seed.json` | 38 publicaciones IG/FB/LinkedIn precargadas (siempre disponibles aunque `/tmp` se borre) |

`src/lib/blog.ts` (489 LOC) y `src/lib/ciudades.ts` (167 LOC, 21 ciudades) tienen los datos inline en TypeScript — no JSON.

## Schema Supabase propuesto (escala)

```sql
-- usuarios y sesiones
users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  nombre text,
  business_profile jsonb,        -- {nombre, sector, ofrece, tono, publico}
  gmail_tokens jsonb,            -- {refreshToken, email, connectedAt}
  plan text,                     -- local|digital|elite|pro
  stripe_customer_id text,
  created_at timestamptz default now(),
  last_login_at timestamptz
);

-- leads desde Diana
diagnosticos (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nombre text, whatsapp text, negocio text,
  sector text check (sector in ('dental','estetica','otro')),
  ciudad text,
  inputs jsonb,                  -- web, ig, gmb, respuesta_wsp, software, etc.
  informe text,                  -- markdown Claude Sonnet
  perdida_anual_eur numeric,
  created_at timestamptz default now()
);

-- leads sin diagnostico
leads (
  id uuid primary key default gen_random_uuid(),
  email text, nombre text, telefono text,
  source text,                   -- landing slug, pack…
  utm jsonb,
  estado text default 'nuevo',   -- nuevo|contactado|qualified|cliente|perdido
  notas text,
  created_at timestamptz default now()
);

newsletter (
  email text primary key,
  subscribed_at timestamptz default now(),
  confirmed boolean default false,
  unsubscribed_at timestamptz
);

-- cola publicaciones (sustituye queue.json + queue-seed.json)
queue_publicaciones (
  id text primary key,           -- pub_<ts>_<rand>
  user_id uuid references users(id),
  red text check (red in ('instagram','facebook','linkedin','tiktok')),
  contenido text not null,
  imagen_url text, video_url text,
  fecha_programada timestamptz,
  estado text check (estado in ('borrador','aprobada','programada','publicada','fallida','asistida')),
  resultado jsonb,               -- {permalink, id, mensaje}
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on queue_publicaciones (estado, fecha_programada);

-- Sergio (parcialmente ya existe)
sergio_competidores (              -- ya como sergio_sources
  id uuid primary key,
  user_id uuid references users(id),
  competitor_name text, url text,
  type text, category text, frequency text,
  active boolean default true,
  config jsonb,
  last_scraped_at timestamptz
);

-- chats Tomás (analitica de soporte)
conversaciones_tomas (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  user_id uuid,
  messages jsonb,                -- [{role, content, ts}]
  derivado_humano boolean default false,
  created_at timestamptz default now()
);

-- evaluaciones automáticas (cron eval)
evals (
  id uuid primary key default gen_random_uuid(),
  agent text,
  fecha date,
  metrica text,                  -- coherencia, tono, completitud
  score numeric,
  muestra jsonb,
  created_at timestamptz default now()
);
```

## Plan de migración a 100 clientes

Ordenado por ROI (qué duele primero al escalar JSON en `/tmp`).

1. **`users.json` → `users` + `kv_store`** primero. En Vercel `/tmp` no es estable entre lambdas: cualquier feature con login se beneficia inmediatamente. `store.ts` ya tiene fallback condicional; basta poblar envs en Vercel.
2. **`diagnosticos.json` → `diagnosticos`**. Es el lead principal del embudo y se está perdiendo entre redespliegues. Sustituir `fs.readFile/writeFile` por `getSupabase().from('diagnosticos')`.
3. **`queue.json` → `queue_publicaciones`**. Cuando se active Meta API + cron `publicar` cada hora, /tmp no aguanta. Mantener `queue-seed.json` solo como bootstrap inicial.
4. **`newsletter.json` → `newsletter`**. Pequeño pero crítico para GDPR (auditoría de consentimiento, fecha alta/baja).
5. **`magic-links.json` → tabla con TTL** (o Redis/Upstash si llega antes). Tokens efímeros, alta concurrencia.
6. **Sergio**: ya está en Supabase (`sergio-db.ts`). Solo añadir índices y RLS por `user_id`.
7. **`conversaciones_tomas` + `evals`**: nuevos. Empezar a guardar desde el día 1 en cuanto pase soporte para auditar/reentrenar.

Estrategia: feature-flag por env (`USE_SUPABASE` ya existe en `store.ts`). Migrar archivo a archivo, dejar fallback JSON durante 1 release y luego retirar. Para datos existentes en `/tmp` no hay nada que migrar — perdidos por diseño actual; se empieza limpio en Supabase.
