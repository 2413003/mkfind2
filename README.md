next instruction:
i meant filters & sorting hidden until someone clicks on filter / sort. don't show them until someone clicks to see them




# MK Find

Minimal lost-and-found web app for Milton Keynes.

## 1) Supabase

Run this in Supabase SQL editor (single script, project-unique names):

```sql
begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mk_find_hubwwdbecarttljomhpn_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('item', 'pet', 'person')),
  post_type text not null default 'lost' check (post_type in ('lost', 'found')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  title text not null,
  detail text,
  lat double precision not null,
  lng double precision not null,
  seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  short_code text,
  address text,
  media_urls text[] not null default '{}'
);

alter table public.mk_find_hubwwdbecarttljomhpn_reports
  add column if not exists address text;

alter table public.mk_find_hubwwdbecarttljomhpn_reports
  add column if not exists media_urls text[] not null default '{}';

alter table public.mk_find_hubwwdbecarttljomhpn_reports
  add column if not exists post_type text not null default 'lost';

alter table public.mk_find_hubwwdbecarttljomhpn_reports
  add column if not exists status text not null default 'open';

alter table public.mk_find_hubwwdbecarttljomhpn_reports
  add column if not exists resolved_at timestamptz;

alter table public.mk_find_hubwwdbecarttljomhpn_reports
  add column if not exists short_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mk_find_hubwwdbecarttljomhpn_reports_post_type_check'
  ) then
    alter table public.mk_find_hubwwdbecarttljomhpn_reports
      add constraint mk_find_hubwwdbecarttljomhpn_reports_post_type_check
      check (post_type in ('lost', 'found'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mk_find_hubwwdbecarttljomhpn_reports_status_check'
  ) then
    alter table public.mk_find_hubwwdbecarttljomhpn_reports
      add constraint mk_find_hubwwdbecarttljomhpn_reports_status_check
      check (status in ('open', 'resolved'));
  end if;
end $$;

create unique index if not exists mk_find_hubwwdbecarttljomhpn_reports_short_code_uidx
  on public.mk_find_hubwwdbecarttljomhpn_reports (short_code)
  where short_code is not null;

alter table public.mk_find_hubwwdbecarttljomhpn_reports enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mk_find_hubwwdbecarttljomhpn_reports'
      and policyname = 'mk_find_hubwwdbecarttljomhpn_reports_public_read'
  ) then
    create policy "mk_find_hubwwdbecarttljomhpn_reports_public_read"
      on public.mk_find_hubwwdbecarttljomhpn_reports
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mk_find_hubwwdbecarttljomhpn_reports'
      and policyname = 'mk_find_hubwwdbecarttljomhpn_reports_public_insert'
  ) then
    create policy "mk_find_hubwwdbecarttljomhpn_reports_public_insert"
      on public.mk_find_hubwwdbecarttljomhpn_reports
      for insert
      to anon
      with check (true);
  end if;
end $$;

create table if not exists public.mk_find_hubwwdbecarttljomhpn_listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.mk_find_hubwwdbecarttljomhpn_reports(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.mk_find_hubwwdbecarttljomhpn_listing_reports enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mk_find_hubwwdbecarttljomhpn_listing_reports'
      and policyname = 'mk_find_hubwwdbecarttljomhpn_listing_reports_public_insert'
  ) then
    create policy "mk_find_hubwwdbecarttljomhpn_listing_reports_public_insert"
      on public.mk_find_hubwwdbecarttljomhpn_listing_reports
      for insert
      to anon
      with check (true);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values (
  'mk-find-hubwwdbecarttljomhpn-media',
  'mk-find-hubwwdbecarttljomhpn-media',
  true
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'mk_find_hubwwdbecarttljomhpn_media_public_upload'
  ) then
    create policy "mk_find_hubwwdbecarttljomhpn_media_public_upload"
      on storage.objects
      for insert
      to anon
      with check (bucket_id = 'mk-find-hubwwdbecarttljomhpn-media');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'mk_find_hubwwdbecarttljomhpn_media_public_read'
  ) then
    create policy "mk_find_hubwwdbecarttljomhpn_media_public_read"
      on storage.objects
      for select
      to anon
      using (bucket_id = 'mk-find-hubwwdbecarttljomhpn-media');
  end if;
end $$;

commit;
```

`app.js` is already configured for:
- URL: `https://hubwwdbecarttljomhpn.supabase.co`
- table: `mk_find_hubwwdbecarttljomhpn_reports`
- bucket: `mk-find-hubwwdbecarttljomhpn-media`

## 2) GitHub Pages

- Push this folder to a GitHub repo.
- In repo settings, enable **Pages**.
- Source: Deploy from branch.
- Branch: `main` (root).

Done.
