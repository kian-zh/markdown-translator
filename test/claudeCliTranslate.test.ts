import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTranslationPrompt, claudeArguments } from '../src/claudeCliTranslate';

test('uses a logged-in local Claude Code invocation with Haiku low effort', () => {
  const args = claudeArguments('zh-CN');

  assert.deepEqual(args.slice(0, 10), [
    '--safe-mode', '--tools', '', '--no-session-persistence',
    '--model', 'haiku', '--effort', 'low', '--max-turns', '1'
  ]);
  assert.ok(args.includes('--output-format'));
  assert.match(args.at(-1) ?? '', /standard input/);
});

test('prompt identifies the target language and protects Markdown data', () => {
  const prompt = buildTranslationPrompt('ja');
  assert.match(prompt, /into ja/);
  assert.match(prompt, /Never translate or modify YAML\/TOML frontmatter/);
});
