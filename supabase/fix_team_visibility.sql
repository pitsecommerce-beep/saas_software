-- ============================================
-- Fix: Team visibility & invite code regeneration
-- ============================================
-- Run this in your Supabase SQL Editor.
--
-- IMPORTANT: The team relationship is based on profiles.team_id (UUID FK),
-- NOT on the invite_code. Changing the invite_code is safe and will NOT
-- break existing team memberships. The invite_code is only used as a
-- lookup key when new members join.
--
-- This migration adds an RPC function so the gerente can safely regenerate
-- the invite code from the frontend. It also ensures the RLS policies
-- allow team members to see each other's profiles.

-- ============================================
-- 1. RPC: update_team_invite_code
-- ============================================
-- Only the team owner can update the invite code.
-- Returns the updated team row so the frontend can read the new code.
CREATE OR REPLACE FUNCTION update_team_invite_code(p_team_id UUID, p_new_code TEXT)
RETURNS SETOF teams
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is the team owner
  IF NOT EXISTS (
    SELECT 1 FROM teams WHERE id = p_team_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Solo el dueño del equipo puede cambiar el código de invitación';
  END IF;

  UPDATE teams SET invite_code = p_new_code WHERE id = p_team_id;
  RETURN QUERY SELECT * FROM teams WHERE id = p_team_id;
END;
$$;

-- ============================================
-- 2. Verify RLS policies for team member visibility
-- ============================================
-- These should already exist from schema.sql, but re-create if missing.
-- The key policy: team members can see other members' profiles via get_my_team_id().

-- Drop and recreate to avoid "already exists" errors
DO $$
BEGIN
  -- Check if the policy exists before dropping
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view team members'
  ) THEN
    DROP POLICY "Users can view team members" ON profiles;
  END IF;
END $$;

CREATE POLICY "Users can view team members" ON profiles
  FOR SELECT USING (
    team_id IS NOT NULL AND team_id = get_my_team_id()
  );

-- Ensure profiles RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
