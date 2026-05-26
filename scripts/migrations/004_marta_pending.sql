-- Marta · Cola de respuestas pendientes de aprobación humana (modo ruedines).
-- Cuando el cliente está en modo_activacion='ruedines', Marta NO envía sola:
-- guarda la respuesta sugerida aquí y notifica al humano.

CREATE TABLE IF NOT EXISTS marta_ig_pending_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES marta_ig_conversations(id) ON DELETE CASCADE,
  ig_user_id VARCHAR(64) NOT NULL,
  ig_username VARCHAR(255),
  owner_email TEXT NOT NULL,
  incoming_message_id UUID REFERENCES marta_ig_messages(id) ON DELETE CASCADE,
  incoming_text TEXT NOT NULL,
  proposed_response TEXT NOT NULL,
  intent VARCHAR(64),
  confidence NUMERIC(3,2),
  status VARCHAR(16) DEFAULT 'pending', -- pending / approved / rejected / sent / failed
  approved_text TEXT, -- si humano edita la propuesta, va aquí
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  meta_message_id VARCHAR(128), -- id del DM enviado tras aprobación
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marta_pending_owner ON marta_ig_pending_responses(owner_email, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marta_pending_conv ON marta_ig_pending_responses(conversation_id);

COMMENT ON TABLE marta_ig_pending_responses IS 'Cola de respuestas que Marta genera pero NO envía (modo ruedines). El founder aprueba/edita/rechaza desde el dashboard.';
