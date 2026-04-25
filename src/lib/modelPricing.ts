// USD por 1 millón de tokens (precios aproximados 2025)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  // Anthropic
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  // Google
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
};

const DEFAULT_PRICING = { input: 2.0, output: 8.0 };

export function getPricing(model: string): { input: number; output: number } {
  // Busca por coincidencia exacta primero, luego por prefijo
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  const key = Object.keys(MODEL_PRICING).find((k) => model.startsWith(k) || k.startsWith(model));
  return key ? MODEL_PRICING[key] : DEFAULT_PRICING;
}

export function calculateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getPricing(model);
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
