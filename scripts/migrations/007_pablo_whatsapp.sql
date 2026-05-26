-- Pablo · WhatsApp Business multi-tenant.
-- Mismo patrón que Marta IG, adaptado a WhatsApp.

-- Conversaciones (una por número de teléfono del cliente final)
CREATE TABLE IF NOT EXISTS pablo_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone_number VARCHAR(40) NOT NULL,    -- E.164 del cliente final
  wa_profile_name VARCHAR(255),
  business_phone_id VARCHAR(64) NOT NULL,  -- número Business del owner
  owner_email TEXT,
  status VARCHAR(32) DEFAULT 'active',     -- active / escalated / closed
  intent_last VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wa_phone_number, business_phone_id)
);
CREATE INDEX IF NOT EXISTS idx_pablo_conv_owner ON pablo_conversations(owner_email);
CREATE INDEX IF NOT EXISTS idx_pablo_conv_status ON pablo_conversations(status);

-- Mensajes (in/out)
CREATE TABLE IF NOT EXISTS pablo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES pablo_conversations(id) ON DELETE CASCADE,
  direction VARCHAR(8) NOT NULL,           -- 'in' / 'out'
  content TEXT,
  intent VARCHAR(64),
  confidence NUMERIC(3,2),
  reasoning TEXT,
  responded_by VARCHAR(16) DEFAULT 'bot',  -- bot / human
  wa_message_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_msg_conv ON pablo_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_pablo_msg_created ON pablo_messages(created_at DESC);

-- Leads
CREATE TABLE IF NOT EXISTS pablo_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES pablo_conversations(id),
  wa_phone_number VARCHAR(40),
  wa_profile_name VARCHAR(255),
  lead_type VARCHAR(32),                    -- cita / presupuesto / info
  notes TEXT,
  owner_email TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_leads_owner ON pablo_leads(owner_email);

-- Cola pending (ruedines)
CREATE TABLE IF NOT EXISTS pablo_pending_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES pablo_conversations(id) ON DELETE CASCADE,
  wa_phone_number VARCHAR(40) NOT NULL,
  wa_profile_name VARCHAR(255),
  owner_email TEXT NOT NULL,
  incoming_message_id UUID REFERENCES pablo_messages(id) ON DELETE CASCADE,
  incoming_text TEXT NOT NULL,
  proposed_response TEXT NOT NULL,
  intent VARCHAR(64),
  confidence NUMERIC(3,2),
  status VARCHAR(16) DEFAULT 'pending',
  approved_text TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  wa_message_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_pending_owner ON pablo_pending_responses(owner_email, status, created_at DESC);

-- Profile config
CREATE TABLE IF NOT EXISTS pablo_profiles (
  owner_email TEXT PRIMARY KEY,
  nombre_negocio TEXT NOT NULL DEFAULT '',
  sector TEXT DEFAULT '',
  horario TEXT DEFAULT '',
  servicios_destacados TEXT DEFAULT '',
  tono_marca TEXT DEFAULT 'cercano y profesional',
  reglas_custom TEXT DEFAULT '',
  saludo_inicial TEXT DEFAULT '',           -- ej. "¡Hola! Gracias por escribir a [Nombre]. ¿En qué te ayudo?"
  modo_activacion TEXT DEFAULT 'ruedines',  -- ruedines / auto
  aprobaciones_count INTEGER DEFAULT 0,
  rechazos_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sugerencias de aprendizaje
CREATE TABLE IF NOT EXISTS pablo_pattern_suggestions (
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
CREATE INDEX IF NOT EXISTS idx_pablo_patterns_owner ON pablo_pattern_suggestions(owner_email, status, created_at DESC);

COMMENT ON TABLE pablo_conversations IS 'Conversaciones WhatsApp Business gestionadas por Pablo (multi-tenant).';
COMMENT ON TABLE pablo_pending_responses IS 'Cola de respuestas pendientes de aprobación humana (modo ruedines).';
