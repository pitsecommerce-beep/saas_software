CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'stripe')),
  api_key_encrypted TEXT NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view payment settings" ON payment_settings
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Gerente can manage payment settings" ON payment_settings
  FOR ALL USING (
    team_id = get_my_team_id() AND get_my_role() = 'gerente'
  );

CREATE INDEX idx_payment_settings_team_id ON payment_settings(team_id);
