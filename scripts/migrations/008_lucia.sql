-- Lucía · Tablas para asistente Gmail (perfil + drafts + aprendizaje + tracking).
-- Mismo patrón Marta/Rocío/Pablo, adaptado a email.

-- Perfil del cliente: cómo quiere que Lucía escriba sus borradores
CREATE TABLE IF NOT EXISTS lucia_profiles (
  owner_email TEXT PRIMARY KEY,
  nombre_persona TEXT NOT NULL DEFAULT '',
  cargo TEXT DEFAULT '',
  empresa TEXT DEFAULT '',
  firma TEXT DEFAULT '',                       -- "Saludos, [Nombre] · CEO en [Empresa]"
  tono_marca TEXT DEFAULT 'cercano y profesional',
  reglas_custom TEXT DEFAULT '',
  idiomas TEXT DEFAULT 'español',              -- "español, inglés"
  modo_activacion TEXT DEFAULT 'drafts',       -- drafts (siempre revisable) / auto (solo etiquetas)
  aprobaciones_count INTEGER DEFAULT 0,
  rechazos_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Borradores generados por Lucía (para tracking + sugerencias)
CREATE TABLE IF NOT EXISTS lucia_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  thread_id TEXT,                              -- Gmail thread id
  message_id TEXT,                             -- Gmail original message id
  from_email TEXT,
  from_name TEXT,
  subject TEXT,
  incoming_snippet TEXT,                       -- primeras 500 chars del email original
  proposed_response TEXT NOT NULL,
  intent VARCHAR(48),                          -- pregunta / reunion / queja / spam / info / propuesta / otro
  confidence NUMERIC(3,2),
  status VARCHAR(16) DEFAULT 'draft_created',  -- draft_created / sent / edited / rejected
  edited_text TEXT,                            -- versión final si el cliente editó antes de enviar
  gmail_draft_id TEXT,                         -- id del draft en Gmail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lucia_drafts_owner ON lucia_drafts(owner_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lucia_drafts_status ON lucia_drafts(owner_email, status);

-- Sugerencias aprendizaje (mismo patrón que Marta/Pablo/Rocío)
CREATE TABLE IF NOT EXISTS lucia_pattern_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  evidence TEXT,
  pattern_type VARCHAR(40),
  source_edits_count INTEGER DEFAULT 0,
  status VARCHAR(16) DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lucia_patterns_owner ON lucia_pattern_suggestions(owner_email, status, created_at DESC);

-- Métricas diarias (para gráficas)
CREATE TABLE IF NOT EXISTS lucia_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  day DATE NOT NULL,
  emails_processed INTEGER DEFAULT 0,
  drafts_created INTEGER DEFAULT 0,
  promos_archived INTEGER DEFAULT 0,
  minutes_saved INTEGER DEFAULT 0,
  UNIQUE(owner_email, day)
);
CREATE INDEX IF NOT EXISTS idx_lucia_metrics_owner ON lucia_daily_metrics(owner_email, day DESC);

COMMENT ON TABLE lucia_profiles IS 'Configuración Lucía por cliente: firma, tono, reglas, idiomas.';
COMMENT ON TABLE lucia_drafts IS 'Borradores generados por Lucía con tracking de edición/aprobación.';
