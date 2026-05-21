// ─── HumanClarity Humanizer — Output Quality Governance ──────────────────────
// Validates that the LLM's output hasn't drifted too far from the original —
// catching hallucinations, length blowups, and content loss before they reach
// the user. If any gate fails, the calling code falls back to the pre-rewrite text.

import { GovernanceResult } from './types';

function getWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function nGrams(words: string[], n: number): string[] {
  const grams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    grams.push(words.slice(i, i + n).join(' '));
  }
  return grams;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extracts likely proper nouns and key terms from text.
 * Used to verify keyword preservation across rewrites.
 */
function extractKeywords(text: string): string[] {
  const COMMON_STARTERS = new Set([
    'The', 'This', 'These', 'That', 'Those', 'A', 'An', 'In', 'On', 'At',
    'By', 'For', 'With', 'As', 'From', 'But', 'And', 'Or', 'So', 'Yet',
    'To', 'Of', 'Is', 'Are', 'Was', 'Were', 'Be', 'Has', 'Have', 'Had',
    'Will', 'Would', 'Could', 'Should', 'May', 'Might', 'Do', 'Does', 'Did',
    'When', 'Where', 'While', 'Since', 'After', 'Before', 'Although', 'Because',
  ]);
  const matches = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  return [...new Set(matches.filter(m => !COMMON_STARTERS.has(m)))];
}

/**
 * Runs the four quality gates on the LLM output against the original text.
 *
 * Gates:
 *  1. Lexical overlap (weighted unigram 40% + bigram 30% + trigram 30%) ≥ 0.15
 *  2. Length ratio (output chars / input chars) between 0.60 and 1.35
 *  3. Sentence count ratio between 0.50 and 1.60
 *  4. Keyword preservation (proper nouns) ≥ 30% when >2 keywords found
 */
export function checkGovernance(original: string, output: string): GovernanceResult {
  if (!output || output.trim().length < 10) {
    return {
      passed: false,
      reason: 'empty_output',
      lexicalOverlap: 0,
      lengthRatio: 0,
      sentenceCountRatio: 0,
      keywordPreservation: 0,
    };
  }

  const origWords = getWords(original);
  const outWords = getWords(output);

  // Gate 1: Lexical overlap
  const unigramJ = jaccardSimilarity(origWords, outWords);
  const bigramJ = jaccardSimilarity(nGrams(origWords, 2), nGrams(outWords, 2));
  const trigramJ = jaccardSimilarity(nGrams(origWords, 3), nGrams(outWords, 3));
  const lexicalOverlap = unigramJ * 0.4 + bigramJ * 0.3 + trigramJ * 0.3;

  // Gate 2: Length ratio
  const lengthRatio = original.length > 0 ? output.length / original.length : 1;

  // Gate 3: Sentence count ratio
  const countSentences = (t: string) =>
    t.split(/[.!?]+/).filter(s => s.trim().length > 3).length;
  const origSentCount = countSentences(original);
  const outSentCount = countSentences(output);
  const sentenceCountRatio = origSentCount > 0 ? outSentCount / origSentCount : 1;

  // Gate 4: Keyword preservation
  const origKeywords = extractKeywords(original);
  const outLower = output.toLowerCase();
  const preservedCount = origKeywords.filter(kw => outLower.includes(kw.toLowerCase())).length;
  const keywordPreservation = origKeywords.length > 2
    ? preservedCount / origKeywords.length
    : 1; // not enough keywords to judge

  // Evaluate gates
  if (lexicalOverlap < 0.15) {
    return { passed: false, reason: 'low_lexical_overlap', lexicalOverlap, lengthRatio, sentenceCountRatio, keywordPreservation };
  }
  if (lengthRatio < 0.6) {
    return { passed: false, reason: 'too_short', lexicalOverlap, lengthRatio, sentenceCountRatio, keywordPreservation };
  }
  if (lengthRatio > 1.35) {
    return { passed: false, reason: 'too_long', lexicalOverlap, lengthRatio, sentenceCountRatio, keywordPreservation };
  }
  if (sentenceCountRatio < 0.5) {
    return { passed: false, reason: 'too_few_sentences', lexicalOverlap, lengthRatio, sentenceCountRatio, keywordPreservation };
  }
  if (sentenceCountRatio > 1.6) {
    return { passed: false, reason: 'too_many_sentences', lexicalOverlap, lengthRatio, sentenceCountRatio, keywordPreservation };
  }
  if (origKeywords.length > 2 && keywordPreservation < 0.30) {
    return { passed: false, reason: 'keywords_lost', lexicalOverlap, lengthRatio, sentenceCountRatio, keywordPreservation };
  }

  return { passed: true, lexicalOverlap, lengthRatio, sentenceCountRatio, keywordPreservation };
}
