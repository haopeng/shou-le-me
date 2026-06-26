create table if not exists public.slim_group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.slim_groups(id) on delete cascade,
  requester_user_id uuid not null references public.slim_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  message text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.slim_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (group_id, requester_user_id)
);

create index if not exists slim_group_join_requests_group_status_idx
on public.slim_group_join_requests(group_id, status, requested_at desc);

create index if not exists slim_group_join_requests_requester_idx
on public.slim_group_join_requests(requester_user_id);

drop trigger if exists slim_group_join_requests_set_updated_at on public.slim_group_join_requests;
create trigger slim_group_join_requests_set_updated_at
before update on public.slim_group_join_requests
for each row execute function public.set_updated_at();

alter table public.slim_group_join_requests enable row level security;
