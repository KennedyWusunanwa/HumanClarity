// ─── HumanClarity Humanizer — Synonym Dictionary ─────────────────────────────
// ~500 academic/formal word → natural synonym mappings.
// Focuses on the vocabulary AI models overuse in academic writing.

/** Full synonym map. Context-sensitive — used in targeted swaps. */
export const SYNONYMS: Record<string, string[]> = {
  // ── Overused verbs ──────────────────────────────────────────────────────────
  utilize: ['use', 'apply', 'employ', 'put to use'],
  facilitate: ['help', 'enable', 'support', 'make easier', 'assist with'],
  demonstrate: ['show', 'prove', 'reveal', 'make clear', 'illustrate'],
  indicate: ['show', 'suggest', 'point to', 'signal'],
  implement: ['carry out', 'put in place', 'execute', 'apply', 'use'],
  examine: ['look at', 'study', 'investigate', 'explore'],
  investigate: ['look into', 'explore', 'study', 'examine', 'probe'],
  analyze: ['study', 'examine', 'look at', 'break down', 'review'],
  evaluate: ['assess', 'judge', 'measure', 'review', 'look at'],
  ascertain: ['find out', 'determine', 'figure out', 'establish'],
  endeavor: ['try', 'attempt', 'aim', 'work'],
  commence: ['start', 'begin', 'kick off'],
  terminate: ['end', 'stop', 'finish', 'conclude'],
  obtain: ['get', 'acquire', 'gain', 'secure'],
  provide: ['give', 'offer', 'deliver', 'supply'],
  require: ['need', 'call for', 'demand', 'involve'],
  achieve: ['reach', 'attain', 'accomplish', 'get to', 'realize'],
  enhance: ['improve', 'boost', 'strengthen', 'increase', 'build on'],
  address: ['deal with', 'tackle', 'handle', 'look at', 'cover'],
  compare: ['contrast', 'look at', 'measure against', 'weigh up'],
  propose: ['suggest', 'put forward', 'recommend', 'offer'],
  suggest: ['propose', 'point to', 'hint at', 'indicate', 'imply'],
  reveal: ['show', 'uncover', 'expose', 'make clear', 'bring to light'],
  identify: ['find', 'spot', 'pinpoint', 'recognize', 'detect'],
  determine: ['find out', 'establish', 'figure out', 'decide', 'work out'],
  establish: ['set up', 'create', 'build', 'form', 'found'],
  contribute: ['add to', 'help with', 'play a role in', 'support'],
  reflect: ['show', 'mirror', 'capture', 'embody'],
  represent: ['stand for', 'show', 'depict', 'capture'],
  consider: ['look at', 'think about', 'examine', 'weigh', 'explore'],
  support: ['back up', 'help', 'strengthen', 'reinforce', 'assist'],
  develop: ['build', 'create', 'form', 'grow', 'work on'],
  highlight: ['point out', 'emphasize', 'stress', 'draw attention to', 'note'],
  emphasize: ['stress', 'highlight', 'point out', 'underline', 'focus on'],
  acknowledge: ['recognize', 'admit', 'accept', 'note'],
  leverage: ['use', 'apply', 'draw on', 'make use of'],
  showcase: ['show', 'highlight', 'demonstrate', 'display'],
  underscore: ['stress', 'highlight', 'reinforce', 'emphasize'],
  delve: ['dig into', 'explore', 'look closely at', 'go deep into'],
  // ── Overused nouns ──────────────────────────────────────────────────────────
  utilization: ['use', 'usage', 'application'],
  methodology: ['approach', 'method', 'process', 'procedure', 'way'],
  implementation: ['carrying out', 'execution', 'application', 'use'],
  analysis: ['study', 'examination', 'review', 'breakdown', 'assessment'],
  evaluation: ['assessment', 'review', 'measurement', 'appraisal'],
  assessment: ['evaluation', 'review', 'judgment', 'appraisal'],
  synthesis: ['combination', 'merging', 'bringing together', 'integration'],
  contribution: ['role', 'input', 'addition', 'impact', 'share'],
  development: ['growth', 'progress', 'advancement', 'building', 'creation'],
  framework: ['structure', 'system', 'model', 'approach', 'scheme'],
  structure: ['design', 'organization', 'setup', 'framework', 'system'],
  process: ['procedure', 'method', 'approach', 'way', 'steps'],
  factor: ['element', 'aspect', 'component', 'part', 'contributor'],
  aspect: ['part', 'element', 'feature', 'side', 'dimension'],
  element: ['part', 'component', 'aspect', 'piece', 'factor'],
  component: ['part', 'piece', 'element', 'section', 'building block'],
  perspective: ['view', 'viewpoint', 'angle', 'lens', 'standpoint'],
  application: ['use', 'practice', 'deployment'],
  complexity: ['intricacy', 'difficulty', 'depth', 'layers', 'nuance'],
  challenge: ['difficulty', 'problem', 'hurdle', 'obstacle'],
  opportunity: ['chance', 'opening', 'prospect', 'possibility'],
  benefit: ['advantage', 'gain', 'plus', 'upside', 'positive'],
  impact: ['effect', 'influence', 'mark', 'change', 'result'],
  outcome: ['result', 'effect', 'end', 'consequence', 'output'],
  conclusion: ['finding', 'result', 'outcome', 'end point', 'summary'],
  relationship: ['link', 'connection', 'tie', 'bond', 'association'],
  interaction: ['exchange', 'connection', 'interplay', 'engagement'],
  context: ['setting', 'situation', 'background', 'environment'],
  concept: ['idea', 'notion', 'principle', 'theory'],
  scope: ['range', 'extent', 'breadth', 'reach', 'coverage'],
  domain: ['field', 'area', 'realm', 'sector', 'territory'],
  field: ['area', 'discipline', 'sector', 'subject'],
  literature: ['research', 'studies', 'work', 'writings', 'scholarship'],
  research: ['study', 'investigation', 'work', 'inquiry'],
  evidence: ['proof', 'data', 'support', 'findings'],
  findings: ['results', 'data', 'evidence', 'outcomes', 'discoveries'],
  // ── Overused adjectives ─────────────────────────────────────────────────────
  significant: ['major', 'key', 'notable', 'meaningful', 'substantial'],
  comprehensive: ['thorough', 'complete', 'full', 'wide-ranging', 'detailed'],
  substantial: ['large', 'considerable', 'major', 'sizable'],
  fundamental: ['basic', 'core', 'key', 'central', 'essential'],
  essential: ['key', 'vital', 'necessary', 'critical', 'crucial'],
  crucial: ['vital', 'key', 'critical', 'very important'],
  critical: ['key', 'vital', 'crucial', 'essential', 'important'],
  optimal: ['best', 'ideal', 'most effective', 'perfect'],
  innovative: ['new', 'fresh', 'creative', 'original', 'novel'],
  novel: ['new', 'fresh', 'original', 'unique'],
  robust: ['strong', 'solid', 'reliable', 'sturdy', 'dependable'],
  rigorous: ['thorough', 'strict', 'careful', 'detailed', 'precise'],
  systematic: ['organized', 'structured', 'methodical', 'orderly'],
  empirical: ['data-based', 'evidence-based', 'practical', 'observed'],
  numerous: ['many', 'several', 'a number of'],
  various: ['different', 'diverse', 'several', 'a variety of'],
  multiple: ['many', 'several', 'more than one'],
  diverse: ['varied', 'different', 'mixed', 'wide-ranging', 'assorted'],
  complex: ['complicated', 'intricate', 'involved', 'multi-faceted'],
  effective: ['working', 'successful', 'efficient', 'useful'],
  efficient: ['effective', 'productive', 'streamlined', 'quick'],
  relevant: ['related', 'applicable', 'pertinent', 'fitting', 'connected'],
  appropriate: ['fitting', 'suitable', 'right', 'proper', 'correct'],
  adequate: ['enough', 'sufficient', 'reasonable', 'satisfactory'],
  extensive: ['wide', 'broad', 'large', 'sweeping', 'far-reaching'],
  contemporary: ['modern', 'current', 'present-day'],
  traditional: ['classic', 'conventional', 'established', 'longstanding'],
  challenging: ['difficult', 'tough', 'demanding', 'hard'],
  practical: ['real-world', 'applied', 'hands-on', 'working', 'functional'],
  // ── Overused adverbs ────────────────────────────────────────────────────────
  significantly: ['considerably', 'notably', 'markedly', 'greatly', 'substantially'],
  primarily: ['mainly', 'mostly', 'chiefly', 'above all', 'largely'],
  particularly: ['especially', 'specifically', 'notably', 'in particular'],
  specifically: ['in particular', 'namely', 'to be exact'],
  broadly: ['generally', 'widely', 'largely', 'overall'],
  widely: ['broadly', 'commonly', 'extensively', 'generally'],
  commonly: ['often', 'usually', 'typically', 'generally'],
  typically: ['usually', 'generally', 'normally', 'often'],
  generally: ['usually', 'normally', 'broadly', 'on the whole'],
  frequently: ['often', 'regularly', 'repeatedly', 'time and again'],
  previously: ['before', 'earlier', 'in the past', 'formerly'],
  currently: ['now', 'today', 'at present', 'right now'],
  ultimately: ['in the end', 'finally', 'at the end of the day'],
  essentially: ['basically', 'in essence', 'at its core', 'fundamentally'],
  notably: ['importantly', 'especially', 'particularly', 'in particular'],
  // ── Overused conjunctions/transitions ──────────────────────────────────────
  furthermore: ['also', 'in addition', "what's more", 'plus'],
  moreover: ['also', 'in addition', 'on top of that', 'besides'],
  additionally: ['also', 'too', 'in addition', 'plus', 'as well'],
  however: ['but', 'yet', 'still', 'that said', 'even so'],
  consequently: ['so', 'as a result', 'because of this', 'this means'],
  therefore: ['so', 'this is why', 'as a result', 'which means'],
  thus: ['so', 'this way', 'as a result'],
  hence: ['so', "this is why", "that's why"],
  nevertheless: ['still', 'even so', 'yet', 'that said'],
  nonetheless: ['still', 'even so', 'yet', 'that said'],
  albeit: ['though', 'although', 'even if'],
  whilst: ['while', 'as', 'during'],
  regarding: ['about', 'concerning', 'on', 'when it comes to'],
  concerning: ['about', 'on', 'relating to'],
};

