import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  const missing = [
    !supabaseUrl && 'SUPABASE_URL',
    !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean).join(', ');
  console.error(`=== CONFIGURATION ERROR ===`);
  console.error(`Missing environment variables: ${missing}`);
  console.error(`Set these in Railway Dashboard > your backend service > Variables`);
  console.error(`Get them from Supabase Dashboard > Settings > API`);
  console.error(`===========================`);
}

// Use the service role key for full DB access (bypasses RLS)
// Will be null if env vars are missing — server starts but webhook returns errors
const client: SupabaseClient | null =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export const isConfigured = !!client;

// Non-null accessor — only call after checking isConfigured
export const supabase = client as SupabaseClient;
