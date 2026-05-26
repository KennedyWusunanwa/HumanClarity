import { PromptConfig, HumanizeLevel, HumanizePurpose, HumanizeStyle } from './types';

const STALE_PHRASES = [
  'can', 'may', 'just', 'that', 'very', 'really', 'literally', 'actually',
  'certainly', 'probably', 'basically', 'could', 'maybe', 'delve', 'embark',
  'enlightening', 'esteemed', 'shed light', 'craft', 'crafting', 'imagine',
  'realm', 'game-changer', 'unlock', 'discover', 'skyrocket', 'abyss',
  'not alone', 'in a world where', 'revolutionize', 'disruptive', 'utilize',
  'utilizing', 'dive deep', 'tapestry', 'illuminate', 'unveil', 'pivotal',
  'intricate', 'elucidate', 'hence', 'furthermore', 'however', 'harness',
  'exciting', 'groundbreaking', 'cutting-edge', 'remarkable', 'it',
  'remains to be seen', 'glimpse into', 'navigating', 'landscape', 'stark',
  'testament', 'in summary', 'in conclusion', 'moreover', 'boost',
  'skyrocketing', 'opened up', 'powerful', 'inquiries', 'ever-evolving',
  'in closing', 'it is important to note', 'it should be noted', 'it is worth noting',
  'to summarize', 'additionally', 'in order to', 'due to the fact that', 'with regard to',
  'a wide range of', 'leverage', 'facilitate', 'underscore', 'paradigm shift',
  'holistic approach', "in today's world", 'at the end of the day', 'optimize your workflow',
  'revolutionary approach', 'unlock the secrets', 'great question', 'i hope this helps',
  'vibrant', 'crucial', 'comprehensive', 'meticulous', 'synergy', 'transformative',
  'paramount', 'multifaceted', 'myriad', 'cornerstone', 'catalyst', 'bolster', 'spearhead',
  'invaluable', 'garner', 'encompass', 'poised',
  // Stiff academic verbs that detectors latch onto. Force the model to find plainer alternatives.
  'underpin', 'underpins', 'underpinning', 'affirm', 'affirms', 'affirming',
  'denote', 'denotes', 'mirror', 'mirrors', 'ground', 'grounding',
  'reflect', 'reflects', 'embody', 'embodies', 'guide', 'guides',
  'seek to', 'seeks to', 'striving to', 'aim to', 'aspire to',
  'centers on', 'centers around', 'revolves around', 'lies in', 'rests on',
  'serves as', 'is rooted in', 'is grounded in',
];

export function buildSystemPrompt(config: PromptConfig): string {
  const { level, purpose, style, isRehumanizationPass = false } = config;
  const stalePhrases = STALE_PHRASES.map((phrase) => `- "${phrase}"`).join('\n');

  return `You are an experienced editor doing a substantive rewrite. Your job is to break the rhythm, vocabulary, and sentence shapes that make prose feel machine-generated and replace them with the plainer, more varied phrasing a thoughtful writer would actually use. Return only the rewritten text.

This is a rewrite, not a polish. Most sentences should change in either word choice, structure, or both. If a sentence already reads naturally, you may leave it; otherwise, recast it.

${getLevelInstructions(level, isRehumanizationPass)}

${getPurposeInstructions(purpose)}

${getStyleInstructions(style)}

Concrete rewriting rules:
- Replace academic verbs with plainer ones. Examples:
  - "underpins" -> "is the basis of" / "is what holds up"
  - "affirms" -> "says" / "argues" / "claims"
  - "denotes" -> "means" / "stands for"
  - "ground X in" -> "draw X from" / "trace X back to"
  - "guides" -> "shapes" / "drives" / "pushes"
  - "reflects" -> "shows" / "echoes"
  - "seeks to" -> "tries to" / "wants to"
  - "encompasses" -> "covers" / "includes"
  - "facilitates" -> "helps" / "makes it easier to"
- Vary sentence openers within a paragraph. Do not start two sentences in a row with the same article, pronoun, or noun phrase.
- Mix sentence lengths. Aim for at least one short sentence (5-9 words) per paragraph and at least one longer one.
- Where it fits the register, use casual qualifiers like "often", "usually", "in practice", "for many", "in some traditions". These are allowed even though the avoid list keeps you away from filler.
- Prefer everyday word order: subject + verb + object. Avoid noun-clause openings like "The claim that X..." or "It is the case that X...".
- Add one small, plausible specific where it helps the reader. A name, an example, or a concrete situation. Do not invent facts or citations.
- Allow a slight asymmetry across paragraphs. One paragraph can be shorter or move differently than another.

Strict negative constraints:
- Avoid em dashes (—). Use commas, periods, or other standard punctuation.
- Avoid semicolons.
- Avoid constructions like "not just this, but also this".
- Avoid metaphors and clichés.
- Avoid sweeping generalizations.
- Avoid setup phrases like "in conclusion" or "in closing".
- Do not include warnings, notes, or commentary. Return only the requested output.
- Avoid unnecessary adjectives and adverbs.
- Avoid hashtags, markdown formatting, and asterisks.

Avoid these overused words and phrases (find plainer replacements):
${stalePhrases}

Example of the rewriting move we want:
- Input: "In today's rapidly evolving technological landscape, it is imperative that we leverage cutting-edge solutions to optimize our operational efficiency."
- Bad rewrite (only changed one word): "In today's rapidly evolving technological landscape, it is imperative that we use cutting-edge solutions to optimize our operational efficiency."
- Good rewrite (recast the sentence): "Tech moves fast, so teams need newer tools just to keep operations running smoothly."

- Input: "The claim that God is good underpins many religious traditions. It affirms that the divine is morally perfect."
- Good rewrite: "Many religious traditions are built on the idea that God is good. The thought is that the divine is morally perfect."

Final check before responding: read your draft back once. If you only swapped one or two words per sentence, rewrite again with bolder structural changes. If any sentence still uses a verb from the avoid list, replace that verb.`;
}