/**
 * Context-blind safe swaps.
 * These are safe to replace globally without reading surrounding context.
 * Only includes words where ALL synonyms are appropriate in any context.
 */
export const SAFE_SYNONYMS: Record<string, string[]> = {
  utilize: ['use'],
  utilization: ['use', 'usage'],
  furthermore: ['also', 'in addition'],
  moreover: ['also', 'in addition', 'besides'],
  additionally: ['also', 'too', 'in addition'],
  consequently: ['so', 'as a result'],
  thus: ['so', 'this way'],
  hence: ['so'],
  nevertheless: ['still', 'even so'],
  nonetheless: ['still', 'that said'],
  facilitate: ['help', 'enable'],
  implement: ['carry out', 'apply'],
  methodology: ['method', 'approach'],
  indicate: ['show', 'suggest'],
  demonstrate: ['show', 'prove'],
  significant: ['major', 'notable'],
  numerous: ['many'],
  various: ['different', 'several'],
  multiple: ['many', 'several'],
  obtain: ['get'],
  require: ['need'],
  provide: ['give'],
  comprehensive: ['thorough', 'complete'],
  crucial: ['vital', 'key'],
  essential: ['key', 'vital'],
  critical: ['key', 'vital'],
  enhance: ['improve', 'boost'],
  address: ['deal with', 'tackle'],
  analyze: ['study', 'examine'],
  evaluate: ['assess', 'review'],
  identify: ['find', 'spot'],
  determine: ['find out', 'establish'],
  contribute: ['add to', 'help with'],
  impact: ['effect', 'influence'],
  fundamental: ['basic', 'core'],
  substantial: ['large', 'considerable'],
  optimal: ['best', 'ideal'],
  innovative: ['new', 'creative'],
  robust: ['strong', 'solid'],
  rigorous: ['thorough', 'strict'],
  leverage: ['use', 'apply'],
  showcase: ['show', 'highlight'],
  underscore: ['stress', 'emphasize'],
  delve: ['dig into', 'explore'],
};

/** Return a random synonym for a word, preserving capitalization. Returns null if not found. */
export function getRandomSynonym(word: string): string | null {
  const lower = word.toLowerCase();
  const syns = SYNONYMS[lower];
  if (!syns || syns.length === 0) return null;
  const chosen = syns[Math.floor(Math.random() * syns.length)];
  if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
    return chosen.charAt(0).toUpperCase() + chosen.slice(1);
  }
  return chosen;
}

/** Return a random context-blind safe synonym, preserving capitalization. Returns null if not found. */
export function getRandomSafeSynonym(word: string): string | null {
  const lower = word.toLowerCase();
  const syns = SAFE_SYNONYMS[lower];
  if (!syns || syns.length === 0) return null;
  const chosen = syns[Math.floor(Math.random() * syns.length)];
  if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
    return chosen.charAt(0).toUpperCase() + chosen.slice(1);
  }
  return chosen;
}
