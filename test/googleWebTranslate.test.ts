import assert from 'node:assert/strict';
import test from 'node:test';
import { googleWebTokenOptions } from '../src/googleWebTranslate';

test('passes an explicit empty mirror to the Google web token library', () => {
  assert.equal(googleWebTokenOptions().mirror, '');
});
