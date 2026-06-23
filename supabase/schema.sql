-- ============================================================
-- Turno PK — Esquema inicial (Supabase)
-- Estado compartido del turno + lista de correos invitados + RLS + realtime.
-- Pegar completo en: Supabase → SQL Editor → New query → Run.
-- ============================================================

-- 1) Lista blanca de correos invitados (solo estos pueden entrar y ver datos)
create table if not exists public.allowed_emails (
  email      text primary key,
  label      text,
  created_at timestamptz not null default now()
);

-- 2) Estado del turno como documento único JSON (familias, turnos, confirmaciones,
--    ruta, ajustes). Suficiente y simple para un furgón de pocas familias.
create table if not exists public.turno_state (
  id         int primary key default 1,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint turno_state_singleton check (id = 1)
);
insert into public.turno_state (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- 3) ¿El usuario autenticado actual está invitado? (security definer para poder
--    leer la lista sin chocar con su propia RLS).
create or replace function public.is_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- 4) Row Level Security: nadie toca nada salvo los invitados.
alter table public.turno_state    enable row level security;
alter table public.allowed_emails enable row level security;

drop policy if exists turno_state_member_all on public.turno_state;
create policy turno_state_member_all on public.turno_state
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

drop policy if exists allowed_emails_member_all on public.allowed_emails;
create policy allowed_emails_member_all on public.allowed_emails
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

-- 5) Permisos base para el rol authenticated (RLS sigue mandando).
grant select, insert, update, delete on public.turno_state    to authenticated;
grant select, insert, update, delete on public.allowed_emails to authenticated;
grant execute on function public.is_member() to authenticated;

-- 6) Realtime: que los cambios del turno lleguen en vivo a los demás.
alter publication supabase_realtime add table public.turno_state;

-- 7) Semilla: el dueño como primer invitado (puede invitar al resto desde la app).
insert into public.allowed_emails (email, label)
values ('fabriziolag@gmail.com', 'Fabrizio (dueño)')
on conflict (email) do nothing;
