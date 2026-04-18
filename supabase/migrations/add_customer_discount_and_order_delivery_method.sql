-- =============================================================================
-- Migration: Add customer discount_percentage and order delivery_method
-- =============================================================================
-- Adds:
--   - customers.discount_percentage: default discount (%) applied over list price
--     when this customer buys. Defaults to 40% per business rule.
--   - orders.delivery_method: how the customer will receive the order
--     (cliente_recoge | envio_directo | envio_en_ruta).
-- =============================================================================

-- 1. Customer discount percentage (default 40%)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 40;

ALTER TABLE customers
  ADD CONSTRAINT customers_discount_percentage_range
  CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

-- 2. Order delivery method
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method TEXT
  CHECK (delivery_method IN ('cliente_recoge', 'envio_directo', 'envio_en_ruta'));
