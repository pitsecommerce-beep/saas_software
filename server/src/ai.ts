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
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS: Record<string, { description: string; parameters: Record<string, unknown> }> = {
  crear_pedido: {
    description: 'Crea un pedido para el cliente con los productos especificados. Solo usar después de que el cliente haya confirmado explícitamente que quiere proceder con la compra.',
    parameters: {
      type: 'object',
      properties: {
        productos: {
          type: 'array',
          description: 'Lista de productos a incluir en el pedido',
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
        notas: { type: 'string', description: 'Notas adicionales del pedido' },
      },
      required: ['productos'],
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

export function buildSystemPrompt(agentPrompt: string, knowledgeContext: string, enabledTools?: string[]): string {
  let prompt = agentPrompt;
  if (knowledgeContext) {
    prompt += `\n\n--- Base de Conocimiento ---\n${knowledgeContext}`;
  }

  // Add order-creation instructions if crear_pedido is enabled
  if (enabledTools?.includes('crear_pedido')) {
    prompt += `\n\n--- Instrucciones para Pedidos ---
Tienes la capacidad de crear pedidos para los clientes. Sigue estas reglas:
1. Cuando un cliente quiera comprar productos, busca los productos en la base de conocimiento para obtener precios y disponibilidad.
2. Antes de crear el pedido, SIEMPRE muestra al cliente un resumen con los productos, cantidades, precios unitarios y el total.
3. Pide confirmacion explicita del cliente (que diga "si", "confirmo", "dale", etc.) ANTES de ejecutar la herramienta crear_pedido.
4. Si el cliente dice que si, usa la herramienta crear_pedido con la lista de productos.
5. Si el cliente quiere modificar algo, ajusta la lista y vuelve a pedir confirmacion.
6. Puedes usar la herramienta consultar_disponibilidad para verificar stock de productos especificos.
7. Nunca inventes precios. Siempre usa los precios de la base de conocimiento.`;
  }

  prompt += '\n\nIMPORTANTE: Responde de forma concisa y directa, como en una conversacion de WhatsApp. Maximo 2-3 parrafos cortos. No uses markdown, asteriscos ni formato especial.';
  prompt += '\n\nCuando menciones un producto que tiene imagen disponible, incluye la URL completa de la imagen en tu respuesta. No la ocultes ni la modifiques.';
  return prompt;
}

// ---------------------------------------------------------------------------
// Main entry: getAIResponse
// ---------------------------------------------------------------------------

export async function getAIResponse(
  agent: AIAgent,
  messages: Message[],
  knowledgeContext: string
): Promise<AIResponse | null> {
  const systemPrompt = buildSystemPrompt(agent.system_prompt, knowledgeContext, agent.enabled_tools);

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

// Continue a conversation after tool results
export async function continueWithToolResults(
  agent: AIAgent,
  systemPrompt: string,
  providerMessages: unknown[],
  toolResults: { toolCallId: string; result: string }[]
): Promise<AIResponse | null> {
  try {
    switch (agent.provider) {
      case 'openai':
        return await continueOpenAI(agent.api_key_encrypted, agent.model, systemPrompt, providerMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[], toolResults, agent.enabled_tools);
      case 'anthropic':
        return await continueAnthropic(agent.api_key_encrypted, agent.model, systemPrompt, providerMessages as Anthropic.MessageParam[], toolResults, agent.enabled_tools);
      case 'google':
        return await continueGoogle(agent.api_key_encrypted, agent.model, systemPrompt, providerMessages as Record<string, unknown>[], toolResults, agent.enabled_tools);
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

  return { parts, hasToolCalls: parts.some((p) => p.type === 'tool_call') };
}

async function continueOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  previousMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  toolResults: { toolCallId: string; result: string }[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const client = new OpenAI({ apiKey });
  const tools = buildOpenAITools(enabledTools);

  // Add tool results as tool messages
  const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...previousMessages,
    ...toolResults.map((tr) => ({
      role: 'tool' as const,
      tool_call_id: tr.toolCallId,
      content: tr.result,
    })),
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

  return { parts, hasToolCalls: parts.some((p) => p.type === 'tool_call') };
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
  toolResults: { toolCallId: string; result: string }[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const client = new Anthropic({ apiKey });
  const tools = buildAnthropicTools(enabledTools);

  // Anthropic expects tool_result blocks in the user turn
  const toolResultContent: Anthropic.ToolResultBlockParam[] = toolResults.map((tr) => ({
    type: 'tool_result',
    tool_use_id: tr.toolCallId,
    content: tr.result,
  }));

  const allMessages: Anthropic.MessageParam[] = [
    ...previousMessages,
    { role: 'user', content: toolResultContent },
  ];

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    system: systemPrompt,
    messages: allMessages,
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
  return { parts, hasToolCalls: parts.some((p) => p.type === 'tool_call') };
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

  const data = await response.json() as {
    candidates?: {
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
        }>;
      };
    }[];
  };

  return parseGoogleResponse(data);
}

async function continueGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  previousContents: Record<string, unknown>[],
  toolResults: { toolCallId: string; result: string }[],
  enabledTools?: string[]
): Promise<AIResponse | null> {
  const tools = buildGoogleTools(enabledTools);

  // Google expects functionResponse parts
  const functionResponses = toolResults.map((tr) => ({
    functionResponse: {
      name: tr.toolCallId, // For Google, we use the function name stored in toolCallId
      response: { result: tr.result },
    },
  }));

  const contents = [
    ...previousContents,
    { role: 'user', parts: functionResponses },
  ];

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
    throw new Error(`Gemini continue error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as {
    candidates?: {
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
        }>;
      };
    }[];
  };
  return parseGoogleResponse(data);
}

function parseGoogleResponse(data: {
  candidates?: {
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: { name: string; args: Record<string, unknown> };
      }>;
    };
  }[];
}): AIResponse {
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
        toolCallId: part.functionCall.name, // Google uses function name as ID
      });
    }
  }

  return { parts, hasToolCalls: parts.some((p) => p.type === 'tool_call') };
}
