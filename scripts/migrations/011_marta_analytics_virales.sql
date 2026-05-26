-- Marta TANDA 2 · Analytics + Oportunidades virales + Leads en comentarios

-- Métricas reales de cada post publicado (cuando Meta apruebe Insights)
CREATE TABLE IF NOT EXISTS marta_post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  ig_media_id VARCHAR(128),
  tipo_post VARCHAR(16) NOT NULL,             -- post / reel / carrusel / story
  titulo TEXT,                                  -- primeros 80 chars del caption o tema
  hashtags TEXT,
  publicado_at TIMESTAMPTZ,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),                -- (likes + comments + saves) / reach * 100
  performance_tier VARCHAR(16),                -- top / above_avg / avg / below_avg
  insights_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, ig_media_id)
);
CREATE INDEX IF NOT EXISTS idx_marta_analytics_owner ON marta_post_analytics(owner_email, publicado_at DESC);
CREATE INDEX IF NOT EXISTS idx_marta_analytics_tier ON marta_post_analytics(owner_email, performance_tier);

-- Recomendaciones generadas tras análisis nocturno
CREATE TABLE IF NOT EXISTS marta_recomendaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  titulo TEXT NOT NULL,
  insight TEXT NOT NULL,                       -- "Tus reels los lunes funcionan 3x más"
  accion_sugerida TEXT NOT NULL,               -- "Programa próximo reel para lunes"
  prioridad VARCHAR(16) DEFAULT 'media',       -- alta / media / baja
  source_data JSONB DEFAULT '{}',
  status VARCHAR(16) DEFAULT 'nueva',          -- nueva / aceptada / descartada
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_recom_owner ON marta_recomendaciones(owner_email, status, created_at DESC);

-- Cuentas competidoras / referentes a vigilar para oportunidades virales
CREATE TABLE IF NOT EXISTS marta_competencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  username VARCHAR(255) NOT NULL,
  motivo TEXT,                                 -- "competidor directo / referente sector"
  active BOOLEAN DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, username)
);
CREATE INDEX IF NOT EXISTS idx_marta_comp_owner ON marta_competencia(owner_email, active);

-- Oportunidades virales detectadas (posts que están reventando en tu sector)
CREATE TABLE IF NOT EXISTS marta_oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  source_username VARCHAR(255),
  source_url TEXT,
  tipo_contenido VARCHAR(16),                  -- reel / post / carrusel
  por_que TEXT NOT NULL,                       -- por qué Marta lo considera oportunidad
  propuesta_adaptada TEXT NOT NULL,            -- versión adaptada para tu marca
  status VARCHAR(16) DEFAULT 'pending',        -- pending / aceptada / descartada
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_oport_owner ON marta_oportunidades(owner_email, status, created_at DESC);

-- Leads detectados en comentarios públicos (extensión de leads pero específico)
-- (Reutilizamos la tabla marta_ig_leads ya existente con un campo extra opcional)
ALTER TABLE marta_ig_leads ADD COLUMN IF NOT EXISTS source_type VARCHAR(16) DEFAULT 'dm';
ALTER TABLE marta_ig_leads ADD COLUMN IF NOT EXISTS comment_id VARCHAR(128);

COMMENT ON TABLE marta_post_analytics IS 'Métricas reales por post publicado (cuando Meta Insights API esté aprobado).';
COMMENT ON TABLE marta_recomendaciones IS 'Recomendaciones generadas por Claude tras análisis nocturno de métricas.';
COMMENT ON TABLE marta_competencia IS 'Cuentas IG que el cliente quiere vigilar para detectar contenido viral.';
COMMENT ON TABLE marta_oportunidades IS 'Posts virales detectados en cuentas del sector con propuesta adaptada para el cliente.';
