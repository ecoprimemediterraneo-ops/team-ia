-- Marta · Sugerencias de reglas custom detectadas automáticamente.
-- Cron nocturno analiza las últimas ediciones del cliente, detecta patrones
-- (ej. "5 veces cambiaste 'primera cita' por 'valoración inicial'") y
-- propone añadirlos como regla permanente.

CREATE TABLE IF NOT EXISTS marta_pattern_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  rule_text TEXT NOT NULL,                    -- regla que se añadiría a reglas_custom
  evidence TEXT,                              -- ejemplos concretos detectados
  pattern_type VARCHAR(40),                   -- tono, vocabulario, formato, prohibicion, otro
  source_edits_count INTEGER DEFAULT 0,       -- cuántas ediciones lo respaldan
  status VARCHAR(16) DEFAULT 'pending',       -- pending / accepted / rejected / dismissed
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marta_patterns_owner ON marta_pattern_suggestions(owner_email, status, created_at DESC);

COMMENT ON TABLE marta_pattern_suggestions IS 'Sugerencias generadas por cron nocturno: patrones detectados en las ediciones del cliente que se pueden convertir en reglas permanentes.';
