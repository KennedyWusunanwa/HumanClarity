import { humanizeText } from '@/lib/humanizer';
import { callLLM } from '@/lib/humanizer/llm-provider';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ACTION_PROMPTS = {
  summarize:
    'You are a careful academic and professional editor. Summarize the text clearly and directly. Preserve the important claims, evidence, limits, and qualifications. Use plain, natural American English. Return only the summary.',
  expand:
    'You are a careful academic and professional editor. Expand the text with useful detail, explanation, and structure while preserving the original meaning and level of evidence. Do not invent facts, citations, examples, or claims. Use clear, natural American English. Return only the expanded text.',
  fix_grammar:
    'You are a careful academic and professional editor. Correct grammar, spelling, punctuation, and awkward phrasing while preserving meaning, tone, nuance, citations, and technical terms. Use clear, natural American English. Return only the corrected text.',
};

function getProviders() {
  const providers = [];

  if (process.env.POLLINATIONS_API_KEY) {
    providers.push({
      type: 'openai',
      name: 'Pollinations AI',
      apiKey: process.env.POLLINATIONS_API_KEY,
      baseUrl: 'https://gen.pollinations.ai/v1',
      model: process.env.POLLINATIONS_MODEL || 'openai',
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    // OpenRouter free models often hit upstream rate limits or get retired. Try the user's
    // configured model first (if any), then fall through a small ladder of known-working
    // non-reasoning free models so a 429/404 on one doesn't kill the whole request.
    const openRouterModels = [];
    if (process.env.OPENROUTER_MODEL) openRouterModels.push(process.env.OPENROUTER_MODEL);
    for (const m of [
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'google/gemma-4-26b-a4b-it:free',
    ]) {
      if (!openRouterModels.includes(m)) openRouterModels.push(m);
    }
    for (const model of openRouterModels) {
      providers.push({
        type: 'openai',
        name: `OpenRouter (${model})`,
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1',
        model,
      });
    }
  }

  return providers;
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildUserPrompt(action, text) {
  switch (action) {
    case 'summarize':
      return `Summarize the following text:\n\n${text}`;
    case 'expand':
      return `Expand the following text:\n\n${text}`;
    case 'fix_grammar':
      return `Correct the following text:\n\n${text}`;
    default:
      return text;
  }
}

export async function POST(request) {
  try {
    const { text, action, humanizeOptions } = await request.json();

    if (!text?.trim()) {
      return Response.json({ error: 'No text provided.' }, { status: 400 });
    }

    const providers = getProviders();
    if (!providers.length) {
      return Response.json(
        {
          error:
            'Text provider is not configured. Add POLLINATIONS_API_KEY or OPENROUTER_API_KEY to your .env.local file.',
        },
        { status: 503 },
      );
    }

    if (action !== 'humanize' && !ACTION_PROMPTS[action]) {
      return Response.json({ error: 'Invalid action.' }, { status: 400 });
    }

    const errors = [];
    for (const provider of providers) {
      try {
        if (action === 'humanize') {
          const result = await humanizeText(text, {
            level: humanizeOptions?.level ?? 'medium',
            style: humanizeOptions?.style ?? 'academic',
            purpose: humanizeOptions?.purpose ?? 'academic',
            passes: humanizeOptions?.passes,
            preserveFormatting: humanizeOptions?.preserveFormatting,
            targetScore: humanizeOptions?.targetScore,
            provider,
          });

          return Response.json({
            result: result.text,
            wordCount: countWords(result.text),
            score: result.score,
            passes: result.passes,
            chunks: result.chunks,
            level: result.level,
            provider: provider.name,
          });
        }

        const result = await callLLM(provider, {
          systemPrompt: ACTION_PROMPTS[action],
          userText: buildUserPrompt(action, text),
          temperature: action === 'fix_grammar' ? 0.2 : action === 'summarize' ? 0.45 : 0.75,
          maxTokens: Math.max(1024, Math.ceil(countWords(text) * (action === 'expand' ? 1.8 : 1.2))),
        });

        return Response.json({
          result: result.trim(),
          wordCount: countWords(result),
          provider: provider.name,
        });
      } catch (err) {
        errors.push(`${provider.name}: ${err.message ?? 'Processing failed.'}`);
      }
    }

    return Response.json({ error: errors.join(' | ') || 'Processing failed.' }, { status: 502 });
  } catch (err) {
    const status = err.status ?? 500;
    return Response.json({ error: err.message ?? 'Processing failed.' }, { status });
  }
}
