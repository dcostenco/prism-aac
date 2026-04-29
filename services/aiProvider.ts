/**
 * AI Provider Service — Gemini 3.1 (cloud) or prism-coder:7b (local/offline)
 *
 * Paid tiers (standard/advanced/enterprise) use Gemini 3.1 Pro for
 * context-aware phrase suggestions and smart prediction enhancement.
 * Free tier and offline mode fall back to prism-coder:7b via Ollama.
 */

import { AIProvider, AIProviderConfig, AI_PROVIDERS, SubscriptionTier, TIER_LIMITS } from '../types';
import { getSetting } from '../db/repository';

export interface AICompletionRequest {
  prompt: string;
  context?: string;
  language?: string;
  maxTokens?: number;
}

export interface AICompletionResponse {
  text: string;
  provider: AIProvider;
  local: boolean;
}

/**
 * Resolve which AI provider to use based on tier and connectivity.
 * - Paid tiers → Gemini 3.1 Pro (falls back to prism-coder offline)
 * - Free tier → prism-coder:7b via Ollama (local only)
 * - No connectivity + no Ollama → returns 'none'
 */
export async function resolveProvider(tier: SubscriptionTier): Promise<AIProviderConfig> {
  const limits = TIER_LIMITS[tier];

  if (!limits.hasAI) {
    return AI_PROVIDERS['prism-coder'];
  }

  const provider = limits.aiProvider;

  if (provider === 'gemini') {
    const apiKey = await getSetting('gemini_api_key');
    if (apiKey) return AI_PROVIDERS['gemini'];
    // No API key — fall back to local
    return AI_PROVIDERS['prism-coder'];
  }

  return AI_PROVIDERS[provider] ?? AI_PROVIDERS['none'];
}

/**
 * Generate AI-powered phrase suggestions based on conversation context.
 */
export async function generateSuggestions(
  request: AICompletionRequest,
  tier: SubscriptionTier,
): Promise<AICompletionResponse> {
  const config = await resolveProvider(tier);

  if (config.provider === 'none') {
    return { text: '', provider: 'none', local: true };
  }

  if (config.provider === 'gemini') {
    return callGemini(request, config);
  }

  return callPrismCoder(request, config);
}

async function callGemini(
  request: AICompletionRequest,
  config: AIProviderConfig,
): Promise<AICompletionResponse> {
  const apiKey = await getSetting('gemini_api_key');
  if (!apiKey) {
    return callPrismCoder(request, AI_PROVIDERS['prism-coder']);
  }

  try {
    const url = `${config.endpoint}/models/${config.model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: buildPrompt(request),
          }],
        }],
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 100,
          temperature: 0.3,
        },
      }),
    });

    if (!res.ok) throw new Error(`Gemini ${res.status}`);

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return { text, provider: 'gemini', local: false };
  } catch {
    // Offline or API error — fall back to local
    return callPrismCoder(request, AI_PROVIDERS['prism-coder']);
  }
}

async function callPrismCoder(
  request: AICompletionRequest,
  config: AIProviderConfig,
): Promise<AICompletionResponse> {
  try {
    const res = await fetch(`${config.endpoint}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: buildPrompt(request),
        stream: false,
        options: {
          num_predict: request.maxTokens ?? 100,
          temperature: 0.3,
        },
      }),
    });

    if (!res.ok) throw new Error(`Ollama ${res.status}`);

    const data = await res.json();
    return { text: data?.response ?? '', provider: 'prism-coder', local: true };
  } catch {
    return { text: '', provider: 'none', local: true };
  }
}

function buildPrompt(request: AICompletionRequest): string {
  const lang = request.language ?? 'en';
  return [
    `You are an AAC (Augmentative and Alternative Communication) assistant.`,
    `Language: ${lang}`,
    request.context ? `Conversation context: ${request.context}` : '',
    `Suggest 3-5 short, natural phrases the user might want to say next.`,
    `Current input: "${request.prompt}"`,
    `Return ONLY a JSON array of strings. No explanation.`,
  ].filter(Boolean).join('\n');
}
