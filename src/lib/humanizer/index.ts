// ─── HumanClarity Humanizer — Public API ─────────────────────────────────────
// Import from here in your API routes and server code.
// Example: import { humanizeText } from '@/lib/humanizer';

export { humanizeText, chunkText } from './humanizer';
export { postProcess } from './postprocess';
export { scoreText, splitSentences, findAISentences } from './detector';
export { checkGovernance } from './governance';
export { applyCollocations } from './collocations';
export { extractProtectedRegions, restoreProtectedRegions } from './protect-regions';
export { callLLM } from './llm-provider';
export type {
  HumanizeOptions,
  HumanizeResult,
  HumanizeLevel,
  HumanizePurpose,
  HumanizeStyle,
  LLMProvider,
  DetectionScore,
  GovernanceResult,
  ProtectedRegion,
} from './types';
