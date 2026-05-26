-- Rocío · Tablas para gestión de reseñas Google.
-- Multi-tenant desde el principio (owner_email + location_id).

-- Locales del cliente (multi-local desde día 1)
CREATE TABLE IF NOT EXISTS rocio_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  google_place_id TEXT,
  google_review_link TEXT,            -- g.page/xxx o https://search.google.com/local/writereview?placeid=...
  address TEXT,
  city TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rocio_loc_owner ON rocio_locations(owner_email);

-- Reseñas (manual por ahora, automático cuando llegue Google Business Profile API)
CREATE TABLE IF NOT EXISTS rocio_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  location_id UUID REFERENCES rocio_locations(id) ON DELETE CASCADE,
  reviewer_name TEXT,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  google_review_id TEXT,
  status VARCHAR(16) DEFAULT 'pending',  -- pending / responded / ignored / escalated
  created_at_google TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rocio_rev_owner ON rocio_reviews(owner_email, status, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_rocio_rev_loc ON rocio_reviews(location_id);

-- Cola de respuestas pendientes de aprobación (modo ruedines)
CREATE TABLE IF NOT EXISTS rocio_pending_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  review_id UUID REFERENCES rocio_reviews(id) ON DELETE CASCADE,
  proposed_response TEXT NOT NULL,
  intent VARCHAR(32),                  -- positiva / negativa / neutra / falsa
  status VARCHAR(16) DEFAULT 'pending', -- pending / approved / rejected / sent / failed
  approved_text TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rocio_pending_owner ON rocio_pending_responses(owner_email, status, created_at DESC);

-- Perfil del cliente (config Rocío)
CREATE TABLE IF NOT EXISTS rocio_profiles (
  owner_email TEXT PRIMARY KEY,
  nombre_negocio TEXT NOT NULL DEFAULT '',
  tono_marca TEXT DEFAULT 'cordial y profesional',
  firma_respuesta TEXT DEFAULT '',
  reglas_custom TEXT DEFAULT '',
  modo_activacion TEXT DEFAULT 'ruedines',   -- ruedines / auto
  aprobaciones_count INTEGER DEFAULT 0,
  rechazos_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitudes de reseña enviadas (tracking de QR/links compartidos)
CREATE TABLE IF NOT EXISTS rocio_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  location_id UUID REFERENCES rocio_locations(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  channel VARCHAR(16),                  -- whatsapp / sms / email / qr / link
  message_sent TEXT,
  status VARCHAR(16) DEFAULT 'sent',    -- sent / clicked / converted
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rocio_req_owner ON rocio_review_requests(owner_email, created_at DESC);

-- Sugerencias de reglas (aprendizaje semi-automático, mismo patrón que Marta)
CREATE TABLE IF NOT EXISTS rocio_pattern_suggestions (
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
CREATE INDEX IF NOT EXISTS idx_rocio_patterns_owner ON rocio_pattern_suggestions(owner_email, status, created_at DESC);

COMMENT ON TABLE rocio_locations IS 'Locales del cliente (multi-local desde día 1).';
COMMENT ON TABLE rocio_reviews IS 'Reseñas Google del cliente. Manual hoy, auto cuando llegue GBP API.';
COMMENT ON TABLE rocio_pending_responses IS 'Respuestas Rocío pendientes de aprobación (modo ruedines).';
COMMENT ON TABLE rocio_profiles IS 'Config personalizable de Rocío por cliente.';
COMMENT ON TABLE rocio_review_requests IS 'Tracking de solicitudes de reseña por canal (QR/WhatsApp/email).';
COMMENT ON TABLE rocio_pattern_suggestions IS 'Sugerencias de reglas detectadas en las ediciones del cliente.';
