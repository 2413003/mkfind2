# MK Find

Minimal lost-and-found web app for Milton Keynes.

## 1) Supabase

Create table:

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('item', 'pet', 'person')),
  title text not null,
  detail text,
  lat double precision not null,
  lng double precision not null,
  seen_at timestamptz not null default now(),
  address text,
  media_urls text[] default '{}'
);
```

Enable policies (public read + anon insert):

```sql
alter table public.reports enable row level security;

create policy "public read reports"
on public.reports
for select
to anon
using (true);

create policy "public add reports"
on public.reports
for insert
to anon
with check (true);
```

Create public storage bucket for photos/videos:

```sql
insert into storage.buckets (id, name, public)
values ('report-media', 'report-media', true)
on conflict (id) do nothing;

create policy "public upload report media"
on storage.objects
for insert
to anon
with check (bucket_id = 'report-media');

create policy "public read report media"
on storage.objects
for select
to anon
using (bucket_id = 'report-media');
```

Then set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `app.js`.

## 2) GitHub Pages

- Push this folder to a GitHub repo.
- In repo settings, enable **Pages**.
- Source: Deploy from branch.
- Branch: `main` (root).

Done.
