import { HumanizeOptions, HumanizeResult, HumanizeLevel, LLMProvider } from './types';
import { extractProtectedRegions, restoreProtectedRegions } from './protect-regions';
import { buildSystemPrompt, buildUserMessage } from './prompts';
import { postProcess } from './postprocess';
import { scoreText, splitSentences, findAISentences } from './detector';
import { checkGovernance } from './governance';
import { callLLM } from './llm-provider';

const CHUNK_SIZE = 2500;

const LEVEL_PASSES: Record<HumanizeLevel, number> = {
  light: 1,
  medium: 1,
  aggressive: 2,
  ninja: 3,
};

const LEVEL_TEMPERATURES: Record<HumanizeLevel, number> = {
  light: 0.45,
  medium: 0.6,
  aggressive: 0.72,
  ninja: 0.82,
};

export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

async function rewriteChunk(
  chunk: string,
  options: Required<HumanizeOptions>,
  temperature: number,
  isRepass: boolean,
): Promise<string> {
  const systemPrompt = buildSystemPrompt({
    level: options.level,
    purpose: options.purpose,
    style: options.style,
    isRehumanizationPass: isRepass,
    temperature,
  });

  return callLLM(options.provider, {
    systemPrompt,
    userText: buildUserMessage(chunk),
    temperature,
    maxTokens: Math.max(512, Math.ceil(chunk.split(/\s+/).length * 1.2)),
  });
}

async function refineStiffSentences(
  text: string,
  options: Required<HumanizeOptions>,
  temperature: number,
): Promise<string> {
  const sentences = splitSentences(text);
  const flagged = findAISentences(sentences, 45);

  if (flagged.length === 0) {
    return text;
  }

  const systemPrompt = buildSystemPrompt({
    level: options.level === 'light' ? 'medium' : options.level,
    purpose: options.purpose,
    style: options.style,
    isRehumanizationPass: true,
  });

  let result = text;

  for (const sentence of flagged) {
    try {
      const rewritten = await callLLM(options.provider, {
        systemPrompt,
        userText:
          'Revise only this sentence so it reads more naturally, spartan, and fluently while adding slight human imperfections like hesitation or slight redundancy if it fits. Return only the revised sentence. Avoid all markdown, asterisks, semicolons, and em dashes.\n\n' +
          sentence,
        temperature,
        maxTokens: 300,
      });

      const cleaned = rewritten
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^Revised[:\s]+/i, '');

      if (cleaned && cleaned.length > 5 && cleaned.length < sentence.length * 1.75) {
        result = result.replace(sentence, cleaned);
      }
    } catch {
      // Skip a failed sentence-level rewrite and keep moving.
    }
  }

  return result;
}

export async function humanizeText(
  text: string,
  options?: HumanizeOptions,
): Promise<HumanizeResult> {
  if (!text?.trim()) {
    throw new Error('humanizeText: no text provided');
  }

  if (!options?.provider) {
    throw new Error(
      'humanizeText: options.provider is required. Set a provider such as { type: "groq" | "gemini" | "openai", apiKey: "..." }.',
    );
  }

  const level = options.level ?? 'medium';
  const resolved: Required<HumanizeOptions> = {
    level,
    style: options.style ?? 'academic',
    purpose: options.purpose ?? 'academic',
    passes: options.passes ?? LEVEL_PASSES[level],
    targetScore: options.targetScore ?? 72,
    preserveFormatting: options.preserveFormatting ?? true,
    provider: options.provider as LLMProvider,
  };

  const originalText = text;
  const { text: protectedText, regions } = extractProtectedRegions(text);
  const chunks = chunkText(protectedText);
  const processedChunks: string[] = [];
  let totalPassesRun = 0;

  for (const chunk of chunks) {
    let current = chunk;
    let localPasses = 0;
    let qualityScore = 0;
    let temperature = LEVEL_TEMPERATURES[resolved.level];

    const firstPass = await rewriteChunk(current, resolved, temperature, false);
    localPasses += 1;
    totalPassesRun += 1;

    const firstGovernance = checkGovernance(chunk, firstPass);
    current = firstGovernance.passed ? firstPass.trim() : chunk;
    current = postProcess(current, resolved.level, resolved.style);
    qualityScore = scoreText(current).total;

    while (localPasses < resolved.passes && qualityScore < resolved.targetScore) {
      temperature = Math.min(0.98, temperature + 0.04);
      localPasses += 1;
      totalPassesRun += 1;

      const refined =
        localPasses === 2
          ? await refineStiffSentences(current, resolved, temperature)
          : await rewriteChunk(current, resolved, temperature, true);

      const governance = checkGovernance(chunk, refined);
      if (governance.passed) {
        current = postProcess(refined.trim(), 'medium', resolved.style);
      }

      qualityScore = scoreText(current).total;
    }

    processedChunks.push(current);
  }

  let finalText = processedChunks.join('\n\n');
  finalText = restoreProtectedRegions(finalText, regions);

  return {
    text: finalText,
    originalText,
    score: scoreText(finalText).total,
    passes: totalPassesRun,
    chunks: chunks.length,
    level: resolved.level,
  };
}
