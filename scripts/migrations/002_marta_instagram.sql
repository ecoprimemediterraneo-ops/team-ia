-- Marta · Instagram DMs / comentarios / menciones
-- Tablas para conversaciones, mensajes y leads detectados.
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Conversaciones IG (un registro por usuario que escribe)
CREATE TABLE IF NOT EXISTS marta_ig_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id VARCHAR(64) NOT NULL,
  ig_username VARCHAR(255),
  business_account_id VARCHAR(64) NOT NULL,
  owner_email TEXT,
  status VARCHAR(32) DEFAULT 'active', -- active, escalated, closed
  intent_last VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ig_user_id, business_account_id)
);

CREATE INDEX IF NOT EXISTS idx_marta_ig_conv_user ON marta_ig_conversations(ig_user_id);
CREATE INDEX IF NOT EXISTS idx_marta_ig_conv_status ON marta_ig_conversations(status);
CREATE INDEX IF NOT EXISTS idx_marta_ig_conv_owner ON marta_ig_conversations(owner_email);

-- Mensajes individuales (in/out)
CREATE TABLE IF NOT EXISTS marta_ig_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES marta_ig_conversations(id) ON DELETE CASCADE,
  direction VARCHAR(8) NOT NULL, -- 'in' / 'out'
  message_type VARCHAR(32), -- dm, comment, mention, story_reply
  content TEXT,
  media_url TEXT,
  intent VARCHAR(64),
  confidence NUMERIC(3,2),
  reasoning TEXT,
  responded_by VARCHAR(16) DEFAULT 'bot', -- bot / human
  meta_message_id VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marta_ig_msg_conv ON marta_ig_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_marta_ig_msg_created ON marta_ig_messages(created_at DESC);

-- Leads detectados desde IG (consulta_precio + pedir_cita)
CREATE TABLE IF NOT EXISTS marta_ig_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES marta_ig_conversations(id),
  ig_username VARCHAR(255),
  lead_type VARCHAR(32), -- cita, presupuesto, info
  notes TEXT,
  owner_email TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marta_ig_leads_owner ON marta_ig_leads(owner_email);

COMMENT ON TABLE marta_ig_conversations IS 'Conversaciones Instagram (DMs/comentarios) gestionadas por Marta.';
COMMENT ON TABLE marta_ig_messages IS 'Mensajes individuales con intent + confidence del clasificador Claude.';
COMMENT ON TABLE marta_ig_leads IS 'Leads cualificados detectados automáticamente (cita, presupuesto).';
