import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown, splitStreamingMarkdown } from '../src/markdown';

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

test('keeps only the final top-level Markdown block replaceable while streaming', () => {
  const markdown = '# Title\n\nFirst paragraph.\n\nSecond paragraph still arriving';
  const parts = splitStreamingMarkdown(markdown);

  assert.equal(parts.committed, '# Title\n\nFirst paragraph.');
  assert.equal(parts.tail, '\n\nSecond paragraph still arriving');
});

test('keeps a single incomplete block in the streaming tail', () => {
  assert.deepEqual(splitStreamingMarkdown('## Still arriving'), {
    committed: '',
    tail: '## Still arriving'
  });
});
