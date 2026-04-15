-- =============================================================================
-- Migration: Add search_order_by_id RPC for partial UUID lookup
-- =============================================================================
--
-- PostgREST's .or() filter does not parse UUID values with dashes well, and
-- the `id` column is of type UUID, so it cannot be used with ILIKE directly.
-- This function casts id to text and performs a prefix match scoped by team.

CREATE OR REPLACE FUNCTION search_order_by_id(p_query TEXT, p_team_id UUID)
RETURNS SETOF orders
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT *
  FROM orders
  WHERE team_id = p_team_id
    AND id::text ILIKE p_query || '%'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION search_order_by_id(TEXT, UUID) TO authenticated, service_role;
