import { HumanizeLevel, HumanizeStyle } from './types';
import { SAFE_SYNONYMS, getRandomSafeSynonym } from './synonyms';
import { applyCollocations } from './collocations';
import { splitSentences } from './detector';

export function stripAIDashes(text: string): string {
  return text
    .replace(/(\d)\s*[—–]\s*(\d)/g, '$1-$2')
    .replace(/([^0-9])\s*[—–]\s*([^0-9])/g, '$1, $2')
    .replace(/[—–]\s*/g, ', ')
    .replace(/;/g, '.');
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .replace(/###\s/g, '')
    .replace(/##\s/g, '')
    .replace(/#\s/g, '');
}

export function swapSafeSynonyms(text: string, rate = 0.25): string {
  let result = text;

  for (const word of Object.keys(SAFE_SYNONYMS)) {
    if (Math.random() > rate) continue;

    const synonym = getRandomSafeSynonym(word);
    if (!synonym || synonym === word) continue;

    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'g');
    result = result.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return synonym.charAt(0).toUpperCase() + synonym.slice(1);
      }
      return synonym;
    });
  }

  return result;
}

const CONTRACTION_MAP: [RegExp, string][] = [
  [/\bdo not\b/g, "don't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bdid not\b/g, "didn't"],
  [/\bcannot\b/g, "can't"],
  [/\bcan not\b/g, "can't"],
  [/\bwill not\b/g, "won't"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bcould not\b/g, "couldn't"],
  [/\bshould not\b/g, "shouldn't"],
  [/\bis not\b/g, "isn't"],
  [/\bare not\b/g, "aren't"],
  [/\bwas not\b/g, "wasn't"],
  [/\bwere not\b/g, "weren't"],
  [/\bhave not\b/g, "haven't"],
  [/\bhas not\b/g, "hasn't"],
  [/\bit is\b/g, "it's"],
  [/\bthat is\b/g, "that's"],
  [/\bthere is\b/g, "there's"],
  [/\bthey are\b/g, "they're"],
  [/\bwe are\b/g, "we're"],
];

export function injectContractions(text: string, rate = 0.15): string {
  let result = text;

  for (const [pattern, contraction] of CONTRACTION_MAP) {
    if (Math.random() < rate) {
      result = result.replace(pattern, contraction);
    }
  }

  return result;
}

const DIRECT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bIn order to\b/g, 'To'],
  [/\bin order to\b/g, 'to'],
  [/\bDue to the fact that\b/g, 'Because'],
  [/\bdue to the fact that\b/g, 'because'],
  [/\bAt this point in time\b/g, 'Now'],
  [/\bat this point in time\b/g, 'now'],
  [/\bIn terms of\b/g, 'For'],
  [/\bin terms of\b/g, 'for'],
];

