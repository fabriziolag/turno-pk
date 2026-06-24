-- ============================================================
-- Turno PK — Ampliación v2: co-apoderados (invitar cónyuge a la familia)
-- + Apellido separado en el perfil. Pegar en Supabase (turno-pk) → SQL Editor → Run.
-- Idempotente.
-- ============================================================

-- Apellido del apoderado (el perfil ya tiene name = nombre)
alter table public.profiles add column if not exists apellido text not null default '';

-- Invitaciones de co-apoderado (a la FAMILIA, distinto de las de turno)
create table if not exists public.family_invites (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  email        text not null,
  inviter_name text not null default '',
  fam_name     text not null default '',
  status       text not null default 'pending',  -- pending | accepted | revoked
  created_at   timestamptz not null default now(),
  unique (family_id, email)
);

create or replace function public.has_pending_family_invite(fam uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from family_invites i
    where i.family_id = fam and lower(i.email) = public.my_email() and i.status = 'pending'
  );
$$;

-- Para poder ver a los co-apoderados de mi propia familia (sus perfiles)
create or replace function public.shares_my_family(other uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from family_members a
    join family_members b on b.family_id = a.family_id
    where a.profile_id = auth.uid() and b.profile_id = other
  );
$$;

-- ---- RLS family_invites ----
alter table public.family_invites enable row level security;

drop policy if exists fi_sel on public.family_invites;
create policy fi_sel on public.family_invites for select to authenticated
  using (public.can_edit_family(family_id) or lower(email) = public.my_email());
drop policy if exists fi_ins on public.family_invites;
create policy fi_ins on public.family_invites for insert to authenticated
  with check (public.can_edit_family(family_id));
drop policy if exists fi_upd on public.family_invites;
create policy fi_upd on public.family_invites for update to authenticated
  using (public.can_edit_family(family_id) or lower(email) = public.my_email())
  with check (public.can_edit_family(family_id) or lower(email) = public.my_email());
drop policy if exists fi_del on public.family_invites;
create policy fi_del on public.family_invites for delete to authenticated
  using (public.can_edit_family(family_id));

-- ---- actualizar policies para los nuevos casos ----
-- ver la familia si tienes invitación de co-apoderado pendiente
drop policy if exists families_sel on public.families;
create policy families_sel on public.families for select to authenticated
  using (
    created_by = auth.uid()
    or public.can_edit_family(id)
    or public.shares_turno_with_family(id)
    or public.has_pending_family_invite(id)
  );

-- ver el perfil de los co-apoderados de mi familia
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_a_turno(id) or public.shares_my_family(id));

grant select, insert, update, delete on public.family_invites to authenticated;
