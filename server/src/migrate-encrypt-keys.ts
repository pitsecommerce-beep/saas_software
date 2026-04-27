import { createClient } from '@supabase/supabase-js';
import { encrypt } from './crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function isEncrypted(value: string): boolean {
  return (value.match(/:/g) ?? []).length === 2;
}

async function main() {
  // --- ai_agents ---
  const { data: agents, error: agentsErr } = await supabase
    .from('ai_agents')
    .select('id, api_key_encrypted');

  if (agentsErr) {
    console.error('Error reading ai_agents:', agentsErr.message);
    process.exit(1);
  }

  let agentsEncrypted = 0;
  const agentsTotal = agents?.length ?? 0;

  for (const agent of agents ?? []) {
    if (!agent.api_key_encrypted || isEncrypted(agent.api_key_encrypted)) continue;

    const { error } = await supabase
      .from('ai_agents')
      .update({ api_key_encrypted: encrypt(agent.api_key_encrypted) })
      .eq('id', agent.id);

    if (error) {
      console.error(`Error updating ai_agents id=${agent.id}:`, error.message);
    } else {
      agentsEncrypted++;
    }
  }

  // --- payment_settings ---
  const { data: payments, error: paymentsErr } = await supabase
    .from('payment_settings')
    .select('id, api_key_encrypted, webhook_secret');

  if (paymentsErr) {
    console.error('Error reading payment_settings:', paymentsErr.message);
    process.exit(1);
  }

  let paymentsEncrypted = 0;
  const paymentsTotal = payments?.length ?? 0;

  for (const payment of payments ?? []) {
    const updates: Record<string, string> = {};

    if (payment.api_key_encrypted && !isEncrypted(payment.api_key_encrypted)) {
      updates.api_key_encrypted = encrypt(payment.api_key_encrypted);
    }
    if (payment.webhook_secret && !isEncrypted(payment.webhook_secret)) {
      updates.webhook_secret = encrypt(payment.webhook_secret);
    }

    if (Object.keys(updates).length === 0) continue;

    const { error } = await supabase
      .from('payment_settings')
      .update(updates)
      .eq('id', payment.id);

    if (error) {
      console.error(`Error updating payment_settings id=${payment.id}:`, error.message);
    } else {
      paymentsEncrypted++;
    }
  }

  console.log(
    `Encriptadas ${agentsEncrypted} de ${agentsTotal} keys en ai_agents, ` +
      `${paymentsEncrypted} de ${paymentsTotal} keys en payment_settings`
  );
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
