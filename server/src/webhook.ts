import type { Request, Response } from 'express';
import { supabase, isConfigured } from './supabase';
import { getAIResponse, continueWithToolResults, buildSystemPrompt } from './ai';
import type { AIResponse, AIResponsePart } from './ai';
import { transcribeAudio } from './transcription';
import { decrypt } from './crypto';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface YCloudMessage {
  id: string;
  type: string;
  whatsappMessageId?: string;
  wamid?: string;
  from: string;
  to: string;
  text?: { body: string };
  audio?: { id?: string; link?: string; mime_type?: string };
  timestamp?: string;
}

interface YCloudWebhookEvent {
  id: string;
  type: string;
  apiVersion: string;
  createTime: string;
  whatsappInboundMessage?: YCloudMessage;
}

interface AIAgent {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  api_key_encrypted: string;
  system_prompt: string;
  is_active: boolean;
  enabled_tools?: string[];
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

export async function handleYCloudWebhook(req: Request, res: Response): Promise<void> {
  try {
    if (!isConfigured || !supabase) {
      res.status(503).json({ error: 'Server not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' });
      return;
    }

    const webhookSecret = process.env.YCLOUD_WEBHOOK_SECRET;
    if (webhookSecret) {
      const token = req.headers['x-ycloud-signature'] ?? req.query.token;
      if (token !== webhookSecret) {
        res.status(401).json({ error: 'Invalid webhook token' });
        return;
      }
    }

    const event = req.body as YCloudWebhookEvent;

    if (event.type !== 'whatsapp.inbound_message.received' || !event.whatsappInboundMessage) {
      res.status(200).json({ status: 'ignored', type: event.type });
      return;
    }

    res.status(200).json({ status: 'received' });

    const msg = event.whatsappInboundMessage;
    await processInboundMessage(msg);
  } catch (err) {
    console.error('Webhook error:', err);
    if (!res.headersSent) {
      res.status(200).json({ status: 'error', message: 'Internal processing error' });
    }
  }
}

// ---------------------------------------------------------------------------
// Main message processing
// ---------------------------------------------------------------------------

async function processInboundMessage(msg: YCloudMessage): Promise<void> {
  const senderPhone = msg.from;
  const recipientPhone = msg.to;
  let messageText = msg.text?.body;

  if (!messageText && msg.type === 'audio' && msg.audio) {
    console.log(`[Audio] Nota de voz recibida de ${senderPhone}, transcribiendo...`);
    const transcribed = await transcribeAudio(msg.audio, recipientPhone);
    if (!transcribed) {
      // Notificar al usuario que no se pudo procesar
      const apiKey = process.env.YCLOUD_API_KEY;
      if (apiKey) {
        await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
          body: JSON.stringify({
            from: recipientPhone,
            to: senderPhone,
            type: 'text',
            text: { body: 'No pude procesar tu nota de voz. Por favor escribe tu mensaje.' }
          })
        });
      }
      return;
    }
    messageText = transcribed;
    console.log(`[Audio] Transcripción: "${messageText}"`);
  }

  if (!messageText) {
    console.log('Received non-text message, skipping');
    return;
  }

  console.log(`Incoming message from ${senderPhone} to ${recipientPhone}: ${messageText}`);

  // 1. Find which team/agent handles this phone number
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
    console.warn(`No agent assigned to phone ${recipientPhone}`);
    return;
  }

  const agent = assignment.agent as AIAgent;
  if (!agent || !agent.is_active) {
    console.warn(`Agent ${assignment.agent_id} is inactive or not found`);
    return;
  }

  // Decrypt API key before any AI call
  const decryptedAgent: AIAgent = { ...agent, api_key_encrypted: decrypt(agent.api_key_encrypted) };

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
        name: senderPhone,
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
    .in('status', ['nuevo', 'ai_attended', 'payment_pending', 'immediate_attention'])
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
        status: 'nuevo',
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
    metadata: {
      ycloud_message_id: msg.id,
      phone: senderPhone,
      original_type: msg.type,
      was_voice_note: msg.type === 'audio',
    },
  });

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

  // Fetch recent messages for context (descending to get the MOST RECENT, then reverse)
  const { data: recentMessagesDesc } = await supabase
    .from('messages')
    .select('sender_type, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const recentMessages = recentMessagesDesc ? [...recentMessagesDesc].reverse() : [];

  // Fetch knowledge schema and search for relevant rows
  console.log(`[KB] Searching knowledge for team=${teamId}, query="${messageText}"`);
  const knowledgeSchema = await getKnowledgeSchema(teamId);
  const searchResults = await searchKnowledgeRows(teamId, messageText, 10);

  let contextForAI = knowledgeSchema;
  if (searchResults) {
    contextForAI += '\n\n--- Resultados encontrados para esta consulta ---\n' + searchResults;
  } else if (knowledgeSchema) {
    contextForAI += '\n\n(No se encontraron productos específicos para esta consulta. Informa al cliente que puede proporcionar más detalles como marca, modelo o tipo de pieza.)';
  }

  // Inject active order context so the AI knows about existing orders
  const activeOrderCtx = await getActiveOrderContext(conversation.id, teamId);
  if (activeOrderCtx) {
    contextForAI += '\n\n' + activeOrderCtx;
  }

  console.log(`[KB] Context length: ${contextForAI.length} chars (~${Math.round(contextForAI.length / 4)} tokens), messages: ${recentMessages?.length ?? 0}`);

  // Sanitize message history before sending to AI
  const sanitizedMessages = sanitizeMessageHistory(recentMessages ?? []);
  if (sanitizedMessages.length === 0) {
    console.warn('Message history empty after sanitization, skipping AI call');
    return;
  }

  // Current Mexico time for AI context
  const currentDateTime = new Date().toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Get AI response (may include tool calls)
  const aiResponse = await getAIResponse(decryptedAgent, sanitizedMessages, contextForAI, currentDateTime);

  if (!aiResponse) {
    console.warn('AI returned empty response');
    return;
  }

  // Process the response — handle tool call loop
  const aiResult = await processAIResponse(
    aiResponse,
    decryptedAgent,
    contextForAI,
    sanitizedMessages,
    teamId,
    customer.id,
    senderPhone,
    conversation.id,
    currentDateTime
  );

  const finalText = aiResult.text;

  // Registrar consumo de tokens (datos independientes de las conversaciones)
  if (aiResult.inputTokens > 0 || aiResult.outputTokens > 0) {
    supabase.from('token_usage').insert({
      team_id: teamId,
      agent_id: agent.id,
      agent_name: agent.name,
      provider: agent.provider,
      model: agent.model,
      input_tokens: aiResult.inputTokens,
      output_tokens: aiResult.outputTokens,
      conversation_id: conversation.id,
    }).then(({ error }) => {
      if (error) console.error('[Tokens] Error saving token_usage:', error.message);
      else console.log(`[Tokens] Saved: ${aiResult.inputTokens} in + ${aiResult.outputTokens} out (${agent.provider}/${agent.model})`);
    });
  }

  if (!finalText) {
    console.warn('No final text after processing AI response');
    return;
  }

  // 6. Save AI response as message (full text with URLs)
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'ai',
    content: finalText,
    metadata: { agent_id: agent.id, agent_name: agent.name },
  });

  // 7. Send response via YCloud API as interleaved text + image blocks
  const blocks = extractMessageBlocks(finalText);
  await sendYCloudMessageBlocks(recipientPhone, senderPhone, blocks);

  // Update conversation
  await supabase
    .from('conversations')
    .update({
      last_message: finalText,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversation.id);

  console.log(`Replied to ${senderPhone} via agent "${agent.name}"`);
}

