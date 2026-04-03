import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface AIAgent {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  api_key_encrypted: string;
  system_prompt: string;
}

interface Message {
  sender_type: string;
  content: string;
  created_at: string;
}

export async function getAIResponse(
  agent: AIAgent,
  messages: Message[],
  knowledgeContext: string
): Promise<string | null> {
  const systemPrompt = buildSystemPrompt(agent.system_prompt, knowledgeContext);
  const conversationHistory = messages.map((m) => ({
    role: m.sender_type === 'customer' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }));

  try {
    switch (agent.provider) {
      case 'openai':
        return await callOpenAI(agent.api_key_encrypted, agent.model, systemPrompt, conversationHistory);
      case 'anthropic':
        return await callAnthropic(agent.api_key_encrypted, agent.model, systemPrompt, conversationHistory);
      case 'google':
        return await callGoogle(agent.api_key_encrypted, agent.model, systemPrompt, conversationHistory);
      default:
        console.error(`Unsupported AI provider: ${agent.provider}`);
        return null;
    }
  } catch (err) {
    console.error(`AI response error (${agent.provider}/${agent.model}):`, err);
    return null;
  }
}

function buildSystemPrompt(agentPrompt: string, knowledgeContext: string): string {
  let prompt = agentPrompt;
  if (knowledgeContext) {
    prompt += `\n\n--- Base de Conocimiento ---\n${knowledgeContext}`;
  }
  prompt += '\n\nIMPORTANTE: Responde de forma concisa y directa, como en una conversación de WhatsApp. Máximo 2-3 párrafos cortos. No uses markdown, asteriscos ni formato especial.';
  prompt += '\n\nCuando menciones un producto que tiene imagen disponible, incluye la URL completa de la imagen en tu respuesta. No la ocultes ni la modifiques.';
  return prompt;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string | null> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_tokens: 500,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content ?? null;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string | null> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    system: systemPrompt,
    messages,
    max_tokens: 500,
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : null;
}

async function callGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string | null> {
  // Google Gemini API via REST
  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}
