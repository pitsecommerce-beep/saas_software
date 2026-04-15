CREATE TABLE IF NOT EXISTS branding_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  app_name TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view branding settings" ON branding_settings
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage branding settings" ON branding_settings
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

CREATE INDEX idx_branding_settings_team_id ON branding_settings(team_id);
