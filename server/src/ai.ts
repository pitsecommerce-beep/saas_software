import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface AIAgent {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  api_key_encrypted: string;
  system_prompt: string;
  enabled_tools?: string[];
}

interface Message {
  sender_type: string;
  content: string;
  created_at: string;
}

// Represents either plain text or a tool call from the model
export interface AIResponsePart {
  type: 'text' | 'tool_call';
  text?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
}

// Full response from the AI
export interface AIResponse {
  parts: AIResponsePart[];
  hasToolCalls: boolean;
  tokenUsage?: { inputTokens: number; outputTokens: number };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS: Record<string, { description: string; parameters: Record<string, unknown> }> = {
  crear_pedido: {
    description: 'Crea un pedido para el cliente con los productos especificados. Solo usar después de que el cliente haya confirmado explícitamente que quiere proceder con la compra. Debes incluir el tipo de entrega (CLIENTE RECOGE, ENVÍO DIRECTO o ENVÍO EN RUTA). Si el tipo de entrega requiere dirección y el cliente no la tiene registrada, primero usa actualizar_direccion_cliente.',
    parameters: {
      type: 'object',
      properties: {
        productos: {
          type: 'array',
          description: 'Lista de productos a incluir en el pedido. El precio se calcula automáticamente aplicando el descuento del cliente sobre el precio de lista.',
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string', description: 'Nombre del producto' },
              sku: { type: 'string', description: 'SKU del producto (si se conoce)' },
              cantidad: { type: 'number', description: 'Cantidad del producto' },
            },
            required: ['nombre', 'cantidad'],
          },
        },
        metodo_entrega: {
          type: 'string',
          enum: ['cliente_recoge', 'envio_directo', 'envio_en_ruta'],
          description: 'Tipo de entrega del pedido: cliente_recoge (CLIENTE RECOGE), envio_directo (ENVÍO DIRECTO) o envio_en_ruta (ENVÍO EN RUTA).',
        },
        notas: { type: 'string', description: 'Notas adicionales del pedido' },
      },
      required: ['productos', 'metodo_entrega'],
    },
  },
  consultar_cliente: {
    description: 'Consulta los datos del cliente actual (descuento asignado y dirección de envío registrada) a partir de su número de celular. Usar al iniciar una conversación para saber si el cliente tiene descuento especial o si falta registrar su dirección.',
    parameters: {
      type: 'object',
      properties: {
        celular: {
          type: 'string',
          description: 'Número de celular del cliente (opcional, si no se proporciona se usa el celular del remitente).',
        },
      },
    },
  },
  actualizar_direccion_cliente: {
    description: 'Guarda o actualiza la dirección de envío del cliente. Usar cuando el cliente no tiene dirección registrada y la proporciona, o cuando pide actualizar la dirección existente. Antes de actualizar una dirección existente, confirma con el cliente el cambio.',
    parameters: {
      type: 'object',
      properties: {
        direccion: {
          type: 'string',
          description: 'Dirección completa: calle, número, colonia, ciudad, estado y código postal.',
        },
        celular: {
          type: 'string',
          description: 'Número de celular del cliente (opcional, por defecto el del remitente).',
        },
      },
      required: ['direccion'],
    },
  },
  consultar_disponibilidad: {
    description: 'Consulta la disponibilidad de un producto en la base de datos de conocimiento. Usar cuando el cliente pregunta si hay stock o disponibilidad.',
    parameters: {
      type: 'object',
      properties: {
        producto: { type: 'string', description: 'Nombre o SKU del producto a consultar' },
      },
      required: ['producto'],
    },
  },
  consultar_pedido: {
    description: 'Consulta el estado de un pedido por su número de orden (ID). Usar cuando el cliente proporciona un número de pedido para saber su estado, productos y total.',
    parameters: {
      type: 'object',
      properties: {
        numero_pedido: { type: 'string', description: 'Número o ID del pedido a consultar' },
      },
      required: ['numero_pedido'],
    },
  },
  generar_link_pago: {
    description: 'Genera un link de pago para que el cliente pague su pedido. Usar después de que el cliente confirme que quiere pagar. Requiere el ID del pedido o el monto y descripción.',
    parameters: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'ID del pedido (si existe)' },
        monto: { type: 'number', description: 'Monto total a cobrar en MXN' },
        descripcion: { type: 'string', description: 'Descripción del cobro' },
      },
      required: ['monto', 'descripcion'],
    },
  },
};

