-- Eva · Tablas para tracking de campañas + perfil + aprendizaje.
-- Mismo patrón Lucía/Marta/Rocío/Pablo.

CREATE TABLE IF NOT EXISTS eva_profiles (
  owner_email TEXT PRIMARY KEY,
  nombre_marca TEXT NOT NULL DEFAULT '',
  sector TEXT DEFAULT '',
  remitente_nombre TEXT DEFAULT '',         -- "María de Clínica Sonrisa"
  remitente_email TEXT DEFAULT '',          -- "maria@clinicasonrisa.com" si dominio propio
  firma TEXT DEFAULT '',
  tono_marca TEXT DEFAULT 'cercano y profesional',
  reglas_custom TEXT DEFAULT '',
  audiencia_target TEXT DEFAULT '',         -- "clientes que vienen 1 vez al año"
  cta_principal TEXT DEFAULT '',            -- "Reservar cita"
  aprobaciones_count INTEGER DEFAULT 0,
  rechazos_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracking de cada campaña enviada (para métricas)
CREATE TABLE IF NOT EXISTS eva_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  tipo VARCHAR(32) NOT NULL,                -- newsletter / welcome / promo / reactivacion / cumpleanos / otro
  asunto TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  contactos_count INTEGER DEFAULT 0,
  enviados_count INTEGER DEFAULT 0,
  abiertos_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  bounces_count INTEGER DEFAULT 0,
  bajas_count INTEGER DEFAULT 0,
  estado VARCHAR(16) DEFAULT 'enviada',     -- programada / enviada / fallida
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eva_campaigns_owner ON eva_campaigns(owner_email, sent_at DESC);

-- Sugerencias aprendizaje
CREATE TABLE IF NOT EXISTS eva_pattern_suggestions (
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
CREATE INDEX IF NOT EXISTS idx_eva_patterns_owner ON eva_pattern_suggestions(owner_email, status, created_at DESC);

COMMENT ON TABLE eva_profiles IS 'Configuración Eva por cliente: marca, remitente, tono, audiencia, CTAs.';
COMMENT ON TABLE eva_campaigns IS 'Tracking campañas: opens/clicks/bounces/bajas (manual hoy, automático cuando lleguen webhooks Resend).';
