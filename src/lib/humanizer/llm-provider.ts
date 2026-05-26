import { LLMProvider } from './types';

export interface LLMCallOptions {
  systemPrompt: string;
  userText: string;
  temperature: number;
  maxTokens?: number;
}

export async function callLLM(
  provider: LLMProvider,
  options: LLMCallOptions,
): Promise<string> {
  const { systemPrompt, userText, temperature, maxTokens = 2048 } = options;
  return callOpenAICompat(provider, systemPrompt, userText, temperature, maxTokens);
}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TRANSIENT_RETRIES = 1;

async function callOpenAICompat(
  provider: LLMProvider,
  systemPrompt: string,
  userText: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const model = provider.model ?? 'openai';
  const baseUrl = provider.baseUrl ?? 'https://gen.pollinations.ai/v1';
  const providerName = provider.name ?? 'OpenAI-compatible provider';
  const maxAttempts = MAX_TRANSIENT_RETRIES + 1;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature,
          // Generous ceiling so reasoning-style models don't burn the budget on chain-of-thought
          // before they emit the actual reply.
          max_tokens: Math.max(4096, maxTokens),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const transient = res.status === 429 || res.status >= 500;
        lastError = new Error(`${providerName} API error ${res.status}: ${body}`);
        if (transient && attempt < maxAttempts) {
          await sleep(250);
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const message = data?.choices?.[0]?.message;
      const content = Array.isArray(message?.content)
        ? message.content.map((part: any) => part?.text ?? '').join('')
        : message?.content;

      if (typeof content === 'string' && content.trim()) {
        return content.trim();
      }

      // Empty content — most likely a content filter or the provider misbehaving.
      // Fail fast so the outer fallback can try the next provider rather than spinning here.
      const finishReason = data?.choices?.[0]?.finish_reason;
      const modelName = data?.model ?? model;
      throw new Error(
        `${providerName} returned an empty response from ${modelName}. Finish reason: ${finishReason ?? 'unknown'}.`,
      );
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      lastError = isAbort
        ? new Error(`${providerName} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
        : (err instanceof Error ? err : new Error(String(err)));
      const isNetworkLevel = isAbort || err?.code === 'UND_ERR_SOCKET' || err?.code === 'ECONNRESET' || err?.code === 'ENOTFOUND';
      if (attempt < maxAttempts && isNetworkLevel) {
        await sleep(250);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`${providerName} request failed`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