// ---------------------------------------------------------------------------
// Build tools for each provider based on agent's enabled_tools
// ---------------------------------------------------------------------------

function getEnabledToolDefs(enabledTools?: string[]): Record<string, typeof TOOL_DEFINITIONS[string]> {
  if (!enabledTools || enabledTools.length === 0) return {};
  const result: Record<string, typeof TOOL_DEFINITIONS[string]> = {};
  for (const toolName of enabledTools) {
    if (TOOL_DEFINITIONS[toolName]) {
      result[toolName] = TOOL_DEFINITIONS[toolName];
    }
    // consultar_disponibilidad is always included if crear_pedido is enabled
    if (toolName === 'crear_pedido' && TOOL_DEFINITIONS['consultar_disponibilidad']) {
      result['consultar_disponibilidad'] = TOOL_DEFINITIONS['consultar_disponibilidad'];
    }
  }
  return result;
}

function buildOpenAITools(enabledTools?: string[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const defs = getEnabledToolDefs(enabledTools);
  return Object.entries(defs).map(([name, def]) => ({
    type: 'function' as const,
    function: {
      name,
      description: def.description,
      parameters: def.parameters,
    },
  }));
}

function buildAnthropicTools(enabledTools?: string[]): Anthropic.Tool[] {
  const defs = getEnabledToolDefs(enabledTools);
  return Object.entries(defs).map(([name, def]) => ({
    name,
    description: def.description,
    input_schema: def.parameters as Anthropic.Tool['input_schema'],
  }));
}

function buildGoogleTools(enabledTools?: string[]): Record<string, unknown>[] {
  const defs = getEnabledToolDefs(enabledTools);
  const functionDeclarations = Object.entries(defs).map(([name, def]) => ({
    name,
    description: def.description,
    parameters: def.parameters,
  }));
  if (functionDeclarations.length === 0) return [];
  return [{ functionDeclarations }];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export function buildSystemPrompt(agentPrompt: string, knowledgeContext: string, enabledTools?: string[], currentDateTime?: string): string {
  let prompt = agentPrompt;
  if (knowledgeContext) {
    prompt += `\n\n--- Base de Conocimiento ---\n${knowledgeContext}`;
  }

  // Add order-creation instructions if crear_pedido is enabled
  if (enabledTools?.includes('crear_pedido')) {
    prompt += `\n\n--- Instrucciones para Pedidos ---
Tienes la capacidad de crear pedidos para los clientes. Sigue estas reglas:
1. Cuando un cliente quiera comprar productos, busca los productos en la base de conocimiento para obtener precios y disponibilidad.
2. El cliente tiene un porcentaje de descuento asignado sobre el precio de lista (precio de venta). El descuento por defecto es 40%. Aplica SIEMPRE el descuento del cliente al calcular el precio unitario que le informas: precio_final = precio_lista * (1 - descuento/100). La herramienta crear_pedido hace este cálculo automáticamente.
3. Antes de crear el pedido, SIEMPRE muestra al cliente un resumen con los productos, cantidades, precios unitarios ya con descuento y el total. Si el descuento no es el default (40%), menciónalo al cliente.
4. SIEMPRE identifica el tipo de entrega antes de crear el pedido. Pregunta al cliente explícitamente si prefiere CLIENTE RECOGE, ENVÍO DIRECTO o ENVÍO EN RUTA.
5. Si el tipo de entrega es ENVÍO DIRECTO o ENVÍO EN RUTA, el cliente DEBE tener una dirección registrada. Usa consultar_cliente al principio de la conversación para verificar si tiene dirección; si no la tiene, pídela y guárdala con actualizar_direccion_cliente. Si ya tiene una dirección, confírmala con el cliente y dale la opción de actualizarla.
6. Pide confirmacion explicita del cliente (que diga "si", "confirmo", "dale", etc.) ANTES de ejecutar la herramienta crear_pedido.
7. Si el cliente dice que si, usa la herramienta crear_pedido con la lista de productos y el metodo_entrega correcto.
8. Si el cliente quiere modificar algo, ajusta la lista y vuelve a pedir confirmacion.
9. Puedes usar la herramienta consultar_disponibilidad para verificar stock de productos especificos.
10. Nunca inventes precios. Siempre usa los precios de la base de conocimiento y aplica el descuento del cliente.

REGLA CRITICA ANTI-DUPLICADOS:
- Una vez que crear_pedido devuelva un order_id exitoso, ese pedido QUEDA REGISTRADO. No lo crees de nuevo.
- Si después el cliente dice "gracias", "listo", "ok", "perfecto", "todo bien" o cualquier expresión de cierre, NO ejecutes crear_pedido. Solo confirma que el pedido está registrado.
- Solo ejecuta crear_pedido si el cliente pide productos NUEVOS y DIFERENTES a los del pedido existente.
- Si el sistema devuelve blocked_duplicate=true, informa al cliente que su pedido ya está registrado y NO intentes crearlo de nuevo.`;
  }

  if (enabledTools?.includes('consultar_cliente')) {
    prompt += `\n\n--- Instrucciones para identificación del cliente ---
Al iniciar una conversación o cuando necesites saber datos del cliente, usa consultar_cliente con su celular (si no se proporciona, se usa el del remitente del mensaje).
1. La respuesta incluye: nombre, descuento asignado (%) y dirección de envío registrada (si existe).
2. Si el cliente NO tiene dirección registrada y el pedido requiere envío, solicítala antes de crear el pedido.
3. Si el cliente SÍ tiene dirección registrada, confírmala textualmente con el cliente antes del envío y ofrécele la opción de actualizarla.
4. Si el descuento del cliente NO es el default (40%), tenlo presente al calcular precios y menciónaselo cuando sea relevante.`;
  }

  if (enabledTools?.includes('actualizar_direccion_cliente')) {
    prompt += `\n\n--- Instrucciones para dirección del cliente ---
1. Cuando el cliente te dicte una nueva dirección, usa actualizar_direccion_cliente con la dirección completa (calle, número, colonia, ciudad, estado, CP).
2. Antes de sobrescribir una dirección existente, confirma el cambio con el cliente.
3. Después de guardar, confirma brevemente al cliente que su dirección quedó registrada.`;
  }

  if (enabledTools?.includes('consultar_pedido')) {
    prompt += `\n\n--- Instrucciones para Consulta de Pedidos ---
Cuando un cliente pregunte por el estado de su pedido o proporcione un numero de orden, usa la herramienta consultar_pedido.
1. Pide al cliente su numero de pedido si no lo ha proporcionado.
2. Usa la herramienta con el numero proporcionado.
3. Informa al cliente el estado, los productos y el total de su pedido de forma clara.
4. Si no se encuentra el pedido, pide al cliente que verifique el numero.`;
  }

  if (enabledTools?.includes('generar_link_pago')) {
    prompt += `\n\n--- Instrucciones para Links de Pago ---
Puedes generar links de pago para que el cliente pague directamente.
1. Solo genera un link de pago cuando el cliente confirme que quiere pagar.
2. Necesitas el monto y una descripcion del cobro.
3. Si hay un pedido asociado, incluye el order_id.
4. Envia el link generado al cliente para que pueda pagar.`;
  }

  prompt += '\n\nIMPORTANTE: Responde de forma concisa y directa, como en una conversacion de WhatsApp. Maximo 2-3 parrafos cortos. No uses markdown, asteriscos ni formato especial.';
  prompt += '\n\nCuando menciones un producto que tiene imagen disponible, incluye la URL completa de la imagen en tu respuesta. No la ocultes ni la modifiques.';
  if (currentDateTime) {
    prompt += `\n\nFecha y hora actual (Ciudad de México): ${currentDateTime}`;
  }
  return prompt;
}

// ---------------------------------------------------------------------------
// Main entry: getAIResponse
// ---------------------------------------------------------------------------

export async function getAIResponse(
  agent: AIAgent,
  messages: Message[],
  knowledgeContext: string,
  currentDateTime?: string
): Promise<AIResponse | null> {
  const systemPrompt = buildSystemPrompt(agent.system_prompt, knowledgeContext, agent.enabled_tools, currentDateTime);

  // Map sender_type to role, then merge consecutive messages with the same role
  const mapped = messages.map((m) => ({
    role: m.sender_type === 'customer' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }));

  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const msg of mapped) {
    const last = conversationHistory[conversationHistory.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n\n' + msg.content;
    } else {
      conversationHistory.push({ ...msg });
    }
  }

  try {
    switch (agent.provider) {
      case 'openai':
        return await callOpenAI(agent.api_key_encrypted, agent.model, systemPrompt, conversationHistory, agent.enabled_tools);
      case 'anthropic':
        return await callAnthropic(agent.api_key_encrypted, agent.model, systemPrompt, conversationHistory, agent.enabled_tools);
      case 'google':
        return await callGoogle(agent.api_key_encrypted, agent.model, systemPrompt, conversationHistory, agent.enabled_tools);
      default:
        console.error(`Unsupported AI provider: ${agent.provider}`);
        return null;
    }
  } catch (err) {
    console.error(`AI response error (${agent.provider}/${agent.model}):`, err);
    return null;
  }
}

// Continue a conversation after tool results.
// providerMessages must ALREADY contain the assistant turn (with tool_use/tool_calls)
// and the tool_result turn appended by the caller.
export async function continueWithToolResults(
  agent: AIAgent,
  systemPrompt: string,
  providerMessages: unknown[]
): Promise<AIResponse | null> {
  try {
    switch (agent.provider) {
      case 'openai':
        return await continueOpenAI(agent.api_key_encrypted, agent.model, systemPrompt, providerMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[], agent.enabled_tools);
      case 'anthropic':
        return await continueAnthropic(agent.api_key_encrypted, agent.model, systemPrompt, providerMessages as Anthropic.MessageParam[], agent.enabled_tools);
      case 'google':
        return await continueGoogle(agent.api_key_encrypted, agent.model, systemPrompt, providerMessages as Record<string, unknown>[], agent.enabled_tools);
      default:
        return null;
    }
  } catch (err) {
    console.error(`AI continue error (${agent.provider}):`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const client = new OpenAI({ apiKey });
  const tools = buildOpenAITools(enabledTools);

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_tokens: 500,
    temperature: 0.7,
  };
  if (tools.length > 0) params.tools = tools;

  const response = await client.chat.completions.create(params);
  const choice = response.choices[0];
  if (!choice) return null;

  const parts: AIResponsePart[] = [];
  if (choice.message.content) {
    parts.push({ type: 'text', text: choice.message.content });
  }
  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      parts.push({
        type: 'tool_call',
        toolName: tc.function.name,
        toolArgs: JSON.parse(tc.function.arguments),
        toolCallId: tc.id,
      });
    }
  }

  const tokenUsage = response.usage
    ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
    : undefined;

  return { parts, hasToolCalls: parts.some((p) => p.type === 'tool_call'), tokenUsage };
}

