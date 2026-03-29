import type { Request, Response } from 'express';
import { supabase } from './supabase';
import { getAIResponse } from './ai';

interface YCloudMessage {
  id: string;
  type: string;
  whatsappMessageId?: string;
  wamid?: string;
  from: string;
  to: string;
  text?: { body: string };
  timestamp?: string;
}

interface YCloudWebhookEvent {
  id: string;
  type: string;
  apiVersion: string;
  createTime: string;
  whatsappInboundMessage?: YCloudMessage;
}

export async function handleYCloudWebhook(req: Request, res: Response): Promise<void> {
  try {
    // Verify webhook token if configured
    const webhookSecret = process.env.YCLOUD_WEBHOOK_SECRET;
    if (webhookSecret) {
      const token = req.headers['x-ycloud-signature'] ?? req.query.token;
      if (token !== webhookSecret) {
        res.status(401).json({ error: 'Invalid webhook token' });
        return;
      }
    }

    const event = req.body as YCloudWebhookEvent;

    // YCloud sends different event types — we only care about inbound messages
    if (event.type !== 'whatsapp.inbound_message.received' || !event.whatsappInboundMessage) {
      // Acknowledge non-message events (status updates, etc.)
      res.status(200).json({ status: 'ignored', type: event.type });
      return;
    }

    // Respond immediately to avoid YCloud timeout (processing happens async)
    res.status(200).json({ status: 'received' });

    // Process the message asynchronously
    const msg = event.whatsappInboundMessage;
    await processInboundMessage(msg);
  } catch (err) {
    console.error('Webhook error:', err);
    // Still return 200 to prevent YCloud from retrying
    if (!res.headersSent) {
      res.status(200).json({ status: 'error', message: 'Internal processing error' });
    }
  }
}

async function processInboundMessage(msg: YCloudMessage): Promise<void> {
  const senderPhone = msg.from;
  const recipientPhone = msg.to;
  const messageText = msg.text?.body;

  if (!messageText) {
    console.log('Received non-text message, skipping');
    return;
  }

  console.log(`Incoming message from ${senderPhone}: ${messageText}`);

  // 1. Find which team/agent handles this phone number
  const { data: assignment, error: assignErr } = await supabase
    .from('channel_assignments')
    .select('*, agent:ai_agents(*)')
    .eq('channel', 'whatsapp')
    .eq('channel_identifier', recipientPhone)
    .single();

  if (assignErr || !assignment) {
    console.warn(`No agent assigned to phone ${recipientPhone}`);
    return;
  }

  const agent = assignment.agent;
  if (!agent || !agent.is_active) {
    console.warn(`Agent ${assignment.agent_id} is inactive or not found`);
    return;
  }

  const teamId = assignment.team_id;

  // 2. Find or create customer
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('team_id', teamId)
    .eq('channel', 'whatsapp')
    .eq('channel_id', senderPhone)
    .single();

  if (!customer) {
    const { data: newCustomer, error: custErr } = await supabase
      .from('customers')
      .insert({
        team_id: teamId,
        name: senderPhone, // Will be updated when customer provides name
        phone: senderPhone,
        channel: 'whatsapp',
        channel_id: senderPhone,
      })
      .select('id')
      .single();
    if (custErr) {
      console.error('Error creating customer:', custErr.message);
      return;
    }
    customer = newCustomer;
  }

  // 3. Find or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id, is_ai_enabled')
    .eq('team_id', teamId)
    .eq('channel_contact_id', senderPhone)
    .eq('channel', 'whatsapp')
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!conversation) {
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        team_id: teamId,
        customer_id: customer.id,
        channel: 'whatsapp',
        channel_contact_id: senderPhone,
        status: 'active',
        is_ai_enabled: true,
        last_message: messageText,
        last_message_at: new Date().toISOString(),
      })
      .select('id, is_ai_enabled')
      .single();
    if (convErr) {
      console.error('Error creating conversation:', convErr.message);
      return;
    }
    conversation = newConv;
  }

  // 4. Save the inbound message
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content: messageText,
    metadata: { ycloud_message_id: msg.id, phone: senderPhone },
  });

  // Update conversation last_message
  await supabase
    .from('conversations')
    .update({
      last_message: messageText,
      last_message_at: new Date().toISOString(),
      unread_count: 1,
    })
    .eq('id', conversation.id);

  // 5. If AI is enabled, generate and send a response
  if (!conversation.is_ai_enabled) {
    console.log('AI disabled for this conversation, skipping auto-reply');
    return;
  }

  // Fetch recent messages for context
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('sender_type, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(20);

  // Fetch knowledge base context if available
  const knowledgeContext = await getKnowledgeContext(teamId);

  // Get AI response
  const aiResponse = await getAIResponse(agent, recentMessages ?? [], knowledgeContext);

  if (!aiResponse) {
    console.warn('AI returned empty response');
    return;
  }

  // 6. Save AI response as message
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'ai',
    content: aiResponse,
    metadata: { agent_id: agent.id, agent_name: agent.name },
  });

  // 7. Send response via YCloud API
  await sendYCloudMessage(recipientPhone, senderPhone, aiResponse);

  // Update conversation
  await supabase
    .from('conversations')
    .update({
      last_message: aiResponse,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversation.id);

  console.log(`Replied to ${senderPhone} via agent "${agent.name}"`);
}

async function getKnowledgeContext(teamId: string): Promise<string> {
  const { data: knowledgeBases } = await supabase
    .from('knowledge_bases')
    .select('name, description')
    .eq('team_id', teamId)
    .eq('is_queryable', true);

  if (!knowledgeBases?.length) return '';

  return knowledgeBases
    .map((kb) => `[${kb.name}]: ${kb.description ?? 'Sin descripción'}`)
    .join('\n');
}

async function sendYCloudMessage(from: string, to: string, text: string): Promise<void> {
  const apiKey = process.env.YCLOUD_API_KEY;
  if (!apiKey) {
    console.error('YCLOUD_API_KEY not configured');
    return;
  }

  try {
    const response = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        from,
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`YCloud API error (${response.status}):`, errorBody);
    }
  } catch (err) {
    console.error('Error sending YCloud message:', err);
  }
}
