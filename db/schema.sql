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
