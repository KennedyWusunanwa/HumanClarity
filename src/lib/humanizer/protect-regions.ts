// ─── HumanClarity Humanizer — Protected Region Handling ──────────────────────
// Extracts special content (citations, URLs, code) into placeholders before
// LLM processing, then restores them afterwards. Prevents the LLM from
// altering citations, formulas, URLs, or code blocks.

import { ProtectedRegion } from './types';

// ── Placeholder sentinel ──────────────────────────────────────────────────────
// The placeholder MUST survive every downstream pass untouched: the LLM rewrite,
// chunking, synonym swaps, sentence splitting/merging, and — critically — the
// post-processing markdown strip.
//
// The old format `__PROTECT_0__` did NOT survive: postProcess() runs
// stripMarkdown(), whose `.replace(/__/g, '')` (strip markdown bold) deleted the
// surrounding underscores, leaving a bare `PROTECT_0` that restore could no
// longer match. The token leaked into the output and the original span was lost.
//
// This sentinel is built from ONLY uppercase ASCII letters and digits. It has:
//   - no markdown-significant characters (_, *, `, #, $, ~)  → stripMarkdown is a no-op on it
//   - no dashes or semicolons                                → stripAIDashes can't touch it
//   - no sentence terminators (. ! ?) and no spaces          → it's never split or merged
//   - letters on both sides of the index digits             → \b…\b synonym/phrase
//                                                              regexes can't bite into it
// The leading/trailing letters also mean a sentence-merge lowercasing the first
// char only flips `H`→`h`, which the case-insensitive matcher below still catches.
const PLACEHOLDER_PREFIX = 'HCPROTECT';
const PLACEHOLDER_SUFFIX = 'ZZ';

function makePlaceholder(index: number): string {
  return `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
}

// Tolerant matcher used on restore. Case-insensitive (a merge pass can lowercase
// the leading letter) and whitespace-tolerant (in case a model pass slips spaces
// in). The sentinel is distinctive enough that this can never collide with real
// prose, so the tolerance is free.
const PLACEHOLDER_RE = /HCPROTECT\s*(\d+)\s*ZZ/gi;

/**
 * Extracts protected regions from text and replaces them with numbered
 * placeholders like HCPROTECT0ZZ. The placeholder format is chosen to survive
 * chunking, synonym replacement, markdown stripping, and sentence manipulation.
 */
export function extractProtectedRegions(text: string): {
  text: string;
  regions: ProtectedRegion[];
} {
  const regions: ProtectedRegion[] = [];
  let idx = 0;

  function protect(match: string): string {
    const placeholder = makePlaceholder(idx);
    regions.push({ index: idx, placeholder, original: match });
    idx++;
    return placeholder;
  }

  let result = text;

  // Fenced code blocks (```...```)
  result = result.replace(/```[\s\S]*?```/g, protect);

  // Inline code (`...`)
  result = result.replace(/`[^`\n]{1,500}`/g, protect);

  // LaTeX display math ($$...$$)
  result = result.replace(/\$\$[\s\S]*?\$\$/g, protect);

  // LaTeX inline math ($...$) — avoid matching isolated $ signs
  result = result.replace(/\$[^$\n]{1,200}\$/g, protect);

  // URLs
  result = result.replace(/https?:\/\/[^\s)>\]"]{4,}/g, protect);

  // Academic citations: (Author, 2020) / (Author et al., 2019) / (Author & Author, 2021)
  // The character class must allow '.' so the period in "et al." and in initials
  // (e.g. "J. Smith") doesn't break the match — without it the most common
  // citation form silently went unprotected.
  result = result.replace(/\([A-Z][a-zA-Z\s\-&,.]+,\s*\d{4}[a-z]?\)/g, protect);

  // Numeric reference citations: [1], [2-4], [1,2,3]
  result = result.replace(/\[\d+(?:[–\-,]\s*\d+)*\]/g, protect);

  // DOI references
  result = result.replace(/\b10\.\d{4,}\/[^\s">,]+/g, protect);

  // Quoted text (longer than 10 chars — preserve exact quotations)
  result = result.replace(/"[^"]{10,300}"/g, protect);

  // Figure/Table references: Figure 1, Table 2, Appendix A
  result = result.replace(/\b(Figure|Fig\.|Table|Appendix|Equation|Eq\.|Section)\s+[\dA-Z][\d.A-Z]*/g, protect);

  return { text: result, regions };
}

/**
 * Restores all protected regions from their placeholders.
 * Must be called after all LLM and post-processing passes.
 *
 * Works by index in a single left-to-right pass over the text. Two important
 * properties of this approach:
 *   - A function replacer is used, so `$` sequences in the original (prices,
 *     math, regex) are inserted literally rather than read as String.replace
 *     special patterns ($&, $1, …).
 *   - The pass does not re-scan inserted text, so an original that happens to
 *     contain a sentinel-shaped substring can't be re-substituted.
 * Any orphan sentinel with no matching region (should never happen given how
 * robust the placeholder is) is stripped rather than leaked to the user.
 */
export function restoreProtectedRegions(
  text: string,
  regions: ProtectedRegion[],
): string {
  if (regions.length === 0) {
    return text.replace(PLACEHOLDER_RE, '');
  }

  const byIndex = new Map(regions.map(region => [region.index, region.original]));

  return text.replace(PLACEHOLDER_RE, (_match, digits) => {
    const original = byIndex.get(Number(digits));
    return original !== undefined ? original : '';
  });
}
