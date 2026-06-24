-- ============================================================
-- Turno PK — Esquema v2 (multi-turno · perfiles · familias · invitaciones)
-- Pegar COMPLETO en: Supabase (proyecto turno-pk) → SQL Editor → New query → Run.
-- Idempotente: se puede correr de nuevo sin romper.
--
-- Identidad/membresía = relacional (con RLS). Estado operativo por turno = un
-- documento JSONB por turno (tabla turno_docs). Coexiste con la tabla turno_state
-- (id=1) de la v1 mientras dure la migración; la vieja se borra en la limpieza final.
-- Familias/hijos son relacionales y se comparten entre turnos.
-- ============================================================

create extension if not exists pgcrypto;

-- ===================== TABLAS =====================

-- Un apoderado logueado. id = auth.users.id
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  name       text not null default '',
  photo      text not null default '',
  phone      text not null default '',
  onboarded  boolean not null default false,
  created_at timestamptz not null default now()
);

-- El hogar (compartido por varios apoderados)
create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  fam_name   text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Co-apoderados: vincula cuentas a una familia
create table if not exists public.family_members (
  family_id  uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       text not null default '',
  primary key (family_id, profile_id)
);

create table if not exists public.kids (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  name       text not null default '',
  photo      text not null default '',
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  label       text not null default 'Casa',
  text        text not null default '',
  region      text not null default '',
  comuna      text not null default '',
  extra       text not null default '',
  house_photo text not null default '',
  lat         double precision,
  lng         double precision,
  sort        int  not null default 0
);

create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  name       text not null default '',
  relation   text not null default '',
  phone      text not null default '',
  is_default boolean not null default false
);

