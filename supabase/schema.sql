-- ============================================
-- Orkesta SaaS - Supabase Database Schema
-- ============================================
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TEAMS
-- ============================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  business_type TEXT NOT NULL CHECK (business_type IN ('retailer', 'servicios')),
  active_modules TEXT[] DEFAULT ARRAY['crm'],
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('gerente', 'vendedor', 'logistica')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger')),
  channel_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger')),
  channel_contact_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'closed')),
  is_ai_enabled BOOLEAN DEFAULT TRUE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'ai')),
  sender_id UUID,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI AGENTS
-- ============================================
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  model TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHANNEL ASSIGNMENTS
-- ============================================
CREATE TABLE channel_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger')),
  channel_identifier TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE BASES
-- ============================================
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  row_count INTEGER DEFAULT 0,
  is_queryable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE COLUMNS
-- ============================================
CREATE TABLE knowledge_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  column_name TEXT NOT NULL,
  description TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'text'
);

-- ============================================
-- TEAM INVITATIONS
-- ============================================
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('gerente', 'vendedor', 'logistica')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS (for Logistics module - future)
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'curioso' CHECK (status IN (
    'curioso', 'cotizando', 'pendiente_pago', 'pendiente_surtir',
    'pendiente_enviar', 'enviado', 'entregado', 'cancelado', 'requiere_atencion'
  )),
  total DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VEHICLES (for Logistics module - future)
-- ============================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  model TEXT,
  capacity TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DELIVERY ROUTES (for Logistics module - future)
-- ============================================
CREATE TABLE delivery_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'planned',
  scheduled_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROUTE STOPS (for Logistics module - future)
-- ============================================
CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  sequence INTEGER NOT NULL,
  address TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT
);

-- ============================================
-- WAREHOUSES (for Warehouse module - future)
-- ============================================
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS (for Warehouse module - future)
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12, 2),
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVENTORY (for Warehouse module - future)
-- ============================================
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER: get_my_team_id()
-- ============================================
-- SECURITY DEFINER bypasses RLS so this function can safely read the
-- profiles table without triggering the profiles RLS policies again.
-- This prevents infinite recursion when profiles or other tables need
-- to check the caller's team_id.
CREATE OR REPLACE FUNCTION get_my_team_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================
-- HELPER: get_my_role()
-- ============================================
-- Same pattern as get_my_team_id() — avoids recursion when checking role.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can view profiles of team members (uses helper to avoid recursion)
CREATE POLICY "Users can view team members" ON profiles
  FOR SELECT USING (
    team_id IS NOT NULL AND team_id = get_my_team_id()
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Authenticated users can insert their own profile row
-- (needed for client-side upsert during onboarding)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- Team members can view their team (uses helper to avoid recursion)
CREATE POLICY "Team members can view team" ON teams
  FOR SELECT USING (
    id = get_my_team_id()
  );

CREATE POLICY "Owner can update team" ON teams
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- ============================================
-- CUSTOMERS POLICIES (use get_my_team_id() to avoid recursion)
-- ============================================

CREATE POLICY "Team members can view customers" ON customers
  FOR SELECT USING (
    team_id = get_my_team_id()
  );

CREATE POLICY "Team members can insert customers" ON customers
  FOR INSERT WITH CHECK (
    team_id = get_my_team_id()
  );

CREATE POLICY "Team members can update customers" ON customers
  FOR UPDATE USING (
    team_id = get_my_team_id()
  );

CREATE POLICY "Gerente can delete customers" ON customers
  FOR DELETE USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- CONVERSATIONS POLICIES (use get_my_team_id() to avoid recursion)
-- ============================================

CREATE POLICY "Team members can view conversations" ON conversations
  FOR SELECT USING (
    team_id = get_my_team_id()
  );

CREATE POLICY "Team members can manage conversations" ON conversations
  FOR ALL USING (
    team_id = get_my_team_id()
  );

-- ============================================
-- MESSAGES POLICIES (use get_my_team_id() to avoid recursion)
-- ============================================

CREATE POLICY "Users can view messages" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE team_id = get_my_team_id()
    )
  );

CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE team_id = get_my_team_id()
    )
  );

-- ============================================
-- AI AGENTS POLICIES (use helpers to avoid recursion)
-- ============================================

CREATE POLICY "Team can view agents" ON ai_agents
  FOR SELECT USING (
    team_id = get_my_team_id()
  );

CREATE POLICY "Gerente can manage agents" ON ai_agents
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- CHANNEL ASSIGNMENTS POLICIES
-- ============================================

