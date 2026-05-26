-- Marta · Perfil personalizable por cliente.
-- Un cliente = una fila. Editable desde /dashboard/marta.

CREATE TABLE IF NOT EXISTS marta_profiles (
  owner_email TEXT PRIMARY KEY,
  nombre_negocio TEXT NOT NULL DEFAULT '',
  sector TEXT DEFAULT '',
  horario TEXT DEFAULT '',
  servicios_destacados TEXT DEFAULT '',
  tono_marca TEXT DEFAULT 'cercano y profesional',
  reglas_custom TEXT DEFAULT '',
  -- Activación: ruedines (todo a aprobación humana) → auto (responde solo)
  modo_activacion TEXT DEFAULT 'ruedines',
  fecha_activacion TIMESTAMPTZ DEFAULT NOW(),
  aprobaciones_count INTEGER DEFAULT 0,
  rechazos_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE marta_profiles IS 'Configuración por cliente de Marta IG: tono, horario, servicios, reglas custom + estado de activación.';
COMMENT ON COLUMN marta_profiles.modo_activacion IS 'ruedines = humano aprueba cada respuesta. auto = Marta envía sola.';
