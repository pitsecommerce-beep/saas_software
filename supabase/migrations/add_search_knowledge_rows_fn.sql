-- Function to search knowledge rows by keywords within JSONB data.
-- Filters happen in Postgres so we never transfer 25k+ rows to the server.
CREATE OR REPLACE FUNCTION search_knowledge_rows(
  kb_ids UUID[],
  search_keywords TEXT[],
  max_per_kb INT DEFAULT 10
)
RETURNS TABLE(knowledge_base_id UUID, row_data JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  -- If no keywords provided, return nothing (schema-only mode)
  IF search_keywords IS NULL OR array_length(search_keywords, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT sub.knowledge_base_id, sub.row_data
  FROM (
    SELECT
      kr.knowledge_base_id,
      kr.row_data,
      ROW_NUMBER() OVER (PARTITION BY kr.knowledge_base_id ORDER BY kr.id) AS rn
    FROM knowledge_rows kr
    WHERE kr.knowledge_base_id = ANY(kb_ids)
      AND EXISTS (
        SELECT 1
        FROM unnest(search_keywords) AS kw
        WHERE unaccent(lower(kr.row_data::text)) LIKE '%' || unaccent(lower(kw)) || '%'
      )
  ) sub
  WHERE sub.rn <= max_per_kb;
END;
$$;

-- Enable unaccent extension for accent-insensitive matching
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Index to speed up the cast-to-text search on large tables
CREATE INDEX IF NOT EXISTS idx_knowledge_rows_kb_id
  ON knowledge_rows(knowledge_base_id);
