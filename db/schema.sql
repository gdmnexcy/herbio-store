-- HERBIO commerce platform: one source of truth for the website, Mini App and product landings.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes BYTEA NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  price_kopecks INTEGER NOT NULL CHECK (price_kopecks >= 0),
  compare_at_kopecks INTEGER CHECK (compare_at_kopecks IS NULL OR compare_at_kopecks >= price_kopecks),
  image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hot BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  hero_title TEXT NOT NULL,
  hero_text TEXT NOT NULL DEFAULT '',
  hero_image_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  cta_label TEXT NOT NULL DEFAULT 'Купити',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS catalog_cta_label TEXT NOT NULL DEFAULT 'Переглянути каталог';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS benefit_1_title TEXT NOT NULL DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS benefit_1_text TEXT NOT NULL DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS benefit_2_title TEXT NOT NULL DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS benefit_2_text TEXT NOT NULL DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS benefit_3_title TEXT NOT NULL DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS benefit_3_text TEXT NOT NULL DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS upsell_product_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

CREATE TABLE IF NOT EXISTS landing_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN ('benefits', 'ingredients', 'how_to_use', 'faq', 'reviews', 'rich_text')),
  heading TEXT NOT NULL DEFAULT '',
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_pages (
  page_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meta credentials stay encrypted at rest. Their plaintext never travels to the browser.
CREATE TABLE IF NOT EXISTS meta_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_id UUID UNIQUE NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  pixel_id TEXT NOT NULL,
  capi_token_encrypted TEXT NOT NULL,
  event_names TEXT[] NOT NULL DEFAULT ARRAY['ViewContent','AddToCart','InitiateCheckout','Purchase'],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT UNIQUE,
  instagram_handle TEXT,
  email TEXT,
  phone TEXT,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  landing_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('web', 'telegram')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'paid', 'cancelled')),
  total_kopecks INTEGER NOT NULL CHECK (total_kopecks >= 0),
  currency TEXT NOT NULL DEFAULT 'UAH',
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, fbclid TEXT,
  meta_event_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_kopecks INTEGER NOT NULL CHECK (unit_price_kopecks >= 0),
  PRIMARY KEY(order_id, product_id)
);

CREATE INDEX IF NOT EXISTS orders_landing_created_idx ON orders(landing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS landing_blocks_position_idx ON landing_blocks(landing_id, position);


-- Customer authentication, verified identities, and loyalty state.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nova_poshta_branch TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_rate SMALLINT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique_idx ON customers (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_telegram_idx ON customers (telegram_user_id);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_token_idx ON auth_sessions(token_hash);
CREATE TABLE IF NOT EXISTS email_login_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_login_codes_email_idx ON email_login_codes(lower(email), created_at DESC);
CREATE TABLE IF NOT EXISTS telegram_login_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_login_requests_nonce_idx ON telegram_login_requests(nonce_hash);


INSERT INTO products (slug, name, category, short_description, format, note, price_kopecks) VALUES
  ('collagen-peptides', 'Колагенові пептиди', 'Краса', 'Підтримка щоденного ритуалу краси.', 'Порошок · 300 г', 'Нейтральний смак', 119000),
  ('spirulina', 'Спіруліна', 'Енергія', 'Рослинний комплекс на щодень.', 'Таблетки · 120 шт.', 'Рослинний комплекс', 79000),
  ('magnesium', 'Магній', 'Баланс', 'Комфортний формат для щоденного раціону.', 'Капсули · 90 шт.', 'Для щоденного раціону', 69000),
  ('peptide-complex', 'Пептидний комплекс', 'Догляд', 'Нова формула для цілісного ритуалу.', 'Капсули · 60 шт.', 'Нова формула', 149000)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO content_pages (page_key, title, content) VALUES
('home', 'Головна', '{"eyebrow":"НАТУРАЛЬНИЙ WELLNESS","headline":"Підтримка, що стає ритуалом.","lead":"Усвідомлені формули для краси, енергії та балансу — без зайвого шуму.","cta":"Обрати свій ритуал"}'::jsonb),
('about', 'Про HERBIO', '{"eyebrow":"ПРО HERBIO","headline":"Здоров’я та краса — щодня","lead":"Wellness-добавки для тих, хто обирає уважне ставлення до себе та своїх щоденних ритуалів."}'::jsonb),
('delivery', 'Доставка', '{"eyebrow":"ДОСТАВКА HERBIO","headline":"Дбайливо до ваших дверей","lead":"Безкоштовна доставка для замовлень від 2 000 ₴."}'::jsonb),
('policy', 'Політика', '{"eyebrow":"ПОЛІТИКА КОНФІДЕНЦІЙНОСТІ","headline":"Ваші дані — під захистом","lead":"Ми дбайливо ставимося до інформації, яку ви залишаєте під час замовлення."}'::jsonb)
ON CONFLICT (page_key) DO NOTHING;
INSERT INTO landing_pages (slug, product_id, title, meta_title, hero_title, hero_text, cta_label, catalog_cta_label, status, published_at)
SELECT 'spirulina', id, 'Спіруліна', 'Спіруліна | HERBIO', 'Спіруліна для вашого щоденного ритму', 'Рослинний комплекс у зручному форматі на щодень.', 'Купити', 'Переглянути каталог', 'published', now()
FROM products WHERE slug='spirulina'
ON CONFLICT (slug) DO UPDATE SET status='published', published_at=COALESCE(landing_pages.published_at, now());


-- Configurable Mini / Standart / Maxi packs per product.
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id TEXT NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label TEXT NOT NULL DEFAULT '';
DO $$ BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_pkey;
  ALTER TABLE order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (order_id, product_id, variant_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
