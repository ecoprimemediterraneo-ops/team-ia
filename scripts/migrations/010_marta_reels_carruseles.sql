-- Marta TANDA 1 · Reels + Carruseles + Saved generations

-- Reels generados por Marta
CREATE TABLE IF NOT EXISTS marta_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  tema TEXT NOT NULL,
  duracion_seg INTEGER DEFAULT 30,            -- 15/30/60/90
  hook TEXT NOT NULL,                          -- primeros 3 segundos
  script TEXT NOT NULL,                        -- script completo con timing
  planos_broll JSONB DEFAULT '[]',             -- ["plano de cliente sonriendo", ...]
  texto_overlay JSONB DEFAULT '[]',            -- textos on-screen por segundo
  musica_sugerida TEXT,                        -- "Trending audio: ..."
  cta_final TEXT,                              -- llamada acción
  hashtags TEXT,
  status VARCHAR(16) DEFAULT 'borrador',       -- borrador / aprobado / grabado / publicado
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_reels_owner ON marta_reels(owner_email, created_at DESC);

-- Carruseles generados por Marta
CREATE TABLE IF NOT EXISTS marta_carruseles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  tema TEXT NOT NULL,
  num_slides INTEGER DEFAULT 7,
  portada JSONB NOT NULL,                      -- {titulo, subtitulo, descripcion_visual}
  slides JSONB NOT NULL,                       -- [{numero, titulo, contenido, descripcion_visual}, ...]
  caption TEXT NOT NULL,                       -- caption del post
  cta_final TEXT,
  hashtags TEXT,
  status VARCHAR(16) DEFAULT 'borrador',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_carruseles_owner ON marta_carruseles(owner_email, created_at DESC);

COMMENT ON TABLE marta_reels IS 'Reels generados con script completo + planos + música + texto overlay.';
COMMENT ON TABLE marta_carruseles IS 'Carruseles multi-slide con portada + slides + descripción visual.';
