-- Pablo + Rocío + Lucía · Tanda 2 (analytics + inteligencia + reportes)

-- ===== PABLO =====
-- Tracking de cada mensaje atendido para analytics + A/B
CREATE TABLE IF NOT EXISTS pablo_message_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  conversation_id TEXT,
  intent VARCHAR(48),                          -- precio / info / queja / lead / pedido / cita / otro
  response_template_id UUID,                   -- si usó template
  variant_letra VARCHAR(2),                    -- A/B/C en A/B tests
  message_in TEXT,
  message_out TEXT,
  status VARCHAR(16) DEFAULT 'sent',           -- sent / converted / no_response
  converted BOOLEAN DEFAULT false,             -- ¿acabó en venta/cita?
  conversion_value NUMERIC(10,2),
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pablo_analytics_owner ON pablo_message_analytics(owner_email, responded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pablo_analytics_intent ON pablo_message_analytics(owner_email, intent);

CREATE TABLE IF NOT EXISTS pablo_templates_intent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  intent VARCHAR(48) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  uso_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_tmpl_owner ON pablo_templates_intent(owner_email, intent, active);

CREATE TABLE IF NOT EXISTS pablo_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  intent VARCHAR(48) NOT NULL,
  tema TEXT NOT NULL,
  variantes JSONB NOT NULL,                    -- [{letra,body,sent_count,converted_count}]
  winner_letra VARCHAR(2),
  status VARCHAR(16) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pablo_ab_owner ON pablo_ab_tests(owner_email, status, created_at DESC);

CREATE TABLE IF NOT EXISTS pablo_reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  periodo VARCHAR(16) NOT NULL,
  resumen_ejecutivo TEXT NOT NULL,
  metricas JSONB DEFAULT '{}',
  insights JSONB DEFAULT '[]',
  recomendaciones JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, periodo)
);
CREATE INDEX IF NOT EXISTS idx_pablo_reportes_owner ON pablo_reportes(owner_email, periodo DESC);

-- ===== ROCÍO =====
-- Análisis sentimiento por reseña
CREATE TABLE IF NOT EXISTS rocio_review_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  review_id TEXT,                              -- id externo GBP
  rating INTEGER,                              -- 1-5
  review_text TEXT,
  sentiment VARCHAR(16),                       -- muy_positivo / positivo / neutro / negativo / muy_negativo
  emocion_principal VARCHAR(32),               -- gratitud / queja / frustracion / entusiasmo / decepcion
  temas JSONB DEFAULT '[]',                    -- ["atencion","precio","tiempo_espera"]
  prioridad_respuesta VARCHAR(16),             -- urgente / alta / normal / baja
  flags JSONB DEFAULT '[]',                    -- ["competencia","posible_falsa","escalar"]
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rocio_sent_owner ON rocio_review_sentiment(owner_email, analyzed_at DESC);

CREATE TABLE IF NOT EXISTS rocio_templates_sector (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  sector VARCHAR(48) NOT NULL,                 -- clinica / peluqueria / restaurante / hotel / fisio / otro
  sentiment VARCHAR(16) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rocio_tmpl_owner ON rocio_templates_sector(owner_email, sector, sentiment);

CREATE TABLE IF NOT EXISTS rocio_pedir_resenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  cliente_nombre TEXT,
  cliente_contacto TEXT NOT NULL,              -- email o teléfono
  canal VARCHAR(16) NOT NULL,                  -- whatsapp / sms / email
  mensaje TEXT NOT NULL,
  link_resena TEXT,
  programado_para TIMESTAMPTZ,
  enviado_at TIMESTAMPTZ,
  status VARCHAR(16) DEFAULT 'borrador',       -- borrador / programado / enviado / respondido
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rocio_pedir_owner ON rocio_pedir_resenas(owner_email, status, created_at DESC);

CREATE TABLE IF NOT EXISTS rocio_reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  periodo VARCHAR(16) NOT NULL,
  resumen_ejecutivo TEXT NOT NULL,
  metricas JSONB DEFAULT '{}',
  insights JSONB DEFAULT '[]',
  recomendaciones JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, periodo)
);
CREATE INDEX IF NOT EXISTS idx_rocio_reportes_owner ON rocio_reportes(owner_email, periodo DESC);

-- ===== LUCÍA =====
-- Resumen ejecutivo diario 8am
CREATE TABLE IF NOT EXISTS lucia_daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  brief_date DATE NOT NULL,
  resumen TEXT NOT NULL,                       -- "Tienes 12 urgentes, 4 reuniones..."
  emails_urgentes INTEGER DEFAULT 0,
  emails_total INTEGER DEFAULT 0,
  reuniones_hoy INTEGER DEFAULT 0,
  propuestas_pendientes INTEGER DEFAULT 0,
  highlights JSONB DEFAULT '[]',               -- ["María Pérez quiere reunión miércoles", ...]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, brief_date)
);
CREATE INDEX IF NOT EXISTS idx_lucia_briefs_owner ON lucia_daily_briefs(owner_email, brief_date DESC);

-- Compromisos detectados ("dije que enviaría X y no lo hice")
CREATE TABLE IF NOT EXISTS lucia_compromisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  thread_id TEXT,
  origen_email TEXT,                           -- email donde dijiste el compromiso
  compromiso_texto TEXT NOT NULL,              -- "Te envío la propuesta el martes"
  fecha_limite DATE,
  destinatario TEXT,
  status VARCHAR(16) DEFAULT 'pendiente',      -- pendiente / cumplido / descartado / vencido
  cumplido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lucia_compromisos_owner ON lucia_compromisos(owner_email, status, fecha_limite);

-- Briefs de reunión (extrae temas de hilos previos)
CREATE TABLE IF NOT EXISTS lucia_meeting_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  meeting_with TEXT NOT NULL,
  meeting_at TIMESTAMPTZ,
  brief_text TEXT NOT NULL,                    -- markdown con contexto
  topics JSONB DEFAULT '[]',
  related_thread_ids JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lucia_meet_owner ON lucia_meeting_briefs(owner_email, meeting_at DESC);

CREATE TABLE IF NOT EXISTS lucia_reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  periodo VARCHAR(16) NOT NULL,
  resumen_ejecutivo TEXT NOT NULL,
  metricas JSONB DEFAULT '{}',
  insights JSONB DEFAULT '[]',
  recomendaciones JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, periodo)
);
CREATE INDEX IF NOT EXISTS idx_lucia_reportes_owner ON lucia_reportes(owner_email, periodo DESC);
