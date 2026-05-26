-- Marta TANDA 3 · A/B testing + Repurposing + Hora óptima

-- A/B test de hooks (3 variantes para cada idea)
CREATE TABLE IF NOT EXISTS marta_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  tema TEXT NOT NULL,
  variantes JSONB NOT NULL,                   -- [{letra:"A",hook:"...",score:0},...]
  winner_letra VARCHAR(2),                    -- A/B/C tras resolver
  metricas_winner JSONB DEFAULT '{}',
  status VARCHAR(16) DEFAULT 'pending',       -- pending / running / resolved / discarded
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_marta_abtests_owner ON marta_ab_tests(owner_email, status, created_at DESC);

-- Repurposing: 1 contenido fuente → N piezas adaptadas
CREATE TABLE IF NOT EXISTS marta_repurpose (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  source_tipo VARCHAR(16) NOT NULL,           -- reel / post / carrusel / video_largo
  source_descripcion TEXT NOT NULL,            -- "Reel de 60s sobre 3 mitos del implante"
  piezas JSONB NOT NULL,                       -- {tiktok:"...", shorts:"...", post:"...", carrusel:[...], blog:"..."}
  status VARCHAR(16) DEFAULT 'borrador',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_repurpose_owner ON marta_repurpose(owner_email, created_at DESC);

COMMENT ON TABLE marta_ab_tests IS 'A/B test de 3 hooks alternativos para encontrar el ganador antes de publicar.';
COMMENT ON TABLE marta_repurpose IS 'De 1 contenido original a 5 piezas adaptadas para distintos canales.';
