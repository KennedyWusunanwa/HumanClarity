export type HumanizeLevel = 'light' | 'medium' | 'aggressive' | 'ninja';
export type HumanizePurpose = 'academic' | 'professional' | 'general' | 'creative';
export type HumanizeStyle = 'academic' | 'casual' | 'professional' | 'creative' | 'technical';

export interface LLMProvider {
  type: 'openai';
  name?: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface HumanizeOptions {
  level?: HumanizeLevel;
  style?: HumanizeStyle;
  purpose?: HumanizePurpose;
  passes?: number;
  targetScore?: number;
  preserveFormatting?: boolean;
  provider?: LLMProvider;
}

export interface HumanizeResult {
  text: string;
  originalText: string;
  score: number;
  passes: number;
  chunks: number;
  level: HumanizeLevel;
}

export interface ProtectedRegion {
  placeholder: string;
  original: string;
}

export interface DetectionScore {
  total: number;
  label: 'human' | 'maybe' | 'ai';
  metrics: {
    sentenceAverage: number;
    perplexity: number;
    burstiness: number;
    aiPhraseDensity: number;
    sentenceVariation: number;
    transitionFrequency: number;
    vocabularyDiversity: number;
    passiveVoice: number;
    sentenceStartDiversity: number;
    pronounUsage: number;
    hedgingFrequency: number;
    quantifierOveruse: number;
  };
}

export interface GovernanceResult {
  passed: boolean;
  reason?: string;
  lexicalOverlap: number;
  lengthRatio: number;
  sentenceCountRatio: number;
  keywordPreservation: number;
}

export interface PromptConfig {
  level: HumanizeLevel;
  purpose: HumanizePurpose;
  style: HumanizeStyle;
  isRehumanizationPass?: boolean;
  temperature?: number;
}
