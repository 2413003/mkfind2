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
  seen_at timestamptz not null default now()
);
```

Enable read policy (public):

```sql
alter table public.reports enable row level security;

create policy "public read reports"
on public.reports
for select
to anon
using (true);
```

Then set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `app.js`.

## 2) GitHub Pages

- Push this folder to a GitHub repo.
- In repo settings, enable **Pages**.
- Source: Deploy from branch.
- Branch: `main` (root).

Done.
