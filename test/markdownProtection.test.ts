import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProtectedMarkdown } from '../src/markdownProtection';

const source = `---
title: Keep this title
---

# Hello world

Read [the guide](https://example.com/docs) and run \`npm run build\`.

<kbd data-key="cmd">Command</kbd>

\`\`\`ts
const greeting = 'do not translate';
\`\`\`
`;

test('accepts prose translation while protected Markdown stays unchanged', () => {
  const translated = source
    .replace('# Hello world', '# 你好，世界')
    .replace('Read [the guide]', '阅读[指南]')
    .replace(' and run ', '，然后运行 ');

  assert.deepEqual(validateProtectedMarkdown(source, translated), { valid: true });
});

test('rejects a changed command or URL', () => {
  const changedCommand = source.replace('npm run build', 'npm run test');
  const changedUrl = source.replace('https://example.com/docs', 'https://example.com/translated');

  assert.equal(validateProtectedMarkdown(source, changedCommand).valid, false);
  assert.equal(validateProtectedMarkdown(source, changedUrl).valid, false);
});
