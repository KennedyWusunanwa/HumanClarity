// ─── HumanClarity Humanizer — LLM Provider Abstraction ───────────────────────
// Supports Groq (OpenAI-compatible), Google Gemini, any OpenAI-compatible API,
// and fully custom async provider functions.
//
// Recommended providers:
//   Groq  → model: 'llama-3.3-70b-versatile' (fast, cheap, excellent quality)
//   Gemini → model: 'gemini-2.0-flash' (fast, cheap, strong reasoning)

import { LLMProvider } from './types';

export interface LLMCallOptions {
  systemPrompt: string;
  userText: string;
  temperature: number;
  maxTokens?: number;
}

/**
 * Dispatches an LLM call to the configured provider.
 * Throws on API errors with a clear message.
 */
export async function callLLM(
  provider: LLMProvider,
  options: LLMCallOptions,
): Promise<string> {
  const { systemPrompt, userText, temperature, maxTokens = 4096 } = options;

  if (provider.callFn) {
    return provider.callFn(systemPrompt, userText, temperature);
  }

  switch (provider.type) {
    case 'groq':
      return callGroq(provider, systemPrompt, userText, temperature, maxTokens);
    case 'gemini':
      return callGemini(provider, systemPrompt, userText, temperature, maxTokens);
    case 'openai':
      return callOpenAICompat(provider, systemPrompt, userText, temperature, maxTokens);
    case 'custom':
      throw new Error('Provider type "custom" requires a callFn to be provided.');
    default:
      throw new Error(`Unknown provider type: "${(provider as LLMProvider).type}"`);
  }
}

// ── Groq (OpenAI-compatible) ──────────────────────────────────────────────────

async function callGroq(
  provider: LLMProvider,
  systemPrompt: string,
  userText: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const model = provider.model ?? 'llama-3.3-70b-versatile';
  const baseUrl = provider.baseUrl ?? 'https://api.groq.com/openai/v1';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty response');
  return content.trim();
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

async function callGemini(
  provider: LLMProvider,
  systemPrompt: string,
  userText: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const model = provider.model ?? 'gemini-2.0-flash';
  const baseUrl = provider.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  const url = `${baseUrl}/models/${model}:generateContent?key=${provider.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userText }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        candidateCount: 1,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    const reason = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned empty content. Finish reason: ${reason ?? 'unknown'}`);
  }
  return content.trim();
}

// ── OpenAI-compatible (also works for Together AI, Fireworks, etc.) ───────────

async function callOpenAICompat(
  provider: LLMProvider,
  systemPrompt: string,
  userText: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const model = provider.model ?? 'gpt-4o-mini';
  const baseUrl = provider.baseUrl ?? 'https://api.openai.com/v1';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI-compatible API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI-compatible provider returned an empty response');
  return content.trim();
}