// ---------------------------------------------------------------------------
// Sanitize message history for AI providers
// ---------------------------------------------------------------------------

function sanitizeMessageHistory(
  messages: { sender_type: string; content: string; created_at: string }[]
): { sender_type: string; content: string; created_at: string }[] {
  if (messages.length === 0) return [];

  // Merge consecutive messages with the same mapped role
  // (e.g. 'ai' and 'agent' both map to 'assistant')
  const mapRole = (senderType: string) => senderType === 'customer' ? 'user' : 'assistant';

  const merged: { sender_type: string; content: string; created_at: string }[] = [];
  for (const msg of messages) {
    const lastMerged = merged[merged.length - 1];
    if (lastMerged && mapRole(lastMerged.sender_type) === mapRole(msg.sender_type)) {
      lastMerged.content += '\n\n' + msg.content;
      lastMerged.created_at = msg.created_at; // keep the latest timestamp
    } else {
      merged.push({ ...msg });
    }
  }

  // Ensure the last message has role 'user'; if 'assistant', remove it
  while (merged.length > 0 && mapRole(merged[merged.length - 1].sender_type) === 'assistant') {
    merged.pop();
  }

  const discarded = messages.length - merged.length;
  if (discarded > 0) {
    console.log(`[Sanitize] Discarded/merged ${discarded} messages (${messages.length} → ${merged.length})`);
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Process AI response with tool call loop
// ---------------------------------------------------------------------------

interface AIProcessResult {
  text: string | null;
  inputTokens: number;
  outputTokens: number;
}

async function processAIResponse(
  response: AIResponse,
  agent: AIAgent,
  knowledgeContext: string,
  messages: { sender_type: string; content: string; created_at: string }[],
  teamId: string,
  customerId: string,
  customerPhone: string,
  conversationId: string,
  currentDateTime?: string
): Promise<AIProcessResult> {
  // Acumula tokens de todas las llamadas IA en este turno de conversación
  let totalInputTokens = response.tokenUsage?.inputTokens ?? 0;
  let totalOutputTokens = response.tokenUsage?.outputTokens ?? 0;

  // If no tool calls, just return the text
  if (!response.hasToolCalls) {
    return { text: getTextFromParts(response.parts), inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
  }

  const systemPrompt = buildSystemPrompt(agent.system_prompt, knowledgeContext, agent.enabled_tools, currentDateTime);

  // Build provider-specific message history for continuation
  const conversationHistory = messages.map((m) => ({
    role: m.sender_type === 'customer' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }));

  // Tool call loop (max 3 iterations to prevent infinite loops)
  let currentResponse = response;
  const providerMessages: unknown[] = [...conversationHistory];
  const MAX_TOOL_ITERATIONS = 3;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    if (!currentResponse.hasToolCalls) break;

    // Execute each tool call
    const toolResults: { toolCallId: string; result: string }[] = [];

    for (const part of currentResponse.parts) {
      if (part.type !== 'tool_call' || !part.toolName) continue;

      console.log(`[Tool] Executing ${part.toolName} with args:`, JSON.stringify(part.toolArgs));

      let result: string;
      switch (part.toolName) {
        case 'crear_pedido':
          result = await executeCrearPedidoWithGuard(
            part.toolArgs ?? {},
            teamId,
            customerId,
            conversationId
          );
          break;
        case 'consultar_disponibilidad':
          result = await executeConsultarDisponibilidad(
            part.toolArgs ?? {},
            teamId
          );
          break;
        case 'consultar_pedido':
          result = await executeConsultarPedido(
            part.toolArgs ?? {},
            teamId
          );
          break;
        case 'generar_link_pago':
          result = await executeGenerarLinkPago(
            part.toolArgs ?? {},
            teamId,
            conversationId
          );
          break;
        case 'consultar_cliente':
          result = await executeConsultarCliente(
            part.toolArgs ?? {},
            teamId,
            customerPhone
          );
          break;
        case 'actualizar_direccion_cliente':
          result = await executeActualizarDireccionCliente(
            part.toolArgs ?? {},
            teamId,
            customerPhone
          );
          break;
        default:
          result = JSON.stringify({ error: `Herramienta desconocida: ${part.toolName}` });
      }

      console.log(`[Tool] ${part.toolName} result:`, result);
      toolResults.push({ toolCallId: part.toolCallId ?? part.toolName!, result });
    }

    // Build assistant message for the conversation (for provider continuation)
    // For OpenAI: need to add the assistant message with tool_calls before tool results
    if (agent.provider === 'openai') {
      const toolCalls = currentResponse.parts
        .filter((p) => p.type === 'tool_call')
        .map((p) => ({
          id: p.toolCallId!,
          type: 'function' as const,
          function: { name: p.toolName!, arguments: JSON.stringify(p.toolArgs ?? {}) },
        }));
      const assistantContent = getTextFromParts(currentResponse.parts);
      providerMessages.push({
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: toolCalls,
      });
      // Append tool results as individual tool messages
      for (const tr of toolResults) {
        providerMessages.push({
          role: 'tool',
          tool_call_id: tr.toolCallId,
          content: tr.result,
        });
      }
    } else if (agent.provider === 'anthropic') {
      // Anthropic: add assistant message with content blocks
      const contentBlocks: unknown[] = [];
      for (const part of currentResponse.parts) {
        if (part.type === 'text' && part.text) {
          contentBlocks.push({ type: 'text', text: part.text });
        } else if (part.type === 'tool_call') {
          contentBlocks.push({
            type: 'tool_use',
            id: part.toolCallId,
            name: part.toolName,
            input: part.toolArgs ?? {},
          });
        }
      }
      providerMessages.push({ role: 'assistant', content: contentBlocks });
      // Append tool_result blocks as a user turn (must immediately follow tool_use)
      providerMessages.push({
        role: 'user',
        content: toolResults.map((tr) => ({
          type: 'tool_result',
          tool_use_id: tr.toolCallId,
          content: tr.result,
        })),
      });
    } else if (agent.provider === 'google') {
      // Google: add model turn with functionCall parts
      const parts: unknown[] = [];
      for (const part of currentResponse.parts) {
        if (part.type === 'text' && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === 'tool_call') {
          parts.push({ functionCall: { name: part.toolName, args: part.toolArgs ?? {} } });
        }
      }
      providerMessages.push({ role: 'model', parts });
      // Append functionResponse parts as a user turn
      providerMessages.push({
        role: 'user',
        parts: toolResults.map((tr) => ({
          functionResponse: {
            name: tr.toolCallId,
            response: { result: tr.result },
          },
        })),
      });
    }

    // Continue the conversation with tool results
    const nextResponse = await continueWithToolResults(
      agent,
      systemPrompt,
      providerMessages
    );

    if (!nextResponse) {
      const partialText = getTextFromParts(currentResponse.parts);
      return {
        text: partialText || 'Lo siento, hubo un error procesando tu solicitud. Por favor intenta de nuevo.',
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    }

    totalInputTokens += nextResponse.tokenUsage?.inputTokens ?? 0;
    totalOutputTokens += nextResponse.tokenUsage?.outputTokens ?? 0;
    currentResponse = nextResponse;
  }

  return { text: getTextFromParts(currentResponse.parts), inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
}

function getTextFromParts(parts: AIResponsePart[]): string | null {
  const texts = parts.filter((p) => p.type === 'text' && p.text).map((p) => p.text!);
  return texts.length > 0 ? texts.join('\n') : null;
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Active order context for AI (Protection 2)
// ---------------------------------------------------------------------------

async function getActiveOrderContext(conversationId: string, teamId: string): Promise<string | null> {
  const { data: activeOrders } = await supabase
    .from('orders')
    .select('id, total, status, order_items(product_name, sku, quantity, unit_price, subtotal)')
    .eq('conversation_id', conversationId)
    .eq('team_id', teamId)
    .not('status', 'in', '("cancelado","entregado")')
    .order('created_at', { ascending: false })
    .limit(3);

  if (!activeOrders || activeOrders.length === 0) return null;

  const sections: string[] = [];
  for (const order of activeOrders) {
    const shortId = (order.id as string).slice(0, 8);
    const items = (order.order_items as Array<{ product_name: string; sku: string | null; quantity: number; unit_price: number; subtotal: number }>) ?? [];
    const itemLines = items.map(
      (it) => `  - ${it.product_name}${it.sku ? ` (${it.sku})` : ''} x${it.quantity} — $${it.subtotal.toFixed(2)}`
    ).join('\n');
    sections.push(
      `Ya existe el pedido #${shortId} con estos productos:\n${itemLines}\n  Total: $${(order.total as number).toFixed(2)} | Estado: ${order.status}`
    );
  }

  return `--- PEDIDO ACTIVO EN ESTA CONVERSACIÓN ---\n${sections.join('\n\n')}\nNO crees otro pedido con estos mismos productos. Si el cliente dice "gracias", "listo", "ok" o similar, confirma que su pedido ya está registrado.\n--- FIN ---`;
}

// ---------------------------------------------------------------------------
// Duplicate order guard (Protection 1)
// ---------------------------------------------------------------------------

async function executeCrearPedidoWithGuard(
  args: Record<string, unknown>,
  teamId: string,
  customerId: string,
  conversationId: string
): Promise<string> {
  const productos = args.productos as Array<{ nombre: string; sku?: string; cantidad: number }> | undefined;
  if (!productos || productos.length === 0) {
    return executeCrearPedido(args, teamId, customerId, conversationId);
  }

  // Look up the last non-cancelled order for this conversation
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('id, total, status, order_items(product_name, sku, quantity)')
    .eq('conversation_id', conversationId)
    .eq('team_id', teamId)
    .neq('status', 'cancelado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOrder) {
    const existingItems = (lastOrder.order_items as Array<{ product_name: string; sku: string | null; quantity: number }>) ?? [];

    // Build normalised maps for the existing order
    const existingBySku = new Map<string, number>();
    const existingByName = new Map<string, number>();
    for (const item of existingItems) {
      if (item.sku) {
        existingBySku.set(item.sku.trim().toUpperCase(), item.quantity);
      }
      existingByName.set(item.product_name.trim().toLowerCase(), item.quantity);
    }

    // Check if requested products are a subset (or exact match) of the existing order
    const useSku = productos.some((p) => p.sku);
    let isDuplicate = true;

    if (useSku) {
      for (const prod of productos) {
        const key = (prod.sku ?? prod.nombre).trim().toUpperCase();
        const existingQty = existingBySku.get(key);
        if (existingQty === undefined || existingQty !== prod.cantidad) {
          isDuplicate = false;
          break;
        }
      }
    } else {
      for (const prod of productos) {
        const key = prod.nombre.trim().toLowerCase();
        const existingQty = existingByName.get(key);
        if (existingQty === undefined || existingQty !== prod.cantidad) {
          isDuplicate = false;
          break;
        }
      }
    }

    if (isDuplicate) {
      const fullId = lastOrder.id as string;
      const shortId = fullId.slice(0, 8);
      const total = lastOrder.total as number;
      console.log(`[Guard] Blocked duplicate order. Request matches existing order ${fullId}`);
      return JSON.stringify({
        success: false,
        blocked_duplicate: true,
        existing_order_id: fullId,
        existing_order_short_id: shortId,
        existing_total: total,
        message: `Ya existe un pedido (Número de pedido: ${fullId}) con exactamente estos productos. Total: $${total.toFixed(2)}. No se creó un pedido nuevo.`,
      });
    }
  }

  // Not a duplicate — proceed normally
  return executeCrearPedido(args, teamId, customerId, conversationId);
}

async function executeCrearPedido(
  args: Record<string, unknown>,
  teamId: string,
  customerId: string,
  conversationId: string
): Promise<string> {
  try {
    const productos = args.productos as Array<{ nombre: string; sku?: string; cantidad: number }>;
    const notas = args.notas as string | undefined;
    const metodoEntregaRaw = typeof args.metodo_entrega === 'string' ? args.metodo_entrega : undefined;
    const VALID_METHODS = ['cliente_recoge', 'envio_directo', 'envio_en_ruta'] as const;
    const deliveryMethod = VALID_METHODS.includes(metodoEntregaRaw as typeof VALID_METHODS[number])
      ? metodoEntregaRaw
      : null;

    if (!productos || productos.length === 0) {
      return JSON.stringify({ success: false, error: 'No se especificaron productos' });
    }

    // Load customer to get discount and address for delivery validation
    const { data: customerRow } = await supabase
      .from('customers')
      .select('discount_percentage, delivery_address')
      .eq('id', customerId)
      .maybeSingle();

    const discountPct = Math.max(
      0,
      Math.min(100, Number(customerRow?.discount_percentage ?? 40))
    );
    const discountFactor = 1 - discountPct / 100;

    if ((deliveryMethod === 'envio_directo' || deliveryMethod === 'envio_en_ruta') &&
        !customerRow?.delivery_address) {
      return JSON.stringify({
        success: false,
        error: 'El cliente no tiene dirección de envío registrada. Solicítala y guárdala con actualizar_direccion_cliente antes de crear un pedido con envío.',
        missing_address: true,
      });
    }

    // Look up each product in knowledge_rows to get prices
    const orderItems: Array<{
      product_name: string;
      sku: string | null;
      quantity: number;
      unit_price: number;
      subtotal: number;
      knowledge_row_id: string | null;
      list_price: number;
    }> = [];

    for (const prod of productos) {
      const searchQuery = prod.sku || prod.nombre;
      const { data: rows } = await supabase
        .rpc('search_knowledge', {
          p_team_id: teamId,
          p_query: searchQuery,
          p_limit: 3,
        });

      let listPrice = 0;
      let knowledgeRowId: string | null = null;
      let productName = prod.nombre;
      let sku = prod.sku || null;

      if (rows && rows.length > 0) {
        const rowData = rows[0].row_data as Record<string, unknown>;
        knowledgeRowId = rows[0].id;

        // Try to get price from common field names (precio de lista / precio de venta)
        listPrice = parseFloat(String(
          rowData.precio_venta ?? rowData.precio ?? rowData.price ?? rowData.unit_price ?? 0
        )) || 0;

        // Use the actual product name/SKU from the database if available
        if (rowData.descripcion) productName = String(rowData.descripcion);
        if (rowData.sku) sku = String(rowData.sku);
      }

      // Apply customer discount over list price
      const unitPrice = Math.round(listPrice * discountFactor * 100) / 100;

      orderItems.push({
        product_name: productName,
        sku,
        quantity: prod.cantidad,
        unit_price: unitPrice,
        subtotal: Math.round(unitPrice * prod.cantidad * 100) / 100,
        knowledge_row_id: knowledgeRowId,
        list_price: listPrice,
      });
    }

    const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Insert the order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        team_id: teamId,
        customer_id: customerId,
        conversation_id: conversationId,
        status: 'pendiente_pago',
        total,
        delivery_method: deliveryMethod,
        notes: notas ?? null,
      })
      .select('id')
      .single();

    if (orderErr) {
      console.error('Error creating order:', orderErr.message);
      return JSON.stringify({ success: false, error: 'Error al crear el pedido en la base de datos' });
    }

    // Insert order items
    const itemsToInsert = orderItems.map((item) => ({
      order_id: order.id,
      knowledge_row_id: item.knowledge_row_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }));

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsErr) {
      console.error('Error creating order items:', itemsErr.message);
    }

    // Build response summary
    const itemsSummary = orderItems.map(
      (item) => `- ${item.product_name}${item.sku ? ` (${item.sku})` : ''}: ${item.quantity} x $${item.unit_price.toFixed(2)} = $${item.subtotal.toFixed(2)}`
    ).join('\n');

    const deliveryLabel =
      deliveryMethod === 'cliente_recoge' ? 'CLIENTE RECOGE' :
      deliveryMethod === 'envio_directo' ? 'ENVÍO DIRECTO' :
      deliveryMethod === 'envio_en_ruta' ? 'ENVÍO EN RUTA' :
      'Sin definir';

    return JSON.stringify({
      success: true,
      order_id: order.id,
      total: total.toFixed(2),
      items_count: orderItems.length,
      descuento_aplicado: `${discountPct}%`,
      metodo_entrega: deliveryMethod,
      summary: `Pedido creado exitosamente.\n\nNúmero de pedido: ${order.id}\n\nProductos (precios ya incluyen descuento del ${discountPct}% sobre lista):\n${itemsSummary}\n\nTotal: $${total.toFixed(2)} MXN\nTipo de entrega: ${deliveryLabel}\nEstado: Pendiente de pago\n\nIMPORTANTE: Siempre comunica al cliente el número de pedido COMPLETO, no abreviado.`,
    });
  } catch (err) {
    console.error('Error in executeCrearPedido:', err);
    return JSON.stringify({ success: false, error: 'Error interno al crear el pedido' });
  }
}

async function executeConsultarDisponibilidad(
  args: Record<string, unknown>,
  teamId: string
): Promise<string> {
  try {
    const producto = args.producto as string;
    if (!producto) {
      return JSON.stringify({ success: false, error: 'No se especificó el producto' });
    }

    const { data: rows } = await supabase
      .rpc('search_knowledge', {
        p_team_id: teamId,
        p_query: producto,
        p_limit: 5,
      });

    if (!rows || rows.length === 0) {
      // Try fallback search
      const { data: fallbackRows } = await supabase
        .rpc('search_knowledge_fallback', {
          p_team_id: teamId,
          p_query: producto,
          p_limit: 5,
        });

      if (!fallbackRows || fallbackRows.length === 0) {
        return JSON.stringify({
          success: true,
          encontrado: false,
          mensaje: `No se encontraron resultados para "${producto}" en la base de datos.`,
        });
      }

      return formatDisponibilidadResults(fallbackRows);
    }

    return formatDisponibilidadResults(rows);
  } catch (err) {
    console.error('Error in executeConsultarDisponibilidad:', err);
    return JSON.stringify({ success: false, error: 'Error consultando disponibilidad' });
  }
}

function formatDisponibilidadResults(
  rows: Array<{ row_data: Record<string, unknown>; knowledge_base_name: string }>
): string {
  const productos = rows.map((row) => {
    const d = row.row_data;
    return {
      nombre: d.descripcion ?? d.nombre ?? d.product_name ?? 'Sin nombre',
      sku: d.sku ?? null,
      precio_venta: d.precio_venta ?? d.precio ?? d.price ?? null,
      existencia_cdmx: d.existencia_cdmx ?? d.existencia ?? d.stock ?? null,
      existencia_tulti: d.existencia_tulti ?? null,
      existencia_foranea: d.existencia_foranea ?? null,
    };
  });

  return JSON.stringify({
    success: true,
    encontrado: true,
    productos,
  });
}

async function executeConsultarPedido(
  args: Record<string, unknown>,
  teamId: string
): Promise<string> {
  try {
    const numeroPedido = (args.numero_pedido as string)?.trim();
    if (!numeroPedido) {
      return JSON.stringify({ success: false, error: 'No se proporcionó número de pedido' });
    }

    const fullUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isFullUuid = fullUuidRegex.test(numeroPedido);

    let order: Record<string, unknown> | null = null;

    if (isFullUuid) {
      // Exact UUID match — use .eq() directly (avoids PostgREST .or() parsing issues with dashes)
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*), customer:customers(name)')
        .eq('team_id', teamId)
        .eq('id', numeroPedido)
        .maybeSingle();

      if (error) {
        console.error('Error querying order by exact UUID:', error);
        return JSON.stringify({ success: false, error: 'Error al consultar el pedido en la base de datos' });
      }
      order = data;
    } else {
      // Partial id (e.g. "b6e973a4") — UUID columns can't be ILIKE'd directly,
      // so call an RPC that casts id::text and prefix-matches it.
      const { data, error } = await supabase
        .rpc('search_order_by_id', { p_query: numeroPedido, p_team_id: teamId });

      if (error) {
        console.error('Error calling search_order_by_id RPC:', error);
        return JSON.stringify({ success: false, error: 'Error al buscar el pedido en la base de datos' });
      }

      const found = Array.isArray(data) ? data[0] : data;
      if (found?.id) {
        // Re-fetch with relations since the RPC only returns the orders row.
        const { data: full, error: fullError } = await supabase
          .from('orders')
          .select('*, order_items(*), customer:customers(name)')
          .eq('team_id', teamId)
          .eq('id', found.id)
          .maybeSingle();

        if (fullError) {
          console.error('Error fetching order details after RPC match:', fullError);
          return JSON.stringify({ success: false, error: 'Error al obtener los detalles del pedido' });
        }
        order = full;
      }
    }

    if (!order) {
      return JSON.stringify({ success: false, encontrado: false, mensaje: `No se encontró un pedido con el número "${numeroPedido}".` });
    }

    const items = ((order.order_items as Array<Record<string, unknown>>) ?? []).map((item) => ({
      producto: item.product_name,
      sku: item.sku,
      cantidad: item.quantity,
      precio_unitario: item.unit_price,
      subtotal: item.subtotal,
    }));

    const statusLabels: Record<string, string> = {
      curioso: 'Curioso',
      cotizando: 'Cotizando',
      pendiente_pago: 'Pendiente de pago',
      pendiente_surtir: 'Pendiente de surtir',
      pendiente_enviar: 'Pendiente de enviar',
      enviado: 'Enviado',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
      requiere_atencion: 'Requiere atención',
    };

    return JSON.stringify({
      success: true,
      encontrado: true,
      pedido: {
        id: order.id,
        id_completo: order.id,
        id_corto: (order.id as string).slice(0, 8),
        estado: statusLabels[order.status as string] ?? order.status,
        total: order.total,
        notas: order.notes,
        cliente: (order.customer as { name?: string } | null)?.name ?? 'Sin cliente',
        fecha: order.created_at,
        productos: items,
      },
      instruccion_para_agente: 'Usa siempre el ID completo al comunicar al cliente',
    });
  } catch (err) {
    console.error('Error in executeConsultarPedido:', err);
    return JSON.stringify({ success: false, error: 'Error interno al consultar el pedido' });
  }
}

async function executeGenerarLinkPago(
  args: Record<string, unknown>,
  teamId: string,
  conversationId: string
): Promise<string> {
  try {
    const monto = args.monto as number;
    const descripcion = args.descripcion as string;
    const orderId = args.order_id as string | undefined;

    if (!monto || monto <= 0) {
      return JSON.stringify({ success: false, error: 'El monto debe ser mayor a 0' });
    }

    const { data: settings } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .maybeSingle();

    if (!settings) {
      return JSON.stringify({
        success: false,
        error: 'No hay proveedor de pagos configurado. El gerente debe configurar Mercado Pago o Stripe en la sección de Configuración.',
      });
    }

    let paymentUrl = '';
    const currency = (settings.currency ?? 'MXN').toUpperCase();
    const externalReference = orderId ?? conversationId;
    const successUrl = (settings.success_url && String(settings.success_url).trim()) || 'https://orkesta.app/payment/success';
    const cancelUrl = (settings.cancel_url && String(settings.cancel_url).trim()) || 'https://orkesta.app/payment/cancel';
    const idempotencyKey = `${externalReference}-${Date.now()}`;
    const decryptedPaymentApiKey = decrypt(settings.api_key_encrypted);
    const metadata: Record<string, string> = {
      team_id: teamId,
      conversation_id: conversationId,
    };
    if (orderId) metadata.order_id = orderId;

    if (settings.provider === 'mercadopago') {
      const body: Record<string, unknown> = {
        items: [
          {
            title: String(descripcion).slice(0, 256),
            quantity: 1,
            unit_price: Number(Number(monto).toFixed(2)),
            currency_id: currency,
          },
        ],
        external_reference: externalReference,
        back_urls: { success: successUrl, failure: cancelUrl, pending: successUrl },
        auto_return: 'approved',
        metadata,
      };
      if (settings.webhook_url) body.notification_url = settings.webhook_url;

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${decryptedPaymentApiKey}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Mercado Pago API error: ${errBody}`);
      }
      const mpData = (await response.json()) as { init_point?: string; sandbox_init_point?: string };
      paymentUrl = mpData.init_point || mpData.sandbox_init_point || '';
    } else if (settings.provider === 'stripe') {
      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('line_items[0][quantity]', '1');
      params.append('line_items[0][price_data][currency]', currency.toLowerCase());
      params.append('line_items[0][price_data][unit_amount]', String(Math.round(monto * 100)));
      params.append('line_items[0][price_data][product_data][name]', String(descripcion).slice(0, 250));
      params.append('success_url', successUrl);
      params.append('cancel_url', cancelUrl);
      params.append('client_reference_id', externalReference);
      params.append('locale', 'es');
      for (const [key, value] of Object.entries(metadata)) {
        params.append(`metadata[${key}]`, value);
        params.append(`payment_intent_data[metadata][${key}]`, value);
      }

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${decryptedPaymentApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': idempotencyKey,
        },
        body: params.toString(),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Stripe API error: ${errBody}`);
      }
      const stripeData = (await response.json()) as { url: string };
      paymentUrl = stripeData.url;
    }

    if (orderId) {
      await supabase
        .from('orders')
        .update({ status: 'pendiente_pago', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('team_id', teamId);
    }

    return JSON.stringify({
      success: true,
      payment_url: paymentUrl,
      provider: settings.provider,
      monto,
      descripcion,
    });
  } catch (err) {
    console.error('Error in executeGenerarLinkPago:', err);
    return JSON.stringify({ success: false, error: 'Error al generar el link de pago. Verifica la configuración del proveedor.' });
  }
}

// ---------------------------------------------------------------------------
// Customer-facing tools (discount, address)
// ---------------------------------------------------------------------------

async function findCustomerByPhone(teamId: string, phone: string) {
  const withPlus = phone.startsWith('+') ? phone : `+${phone}`;
  const withoutPlus = phone.replace(/^\+/, '');

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, channel_id, discount_percentage, delivery_address')
    .eq('team_id', teamId)
    .or(
      `phone.eq.${phone},phone.eq.${withPlus},phone.eq.${withoutPlus},channel_id.eq.${phone},channel_id.eq.${withPlus},channel_id.eq.${withoutPlus}`
    )
    .limit(1)
    .maybeSingle();

  return data;
}

async function executeConsultarCliente(
  args: Record<string, unknown>,
  teamId: string,
  senderPhone: string
): Promise<string> {
  try {
    const phone = (typeof args.celular === 'string' && args.celular.trim()) || senderPhone;
    const customer = await findCustomerByPhone(teamId, phone);

    if (!customer) {
      return JSON.stringify({
        success: true,
        encontrado: false,
        mensaje: `No se encontró un cliente registrado con el celular ${phone}. Se usará el descuento por defecto del 40% y habrá que registrar su dirección antes de cualquier envío.`,
        descuento_default: 40,
      });
    }

    const discount = Number(customer.discount_percentage ?? 40);
    const hasAddress = !!(customer.delivery_address && String(customer.delivery_address).trim());

    return JSON.stringify({
      success: true,
      encontrado: true,
      cliente: {
        id: customer.id,
        nombre: customer.name,
        celular: customer.phone ?? customer.channel_id,
        porcentaje_descuento: discount,
        es_descuento_default: discount === 40,
        tiene_direccion: hasAddress,
        direccion_envio: hasAddress ? customer.delivery_address : null,
      },
      instruccion_para_agente: hasAddress
        ? 'El cliente tiene dirección registrada. Confírmala con el cliente antes del envío y ofrécele actualizarla si hace falta.'
        : 'El cliente NO tiene dirección registrada. Si el pedido requiere envío, solicítasela y guárdala con actualizar_direccion_cliente antes de crear el pedido.',
    });
  } catch (err) {
    console.error('Error in executeConsultarCliente:', err);
    return JSON.stringify({ success: false, error: 'Error consultando los datos del cliente' });
  }
}

async function executeActualizarDireccionCliente(
  args: Record<string, unknown>,
  teamId: string,
  senderPhone: string
): Promise<string> {
  try {
    const direccion = typeof args.direccion === 'string' ? args.direccion.trim() : '';
    if (!direccion) {
      return JSON.stringify({ success: false, error: 'La dirección no puede estar vacía.' });
    }
    const phone = (typeof args.celular === 'string' && args.celular.trim()) || senderPhone;
    const customer = await findCustomerByPhone(teamId, phone);
    if (!customer) {
      return JSON.stringify({
        success: false,
        error: `No se encontró un cliente con el celular ${phone}.`,
      });
    }

    const prevAddress = customer.delivery_address ?? null;
    const { error } = await supabase
      .from('customers')
      .update({ delivery_address: direccion, updated_at: new Date().toISOString() })
      .eq('id', customer.id)
      .eq('team_id', teamId);

    if (error) {
      console.error('Error updating customer address:', error);
      return JSON.stringify({ success: false, error: 'Error guardando la dirección del cliente.' });
    }

    return JSON.stringify({
      success: true,
      cliente_id: customer.id,
      direccion_anterior: prevAddress,
      direccion_envio: direccion,
      mensaje: prevAddress
        ? `Dirección actualizada para ${customer.name}.`
        : `Dirección registrada para ${customer.name}.`,
    });
  } catch (err) {
    console.error('Error in executeActualizarDireccionCliente:', err);
    return JSON.stringify({ success: false, error: 'Error interno al actualizar la dirección' });
  }
}

// ---------------------------------------------------------------------------
// Knowledge base helpers (unchanged from original)
// ---------------------------------------------------------------------------

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

  // Nivel 3: búsqueda fuzzy con trigram
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

// ---------------------------------------------------------------------------
// Message sending helpers
// ---------------------------------------------------------------------------

export type MessageBlock = { type: 'text'; content: string } | { type: 'image'; url: string };

export function extractMessageBlocks(text: string): MessageBlock[] {
  const imageUrlRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi;
  const blocks: MessageBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imageUrlRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).replace(/\n{3,}/g, '\n\n').trim();
    if (before) {
      blocks.push({ type: 'text', content: before });
    }
    blocks.push({ type: 'image', url: match[0] });
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex).replace(/\n{3,}/g, '\n\n').trim();
  if (remaining) {
    blocks.push({ type: 'text', content: remaining });
  }

  return blocks;
}



async function sendYCloudMessageBlocks(from: string, to: string, blocks: MessageBlock[]): Promise<void> {
  const apiKey = process.env.YCLOUD_API_KEY;
  if (!apiKey) {
    console.error('YCLOUD_API_KEY not configured');
    return;
  }

  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const block = blocks[i];
    try {
      const body =
        block.type === 'text'
          ? { from, to, type: 'text', text: { body: block.content } }
          : { from, to, type: 'image', image: { link: block.url } };

      const response = await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`YCloud API error (${response.status}):`, errorBody);
      }
    } catch (err) {
      console.error('Error sending YCloud block:', err);
    }
  }
}

