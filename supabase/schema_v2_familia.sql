-- ============================================================
-- Turno PK — Ampliación v2: foto en contactos.
-- (Las demás fotos ya existen: profiles.photo, kids.photo, addresses.house_photo;
--  y addresses ya soporta múltiples filas por familia con label = asociación.)
-- Pegar en Supabase (turno-pk) → SQL Editor → Run. Idempotente.
-- ============================================================

alter table public.contacts add column if not exists photo text not null default '';
