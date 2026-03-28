import express from 'express';
import { handleYCloudWebhook } from './webhook';

const app = express();
const PORT = process.env.PORT || 3000;

// YCloud sends JSON payloads
app.use(express.json());

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'orkesta-webhook-server' });
});

// YCloud webhook endpoint
app.post('/api/webhooks/ycloud', handleYCloudWebhook);

app.listen(PORT, () => {
  console.log(`Orkesta webhook server running on port ${PORT}`);
});
