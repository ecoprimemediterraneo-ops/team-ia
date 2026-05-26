-- Pablo Tandas 3+4 · CRM + Citas + Catálogo + Insights + Voz + Keywords

-- Pipeline CRM: leads con etapas
CREATE TABLE IF NOT EXISTS pablo_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  phone TEXT NOT NULL,
  nombre TEXT,
  etapa VARCHAR(32) DEFAULT 'nuevo',           -- nuevo / conversacion / cita_programada / cliente / recurrente / perdido
  tags JSONB DEFAULT '[]',                     -- ["caliente","vip","precio_sensible","spam"]
  notas TEXT,
  valor_estim NUMERIC(10,2),
  primera_conversacion_at TIMESTAMPTZ DEFAULT NOW(),
  ultima_actividad_at TIMESTAMPTZ DEFAULT NOW(),
  fuente VARCHAR(48),                          -- whatsapp_directo / qr / web / referido
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, phone)
);
CREATE INDEX IF NOT EXISTS idx_pablo_leads_owner ON pablo_leads(owner_email, etapa, ultima_actividad_at DESC);

-- Citas con recordatorios programados
CREATE TABLE IF NOT EXISTS pablo_citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  lead_id UUID REFERENCES pablo_leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  nombre TEXT,
  servicio TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duracion_min INTEGER DEFAULT 60,
  status VARCHAR(16) DEFAULT 'programada',     -- programada / confirmada / completada / no_show / cancelada
  recordatorio_24h_sent BOOLEAN DEFAULT false,
  recordatorio_2h_sent BOOLEAN DEFAULT false,
  followup_sent BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_citas_owner ON pablo_citas(owner_email, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pablo_citas_status ON pablo_citas(owner_email, status);

-- Catálogo de productos/servicios
CREATE TABLE IF NOT EXISTS pablo_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10,2),
  precio_desde BOOLEAN DEFAULT false,
  duracion_min INTEGER,
  categoria VARCHAR(64),
  keywords TEXT,                               -- para matching automático
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_catalogo_owner ON pablo_catalogo(owner_email, active);

-- Keywords críticas (escalada/bloqueo auto)
CREATE TABLE IF NOT EXISTS pablo_keywords_criticas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  keyword TEXT NOT NULL,
  accion VARCHAR(16) NOT NULL,                 -- escalar / bloquear_auto / alerta
  motivo TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_kw_owner ON pablo_keywords_criticas(owner_email, active);

-- Voz audios generados
CREATE TABLE IF NOT EXISTS pablo_voice_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  lead_phone TEXT,
  script TEXT NOT NULL,
  voice_id VARCHAR(64),
  duracion_seg INTEGER,
  caracteres_usados INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_voice_owner ON pablo_voice_audios(owner_email, created_at DESC);

-- Insights generados (BI)
CREATE TABLE IF NOT EXISTS pablo_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  titulo TEXT NOT NULL,
  insight TEXT NOT NULL,
  accion_sugerida TEXT,
  prioridad VARCHAR(16) DEFAULT 'media',
  source_data JSONB DEFAULT '{}',
  status VARCHAR(16) DEFAULT 'nueva',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pablo_insights_owner ON pablo_insights(owner_email, status, created_at DESC);
