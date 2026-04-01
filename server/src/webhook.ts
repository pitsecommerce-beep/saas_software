import type { Request, Response } from 'express';
import { supabase, isConfigured } from './supabase';
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
    // Check if server is properly configured
    if (!isConfigured || !supabase) {
      res.status(503).json({ error: 'Server not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' });
      return;
    }

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

  console.log(`Incoming message from ${senderPhone} to ${recipientPhone}: ${messageText}`);

  // 1. Find which team/agent handles this phone number
  // Try exact match first, then try with/without '+' prefix
  const recipientWithPlus = recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`;
  const recipientWithoutPlus = recipientPhone.replace(/^\+/, '');

  const { data: assignments, error: assignErr } = await supabase
    .from('channel_assignments')
    .select('*, agent:ai_agents(*)')
    .eq('channel', 'whatsapp')
    .in('channel_identifier', [recipientPhone, recipientWithPlus, recipientWithoutPlus]);

  if (assignErr) {
    console.error('DB error looking up assignment:', assignErr.message);
    return;
  }

  const assignment = assignments?.[0];
  if (!assignment) {
    console.warn(`No agent assigned to phone ${recipientPhone} (searched: ${recipientPhone}, ${recipientWithPlus}, ${recipientWithoutPlus})`);
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

  // Fetch knowledge base context if available (filtered by user message)
  const knowledgeContext = await getKnowledgeContext(teamId, messageText);

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

async function getKnowledgeContext(teamId: string, userMessage: string): Promise<string> {
  const { data: knowledgeBases } = await supabase
    .from('knowledge_bases')
    .select('id, name, description')
    .eq('team_id', teamId)
    .eq('is_queryable', true);

  if (!knowledgeBases?.length) return '';

  const kbIds = knowledgeBases.map((kb) => kb.id);

  // Fetch column descriptions so the AI knows the schema
  const { data: columns } = await supabase
    .from('knowledge_columns')
    .select('knowledge_base_id, column_name, description, data_type')
    .in('knowledge_base_id', kbIds);

  // Group columns by knowledge base
  const colsByKb: Record<string, typeof columns> = {};
  for (const col of columns ?? []) {
    if (!colsByKb[col.knowledge_base_id]) colsByKb[col.knowledge_base_id] = [];
    colsByKb[col.knowledge_base_id]!.push(col);
  }

  // Extract keywords from user message for pre-filtering (words > 2 chars)
  const stopwords = new Set(['para', 'como', 'este', 'esta', 'esos', 'esas', 'tiene', 'están', 'puede', 'sobre', 'desde', 'hasta', 'donde', 'cuando', 'cuanto', 'cuánto', 'porque', 'todo', 'toda', 'todos', 'todas', 'cual', 'cuál', 'quiero', 'necesito', 'hola', 'buenas', 'buenos', 'gracias', 'favor', 'with', 'that', 'this', 'from', 'have', 'what', 'your', 'which', 'una', 'uno', 'unos', 'unas', 'los', 'las', 'del', 'por', 'que', 'más', 'mas', 'hay', 'son', 'con']);
  const keywords = userMessage
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove accents for matching
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));

  // Fetch rows per KB, filtered by user message keywords
  const rowsByKb: Record<string, { row_data: Record<string, unknown> }[]> = {};
  const MAX_ROWS_PER_KB = 10;

  for (const kb of knowledgeBases) {
    const { data: rows } = await supabase
      .from('knowledge_rows')
      .select('row_data')
      .eq('knowledge_base_id', kb.id)
      .limit(500);

    if (!rows?.length) continue;

    if (keywords.length > 0) {
      // Client-side keyword filter: normalize row text and match against keywords
      const filtered = rows.filter((r) => {
        const text = JSON.stringify(r.row_data)
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return keywords.some((kw) => text.includes(kw));
      });
      if (filtered.length > 0) {
        rowsByKb[kb.id] = filtered.slice(0, MAX_ROWS_PER_KB);
      }
    } else {
      // No keywords extracted (short message like "hola") — skip data rows
      // Schema/columns are still sent so the AI knows what info is available
    }
  }

  // Build output in compact CSV format with only relevant columns
  const sections: string[] = [];
  for (const kb of knowledgeBases) {
    let section = `[${kb.name}]: ${kb.description ?? 'Sin descripción'}`;

    const kbCols = colsByKb[kb.id];
    if (kbCols?.length) {
      section += '\nColumnas: ' + kbCols.map((c) => `${c.column_name} (${c.description})`).join(', ');
    }

    const kbRows = rowsByKb[kb.id];
    if (kbRows?.length) {
      // Get only columns defined in knowledge_columns (filter out Excel junk)
      const relevantColNames = kbCols?.map((c) => c.column_name) ?? [];

      if (relevantColNames.length > 0) {
        // CSV format: header row + pipe-separated values
        section += '\nDatos:\n';
        section += relevantColNames.join('|');
        section += '\n' + kbRows.map((r) =>
          relevantColNames.map((col) => {
            const val = r.row_data[col];
            return val !== null && val !== undefined ? String(val) : '';
          }).join('|')
        ).join('\n');
      } else {
        // Fallback: if no columns defined, use compact JSON
        section += '\nDatos:\n';
        section += kbRows.map((r) => JSON.stringify(r.row_data)).join('\n');
      }
    }

    sections.push(section);
  }

  return sections.join('\n\n');
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