async function continueOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  previousMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const client = new OpenAI({ apiKey });
  const tools = buildOpenAITools(enabledTools);

  // previousMessages already contains the assistant turn with tool_calls
  // and the subsequent tool-role messages with their results.
  const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...previousMessages,
  ];

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: allMessages,
    max_tokens: 500,
    temperature: 0.7,
  };
  if (tools.length > 0) params.tools = tools;

  const response = await client.chat.completions.create(params);
  const choice = response.choices[0];
  if (!choice) return null;

  const parts: AIResponsePart[] = [];
  if (choice.message.content) {
    parts.push({ type: 'text', text: choice.message.content });
  }
  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      parts.push({
        type: 'tool_call',
        toolName: tc.function.name,
        toolArgs: JSON.parse(tc.function.arguments),
        toolCallId: tc.id,
      });
    }
  }

  const tokenUsage = response.usage
    ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
    : undefined;

  return { parts, hasToolCalls: parts.some((p) => p.type === 'tool_call'), tokenUsage };
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const client = new Anthropic({ apiKey });
  const tools = buildAnthropicTools(enabledTools);

  // Validate messages before calling the API
  if (messages.length === 0) {
    throw new Error('Anthropic: messages array is empty. Cannot send a request with no messages.');
  }
  if (messages[messages.length - 1].role !== 'user') {
    throw new Error(`Anthropic: last message has role '${messages[messages.length - 1].role}', but must be 'user'. History may be corrupted.`);
  }

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    system: systemPrompt,
    messages,
    max_tokens: 500,
  };
  if (tools.length > 0) params.tools = tools;

  const response = await client.messages.create(params);
  return parseAnthropicResponse(response);
}

