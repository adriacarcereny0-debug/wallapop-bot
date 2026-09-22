-- ============================================================================
-- Wallapop Assistant — esquema inicial
--
-- Principios:
--   1. Aislamiento multicuenta: toda fila de una cuenta lleva user_id Y account_id.
--   2. RLS activado en TODAS las tablas, sin excepción.
--   3. El dinero se guarda en céntimos (integer). Nunca float.
--   4. Los tokens OAuth se guardan cifrados (AES-256-GCM en la capa de aplicación),
--      jamás en texto plano. Las contraseñas de Wallapop NO se guardan nunca.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Tipos ───────────────────────────────────────────────────────────────────
create type account_status   as enum ('demo', 'connected', 'needs_attention', 'disconnected');
create type product_condition as enum ('new', 'like_new', 'very_good', 'good', 'acceptable', 'for_parts');
create type listing_status   as enum ('draft', 'pending_review', 'active', 'reserved', 'sold', 'archived', 'needs_attention');
create type conversation_status as enum ('pending', 'negotiating', 'closed', 'archived');
create type conversation_priority as enum ('low', 'normal', 'high');
create type message_role     as enum ('buyer', 'seller', 'assistant');
create type sale_status      as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type sale_method      as enum ('shipping', 'in_person', 'other');
create type image_kind       as enum ('original', 'enhanced');

-- ── users: perfil propio, espejo de auth.users ──────────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  display_name text,
  created_at  timestamptz not null default now()
);

-- ── accounts: cuentas de Wallapop gestionadas por el usuario ────────────────
create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,
  slug          text not null,
  status        account_status not null default 'disconnected',
  last_synced_at timestamptz,
  attention_reason text,

  -- Credenciales OAuth de Wallapop Connect.
  -- SIEMPRE cifradas por la aplicación antes de escribirse aquí.
  -- NUNCA se almacena la contraseña de Wallapop del usuario.
  oauth_access_token_encrypted  text,
  oauth_refresh_token_encrypted text,
  oauth_expires_at              timestamptz,

  created_at    timestamptz not null default now(),
  unique (user_id, slug)
);

-- ── products: catálogo central, a nivel de usuario ──────────────────────────
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,
  brand         text,
  model         text,
  category      text not null,
  subcategory   text,
  condition     product_condition not null default 'good',
  purchase_price_cents integer check (purchase_price_cents >= 0),
  target_price_cents   integer check (target_price_cents >= 0),
  min_price_cents      integer check (min_price_cents >= 0),
  sale_price_cents     integer check (sale_price_cents >= 0),
  internal_description text,
  public_description   text,
  features      jsonb not null default '{}'::jsonb,
  sku           text not null,
  stock         integer not null default 1 check (stock >= 0),
  internal_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, sku)
);

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,          -- object storage / CDN, nunca binario en BD
  kind        image_kind not null default 'original',
  alt         text not null default '',
  transformation text,                -- trazabilidad de la edición por IA
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── listings: anuncios, siempre ligados a UNA cuenta ────────────────────────
create table public.listings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  account_id    uuid not null references public.accounts(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  price_cents   integer not null check (price_cents >= 0),
  status        listing_status not null default 'draft',
  category_leaf_id text,              -- category_leaf_id de Wallapop
  external_item_id text,              -- id del item en Wallapop tras publicar
  hashtags      text[] not null default '{}',
  attention_reason text,
  last_optimized_at timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (account_id, external_item_id)
);

