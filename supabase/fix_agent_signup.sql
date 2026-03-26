-- ============================================
-- Fix: Agent (vendedor) signup failing with 500
-- ============================================
-- Run this in your Supabase SQL Editor.
--
-- Changes:
-- 1. handle_new_user() now reads role from user metadata instead of
--    hardcoding 'gerente'.
-- 2. Uses EXCEPTION handler so the trigger never aborts the signup
--    transaction (the app creates the profile row as fallback).
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role TEXT;
BEGIN
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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
