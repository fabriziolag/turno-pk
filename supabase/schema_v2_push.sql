-- ============================================================
-- Turno PK — Fase 2b: notificaciones push (Web Push)
-- Tabla de suscripciones. La Edge Function `notify` lee con service_role.
-- Pegar en Supabase (turno-pk) → SQL Editor → Run. Idempotente.
-- ============================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- cada usuario maneja SUS suscripciones (la función de envío usa service_role y se salta RLS)
drop policy if exists push_sel on public.push_subscriptions;
create policy push_sel on public.push_subscriptions for select to authenticated
  using (profile_id = auth.uid());
drop policy if exists push_ins on public.push_subscriptions;
create policy push_ins on public.push_subscriptions for insert to authenticated
  with check (profile_id = auth.uid());
drop policy if exists push_upd on public.push_subscriptions;
create policy push_upd on public.push_subscriptions for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists push_del on public.push_subscriptions;
create policy push_del on public.push_subscriptions for delete to authenticated
  using (profile_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;
