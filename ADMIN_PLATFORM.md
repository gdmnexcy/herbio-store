# HERBIO Admin Platform

## What the platform manages

- Products, prices in UAH, categories, stock status, descriptions and product images.
- Landing pages on `/l/<slug>` with a chosen product, hero image, editable copy and reusable blocks.
- Per-landing Meta Pixel ID and Conversions API token.
- Website and Telegram Mini App orders in one database.

## Meta event model

Each landing sends browser events using its own Pixel ID:

1. `ViewContent` when the landing opens.
2. `AddToCart` when the product is added.
3. `InitiateCheckout` when checkout is opened.
4. `Purchase` only after an order is successfully created.

The server sends the same `Purchase` through the Conversions API using the same `event_id`; Meta can deduplicate browser and server copies. The CAPI token is encrypted with `META_ENCRYPTION_KEY` and never returned by the admin API.

## Required Railway variables

- `DATABASE_URL` — Railway PostgreSQL connection string.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` — initial administrator.
- `META_ENCRYPTION_KEY` — 32-byte base64 key for server-side CAPI token encryption.
- `TELEGRAM_BOT_TOKEN` — only used by the server to verify Mini App init data.

## Deployment order

1. Provision PostgreSQL in the Railway project.
2. Apply `db/schema.sql` once.
3. Add the required environment variables.
4. Deploy the admin-enabled application.
5. Create products and then product landings from the admin panel.
