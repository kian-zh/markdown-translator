import assert from 'node:assert/strict';
import test from 'node:test';
import { isRefreshRequest } from '../src/webviewMessages';

test('webview ready acknowledgement does not start a translation', () => {
  assert.equal(isRefreshRequest({ type: 'ready' }), false);
  assert.equal(isRefreshRequest({ type: 'refresh' }), true);
});
