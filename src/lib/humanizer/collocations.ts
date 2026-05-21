// ─── HumanClarity Humanizer — Collocation & AI Phrase Replacements ───────────
// Maps common AI-signature phrases to natural human equivalents.
// Applied deterministically in post-processing (no LLM needed).

export interface Collocation {
  pattern: RegExp;
  replacements: string[];
}

/**
 * 100+ AI-signature phrases → human alternatives.
 * Applied in order during postProcess(). Each match picks a random replacement.
 */
export const COLLOCATIONS: Collocation[] = [
  // ── Ultra-common AI openers & hedges ────────────────────────────────────────
  { pattern: /\bit is important to note that\b/gi, replacements: ['note that', 'importantly,', 'worth noting:', 'keep in mind that'] },
  { pattern: /\bit is worth noting that\b/gi, replacements: ['notably,', 'one thing to note:', "it's worth noting that"] },
  { pattern: /\bit is worth noting\b/gi, replacements: ['notably,', "it's worth noting"] },
  { pattern: /\bit is important to\b/gi, replacements: ["it's key to", 'it matters to', 'you need to'] },
  { pattern: /\bit is crucial to\b/gi, replacements: ['you must', "it's vital to", "it's key to"] },
  { pattern: /\bit is essential to\b/gi, replacements: ['you must', 'you need to', "it's key to"] },
  { pattern: /\bit is necessary to\b/gi, replacements: ['you need to', 'you must', 'this requires'] },
  { pattern: /\bit should be noted that\b/gi, replacements: ['note that', 'worth noting,', 'importantly,'] },
  { pattern: /\bit should be mentioned that\b/gi, replacements: ['note that', 'worth mentioning,'] },
  { pattern: /\bit is worth mentioning that\b/gi, replacements: ['worth mentioning,', 'note that'] },
  { pattern: /\bit goes without saying that\b/gi, replacements: ['clearly,', 'of course,', 'naturally,'] },
  { pattern: /\bneedless to say,?\b/gi, replacements: ['of course,', 'naturally,', 'clearly,'] },

  // ── AI argument hedges ───────────────────────────────────────────────────────
  { pattern: /\bit can be argued that\b/gi, replacements: ['one view is that', 'some would say', 'arguably,'] },
  { pattern: /\bit could be argued that\b/gi, replacements: ['arguably,', 'one could say', 'some argue that'] },
  { pattern: /\bit appears that\b/gi, replacements: ['it seems', 'this suggests', 'apparently,'] },
  { pattern: /\bit seems that\b/gi, replacements: ['it looks like', 'this suggests', 'seemingly,'] },
  { pattern: /\bone might argue\b/gi, replacements: ['some argue', "there's a case that", 'arguably,'] },
  { pattern: /\bone could argue\b/gi, replacements: ['some argue', 'arguably,', "there's reason to think"] },
  { pattern: /\bone might suggest\b/gi, replacements: ['some suggest', 'arguably,'] },
  { pattern: /\bone might consider\b/gi, replacements: ['consider', 'think about'] },

  // ── AI conclusion phrases ─────────────────────────────────────────────────────
  { pattern: /\bin conclusion,?\b/gi, replacements: ['to wrap up,', 'so,', 'in short,', 'to close,', 'all things considered,'] },
  { pattern: /\bin summary,?\b/gi, replacements: ['in short,', 'to sum up,', 'simply put,', 'briefly,'] },
  { pattern: /\bto summarize,?\b/gi, replacements: ['in short,', 'simply put,', 'basically,'] },
  { pattern: /\bto conclude,?\b/gi, replacements: ['so,', 'to finish,', 'in the end,'] },
  { pattern: /\boverall,?\b/gi, replacements: ['in general,', 'broadly speaking,', 'on the whole,'] },
  { pattern: /\ball in all,?\b/gi, replacements: ['overall,', 'in short,', 'to sum up,'] },

  // ── AI verbose connectors ─────────────────────────────────────────────────────
  { pattern: /\bin order to\b/gi, replacements: ['to', 'so that', 'for'] },
  { pattern: /\bdue to the fact that\b/gi, replacements: ['because', 'since', 'given that'] },
  { pattern: /\bowing to the fact that\b/gi, replacements: ['because', 'since', 'given that'] },
  { pattern: /\bfor the purpose of\b/gi, replacements: ['to', 'for'] },
  { pattern: /\bfor the reason that\b/gi, replacements: ['because', 'since'] },
  { pattern: /\bwith regard to\b/gi, replacements: ['about', 'on', 'regarding', 'when it comes to'] },
  { pattern: /\bwith regards to\b/gi, replacements: ['about', 'on', 'regarding'] },
  { pattern: /\bin terms of\b/gi, replacements: ['regarding', 'on', 'for', 'when it comes to'] },
  { pattern: /\bwith respect to\b/gi, replacements: ['about', 'on', 'regarding', 'for'] },
  { pattern: /\bas a result of\b/gi, replacements: ['because of', 'due to', 'from'] },
  { pattern: /\bprior to\b/gi, replacements: ['before'] },
  { pattern: /\bsubsequent to\b/gi, replacements: ['after', 'following'] },
  { pattern: /\bat this point in time\b/gi, replacements: ['now', 'currently', 'at this point'] },
  { pattern: /\bat the present time\b/gi, replacements: ['now', 'currently', 'today'] },
  { pattern: /\bin the near future\b/gi, replacements: ['soon', 'shortly', 'in the coming weeks'] },
  { pattern: /\bin the foreseeable future\b/gi, replacements: ['soon', 'going forward', 'in the near term'] },
  { pattern: /\bby means of\b/gi, replacements: ['through', 'using', 'via', 'by'] },
  { pattern: /\bmake use of\b/gi, replacements: ['use', 'apply', 'employ'] },
  { pattern: /\bin light of\b/gi, replacements: ['given', 'considering', 'in view of', 'because of'] },
  { pattern: /\bthe fact that\b/gi, replacements: ['that', 'how'] },
  { pattern: /\bgiven the fact that\b/gi, replacements: ['since', 'given that', 'because'] },

  // ── AI quantity/range phrases ─────────────────────────────────────────────────
  { pattern: /\ba wide range of\b/gi, replacements: ['many', 'various', 'a variety of', 'an array of'] },
  { pattern: /\ba wide variety of\b/gi, replacements: ['many different', 'various', 'a range of'] },
  { pattern: /\ba broad range of\b/gi, replacements: ['many', 'a variety of', 'various'] },
  { pattern: /\ba number of\b/gi, replacements: ['several', 'some', 'many'] },
  { pattern: /\ba large number of\b/gi, replacements: ['many', 'a lot of', 'countless'] },
  { pattern: /\ba great deal of\b/gi, replacements: ['a lot of', 'much', 'significant'] },
  { pattern: /\ba myriad of\b/gi, replacements: ['many', 'countless', 'a wealth of'] },
  { pattern: /\ba plethora of\b/gi, replacements: ['many', 'an abundance of', 'countless'] },
  { pattern: /\bnumerous studies\b/gi, replacements: ['many studies', 'several studies', 'research'] },
  { pattern: /\bnumerous researchers\b/gi, replacements: ['many researchers', 'several researchers'] },
  { pattern: /\bnumerous factors\b/gi, replacements: ['many factors', 'several factors', 'a range of factors'] },
  { pattern: /\bnumerous benefits\b/gi, replacements: ['many benefits', 'several benefits', 'real benefits'] },

  // ── AI passive meta-phrases ───────────────────────────────────────────────────
  { pattern: /\bit has been observed that\b/gi, replacements: ['studies show', 'evidence shows', 'research finds'] },
  { pattern: /\bit has been shown that\b/gi, replacements: ['research shows', 'evidence suggests', 'studies find'] },
  { pattern: /\bit has been argued that\b/gi, replacements: ['scholars argue', 'some researchers argue', 'the view is'] },
  { pattern: /\bit has been proposed that\b/gi, replacements: ['researchers suggest', 'the proposal is', 'one idea is'] },
  { pattern: /\bit has been suggested that\b/gi, replacements: ['evidence suggests', 'researchers suggest', 'some propose'] },
  { pattern: /\bit has been established that\b/gi, replacements: ['research confirms', 'evidence shows', 'studies confirm'] },
  { pattern: /\bit has been found that\b/gi, replacements: ['research shows', 'findings suggest', 'studies show'] },
  { pattern: /\bas previously mentioned\b/gi, replacements: ['as noted', 'as discussed', 'as seen'] },
  { pattern: /\bas mentioned (above|earlier|previously)\b/gi, replacements: ['as noted', 'as discussed', 'as I mentioned'] },
  { pattern: /\bas stated (above|earlier|previously)\b/gi, replacements: ['as noted', 'as I said', 'as discussed'] },
  { pattern: /\bthis paper aims to\b/gi, replacements: ['this paper', 'the goal here is to', 'this work aims to'] },
  { pattern: /\bthis study aims to\b/gi, replacements: ['this study', 'the aim here is to', 'this research'] },
  { pattern: /\bthis paper seeks to\b/gi, replacements: ['this paper', 'the aim is to'] },
  { pattern: /\bthis research aims to\b/gi, replacements: ['this research', 'the goal is to'] },

  // ── AI role/function clichés ──────────────────────────────────────────────────
  { pattern: /\bplay(?:s)? a (crucial|critical|vital|key|important|significant) role\b/gi, replacements: ['matter a lot', 'have a major impact', 'be central to', 'be important'] },
  { pattern: /\bserves? as\b/gi, replacements: ['acts as', 'works as', 'functions as', 'is'] },
  { pattern: /\bhave the potential to\b/gi, replacements: ['can', 'could', 'might'] },
  { pattern: /\bhas the potential to\b/gi, replacements: ['can', 'could', 'might'] },
  { pattern: /\bshed(?:s)? light on\b/gi, replacements: ['clarify', 'explain', 'illuminate', 'help understand'] },
  { pattern: /\bbring(?:s)? to light\b/gi, replacements: ['reveal', 'uncover', 'expose', 'show'] },
  { pattern: /\btake into account\b/gi, replacements: ['consider', 'factor in', 'account for'] },
  { pattern: /\btake into consideration\b/gi, replacements: ['consider', 'think about', 'account for'] },
  { pattern: /\bcome to the conclusion\b/gi, replacements: ['conclude', 'decide', 'determine'] },

  // ── AI buzzwords ───────────────────────────────────────────────────────────────
  { pattern: /\bstate[\s-]of[\s-]the[\s-]art\b/gi, replacements: ['cutting-edge', 'advanced', 'latest', 'modern'] },
  { pattern: /\bcutting[\s-]edge\b/gi, replacements: ['advanced', 'latest', 'modern', 'new'] },
  { pattern: /\bsynergy\b/gi, replacements: ['collaboration', 'cooperation', 'combined effect'] },
  { pattern: /\bparadigm shift\b/gi, replacements: ['major change', 'fundamental shift', 'transformation'] },
  { pattern: /\bholistic approach\b/gi, replacements: ['comprehensive approach', 'broad view', 'overall approach'] },
  { pattern: /\bkey takeaway(?:s)?\b/gi, replacements: ['main lesson', 'key point', 'main finding'] },
  { pattern: /\bdeep dive\b/gi, replacements: ['close look', 'detailed examination', 'thorough analysis'] },
  { pattern: /\bin the realm of\b/gi, replacements: ['in', 'within', 'in the field of'] },
  { pattern: /\bin the world of\b/gi, replacements: ['in', 'within'] },

  // ── Discourse markers replaced ────────────────────────────────────────────────
  { pattern: /\bon the other hand,?\b/gi, replacements: ['but', 'yet', 'that said,', 'conversely,', 'in contrast,'] },
  { pattern: /\bwith this in mind,?\b/gi, replacements: ['so,', 'given this,', 'keeping this in mind,'] },
  { pattern: /\bfrom this perspective,?\b/gi, replacements: ['seen this way,', 'with this view,', 'from this angle,'] },
  { pattern: /\bthat being said,?\b/gi, replacements: ['still,', 'that said,', 'even so,'] },
  { pattern: /\bmore often than not\b/gi, replacements: ['usually', 'often', 'typically', 'in most cases'] },
  { pattern: /\bmore and more\b/gi, replacements: ['increasingly', 'growing', 'ever more'] },
  { pattern: /\bfirst and foremost,?\b/gi, replacements: ['first,', 'primarily,', 'above all,'] },
  { pattern: /\blast but not least,?\b/gi, replacements: ['finally,', 'and lastly,', 'one final point:'] },
  { pattern: /\bby and large\b/gi, replacements: ['generally', 'mostly', 'broadly', 'in general'] },
  { pattern: /\bwhen it comes to\b/gi, replacements: ['regarding', 'for', 'on', 'about'] },
  { pattern: /\bwhen considering\b/gi, replacements: ['considering', 'looking at', 'thinking about'] },
  { pattern: /\bwhen examining\b/gi, replacements: ['examining', 'looking at', 'studying'] },
  { pattern: /\btherefore, it is\b/gi, replacements: ['so it is', 'this makes it', 'for this reason it is'] },
  { pattern: /\balong with\b/gi, replacements: ['together with', 'alongside', 'as well as', 'plus'] },
  { pattern: /\bin conjunction with\b/gi, replacements: ['together with', 'alongside', 'combined with'] },
  { pattern: /\bbesides this,?\b/gi, replacements: ['also,', 'in addition,', 'on top of that,'] },
];

/** Apply all collocation replacements to text. Each match picks a random replacement. */
export function applyCollocations(text: string): string {
  let result = text;
  for (const col of COLLOCATIONS) {
    result = result.replace(col.pattern, () => {
      return col.replacements[Math.floor(Math.random() * col.replacements.length)];
    });
  }
  return result;
}

/** Apply only a single random collocation (lighter touch for targeted passes). */
export function applyOneRandomCollocation(text: string): string {
  const applicable = COLLOCATIONS.filter(c => c.pattern.test(text));
  if (applicable.length === 0) return text;
  const col = applicable[Math.floor(Math.random() * applicable.length)];
  col.pattern.lastIndex = 0; // reset regex state
  return text.replace(col.pattern, () => {
    return col.replacements[Math.floor(Math.random() * col.replacements.length)];
  });
}