async function continueAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  previousMessages: Anthropic.MessageParam[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const client = new Anthropic({ apiKey });
  const tools = buildAnthropicTools(enabledTools);

  // previousMessages already contains the assistant turn with tool_use blocks
  // and the user turn with the matching tool_result blocks.
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    system: systemPrompt,
    messages: previousMessages,
    max_tokens: 500,
  };
  if (tools.length > 0) params.tools = tools;

  const response = await client.messages.create(params);
  return parseAnthropicResponse(response);
}

function parseAnthropicResponse(response: Anthropic.Message): AIResponse {
  const parts: AIResponsePart[] = [];
  for (const block of response.content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text });
    } else if (block.type === 'tool_use') {
      parts.push({
        type: 'tool_call',
        toolName: block.name,
        toolArgs: block.input as Record<string, unknown>,
        toolCallId: block.id,
      });
    }
  }
  const tokenUsage = response.usage
    ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
    : undefined;
  return { parts, hasToolCalls: parts.some((p) => p.type === 'tool_call'), tokenUsage };
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------

async function callGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const tools = buildGoogleTools(enabledTools);

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
  };
  if (tools.length > 0) body.tools = tools;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as GoogleApiResponse;
  return parseGoogleResponse(data);
}

async function continueGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  previousContents: Record<string, unknown>[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const tools = buildGoogleTools(enabledTools);

  // previousContents already contains the model turn with functionCall parts
  // and the user turn with the matching functionResponse parts.
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: previousContents,
    generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
  };
  if (tools.length > 0) body.tools = tools;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini continue error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as GoogleApiResponse;
  return parseGoogleResponse(data);
}

interface GoogleApiResponse {
  candidates?: {
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: { name: string; args: Record<string, unknown> };
      }>;
    };
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

function parseGoogleResponse(data: GoogleApiResponse): AIResponse {
  const parts: AIResponsePart[] = [];
  const candidateParts = data.candidates?.[0]?.content?.parts ?? [];

  for (const part of candidateParts) {
    if (part.text) {
      parts.push({ type: 'text', text: part.text });
    }
    if (part.functionCall) {
      parts.push({
        type: 'tool_call',
        toolName: part.functionCall.name,
        toolArgs: part.functionCall.args,
        toolCallId: part.functionCall.name,
      });
    }
  }

  const tokenUsage = data.usageMetadata
    ? {
        inputTokens: data.usageMetadata.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
      }
    : undefined;

  return { parts, hasToolCalls: parts.some((p) => p.type === 'tool_call'), tokenUsage };
}
