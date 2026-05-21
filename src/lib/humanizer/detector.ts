// ─── HumanClarity Humanizer — Internal 12-Metric Detection Scorer ────────────
// Approximates AI-detector scores to decide when to stop re-humanizing.
// Based on StealthHumanizer's detection metrics. NOT a replacement for
// real detectors — used purely for internal quality-loop decisions.
//
// Score ≥ 55 → Human | 35–54 → Borderline | < 35 → AI
// Max possible score: 106 points across 12 metrics.

import { DetectionScore } from './types';

// ── Phrase lists ──────────────────────────────────────────────────────────────

const AI_PHRASES: string[] = [
  'it is important to note',
  'it is worth noting',
  'it should be noted',
  'it can be argued',
  'it could be argued',
  'it appears that',
  'it seems that',
  'one might argue',
  'one could argue',
  'in conclusion',
  'in summary',
  'to summarize',
  'furthermore',
  'moreover',
  'additionally',
  'consequently',
  'it is crucial',
  'it is essential',
  'it has been shown',
  'it has been observed',
  'it has been suggested',
  'it has been found',
  'in order to',
  'due to the fact',
  'with regard to',
  'a wide range of',
  'shed light on',
  'utilize',
  'leverage',
  'facilitate',
  'delve into',
  'showcase',
  'underscore',
  'needless to say',
  'it goes without saying',
  'as previously mentioned',
  'first and foremost',
  'last but not least',
  'in the realm of',
  'in the world of',
  'state of the art',
  'paradigm shift',
  'holistic approach',
  'key takeaway',
];

const TRANSITION_WORDS: string[] = [
  'furthermore', 'moreover', 'additionally', 'consequently', 'therefore',
  'thus', 'hence', 'nevertheless', 'nonetheless', 'notwithstanding',
  'subsequently', 'accordingly', 'conversely', 'alternatively', 'otherwise',
  'in contrast', 'as a result', 'in addition', 'in conclusion', 'in summary',
];

const HEDGING_PHRASES: string[] = [
  'it appears', 'it seems', 'it could be', 'it may be', 'it might be',
  'one might', 'one could', 'seemingly', 'perhaps', 'possibly',
  'it is possible', 'it is likely', 'to some extent', 'in some ways',
  'arguably', 'it could be argued', 'it might be argued',
];

const AI_QUANTIFIERS: string[] = [
  'numerous', 'various', 'diverse', 'multiple', 'myriad', 'countless',
  'a plethora of', 'a multitude of', 'a wide array of', 'a wide range of',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function countMatches(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(escaped, 'gi')) || []).length;
}

// ── Sentence splitter (abbreviation-aware) ────────────────────────────────────

/**
 * Splits text into sentences without splitting on common abbreviations.
 * Exported so other modules can reuse it.
 */
