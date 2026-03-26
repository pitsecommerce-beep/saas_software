-- ============================================
-- Orkesta SaaS - RLS Policy Fix Migration
-- ============================================
-- Run this in your Supabase SQL Editor to fix infinite recursion
-- errors and missing INSERT policies on an EXISTING database.
--
-- Root cause: RLS policies on customers, conversations, messages,
-- ai_agents, etc. used sub-SELECTs on the `profiles` table, which
-- triggered the profiles RLS policies again, causing infinite recursion.
--
-- Fix: All policies now use get_my_team_id() and get_my_role() helpers
-- which are SECURITY DEFINER and bypass RLS.
-- ============================================

-- ============================================
-- 1. Create/update helper functions
-- ============================================

CREATE OR REPLACE FUNCTION get_my_team_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT team_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================
-- 2. Fix PROFILES policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view team members" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Recreate with correct definitions
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view team members" ON profiles
  FOR SELECT USING (
    team_id IS NOT NULL AND team_id = get_my_team_id()
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- NEW: Allow authenticated users to insert their own profile row
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- 3. Fix TEAMS policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view team" ON teams;
DROP POLICY IF EXISTS "Owner can update team" ON teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON teams;

CREATE POLICY "Team members can view team" ON teams
  FOR SELECT USING (id = get_my_team_id());

CREATE POLICY "Owner can update team" ON teams
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- ============================================
-- 4. Fix CUSTOMERS policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view customers" ON customers;
DROP POLICY IF EXISTS "Team members can insert customers" ON customers;
DROP POLICY IF EXISTS "Team members can update customers" ON customers;
DROP POLICY IF EXISTS "Gerente can delete customers" ON customers;

CREATE POLICY "Team members can view customers" ON customers
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Team members can insert customers" ON customers
  FOR INSERT WITH CHECK (team_id = get_my_team_id());

CREATE POLICY "Team members can update customers" ON customers
  FOR UPDATE USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can delete customers" ON customers
  FOR DELETE USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- 5. Fix CONVERSATIONS policies
-- ============================================

DROP POLICY IF EXISTS "Team members can view conversations" ON conversations;
DROP POLICY IF EXISTS "Team members can manage conversations" ON conversations;

CREATE POLICY "Team members can view conversations" ON conversations
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Team members can manage conversations" ON conversations
  FOR ALL USING (team_id = get_my_team_id());

-- ============================================
-- 6. Fix MESSAGES policies
-- ============================================

DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

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
-- 7. Fix AI_AGENTS policies
-- ============================================

DROP POLICY IF EXISTS "Team can view agents" ON ai_agents;
DROP POLICY IF EXISTS "Gerente can manage agents" ON ai_agents;

CREATE POLICY "Team can view agents" ON ai_agents
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage agents" ON ai_agents
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- 8. Fix CHANNEL_ASSIGNMENTS policies
-- ============================================

DROP POLICY IF EXISTS "Team can view assignments" ON channel_assignments;
DROP POLICY IF EXISTS "Gerente can manage assignments" ON channel_assignments;

CREATE POLICY "Team can view assignments" ON channel_assignments
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage assignments" ON channel_assignments
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- 9. Fix KNOWLEDGE_BASES policies
-- ============================================

DROP POLICY IF EXISTS "Team can view knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Gerente can manage knowledge bases" ON knowledge_bases;

CREATE POLICY "Team can view knowledge bases" ON knowledge_bases
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage knowledge bases" ON knowledge_bases
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- 10. Fix KNOWLEDGE_COLUMNS policies
-- ============================================

DROP POLICY IF EXISTS "Users can view knowledge columns" ON knowledge_columns;
DROP POLICY IF EXISTS "Gerente can manage knowledge columns" ON knowledge_columns;

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
-- 11. Fix TEAM_INVITATIONS policies
-- ============================================

DROP POLICY IF EXISTS "Team can view invitations" ON team_invitations;
DROP POLICY IF EXISTS "Gerente can manage invitations" ON team_invitations;

CREATE POLICY "Team can view invitations" ON team_invitations
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage invitations" ON team_invitations
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

-- ============================================
-- 12. Ensure handle_new_user trigger exists
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role TEXT;
BEGIN
  -- Read role from user metadata; default to 'vendedor' if not provided or invalid.
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor');
  IF _role NOT IN ('gerente', 'vendedor', 'logistica') THEN
    _role := 'vendedor';
  END IF;

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
    _role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (safe to run multiple times)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 13. Ensure RPC functions exist
-- ============================================

CREATE OR REPLACE FUNCTION get_team_by_invite_code(p_invite_code TEXT)
RETURNS SETOF teams
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM teams WHERE invite_code = p_invite_code LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = p_email);
$$;
