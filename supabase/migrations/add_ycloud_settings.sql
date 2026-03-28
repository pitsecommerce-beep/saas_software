-- ============================================
-- YCLOUD SETTINGS (per-team yCloud configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS ycloud_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  api_key_encrypted TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  webhook_token TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ycloud_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view ycloud settings" ON ycloud_settings
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage ycloud settings" ON ycloud_settings
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

CREATE INDEX idx_ycloud_settings_team_id ON ycloud_settings(team_id);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_ycloud_settings_updated_at
  BEFORE UPDATE ON ycloud_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
