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
    .limit(10);

  // Fetch knowledge schema and search for relevant rows
  console.log(`[KB] Searching knowledge for team=${teamId}, query="${messageText}"`);
  const knowledgeSchema = await getKnowledgeSchema(teamId);
  const searchResults = await searchKnowledgeRows(teamId, messageText, 15);

  let contextForAI = knowledgeSchema;
  if (searchResults) {
    contextForAI += '\n\n--- Resultados encontrados para esta consulta ---\n' + searchResults;
  } else if (knowledgeSchema) {
    contextForAI += '\n\n(No se encontraron productos específicos para esta consulta. Informa al cliente que puede proporcionar más detalles como marca, modelo o tipo de pieza.)';
  }

  console.log(`[KB] Context length: ${contextForAI.length} chars (~${Math.round(contextForAI.length / 4)} tokens), messages: ${recentMessages?.length ?? 0}`);

  // Get AI response
  const aiResponse = await getAIResponse(agent, recentMessages ?? [], contextForAI);

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

async function getKnowledgeSchema(teamId: string): Promise<string> {
  const { data: knowledgeBases } = await supabase
    .from('knowledge_bases')
    .select('id, name, description')
    .eq('team_id', teamId)
    .eq('is_queryable', true);

  if (!knowledgeBases?.length) return '';

  const kbIds = knowledgeBases.map((kb) => kb.id);
  const { data: columns } = await supabase
    .from('knowledge_columns')
    .select('knowledge_base_id, column_name, description, data_type')
    .in('knowledge_base_id', kbIds);

  const sections: string[] = [];
  for (const kb of knowledgeBases) {
    const kbCols = (columns ?? []).filter((c) => c.knowledge_base_id === kb.id);
    let section = `Base de datos "${kb.name}": ${kb.description ?? 'Sin descripción'}`;
    if (kbCols.length) {
      section += '\nColumnas disponibles: ' + kbCols.map((c) => `${c.column_name} (${c.description})`).join(', ');
    }
    sections.push(section);
  }
  return sections.join('\n\n');
}

async function searchKnowledgeRows(
  teamId: string,
  query: string,
  maxResults: number = 15
): Promise<string> {
  if (!query || query.trim().length < 2) return '';

  const { data: results, error } = await supabase
    .rpc('search_knowledge', {
      p_team_id: teamId,
      p_query: query,
      p_limit: maxResults,
    });

  if (error) {
    console.warn(`[KB] search_knowledge RPC error:`, error.message);
  }

  let rows = results;
  let usedFallback = false;

  if ((!rows || rows.length === 0) && !error) {
    const { data: fallbackResults, error: fbError } = await supabase
      .rpc('search_knowledge_fallback', {
        p_team_id: teamId,
        p_query: query,
        p_limit: maxResults,
      });
    if (fbError) {
      console.warn(`[KB] search_knowledge_fallback RPC error:`, fbError.message);
    }
    rows = fallbackResults;
    usedFallback = true;
  }

  // Nivel 3: búsqueda fuzzy con trigram (para typos)
  if (!rows || rows.length === 0) {
    const { data: fuzzyResults } = await supabase
      .rpc('search_knowledge_fuzzy', {
        p_team_id: teamId,
        p_query: query,
        p_limit: maxResults,
      });
    rows = fuzzyResults;
  }

  console.log(`[KB] query="${query}" → ${rows?.length ?? 0} rows${usedFallback ? ' (fallback)' : ''}`);

  if (!rows || rows.length === 0) return '';

  const grouped: Record<string, { name: string; rows: Record<string, unknown>[] }> = {};
  for (const row of rows) {
    const kbId = row.knowledge_base_id;
    if (!grouped[kbId]) {
      grouped[kbId] = { name: row.knowledge_base_name, rows: [] };
    }
    grouped[kbId].rows.push(row.row_data);
  }

  const sections: string[] = [];
  for (const [, group] of Object.entries(grouped)) {
    if (group.rows.length === 0) continue;
    const headers = Object.keys(group.rows[0]);
    let section = `[${group.name}] (${group.rows.length} resultados):\n`;
    section += headers.join(' | ') + '\n';
    section += group.rows
      .map((r) => headers.map((h) => String(r[h] ?? '')).join(' | '))
      .join('\n');
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
