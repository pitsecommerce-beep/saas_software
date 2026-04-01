import express from 'express';
import cors from 'cors';
import { handleYCloudWebhook } from './webhook';
import { handleSendMessage } from './outbound';
import { isConfigured } from './supabase';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend requests
app.use(cors());

// YCloud sends JSON payloads
app.use(express.json());

// Health check — always responds 200 so Railway doesn't kill the container
app.get('/', (_req, res) => {
  const missingVars = [
    !process.env.SUPABASE_URL && 'SUPABASE_URL',
    !process.env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    !process.env.YCLOUD_API_KEY && 'YCLOUD_API_KEY',
  ].filter(Boolean);

  res.json({
    status: isConfigured ? 'ok' : 'misconfigured',
    service: 'orkesta-webhook-server',
    ...(missingVars.length > 0 && { missingEnvVars: missingVars }),
  });
});

// YCloud webhook endpoint
app.post('/api/webhooks/ycloud', handleYCloudWebhook);

// Outbound message endpoint — send messages from UI to customer via YCloud
app.post('/api/messages/send', handleSendMessage);

app.listen(PORT, () => {
  console.log(`Orkesta webhook server running on port ${PORT}`);
  if (!isConfigured) {
    console.warn('⚠ Server started but Supabase is NOT configured. Webhooks will fail until env vars are set.');
  }
});
