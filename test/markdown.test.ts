import assert from 'node:assert/strict';
import test from 'node:test';
import { translateMarkdown } from '../src/markdown';

test('only natural-language Markdown text is sent for translation', async () => {
  const requests: string[] = [];
  const markdown = `---
title: Do not translate metadata
---

# Hello \`const unchanged = true\`

Use [the guide](https://example.com/docs) before running this:

\`npm run build\`

\`\`\`ts
const greeting = 'do not translate';
\`\`\`
`;

  const result = await translateMarkdown(markdown, async value => {
    requests.push(value);
    return `[${value}]`;
  });

  assert.deepEqual(requests, ['Hello ', 'Use ', 'the guide', ' before running this:']);
  assert.match(result.translatedHtml, /const unchanged = true/);
  assert.match(result.translatedHtml, /npm run build/);
  assert.match(result.translatedHtml, /const greeting = &#39;do not translate&#39;;/);
  assert.match(result.translatedHtml, /title: Do not translate metadata/);
  assert.match(result.translatedHtml, /https:\/\/example\.com\/docs/);
});
