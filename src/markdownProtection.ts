export type ProtectedContentCheck = { valid: true } | { valid: false; reason: string };

type ProtectedToken = { index: number; value: string };

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
      return { valid: false, reason: `protected content changed at item ${index + 1}` };
    }
  }
  return { valid: true };
}

function extractProtectedTokens(markdown: string): ProtectedToken[] {
  const tokens: ProtectedToken[] = [];
  const addMatches = (pattern: RegExp, group = 0): void => {
    for (const match of markdown.matchAll(pattern)) {
      const value = match[group];
      const offset = match.indices?.[group]?.[0] ?? match.index ?? 0;
      if (typeof value === 'string') tokens.push({ index: offset, value });
    }
  };

  // Frontmatter, fenced/indented code and inline code.
  addMatches(/^(?:---|\+\+\+)\r?\n[\s\S]*?\r?\n(?:---|\+\+\+)\s*(?:\r?\n|$)/dg);
  addMatches(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)/dg);
  addMatches(/^(?:(?: {4}|\t).*)(?:\n(?: {4}|\t).*)*/dgm);
  addMatches(/(`+)([\s\S]*?)\1/dg);

  // HTML tags/attributes and Markdown destinations are data, not prose.
  addMatches(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/dg);
  addMatches(/!?(?:\[[^\]]*\])\(\s*(<[^>]*>|(?:\\.|[^()\s])+)(?:\s+["'][^"']*["'])?\s*\)/dg, 1);
  addMatches(/<https?:\/\/[^>]+>/dg);

  return tokens.sort((left, right) => left.index - right.index || right.value.length - left.value.length);
}
