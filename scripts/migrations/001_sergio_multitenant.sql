-- Sergio multi-tenant
-- Añade owner_email a sergio_sources y crea índice para queries rápidas.
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE sergio_sources
  ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Backfill: las sources existentes pasan a ser propiedad del founder
UPDATE sergio_sources
SET owner_email = 'ecoprimemediterraneo@gmail.com'
WHERE owner_email IS NULL;

-- Índice para listSourcesByOwner
CREATE INDEX IF NOT EXISTS sergio_sources_owner_idx
  ON sergio_sources (owner_email)
  WHERE active = true;

-- Comentario para clarificar el modelo:
COMMENT ON COLUMN sergio_sources.owner_email IS
  'Email del cliente que añadió esta fuente. Multi-tenancy: cada cliente ve solo las suyas.';
