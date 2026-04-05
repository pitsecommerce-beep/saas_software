-- =============================================================================
-- Migration: Add order_items table and enabled_tools to ai_agents
-- =============================================================================

-- 1. Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  knowledge_row_id UUID REFERENCES knowledge_rows(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by order
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 2. Add enabled_tools column to ai_agents
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS enabled_tools TEXT[] DEFAULT '{}';

-- 3. Enable RLS on order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for order_items (same pattern as orders: team-scoped)
CREATE POLICY "Team members can view order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.team_id = o.team_id
      WHERE o.id = order_items.order_id
        AND p.id = auth.uid()
    )
  );

CREATE POLICY "Team gerentes can manage order items"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.team_id = o.team_id
      WHERE o.id = order_items.order_id
        AND p.id = auth.uid()
        AND p.role = 'gerente'
    )
  );

-- Allow service role (backend) to insert order_items without RLS restrictions
-- The server uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS automatically