create table public.listing_images (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  image_id   uuid not null references public.product_images(id) on delete cascade,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── conversations: modo asistente (Wallapop no ofrece API de chat) ──────────
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  listing_id  uuid references public.listings(id) on delete set null,
  buyer_alias text not null,          -- alias, no datos personales del comprador
  status      conversation_status not null default 'pending',
  priority    conversation_priority not null default 'normal',
  last_offer_cents integer check (last_offer_cents >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            message_role not null,
  body            text not null,
  used            boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ── sales ───────────────────────────────────────────────────────────────────
create table public.sales (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  listing_id  uuid references public.listings(id) on delete set null,
  buyer_alias text,
  price_cents integer not null check (price_cents >= 0),
  status      sale_status not null default 'pending',
  method      sale_method not null default 'shipping',
  notes       text,
  sold_at     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ── ai_generations: trazabilidad y control de coste de IA ───────────────────
create table public.ai_generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  account_id  uuid references public.accounts(id) on delete set null,
  fn          text not null,          -- generateListing, generateReply, ...
  provider    text not null,
  model       text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_cents  integer not null default 0,
  ok          boolean not null default true,
  error       text,
  created_at  timestamptz not null default now()
);

-- ── tasks: acciones preparadas pendientes de aprobación humana ──────────────
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  kind        text not null,
  subject_id  uuid not null,
  summary     text not null,
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ── activity_logs ───────────────────────────────────────────────────────────
create table public.activity_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  kind       text not null,
  message    text not null,
  created_at timestamptz not null default now()
);

-- ── settings ────────────────────────────────────────────────────────────────
create table public.settings (
  user_id    uuid primary key references public.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Índices ─────────────────────────────────────────────────────────────────
create index on public.accounts       (user_id);
create index on public.products       (user_id, created_at desc);
create index on public.product_images (product_id, position);
create index on public.listings       (user_id, account_id, status);
create index on public.listings       (account_id, updated_at desc);
create index on public.listing_images (listing_id, position);
create index on public.conversations  (user_id, account_id, status);
create index on public.messages       (conversation_id, created_at);
create index on public.sales          (user_id, account_id, sold_at desc);
create index on public.ai_generations  (user_id, created_at desc);
create index on public.tasks           (user_id, account_id) where approved_at is null;
create index on public.activity_logs   (user_id, created_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY
--
-- Cada tabla sólo deja ver y tocar filas cuyo user_id sea el del usuario
-- autenticado. El aislamiento entre cuentas del MISMO usuario se garantiza
-- además en la capa de aplicación mediante el filtro account_id obligatorio.
-- ============================================================================

alter table public.users           enable row level security;
alter table public.accounts        enable row level security;
alter table public.products        enable row level security;
alter table public.product_images  enable row level security;
alter table public.listings        enable row level security;
alter table public.listing_images  enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.sales           enable row level security;
alter table public.ai_generations  enable row level security;
alter table public.tasks           enable row level security;
alter table public.activity_logs   enable row level security;
alter table public.settings        enable row level security;

-- users: el usuario sólo se ve a sí mismo.
create policy users_select on public.users for select using (auth.uid() = id);
create policy users_update on public.users for update using (auth.uid() = id) with check (auth.uid() = id);

-- Política uniforme para el resto de tablas: user_id = auth.uid().
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'products', 'product_images', 'listings', 'listing_images',
    'conversations', 'messages', 'sales', 'ai_generations', 'tasks',
    'activity_logs', 'settings'
  ]
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (auth.uid() = user_id);', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert with check (auth.uid() = user_id);', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ── Trigger: crear perfil al registrarse ────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Trigger: mantener updated_at ────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger products_touch      before update on public.products      for each row execute function public.touch_updated_at();
create trigger listings_touch      before update on public.listings      for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations for each row execute function public.touch_updated_at();

-- ============================================================================
-- ALMACENAMIENTO DE IMÁGENES
--
-- Las fotos viven en Supabase Storage, nunca en la base de datos: en las tablas
-- sólo se guarda la URL.
--
-- El bucket es PÚBLICO EN LECTURA a propósito. Al publicar un anuncio,
-- `POST /items` de Wallapop recibe una URL de imagen y es Wallapop quien la
-- descarga: si el fichero exigiera autenticación, la publicación fallaría. Las
-- rutas llevan un UUID aleatorio, así que no son adivinables.
--
-- La escritura sí está restringida: cada usuario sólo puede escribir dentro de
-- su propia carpeta, que es el primer segmento de la ruta (`<user_id>/...`).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product_images_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "product_images_update"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "product_images_delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
