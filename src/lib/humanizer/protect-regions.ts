// ─── HumanClarity Humanizer — Protected Region Handling ──────────────────────
// Extracts special content (citations, URLs, code) into placeholders before
// LLM processing, then restores them afterwards. Prevents the LLM from
// altering citations, formulas, URLs, or code blocks.

import { ProtectedRegion } from './types';

/**
 * Extracts protected regions from text and replaces them with numbered
 * placeholders like __PROTECT_0__. The placeholder format is chosen to
 * survive chunking, synonym replacement, and sentence manipulation.
 */
export function extractProtectedRegions(text: string): {
  text: string;
  regions: ProtectedRegion[];
} {
  const regions: ProtectedRegion[] = [];
  let idx = 0;

  function protect(match: string): string {
    const placeholder = `__PROTECT_${idx}__`;
    regions.push({ placeholder, original: match });
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
  result = result.replace(/\([A-Z][a-zA-Z\s\-&,]+,\s*\d{4}[a-z]?\)/g, protect);

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
 */
export function restoreProtectedRegions(
  text: string,
  regions: ProtectedRegion[],
): string {
  let result = text;
  for (const region of regions) {
    // Use split/join instead of replace to handle all occurrences safely
    result = result.split(region.placeholder).join(region.original);
  }
  return result;
}
