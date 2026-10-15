-- Pigeon : base de données Supabase
-- À coller en entier dans Supabase > SQL Editor > New query, puis "Run".

-- 1. Profils (un par compte, créé automatiquement à l'inscription)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,20}$'),
  hue int not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text := lower(new.raw_user_meta_data ->> 'username');
begin
  insert into public.profiles (id, username, hue)
  values (new.id, uname, abs(hashtext(uname)) % 360);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Salons
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 24),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Messages
create table public.messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index messages_room_created_idx on public.messages (room_id, created_at desc);

-- 4. Règles d'accès : seules les personnes connectées lisent et écrivent,
--    et chacun ne peut supprimer que ses propres messages.
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.messages enable row level security;

create policy "profiles lisibles par les connectés"
  on public.profiles for select to authenticated using (true);

create policy "salons lisibles par les connectés"
  on public.rooms for select to authenticated using (true);
create policy "salons créés par les connectés"
  on public.rooms for insert to authenticated with check (created_by = auth.uid());

create policy "messages lisibles par les connectés"
  on public.messages for select to authenticated using (true);
create policy "messages écrits par leur auteur"
  on public.messages for insert to authenticated with check (user_id = auth.uid());
create policy "messages supprimés par leur auteur"
  on public.messages for delete to authenticated using (user_id = auth.uid());

-- 5. Messages en direct
alter publication supabase_realtime add table public.messages, public.rooms;

-- 6. Deux salons de départ
insert into public.rooms (name) values ('Général'), ('Aléatoire');
