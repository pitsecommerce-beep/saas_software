-- =============================================================================
-- Migration: Add seller tracking to orders and extend payment settings
-- =============================================================================
--
-- 1) orders.seller_id — references the profile (vendedor/gerente) who created
--    the order when it is entered manually from the UI. Nullable to preserve
--    historical rows and orders created by the AI agent.
--
-- 2) payment_settings — adds optional fields so Mercado Pago and Stripe
--    integrations can be wired end-to-end without code changes:
--      - public_key          : MP public key (Checkout Bricks) / Stripe publishable
--      - success_url         : redirect after successful payment
--      - cancel_url          : redirect after cancelled payment
--      - webhook_secret      : Stripe signing secret / MP notification secret
--      - statement_descriptor: shown on the customer's statement
--      - currency            : ISO-4217 currency (defaults to MXN)
--
-- Using ADD COLUMN IF NOT EXISTS so the migration is idempotent.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);

ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS public_key TEXT,
  ADD COLUMN IF NOT EXISTS success_url TEXT,
  ADD COLUMN IF NOT EXISTS cancel_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS statement_descriptor TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MXN';
