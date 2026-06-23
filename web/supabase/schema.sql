create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.slim_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  nickname text,
  avatar_url text,
  locale text check (locale in ('en', 'zh')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slim_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.slim_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.slim_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.slim_groups(id) on delete cascade,
  user_id uuid not null references public.slim_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  base_weight_kg numeric(5, 1),
  base_date date,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.slim_weight_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.slim_group_members(id) on delete cascade,
  recorded_on date not null,
  weight_kg numeric(5, 1) not null check (weight_kg between 20 and 400),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, recorded_on)
);

create index if not exists slim_groups_invite_code_idx on public.slim_groups(invite_code);
create index if not exists slim_group_members_user_id_idx on public.slim_group_members(user_id);
create index if not exists slim_group_members_group_id_idx on public.slim_group_members(group_id);
create index if not exists slim_weight_logs_member_date_idx on public.slim_weight_logs(member_id, recorded_on);

drop trigger if exists slim_profiles_set_updated_at on public.slim_profiles;
create trigger slim_profiles_set_updated_at
before update on public.slim_profiles
for each row execute function public.set_updated_at();

drop trigger if exists slim_groups_set_updated_at on public.slim_groups;
create trigger slim_groups_set_updated_at
before update on public.slim_groups
for each row execute function public.set_updated_at();

drop trigger if exists slim_group_members_set_updated_at on public.slim_group_members;
create trigger slim_group_members_set_updated_at
before update on public.slim_group_members
for each row execute function public.set_updated_at();

drop trigger if exists slim_weight_logs_set_updated_at on public.slim_weight_logs;
create trigger slim_weight_logs_set_updated_at
before update on public.slim_weight_logs
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.slim_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.slim_profiles enable row level security;
alter table public.slim_groups enable row level security;
alter table public.slim_group_members enable row level security;
alter table public.slim_weight_logs enable row level security;

drop policy if exists "slim_profiles_select_own" on public.slim_profiles;
create policy "slim_profiles_select_own"
on public.slim_profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "slim_profiles_update_own" on public.slim_profiles;
create policy "slim_profiles_update_own"
on public.slim_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "slim_profiles_insert_own" on public.slim_profiles;
create policy "slim_profiles_insert_own"
on public.slim_profiles
for insert
to authenticated
with check (auth.uid() = id);

-- Groups, memberships, and weight logs intentionally have no direct browser policies.
-- The Next.js API uses the Supabase service role and returns only privacy-safe data:
-- other members' deltas, never their actual base or current weights.
