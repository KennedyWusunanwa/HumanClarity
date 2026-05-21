import { humanizeText } from '@/lib/humanizer';
import { callLLM } from '@/lib/humanizer/llm-provider';

const ACTION_PROMPTS = {
  summarize:
    'You are a careful academic and professional editor. Summarize the text clearly and directly. Preserve the important claims, evidence, limits, and qualifications. Use plain, natural American English. Return only the summary.',
  expand:
    'You are a careful academic and professional editor. Expand the text with useful detail, explanation, and structure while preserving the original meaning and level of evidence. Do not invent facts, citations, examples, or claims. Use clear, natural American English. Return only the expanded text.',
  fix_grammar:
    'You are a careful academic and professional editor. Correct grammar, spelling, punctuation, and awkward phrasing while preserving meaning, tone, nuance, citations, and technical terms. Use clear, natural American English. Return only the corrected text.',
};

function getProvider() {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      type: 'openai',
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: 'https://openrouter.ai/api/v1',
      model: process.env.HUMANIZER_MODEL || 'openrouter/free',
    };
  }

  if (process.env.POLLINATIONS_API_KEY) {
    return {
      type: 'openai',
      apiKey: process.env.POLLINATIONS_API_KEY,
      baseUrl: 'https://gen.pollinations.ai/v1',
      model: process.env.HUMANIZER_MODEL || 'deepseek',
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      type: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.HUMANIZER_MODEL || 'llama-3.3-70b-versatile',
    };
  }

  if (process.env.GEMINI_API_KEY) {
    return {
      type: 'gemini',
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.HUMANIZER_MODEL || 'gemini-2.0-flash',
    };
  }

  return null;
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

    const provider = getProvider();
    if (!provider) {
      return Response.json(
        {
          error:
            'Text provider is not configured. Add OPENROUTER_API_KEY, POLLINATIONS_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY to your .env.local file.',
        },
        { status: 503 },
      );
    }

    if (action === 'humanize') {
      const result = await humanizeText(text, {
        level: humanizeOptions?.level ?? 'ninja',
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
      });
    }

    if (!ACTION_PROMPTS[action]) {
      return Response.json({ error: 'Invalid action.' }, { status: 400 });
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
    });
  } catch (err) {
    const status = err.status ?? 500;
    return Response.json({ error: err.message ?? 'Processing failed.' }, { status });
  }
}
