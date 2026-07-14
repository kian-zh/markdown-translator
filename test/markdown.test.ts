import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown } from '../src/markdown';

test('renders Markdown while preserving code and frontmatter for display', () => {
  const html = renderMarkdown(`---
title: Keep metadata
---

# Hello \`const unchanged = true\`

\`\`\`ts
const greeting = 'unchanged';
\`\`\`
`);

  assert.match(html, /const unchanged = true/);
  assert.match(html, /const greeting = &#39;unchanged&#39;;/);
  assert.match(html, /title: Keep metadata/);
});
