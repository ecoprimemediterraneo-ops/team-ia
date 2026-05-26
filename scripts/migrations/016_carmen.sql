-- Carmen · Contestador inteligente (Twilio + Whisper + Claude + ElevenLabs + WhatsApp)
CREATE TABLE IF NOT EXISTS carmen_profiles (
  owner_email TEXT PRIMARY KEY,
  nombre_negocio TEXT NOT NULL DEFAULT '',
  sector TEXT DEFAULT '',
  saludo TEXT DEFAULT 'Hola, soy Carmen. Ahora mismo no podemos atenderte. Cuéntame brevemente en qué te puedo ayudar después del tono y te llamamos cuanto antes.',
  voz_id VARCHAR(64) DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  greeting_audio_base64 TEXT,                    -- MP3 pregenerado con ElevenLabs (cache)
  greeting_text_hash TEXT,                       -- hash del saludo para detectar cambios y regenerar
  twilio_phone_number TEXT,                       -- número Twilio asignado a este cliente
  whatsapp_dueno TEXT,                          -- formato +34xxx
  email_dueno TEXT,
  horario_negocio TEXT DEFAULT 'L-V 9-19, S 10-14',
  max_recording_sec INTEGER DEFAULT 60,
  modo_activacion VARCHAR(16) DEFAULT 'auto',    -- siempre auto en contestador
  aprobaciones_count INTEGER DEFAULT 0,
  rechazos_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carmen_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  twilio_call_sid TEXT UNIQUE,
  caller_number TEXT,
  caller_name TEXT,
  duration_sec INTEGER,
  recording_url TEXT,
  transcript TEXT,
  resumen TEXT,
  intent VARCHAR(48),
  urgencia VARCHAR(16) DEFAULT 'normal',
  recall_phone TEXT,
  status VARCHAR(16) DEFAULT 'nueva',
  whatsapp_sent BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_carmen_calls_owner ON carmen_calls(owner_email, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_carmen_calls_urgencia ON carmen_calls(owner_email, urgencia);

CREATE TABLE IF NOT EXISTS carmen_sandbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  user_message TEXT NOT NULL,
  resumen_generado TEXT NOT NULL,
  intent_detectado VARCHAR(48),
  urgencia_detectada VARCHAR(16),
  whatsapp_simulado TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carmen_sandbox_owner ON carmen_sandbox(owner_email, created_at DESC);
