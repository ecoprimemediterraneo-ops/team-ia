-- Tomás 2.0 · Soporte IA contextual + tickets pre-investigados

CREATE TABLE IF NOT EXISTS tomas_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  session_id TEXT,                              -- agrupa mensajes de una conversación
  role VARCHAR(16) NOT NULL,                    -- user / assistant
  content TEXT NOT NULL,
  context_snapshot JSONB,                       -- estado del cliente en ese momento (opcional)
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tomas_conv_owner ON tomas_conversations(owner_email, session_id, created_at);

CREATE TABLE IF NOT EXISTS tomas_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  asunto VARCHAR(255) NOT NULL,
  problema_cliente TEXT NOT NULL,               -- lo que dijo el cliente
  diagnostico_tomas TEXT NOT NULL,              -- análisis IA
  hipotesis JSONB DEFAULT '[]',                 -- ["hipótesis 1", "hipótesis 2"]
  accion_sugerida TEXT,                         -- qué hacer
  contexto_cliente JSONB DEFAULT '{}',          -- snapshot perfil + agentes
  prioridad VARCHAR(16) DEFAULT 'normal',       -- urgente / alta / normal / baja
  status VARCHAR(16) DEFAULT 'abierto',         -- abierto / en_proceso / resuelto / cerrado
  asignado_a TEXT,                              -- email del admin que lo lleva
  resolucion TEXT,
  resolved_at TIMESTAMPTZ,
  notificado_email BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tomas_tickets_status ON tomas_tickets(status, prioridad, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tomas_tickets_owner ON tomas_tickets(owner_email, status);

-- FAQ auto-generada (cuando 3+ clientes preguntan lo mismo, IA lo añade)
CREATE TABLE IF NOT EXISTS tomas_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  agente_relacionado VARCHAR(32),               -- pablo / marta / etc, null = general
  hits INTEGER DEFAULT 0,                       -- cuántas veces se ha usado
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tomas_faq_agente ON tomas_faq(agente_relacionado, active, hits DESC);