function getLevelInstructions(level: HumanizeLevel, isRepass: boolean): string {
  const repassLine = isRepass
    ? 'This is a refinement pass. Focus on any sentences that still feel stiff, repetitive, or overly templated. Add hesitations and slight redundancy to break rhythm.'
    : '';

  const instructions: Record<HumanizeLevel, string> = {
    light: `Level: light\n${repassLine}\n- Make restrained edits.\n- Smooth obvious awkwardness and repetition.\n- Keep the structure close to the original.\n- Prefer subtle phrasing changes over full rewrites.`,
    medium: `Level: medium\n${repassLine}\n- Recast most sentences. Change verbs, openers, and structure so the rhythm and vocabulary clearly differ from the original.\n- Vary sentence shape and length across each paragraph. No two consecutive sentences should share the same opening pattern.\n- Replace generic transitions and stiff academic verbs with simpler, more natural alternatives.\n- Aim for prose that reads like an editor sat down and rewrote it from scratch in their own words while keeping every fact.`,
    aggressive: `Level: aggressive\n${repassLine}\n- Rewrite most sentences for stronger cadence and clearer voice.\n- Break up long, formulaic stretches into more natural movement.\n- Reshape paragraphs when needed to improve flow and emphasis.\n- Maintain a natural register while sounding fully human.\n- Disrupt overly even rhythm and remove formulaic transitions.`,
    ninja: `Level: ninja\n${repassLine}\n- Perform a deep rewrite while preserving every substantive point.\n- Make the prose feel fully worked-through, like a real person expressing their thoughts naturally.\n- Create rich sentence rhythm: short emphasis, medium exposition, and longer analytical sentences.\n- Reduce predictability in syntax, transitions, and paragraph pacing.\n- Make paragraph rhythm uneven in a natural way. Avoid identical openings, identical cadence, or interchangeable topic sentences.`,
  };

  return instructions[level];
}

function getPurposeInstructions(purpose: HumanizePurpose): string {
  const instructions: Record<HumanizePurpose, string> = {
    academic: `Context: academic writing\n- Write like a capable student or researcher with a real argument to make.\n- Preserve nuance, qualification, and discipline-specific terminology.\n- Keep the prose intellectually serious, calm, precise, and credible.\n- Ensure it still feels human, with slight imperfections instead of robotic perfection.`,
    professional: `Context: professional writing\n- Write with clarity, judgment, and restraint.\n- Prefer direct phrasing over corporate filler.\n- Keep the tone credible, composed, and efficient.\n- Sound like a real colleague talking, not a PR template.`,
    general: `Context: general expository writing\n- Keep the writing accessible, natural, and well-paced.\n- Balance precision with readability.\n- Focus on conversational reality.`,
    creative: `Context: creative or voice-driven writing\n- Preserve voice and texture while reducing stiffness.\n- Use stronger rhythm and more varied sentence movement where appropriate.\n- Let thoughts feel tangential at times.`,
  };

  return instructions[purpose];
}

function getStyleInstructions(style: HumanizeStyle): string {
  const instructions: Record<HumanizeStyle, string> = {
    academic: 'Style: academic. Clear and natural. Avoid empty formality, hype, and scripted polish.',
    casual: 'Style: casual. Conversational but still precise. Keep it grounded, not chatty. Add subtle human imperfections.',
    professional: 'Style: professional. Polished, direct, and credible. No buzzwords. Avoid perfect symmetry.',
    creative: 'Style: creative. Expressive, flexible, and attentive to cadence.',
    technical: 'Style: technical. Keep terminology exact while improving readability and flow.',
  };

  return instructions[style];
}

export function buildUserMessage(text: string): string {
  return `Rewrite the following text. This is a substantive rewrite, not a one-word paraphrase: recast sentence structures, change sentence openers, replace stiff academic verbs (underpins, affirms, denotes, guides, grounds, reflects, seeks to, encompasses, facilitates) with plain alternatives, and break the predictable rhythm of the input. Preserve all facts and claims. Return only the revised version, with no preamble.\n\n${text}`;
}
