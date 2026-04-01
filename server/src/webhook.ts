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

  console.log(`\n========== INCOMING MESSAGE ==========`);
  console.log(`From: ${senderPhone} → To: ${recipientPhone}`);
  console.log(`Text: "${messageText}"`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // 1. Find which team/agent handles this phone number
  // Try exact match first, then try with/without '+' prefix
  const recipientWithPlus = recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`;
  const recipientWithoutPlus = recipientPhone.replace(/^\+/, '');

  console.log(`\n[QUERY] channel_assignments — searching for phone: ${recipientPhone}, ${recipientWithPlus}, ${recipientWithoutPlus}`);
  const { data: assignments, error: assignErr } = await supabase
    .from('channel_assignments')
    .select('*, agent:ai_agents(*)')
    .eq('channel', 'whatsapp')
    .in('channel_identifier', [recipientPhone, recipientWithPlus, recipientWithoutPlus]);

  if (assignErr) {
    console.error('[QUERY RESULT] channel_assignments — ERROR:', assignErr.message);
    return;
  }
  console.log(`[QUERY RESULT] channel_assignments — ${assignments?.length ?? 0} result(s) found`);

  const assignment = assignments?.[0];
  if (!assignment) {
    console.warn(`[QUERY RESULT] No agent assigned to phone ${recipientPhone}`);
    return;
  }

  const agent = assignment.agent;
  if (!agent || !agent.is_active) {
    console.warn(`[QUERY RESULT] Agent ${assignment.agent_id} is inactive or not found`);
    return;
  }

  console.log(`[AGENT] ID: ${agent.id}, Name: "${agent.name}", Provider: ${agent.provider}, Model: ${agent.model}`);
  const teamId = assignment.team_id;
  console.log(`[TEAM] ID: ${teamId}`);

  // 2. Find or create customer
  console.log(`\n[QUERY] customers — searching for phone: ${senderPhone}, team: ${teamId}`);
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('team_id', teamId)
    .eq('channel', 'whatsapp')
    .eq('channel_id', senderPhone)
    .single();

  if (!customer) {
    console.log(`[QUERY RESULT] customers — not found, creating new customer`);
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
      console.error('[QUERY RESULT] customers INSERT — ERROR:', custErr.message);
      return;
    }
    customer = newCustomer;
    console.log(`[QUERY RESULT] customers — created with ID: ${customer!.id}`);
  } else {
    console.log(`[QUERY RESULT] customers — found existing, ID: ${customer.id}`);
  }

  // 3. Find or create conversation
  console.log(`\n[QUERY] conversations — searching active/pending for phone: ${senderPhone}`);
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
    console.log(`[QUERY RESULT] conversations — not found, creating new conversation`);
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
      console.error('[QUERY RESULT] conversations INSERT — ERROR:', convErr.message);
      return;
    }
    conversation = newConv;
    console.log(`[QUERY RESULT] conversations — created, ID: ${conversation!.id}, AI enabled: ${conversation!.is_ai_enabled}`);
  } else {
    console.log(`[QUERY RESULT] conversations — found existing, ID: ${conversation.id}, AI enabled: ${conversation.is_ai_enabled}`);
  }

  // 4. Save the inbound message
  console.log(`\n[QUERY] messages INSERT — saving customer message to conversation ${conversation.id}`);
  const { error: msgInsertErr } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content: messageText,
    metadata: { ycloud_message_id: msg.id, phone: senderPhone },
  });
  console.log(`[QUERY RESULT] messages INSERT — ${msgInsertErr ? 'ERROR: ' + msgInsertErr.message : 'OK'}`);

  // Update conversation last_message
  const { error: convUpdateErr } = await supabase
    .from('conversations')
    .update({
      last_message: messageText,
      last_message_at: new Date().toISOString(),
      unread_count: 1,
    })
    .eq('id', conversation.id);
  console.log(`[QUERY RESULT] conversations UPDATE — ${convUpdateErr ? 'ERROR: ' + convUpdateErr.message : 'OK'}`);

  // 5. If AI is enabled, generate and send a response
  if (!conversation.is_ai_enabled) {
    console.log('\n[SKIP] AI disabled for this conversation, skipping auto-reply');
    return;
  }

  // Fetch recent messages for context
  console.log(`\n[QUERY] messages SELECT — fetching recent messages for conversation ${conversation.id}`);
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('sender_type, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(20);
  console.log(`[QUERY RESULT] messages SELECT — ${recentMessages?.length ?? 0} messages in history`);

  // Fetch knowledge base context if available (filtered by user message)
  console.log(`\n[KNOWLEDGE] Fetching knowledge context for team ${teamId}...`);
  const knowledgeContext = await getKnowledgeContext(teamId, messageText);
  console.log(`[KNOWLEDGE] Context length: ${knowledgeContext.length} chars`);
  if (knowledgeContext) {
    console.log(`[KNOWLEDGE] Context preview:\n${knowledgeContext.substring(0, 500)}${knowledgeContext.length > 500 ? '\n... (truncated)' : ''}`);
  } else {
    console.log(`[KNOWLEDGE] No knowledge context available (no queryable knowledge bases or no matching rows)`);
  }

  // Get AI response
  console.log(`\n[AI] Calling ${agent.provider}/${agent.model} for response...`);
  const aiResponse = await getAIResponse(agent, recentMessages ?? [], knowledgeContext);

  if (!aiResponse) {
    console.warn('[AI] Agent returned EMPTY response');
    return;
  }
  console.log(`[AI] Response received (${aiResponse.length} chars):`);
  console.log(`[AI] "${aiResponse.substring(0, 300)}${aiResponse.length > 300 ? '...' : ''}"`);

  // 6. Save AI response as message
  console.log(`\n[QUERY] messages INSERT — saving AI response`);
  const { error: aiMsgErr } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'ai',
    content: aiResponse,
    metadata: { agent_id: agent.id, agent_name: agent.name },
  });
  console.log(`[QUERY RESULT] messages INSERT (AI) — ${aiMsgErr ? 'ERROR: ' + aiMsgErr.message : 'OK'}`);

  // 7. Send response via YCloud API
  console.log(`\n[YCLOUD] Sending message to ${senderPhone}...`);
  await sendYCloudMessage(recipientPhone, senderPhone, aiResponse);

  // Update conversation
  const { error: finalUpdateErr } = await supabase
    .from('conversations')
    .update({
      last_message: aiResponse,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversation.id);
  console.log(`[QUERY RESULT] conversations final UPDATE — ${finalUpdateErr ? 'ERROR: ' + finalUpdateErr.message : 'OK'}`);

  console.log(`\n========== REPLY SENT to ${senderPhone} via "${agent.name}" ==========\n`);
}

async function getKnowledgeContext(teamId: string, userMessage: string): Promise<string> {
  console.log(`  [KB QUERY] knowledge_bases — searching queryable KBs for team ${teamId}`);
  const { data: knowledgeBases, error: kbErr } = await supabase
    .from('knowledge_bases')
    .select('id, name, description')
    .eq('team_id', teamId)
    .eq('is_queryable', true);

  if (kbErr) {
    console.error(`  [KB QUERY RESULT] knowledge_bases — ERROR: ${kbErr.message}`);
  }

  if (!knowledgeBases?.length) {
    console.log(`  [KB QUERY RESULT] knowledge_bases — 0 queryable KBs found`);
    return '';
  }
  console.log(`  [KB QUERY RESULT] knowledge_bases — ${knowledgeBases.length} KB(s) found: ${knowledgeBases.map(kb => `"${kb.name}" (${kb.id})`).join(', ')}`);

  const kbIds = knowledgeBases.map((kb) => kb.id);

  // Fetch column descriptions so the AI knows the schema
  console.log(`  [KB QUERY] knowledge_columns — fetching columns for ${kbIds.length} KB(s)`);
  const { data: columns, error: colErr } = await supabase
    .from('knowledge_columns')
    .select('knowledge_base_id, column_name, description, data_type')
    .in('knowledge_base_id', kbIds);
  if (colErr) {
    console.error(`  [KB QUERY RESULT] knowledge_columns — ERROR: ${colErr.message}`);
  } else {
    console.log(`  [KB QUERY RESULT] knowledge_columns — ${columns?.length ?? 0} column(s) found`);
  }

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
  console.log(`  [KB SEARCH] Keywords extracted from message: [${keywords.join(', ')}] (${keywords.length} keywords)`);

  // Search rows via Postgres RPC — filtering happens in the DB, not client-side
  const rowsByKb: Record<string, { row_data: Record<string, unknown> }[]> = {};
  const MAX_ROWS_PER_KB = 10;

  if (keywords.length > 0) {
    console.log(`  [KB QUERY] search_knowledge_rows RPC — searching with keywords: [${keywords.join(', ')}], max ${MAX_ROWS_PER_KB} per KB`);
    const { data: matchedRows, error: rpcErr } = await supabase.rpc('search_knowledge_rows', {
      kb_ids: kbIds,
      search_keywords: keywords,
      max_per_kb: MAX_ROWS_PER_KB,
    });

    if (rpcErr) {
      console.error(`  [KB QUERY RESULT] search_knowledge_rows — ERROR: ${rpcErr.message}`);
    } else {
      console.log(`  [KB QUERY RESULT] search_knowledge_rows — ${matchedRows?.length ?? 0} row(s) matched`);
      if (matchedRows?.length) {
        console.log(`  [KB QUERY RESULT] First matched row preview: ${JSON.stringify(matchedRows[0].row_data).substring(0, 200)}`);
      }
    }

    for (const row of matchedRows ?? []) {
      if (!rowsByKb[row.knowledge_base_id]) rowsByKb[row.knowledge_base_id] = [];
      rowsByKb[row.knowledge_base_id]!.push(row);
    }
  } else {
    console.log(`  [KB SEARCH] No keywords extracted — skipping row search (only schema will be sent to AI)`);
  }
  // When no keywords (short messages like "hola"), no rows are sent —
  // the schema/columns are still included so the AI knows what info is available

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
