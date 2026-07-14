import assert from 'node:assert/strict';
import test from 'node:test';
import { repairProtectedMarkdown, validateProtectedMarkdown } from '../src/markdownProtection';

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

test('restores protected Markdown when Claude keeps its outer structure', () => {
  const source = 'Use [`tool --safe`](https://example.com/docs).\n\n```ts\nconst greeting = "hello";\n```\n';
  const translated = '使用 [`工具 --安全`](https://example.cn/docs)。\n\n```ts\nconst greeting = "你好";\n```\n';

  const repaired = repairProtectedMarkdown(source, translated);

  assert.equal(repaired, '使用 [`tool --safe`](https://example.com/docs)。\n\n```ts\nconst greeting = "hello";\n```\n');
  assert.deepEqual(validateProtectedMarkdown(source, repaired ?? ''), { valid: true });
});

test('does not repair Markdown after a protected block loses its structure', () => {
  const source = '```ts\nconst answer = 42;\n```\n';
  const translated = '代码：const answer = 42;\n';

  assert.equal(repairProtectedMarkdown(source, translated), undefined);
});
