export type ProtectedContentCheck = { valid: true } | { valid: false; reason: string };

type ProtectedToken = { index: number; end: number; value: string; kind: string };

/**
 * Model output is allowed to translate prose only. These Markdown constructs
 * must make a byte-for-byte round trip before we render the result.
 */
export function validateProtectedMarkdown(source: string, translated: string): ProtectedContentCheck {
  const originalTokens = extractProtectedTokens(source);
  const translatedTokens = extractProtectedTokens(translated);
  if (originalTokens.length !== translatedTokens.length) {
    return { valid: false, reason: `protected content count changed (${originalTokens.length} → ${translatedTokens.length})` };
  }
  for (let index = 0; index < originalTokens.length; index++) {
    if (originalTokens[index].value !== translatedTokens[index].value) {
      return { valid: false, reason: `protected ${originalTokens[index].kind} changed at item ${index + 1}` };
    }
  }
  return { valid: true };
}

/**
 * Restores source data after Claude has returned recognisable Markdown. This
 * keeps the whole document available to the model for context, while making
 * formatting-only edits to code, URLs, and tags harmless. A missing or
 * reordered protected construct is deliberately not repaired.
 */
export function repairProtectedMarkdown(source: string, translated: string): string | undefined {
  const sourceTokens = extractProtectedTokens(source);
  const translatedTokens = extractProtectedTokens(translated);
  if (sourceTokens.length !== translatedTokens.length) return undefined;
  if (sourceTokens.some((token, index) => token.kind !== translatedTokens[index].kind)) return undefined;

  let cursor = 0;
  let repaired = '';
  for (let index = 0; index < sourceTokens.length; index++) {
    const sourceToken = sourceTokens[index];
    const translatedToken = translatedTokens[index];
    repaired += translated.slice(cursor, translatedToken.index);
    repaired += sourceToken.value;
    cursor = translatedToken.end;
  }
  return repaired + translated.slice(cursor);
}

function extractProtectedTokens(markdown: string): ProtectedToken[] {
  const candidates: Array<ProtectedToken & { priority: number }> = [];
  const addMatches = (kind: string, priority: number, pattern: RegExp, group = 0): void => {
    for (const match of markdown.matchAll(pattern)) {
      const value = match[group];
      const offset = match.indices?.[group]?.[0] ?? match.index ?? 0;
      if (typeof value === 'string') candidates.push({ index: offset, end: offset + value.length, value, kind, priority });
    }
  };

  // Larger constructs win over their nested components, so every selected
  // range is non-overlapping and can be safely spliced back into the output.
  addMatches('frontmatter', 100, /^(?:---|\+\+\+)\r?\n[\s\S]*?\r?\n(?:---|\+\+\+)\s*(?:\r?\n|$)/dg);
  addMatches('fenced code block', 90, /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)/dg);
  addMatches('indented code block', 80, /^(?:(?: {4}|\t).*)(?:\n(?: {4}|\t).*)*/dgm);
  addMatches('inline code', 70, /(`+)([\s\S]*?)\1/dg);

  // HTML tags/attributes and Markdown destinations are data, not prose.
  addMatches('HTML', 60, /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/dg);
  addMatches('link destination', 50, /!?(?:\[[^\]]*\])\(\s*(<[^>]*>|(?:\\.|[^()\s])+)(?:\s+["'][^"']*["'])?\s*\)/dg, 1);
  addMatches('autolink', 40, /<https?:\/\/[^>]+>/dg);

  candidates.sort((left, right) => left.index - right.index || right.priority - left.priority || right.value.length - left.value.length);
  const tokens: ProtectedToken[] = [];
  let lastEnd = -1;
  for (const candidate of candidates) {
    if (candidate.index < lastEnd) continue;
    tokens.push(candidate);
    lastEnd = candidate.end;
  }
  return tokens;
}