CREATE POLICY "Team can view assignments" ON channel_assignments
  FOR SELECT USING (
    team_id = get_my_team_id()
  );

CREATE POLICY "Gerente can manage assignments" ON channel_assignments
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- KNOWLEDGE BASES POLICIES
-- ============================================

CREATE POLICY "Team can view knowledge bases" ON knowledge_bases
  FOR SELECT USING (
    team_id = get_my_team_id()
  );

CREATE POLICY "Gerente can manage knowledge bases" ON knowledge_bases
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- KNOWLEDGE COLUMNS POLICIES
-- ============================================

CREATE POLICY "Users can view knowledge columns" ON knowledge_columns
  FOR SELECT USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE team_id = get_my_team_id()
    )
  );

CREATE POLICY "Gerente can manage knowledge columns" ON knowledge_columns
  FOR ALL USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE team_id = get_my_team_id()
    )
  );

-- ============================================
-- TEAM INVITATIONS POLICIES
-- ============================================

CREATE POLICY "Team can view invitations" ON team_invitations
  FOR SELECT USING (
    team_id = get_my_team_id()
  );

CREATE POLICY "Gerente can manage invitations" ON team_invitations
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- ORDERS POLICIES
-- ============================================

CREATE POLICY "Team members can view orders" ON orders
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Team members can manage orders" ON orders
  FOR ALL USING (team_id = get_my_team_id());

-- ============================================
-- VEHICLES POLICIES
-- ============================================

CREATE POLICY "Team members can view vehicles" ON vehicles
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage vehicles" ON vehicles
  FOR ALL USING (team_id = get_my_team_id() AND get_my_role() = 'gerente');

-- ============================================
-- DELIVERY ROUTES POLICIES
-- ============================================

CREATE POLICY "Team members can view routes" ON delivery_routes
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Team members can manage routes" ON delivery_routes
  FOR ALL USING (team_id = get_my_team_id());

-- ============================================
-- ROUTE STOPS POLICIES
-- ============================================

CREATE POLICY "Team members can view stops" ON route_stops
  FOR SELECT USING (
    route_id IN (SELECT id FROM delivery_routes WHERE team_id = get_my_team_id())
  );

CREATE POLICY "Team members can manage stops" ON route_stops
  FOR ALL USING (
    route_id IN (SELECT id FROM delivery_routes WHERE team_id = get_my_team_id())
  );

-- ============================================
-- WAREHOUSES POLICIES
-- ============================================

CREATE POLICY "Team members can view warehouses" ON warehouses
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage warehouses" ON warehouses
  FOR ALL USING (team_id = get_my_team_id() AND get_my_role() = 'gerente');

-- ============================================
-- PRODUCTS POLICIES
-- ============================================

CREATE POLICY "Team members can view products" ON products
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage products" ON products
  FOR ALL USING (team_id = get_my_team_id() AND get_my_role() = 'gerente');

-- ============================================
-- INVENTORY POLICIES
-- ============================================

CREATE POLICY "Team members can view inventory" ON inventory
  FOR SELECT USING (
    warehouse_id IN (SELECT id FROM warehouses WHERE team_id = get_my_team_id())
  );

CREATE POLICY "Team members can manage inventory" ON inventory
  FOR ALL USING (
    warehouse_id IN (SELECT id FROM warehouses WHERE team_id = get_my_team_id())
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    'gerente'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_profiles_team_id ON profiles(team_id);
CREATE INDEX idx_customers_team_id ON customers(team_id);
CREATE INDEX idx_conversations_team_id ON conversations(team_id);
CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_conversations_assigned_to ON conversations(assigned_to);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_ai_agents_team_id ON ai_agents(team_id);
CREATE INDEX idx_channel_assignments_team_id ON channel_assignments(team_id);
CREATE INDEX idx_knowledge_bases_team_id ON knowledge_bases(team_id);
CREATE INDEX idx_orders_team_id ON orders(team_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX idx_teams_invite_code ON teams(invite_code);

-- ============================================
-- RPC: look up a team by invite code
-- Runs with SECURITY DEFINER so unauthenticated/teamless users
-- can find a team to join without needing to satisfy the RLS
-- "Team members can view team" policy.
-- ============================================
CREATE OR REPLACE FUNCTION get_team_by_invite_code(p_invite_code TEXT)
RETURNS SETOF teams
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM teams WHERE invite_code = p_invite_code LIMIT 1;
$$;

-- Check if an email already has a registered account.
-- Uses SECURITY DEFINER so unauthenticated users can call it during registration.
CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
$$;