-- Turno (grupo de furgón) + sus ajustes propios (colegio, horarios)
create table if not exists public.turnos (
  id            uuid primary key default gen_random_uuid(),
  emoji         text not null default '🚐',
  name          text not null default '',
  school_name   text not null default '',
  school_text   text not null default '',
  school_region text not null default '',
  school_comuna text not null default '',
  school_extra  text not null default '',
  school_lat    double precision,
  school_lng    double precision,
  exit_times    jsonb not null default '{"lun":"13:20","mar":"13:20","mie":"13:20","jue":"13:20","vie":"13:20"}'::jsonb,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- Familia ∈ turno + qué hijos de esa familia participan en ESTE turno
create table if not exists public.turno_members (
  turno_id  uuid not null references public.turnos(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  kid_ids   uuid[] not null default '{}',
  joined_at timestamptz not null default now(),
  primary key (turno_id, family_id)
);

create table if not exists public.turno_invites (
  id         uuid primary key default gen_random_uuid(),
  turno_id   uuid not null references public.turnos(id) on delete cascade,
  email      text not null,
  invited_by uuid not null references public.profiles(id),
  status     text not null default 'pending',  -- pending | accepted | revoked
  created_at timestamptz not null default now(),
  unique (turno_id, email)
);

-- Estado operativo por turno: { schedule, confirm, routeState, manualOrder }
create table if not exists public.turno_docs (
  turno_id   uuid primary key references public.turnos(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ===================== HELPERS (SECURITY DEFINER, sin recursión) =====================
-- Toda verificación de membresía pasa por estas funciones → las policies NUNCA
-- hacen self-join sobre la tabla protegida (evita "infinite recursion in policy").

create or replace function public.my_email()
  returns text language sql stable set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.can_edit_family(fam uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from family_members fm
    where fm.family_id = fam and fm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_turno_member(t uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from turno_members tm
    join family_members fm on fm.family_id = tm.family_id
    where tm.turno_id = t and fm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_turno_creator(t uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from turnos where id = t and created_by = auth.uid());
$$;

create or replace function public.shares_turno_with_family(fam uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from turno_members them
    join turno_members mine on mine.turno_id = them.turno_id
    join family_members fm   on fm.family_id = mine.family_id
    where them.family_id = fam and fm.profile_id = auth.uid()
  );
$$;

create or replace function public.shares_a_turno(other uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from family_members them
    join turno_members tmt on tmt.family_id = them.family_id
    join turno_members tmm on tmm.turno_id  = tmt.turno_id
    join family_members me  on me.family_id  = tmm.family_id
    where them.profile_id = other and me.profile_id = auth.uid()
  );
$$;

create or replace function public.is_onboarded()
  returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select onboarded from profiles where id = auth.uid()), false);
$$;

create or replace function public.has_pending_invite(t uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from turno_invites i
    where i.turno_id = t and lower(i.email) = public.my_email() and i.status = 'pending'
  );
$$;

-- ===================== RLS =====================
alter table public.profiles       enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.kids           enable row level security;
alter table public.addresses      enable row level security;
alter table public.contacts       enable row level security;
alter table public.turnos         enable row level security;
alter table public.turno_members  enable row level security;
alter table public.turno_invites  enable row level security;
alter table public.turno_docs     enable row level security;

-- ---- profiles ----
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_a_turno(id));
drop policy if exists profiles_ins on public.profiles;             -- escape anti-lockout
create policy profiles_ins on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---- families ----
drop policy if exists families_sel on public.families;
create policy families_sel on public.families for select to authenticated
  using (created_by = auth.uid() or public.can_edit_family(id) or public.shares_turno_with_family(id));
drop policy if exists families_ins on public.families;
create policy families_ins on public.families for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists families_upd on public.families;
create policy families_upd on public.families for update to authenticated
  using (public.can_edit_family(id)) with check (public.can_edit_family(id));
drop policy if exists families_del on public.families;
create policy families_del on public.families for delete to authenticated
  using (public.can_edit_family(id));

-- ---- family_members ---- (escape: self-add del creador)
drop policy if exists fm_sel on public.family_members;
create policy fm_sel on public.family_members for select to authenticated
  using (profile_id = auth.uid() or public.can_edit_family(family_id));
drop policy if exists fm_ins on public.family_members;
create policy fm_ins on public.family_members for insert to authenticated
  with check (profile_id = auth.uid() or public.can_edit_family(family_id));
drop policy if exists fm_del on public.family_members;
create policy fm_del on public.family_members for delete to authenticated
  using (public.can_edit_family(family_id));

-- ---- kids / addresses / contacts (family-scoped, mismo patrón) ----
-- SELECT: dueño de la familia o compañero de turno. Modificar: solo el hogar.
drop policy if exists kids_sel on public.kids;
create policy kids_sel on public.kids for select to authenticated
  using (public.can_edit_family(family_id) or public.shares_turno_with_family(family_id));
drop policy if exists kids_mod on public.kids;
create policy kids_mod on public.kids for all to authenticated
  using (public.can_edit_family(family_id)) with check (public.can_edit_family(family_id));

drop policy if exists addr_sel on public.addresses;
create policy addr_sel on public.addresses for select to authenticated
  using (public.can_edit_family(family_id) or public.shares_turno_with_family(family_id));
drop policy if exists addr_mod on public.addresses;
create policy addr_mod on public.addresses for all to authenticated
  using (public.can_edit_family(family_id)) with check (public.can_edit_family(family_id));

drop policy if exists contacts_sel on public.contacts;
create policy contacts_sel on public.contacts for select to authenticated
  using (public.can_edit_family(family_id) or public.shares_turno_with_family(family_id));
drop policy if exists contacts_mod on public.contacts;
create policy contacts_mod on public.contacts for all to authenticated
  using (public.can_edit_family(family_id)) with check (public.can_edit_family(family_id));

-- ---- turnos ----
drop policy if exists turnos_sel on public.turnos;
create policy turnos_sel on public.turnos for select to authenticated
  using (public.is_turno_member(id) or created_by = auth.uid() or public.has_pending_invite(id));
drop policy if exists turnos_ins on public.turnos;
create policy turnos_ins on public.turnos for insert to authenticated
  with check (created_by = auth.uid());
drop policy if exists turnos_upd on public.turnos;
create policy turnos_upd on public.turnos for update to authenticated
  using (public.is_turno_member(id)) with check (public.is_turno_member(id));
drop policy if exists turnos_del on public.turnos;
create policy turnos_del on public.turnos for delete to authenticated
  using (created_by = auth.uid());

-- ---- turno_members ----
drop policy if exists tm_sel on public.turno_members;
create policy tm_sel on public.turno_members for select to authenticated
  using (public.is_turno_member(turno_id) or public.can_edit_family(family_id) or public.has_pending_invite(turno_id));
drop policy if exists tm_ins on public.turno_members;
create policy tm_ins on public.turno_members for insert to authenticated
  with check (
    public.can_edit_family(family_id)
    and (public.is_turno_member(turno_id) or public.has_pending_invite(turno_id) or public.is_turno_creator(turno_id))
  );
drop policy if exists tm_upd on public.turno_members;
create policy tm_upd on public.turno_members for update to authenticated
  using (public.can_edit_family(family_id)) with check (public.can_edit_family(family_id));
drop policy if exists tm_del on public.turno_members;
create policy tm_del on public.turno_members for delete to authenticated
  using (public.can_edit_family(family_id) or public.is_turno_creator(turno_id));

-- ---- turno_invites ----
drop policy if exists ti_sel on public.turno_invites;
create policy ti_sel on public.turno_invites for select to authenticated
  using (public.is_turno_member(turno_id) or lower(email) = public.my_email());
drop policy if exists ti_ins on public.turno_invites;            -- solo miembro con perfil completo
create policy ti_ins on public.turno_invites for insert to authenticated
  with check (public.is_turno_member(turno_id) and public.is_onboarded() and invited_by = auth.uid());
drop policy if exists ti_upd on public.turno_invites;
create policy ti_upd on public.turno_invites for update to authenticated
  using (public.is_turno_member(turno_id) or lower(email) = public.my_email())
  with check (public.is_turno_member(turno_id) or lower(email) = public.my_email());
drop policy if exists ti_del on public.turno_invites;
create policy ti_del on public.turno_invites for delete to authenticated
  using (public.is_turno_member(turno_id));

-- ---- turno_docs ----
drop policy if exists ts_all on public.turno_docs;
create policy ts_all on public.turno_docs for all to authenticated
  using (public.is_turno_member(turno_id)) with check (public.is_turno_member(turno_id));

-- ===================== GRANTS =====================
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.families, public.family_members, public.kids,
  public.addresses, public.contacts, public.turnos, public.turno_members,
  public.turno_invites, public.turno_docs
  to authenticated;
grant execute on all functions in schema public to authenticated;

-- ===================== REALTIME =====================
-- (la sincronización real usa el sondeo de 3s; realtime queda como bonus)
do $$ begin
  alter publication supabase_realtime add table public.turno_docs;
exception when duplicate_object then null; end $$;
