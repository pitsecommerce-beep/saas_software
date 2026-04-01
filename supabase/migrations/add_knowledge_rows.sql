-- Migration: Add knowledge_rows table to store actual Excel data
-- Run this in your Supabase SQL Editor

-- ============================================
-- KNOWLEDGE ROWS (stores actual Excel row data)
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  row_data JSONB NOT NULL
);

-- Index for fast lookups by knowledge_base_id
CREATE INDEX IF NOT EXISTS idx_knowledge_rows_kb_id ON knowledge_rows(knowledge_base_id);

-- Enable RLS
ALTER TABLE knowledge_rows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view knowledge rows" ON knowledge_rows
  FOR SELECT USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE team_id = get_my_team_id()
    )
  );

CREATE POLICY "Gerente can manage knowledge rows" ON knowledge_rows
  FOR ALL USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE team_id = get_my_team_id()
    )
  );