export function splitSentences(text: string): string[] {
  // Protect abbreviations and initials
  const protected_ = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|i\.e|e\.g|Fig|vol|pp|no|approx|est|dept|govt)\.\s/g, '$1___DOT___ ')
    .replace(/\b([A-Z]\.){2,}/g, (m) => m.replace(/\./g, '___DOT___'));

  const raw = protected_.split(/(?<=[.!?])\s+(?=[A-Z"'(])/g);

  return raw
    .map(s => s.replace(/___DOT___/g, '.').trim())
    .filter(s => s.length > 5);
}

// ── Main scorer ───────────────────────────────────────────────────────────────

/**
 * Scores text across 12 metrics. Returns a DetectionScore with total (0–100)
 * and per-metric breakdowns. Used to decide when re-humanization can stop.
 */
export function scoreText(text: string): DetectionScore {
  const sentences = splitSentences(text);
  if (sentences.length < 2) {
    return {
      total: 50,
      label: 'maybe',
      metrics: {
        sentenceAverage: 10, perplexity: 8, burstiness: 8, aiPhraseDensity: 6,
        sentenceVariation: 4, transitionFrequency: 4, vocabularyDiversity: 3,
        passiveVoice: 3, sentenceStartDiversity: 3, pronounUsage: 1,
        hedgingFrequency: 1, quantifierOveruse: 1,
      },
    };
  }

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  const totalSentences = sentences.length;
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);

  // ── 1. Sentence Average (weight: 25) ─────────────────────────────────────────
  // Human avg: 10–18 words. AI: 20–28 words. Penalize AI-typical lengths.
  const avgLen = mean(sentenceLengths);
  let sentenceAverageScore: number;
  if (avgLen >= 9 && avgLen <= 19) sentenceAverageScore = 25;
  else if (avgLen >= 7 && avgLen <= 22) sentenceAverageScore = 19;
  else if (avgLen >= 5 && avgLen <= 26) sentenceAverageScore = 12;
  else sentenceAverageScore = 6;

  // ── 2. Burstiness (weight: 15) ────────────────────────────────────────────────
  // burstiness = (stddev / mean) * 100 * 2.5. Human > 35. AI < 15.
  const burst = totalSentences > 1 ? (stddev(sentenceLengths) / avgLen) * 100 * 2.5 : 0;
  let burstinessScore: number;
  if (burst >= 45) burstinessScore = 15;
  else if (burst >= 28) burstinessScore = 11;
  else if (burst >= 15) burstinessScore = 7;
  else burstinessScore = 2;

  // ── 3. Perplexity approximation (weight: 15) ──────────────────────────────────
  // Bigram diversity: unique bigrams / total bigrams. Higher = less predictable.
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(`${words[i]}_${words[i + 1]}`);
  const bigramDiversity = bigrams.length > 0 ? new Set(bigrams).size / bigrams.length : 0;
  let perplexityScore: number;
  if (bigramDiversity >= 0.78) perplexityScore = 15;
  else if (bigramDiversity >= 0.62) perplexityScore = 11;
  else if (bigramDiversity >= 0.45) perplexityScore = 7;
  else perplexityScore = 3;

  // ── 4. AI Phrase Density (weight: 12) ─────────────────────────────────────────
  let aiPhraseHits = 0;
  for (const phrase of AI_PHRASES) aiPhraseHits += countMatches(lowerText, phrase);
  const aiPhrasePer100 = totalWords > 0 ? (aiPhraseHits / totalWords) * 100 : 0;
  let aiPhraseDensityScore: number;
  if (aiPhraseHits === 0) aiPhraseDensityScore = 12;
  else if (aiPhrasePer100 < 0.4) aiPhraseDensityScore = 8;
  else if (aiPhrasePer100 < 1.2) aiPhraseDensityScore = 4;
  else aiPhraseDensityScore = 0;

  // ── 5. Sentence Variation (weight: 8) ─────────────────────────────────────────
  // How wide is the spread between shortest and longest sentence?
  const minLen = Math.min(...sentenceLengths);
  const maxLen = Math.max(...sentenceLengths);
  const variation = maxLen - minLen;
  let sentenceVariationScore: number;
  if (variation >= 28) sentenceVariationScore = 8;
  else if (variation >= 18) sentenceVariationScore = 6;
  else if (variation >= 10) sentenceVariationScore = 4;
  else sentenceVariationScore = 1;

  // ── 6. Transition Frequency (weight: 8) ───────────────────────────────────────
  // Fewer formal transitions = more human. Target: ≤3 per 1,000 words.
  let transitionCount = 0;
  for (const t of TRANSITION_WORDS) transitionCount += countMatches(lowerText, t);
  const transitionPer1k = totalWords > 0 ? (transitionCount / totalWords) * 1000 : 0;
  let transitionFrequencyScore: number;
  if (transitionPer1k <= 2.5) transitionFrequencyScore = 8;
  else if (transitionPer1k <= 5) transitionFrequencyScore = 5;
  else if (transitionPer1k <= 9) transitionFrequencyScore = 2;
  else transitionFrequencyScore = 0;

  // ── 7. Vocabulary Diversity / TTR (weight: 5) ─────────────────────────────────
  const uniqueWords = new Set(words).size;
  const ttr = totalWords > 0 ? uniqueWords / totalWords : 0;
  let vocabularyDiversityScore: number;
  if (ttr >= 0.62) vocabularyDiversityScore = 5;
  else if (ttr >= 0.48) vocabularyDiversityScore = 4;
  else if (ttr >= 0.36) vocabularyDiversityScore = 3;
  else vocabularyDiversityScore = 1;

  // ── 8. Passive Voice Rate (weight: 5) ─────────────────────────────────────────
  const passiveMatches = (text.match(/\b(was|were|is|are|been|being)\s+\w+(?:ed|en)\b/gi) || []).length;
  const passiveRate = totalSentences > 0 ? passiveMatches / totalSentences : 0;
  let passiveVoiceScore: number;
  if (passiveRate <= 0.08) passiveVoiceScore = 5;
  else if (passiveRate <= 0.18) passiveVoiceScore = 3;
  else if (passiveRate <= 0.30) passiveVoiceScore = 1;
  else passiveVoiceScore = 0;

  // ── 9. Sentence Start Diversity (weight: 5) ───────────────────────────────────
  const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase() || '');
  const uniqueStarters = new Set(starters).size;
  const starterDiversityRatio = totalSentences > 0 ? uniqueStarters / totalSentences : 0;
  let sentenceStartDiversityScore: number;
  if (starterDiversityRatio >= 0.82) sentenceStartDiversityScore = 5;
  else if (starterDiversityRatio >= 0.65) sentenceStartDiversityScore = 3;
  else if (starterDiversityRatio >= 0.45) sentenceStartDiversityScore = 2;
  else sentenceStartDiversityScore = 0;

  // ── 10. Pronoun Usage (weight: 3) ────────────────────────────────────────────
  // Human writing (even academic) uses first/second person; AI avoids it.
  let pronounCount = 0;
  for (const p of ['\\bI\\b', '\\bwe\\b', '\\byou\\b', '\\bmy\\b', '\\bour\\b', '\\byour\\b', "\\bi'", "\\bwe'", "\\byou'"]) {
    pronounCount += (text.match(new RegExp(p, 'gi')) || []).length;
  }
  const pronounPer1k = totalWords > 0 ? (pronounCount / totalWords) * 1000 : 0;
  let pronounUsageScore: number;
  if (pronounPer1k >= 6) pronounUsageScore = 3;
  else if (pronounPer1k >= 2.5) pronounUsageScore = 2;
  else if (pronounPer1k >= 0.5) pronounUsageScore = 1;
  else pronounUsageScore = 0;

  // ── 11. Hedging Frequency (weight: 3) ────────────────────────────────────────
  let hedgeCount = 0;
  for (const h of HEDGING_PHRASES) hedgeCount += countMatches(lowerText, h);
  const hedgePer1k = totalWords > 0 ? (hedgeCount / totalWords) * 1000 : 0;
  let hedgingFrequencyScore: number;
  if (hedgePer1k <= 1.5) hedgingFrequencyScore = 3;
  else if (hedgePer1k <= 4) hedgingFrequencyScore = 1;
  else hedgingFrequencyScore = 0;

  // ── 12. Quantifier Overuse (weight: 2) ────────────────────────────────────────
  let quantifierCount = 0;
  for (const q of AI_QUANTIFIERS) quantifierCount += countMatches(lowerText, q);
  const quantifierPer1k = totalWords > 0 ? (quantifierCount / totalWords) * 1000 : 0;
  let quantifierOveruseScore: number;
  if (quantifierPer1k <= 1) quantifierOveruseScore = 2;
  else if (quantifierPer1k <= 3) quantifierOveruseScore = 1;
  else quantifierOveruseScore = 0;

  // ── Final score ───────────────────────────────────────────────────────────────
  const total = Math.min(
    100,
    sentenceAverageScore + burstinessScore + perplexityScore + aiPhraseDensityScore +
    sentenceVariationScore + transitionFrequencyScore + vocabularyDiversityScore +
    passiveVoiceScore + sentenceStartDiversityScore + pronounUsageScore +
    hedgingFrequencyScore + quantifierOveruseScore,
  );

  const label: DetectionScore['label'] = total >= 55 ? 'human' : total >= 35 ? 'maybe' : 'ai';

  return {
    total,
    label,
    metrics: {
      sentenceAverage: sentenceAverageScore,
      perplexity: perplexityScore,
      burstiness: burstinessScore,
      aiPhraseDensity: aiPhraseDensityScore,
      sentenceVariation: sentenceVariationScore,
      transitionFrequency: transitionFrequencyScore,
      vocabularyDiversity: vocabularyDiversityScore,
      passiveVoice: passiveVoiceScore,
      sentenceStartDiversity: sentenceStartDiversityScore,
      pronounUsage: pronounUsageScore,
      hedgingFrequency: hedgingFrequencyScore,
      quantifierOveruse: quantifierOveruseScore,
    },
  };
}

/**
 * Returns the sentences from a list that still score below the AI threshold.
 * Used to target only weak sentences in re-humanization passes.
 */
export function findAISentences(sentences: string[], threshold = 42): string[] {
  return sentences.filter(s => {
    if (s.split(/\s+/).filter(Boolean).length < 5) return false; // skip very short sentences
    return scoreText(s).total < threshold;
  });
}