export function simplifyWordyPhrases(text: string): string {
  let result = text;
  for (const [pattern, replacement] of DIRECT_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function manipulateSentenceLengths(text: string): string {
  const paragraphs = text.split(/\n\n+/);

  return paragraphs
    .map((paragraph) => {
      const sentences = splitSentences(paragraph);
      if (sentences.length < 3) {
        return paragraph;
      }

      const result: string[] = [];
      let index = 0;

      while (index < sentences.length) {
        const sentence = sentences[index];
        const wordCount = sentence.split(/\s+/).filter(Boolean).length;

        if (wordCount < 8 && index + 1 < sentences.length && Math.random() < 0.35) {
          const next = sentences[index + 1];
          const nextCount = next.split(/\s+/).filter(Boolean).length;
          if (nextCount < 14) {
            const connectors = ['and', 'but', 'while', 'although', 'yet'];
            const connector = connectors[Math.floor(Math.random() * connectors.length)];
            const merged = `${sentence.replace(/[.!?]\s*$/, '')}, ${connector} ${next.charAt(0).toLowerCase()}${next.slice(1)}`;
            result.push(merged);
            index += 2;
            continue;
          }
        }

        if (wordCount > 35 && Math.random() < 0.5) {
          const splitIndex = findBestSplitPoint(sentence);
          if (splitIndex > -1) {
            const part1 = `${sentence.slice(0, splitIndex).trim().replace(/[,;]$/, '')}.`;
            const part2Base = sentence.slice(splitIndex + 1).trim();
            const part2 = `${part2Base.charAt(0).toUpperCase()}${part2Base.slice(1)}`;
            if (part1.split(/\s+/).length >= 6 && part2.split(/\s+/).length >= 5) {
              result.push(part1, part2);
              index += 1;
              continue;
            }
          }
        }

        result.push(sentence);
        index += 1;
      }

      return result.join(' ');
    })
    .join('\n\n');
}

function findBestSplitPoint(sentence: string): number {
  const midpoint = Math.floor(sentence.length / 2);
  let bestIndex = -1;
  let minimumDistance = Infinity;
  let position = 0;

  while ((position = sentence.indexOf(',', position + 1)) !== -1) {
    const distance = Math.abs(position - midpoint);
    if (distance < minimumDistance) {
      minimumDistance = distance;
      bestIndex = position;
    }
  }

  position = 0;
  while ((position = sentence.indexOf(';', position + 1)) !== -1) {
    const distance = Math.abs(position - midpoint);
    if (distance < minimumDistance) {
      minimumDistance = distance;
      bestIndex = position;
    }
  }

  return bestIndex;
}

export function randomizeParagraphStructure(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length < 3) {
    return text;
  }

  const result = [...paragraphs];

  for (let index = 1; index < result.length - 1; index += 1) {
    const sentences = splitSentences(result[index]);

    if (sentences.length >= 5 && Math.random() < 0.12) {
      const splitAt = Math.floor(sentences.length / 2);
      result[index] = sentences.slice(0, splitAt).join(' ');
      result.splice(index + 1, 0, sentences.slice(splitAt).join(' '));
      continue;
    }

    if (index < result.length - 1 && Math.random() < 0.08) {
      const nextSentences = splitSentences(result[index + 1]);
      if (nextSentences.length <= 2) {
        result[index] = `${result[index]} ${result[index + 1]}`;
        result.splice(index + 1, 1);
      }
    }
  }

  return result.filter(Boolean).join('\n\n');
}

const NATURAL_ASIDES = [
  '(I think)',
  '(perhaps)',
  '(maybe slightly)',
  '(or at least it seems that way)',
  '(if that makes sense)',
];

export function softenFlow(text: string, style: HumanizeStyle): string {
  if (style === 'technical') {
    return text;
  }

  const paragraphs = text.split(/\n\n+/);

  return paragraphs
    .map((paragraph, index) => {
      if (index === 0 || index % 3 !== 0) {
        return paragraph;
      }

      const sentences = splitSentences(paragraph);
      if (sentences.length < 4) {
        return paragraph;
      }

      const insertAt = Math.floor(sentences.length / 2);
      const aside = NATURAL_ASIDES[Math.floor(Math.random() * NATURAL_ASIDES.length)];
      sentences[insertAt] = sentences[insertAt].replace(/([,.])?$/, ` ${aside}$1`);
      return sentences.join(' ');
    })
    .join('\n\n');
}

export function diversifySentenceStarts(text: string): string {
  const paragraphs = text.split(/\n\n+/);

  return paragraphs
    .map((paragraph) => {
      const sentences = splitSentences(paragraph);
      if (sentences.length < 3) {
        return paragraph;
      }

      let repeatCount = 0;
      let lastStart = '';
      const rewritten = sentences.map((sentence) => {
        const trimmed = sentence.trim();
        const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';

        if (['the', 'this', 'it', 'in'].includes(firstWord) && firstWord === lastStart) {
          repeatCount += 1;
        } else {
          repeatCount = 1;
          lastStart = firstWord;
        }

        if (repeatCount > 2 && firstWord === 'this') {
          return trimmed.replace(/^This\s+/i, 'Such a pattern ');
        }

        if (repeatCount > 2 && firstWord === 'it') {
          return trimmed.replace(/^It\s+/i, 'That ');
        }

        if (repeatCount > 2 && firstWord === 'in') {
          return trimmed.replace(/^In\s+/i, 'Within ');
        }

        return trimmed;
      });

      return rewritten.join(' ');
    })
    .join('\n\n');
}

export function postProcess(
  text: string,
  level: HumanizeLevel,
  style: HumanizeStyle = 'academic',
): string {
  let result = stripAIDashes(text);
  result = stripMarkdown(result);
  result = applyCollocations(result);
  result = simplifyWordyPhrases(result);
  result = manipulateSentenceLengths(result);
  result = diversifySentenceStarts(result);

  if (level === 'light') {
    result = swapSafeSynonyms(result, 0.12);
    return result;
  }

  result = swapSafeSynonyms(result, 0.22);
  if (style === 'casual') {
    result = injectContractions(result, 0.12);
  }

  if (level === 'aggressive' || level === 'ninja') {
    result = randomizeParagraphStructure(result);
    result = softenFlow(result, style);
    result = swapSafeSynonyms(result, 0.1);
  }

  // Tidy artifacts that earlier passes can leave behind (double-periods from `;` -> `.`,
  // stray double spaces, orphaned punctuation).
  result = result
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/([.!?])\s*\.\s*\.?/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();

  return result;
}
