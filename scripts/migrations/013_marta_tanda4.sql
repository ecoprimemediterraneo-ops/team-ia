-- Marta TANDA 4 · Templates eventos + i18n + Voz + Colaboraciones + Reportes + Shopping

-- Templates de campañas por eventos del calendario
CREATE TABLE IF NOT EXISTS marta_templates_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  evento_key VARCHAR(48) NOT NULL,             -- navidad / san_valentin / black_friday / rebajas / dia_madre ...
  evento_nombre TEXT NOT NULL,
  fecha_objetivo DATE,                         -- fecha del evento o cercana
  tipo_pieza VARCHAR(16) NOT NULL,             -- post / reel / carrusel / story
  caption TEXT NOT NULL,
  hashtags TEXT,
  hook TEXT,                                   -- si es reel
  cta TEXT,
  notas_visuales TEXT,                         -- "fondo cálido, paleta navideña"
  status VARCHAR(16) DEFAULT 'borrador',       -- borrador / programado / publicado
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_tmpl_owner ON marta_templates_eventos(owner_email, fecha_objetivo);

-- Traducciones cacheadas (caption ES → EN / FR / DE / IT / PT)
CREATE TABLE IF NOT EXISTS marta_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  source_text TEXT NOT NULL,
  source_lang VARCHAR(8) DEFAULT 'es',
  target_lang VARCHAR(8) NOT NULL,
  translated_text TEXT NOT NULL,
  context VARCHAR(32),                         -- caption / hashtags / hook
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_trans_owner ON marta_translations(owner_email, created_at DESC);

-- Voz generada con ElevenLabs para stories/reels
CREATE TABLE IF NOT EXISTS marta_voice_overs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  script TEXT NOT NULL,
  voice_id VARCHAR(64),
  voice_name VARCHAR(64),
  duracion_seg INTEGER,
  audio_url TEXT,                              -- data URL o storage url
  audio_format VARCHAR(16) DEFAULT 'mp3',
  caracteres_usados INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_voice_owner ON marta_voice_overs(owner_email, created_at DESC);

-- Sugerencias de colaboraciones con cuentas afines
CREATE TABLE IF NOT EXISTS marta_colaboraciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  cuenta_sugerida VARCHAR(255) NOT NULL,
  tipo_cuenta VARCHAR(32),                     -- complementaria / referente / micro_influencer
  por_que TEXT NOT NULL,                       -- razonamiento de por qué encaja
  propuesta_colab TEXT NOT NULL,               -- mensaje propuesta listo para enviar
  beneficio_estimado TEXT,
  status VARCHAR(16) DEFAULT 'pending',        -- pending / contactada / aceptada / descartada
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_colab_owner ON marta_colaboraciones(owner_email, status, created_at DESC);

-- Reportes mensuales generados
CREATE TABLE IF NOT EXISTS marta_reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  periodo VARCHAR(16) NOT NULL,                -- "2026-05"
  resumen_ejecutivo TEXT NOT NULL,
  metricas JSONB DEFAULT '{}',                 -- {posts, reach, engagement, top_post, ...}
  insights JSONB DEFAULT '[]',                 -- ["Reels suben 40% vs mes pasado", ...]
  recomendaciones JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, periodo)
);
CREATE INDEX IF NOT EXISTS idx_marta_reportes_owner ON marta_reportes(owner_email, periodo DESC);

-- Productos del catálogo del cliente (para tags IG Shopping)
CREATE TABLE IF NOT EXISTS marta_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10,2),
  categoria VARCHAR(64),
  keywords TEXT,                               -- palabras clave para matching
  url_producto TEXT,
  imagen_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marta_productos_owner ON marta_productos(owner_email, active);

COMMENT ON TABLE marta_templates_eventos IS 'Templates de campañas pre-generadas para fechas señaladas.';
COMMENT ON TABLE marta_translations IS 'Cache de traducciones de captions/hashtags.';
COMMENT ON TABLE marta_voice_overs IS 'Audios narrados con ElevenLabs para stories/reels.';
COMMENT ON TABLE marta_colaboraciones IS 'Sugerencias de cuentas afines para co-marketing.';
COMMENT ON TABLE marta_reportes IS 'Reportes mensuales ejecutivos para guardar/imprimir.';
COMMENT ON TABLE marta_productos IS 'Catálogo de productos del cliente para auto-tag IG Shopping.';
