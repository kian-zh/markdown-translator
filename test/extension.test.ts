import assert from 'node:assert/strict';
import test from 'node:test';
import { isRefreshRequest, isSourceAnchorRequest } from '../src/webviewMessages';

test('webview ready acknowledgement does not start a translation', () => {
  assert.equal(isRefreshRequest({ type: 'ready' }), false);
  assert.equal(isRefreshRequest({ type: 'refresh' }), true);
});

test('accepts only valid source scroll anchors from the reader', () => {
  assert.equal(isSourceAnchorRequest({ type: 'sourceAnchor', sourceOffset: 42 }), true);
  assert.equal(isSourceAnchorRequest({ type: 'sourceAnchor', sourceOffset: -1 }), false);
  assert.equal(isSourceAnchorRequest({ type: 'sourceAnchor', sourceOffset: '42' }), false);
});
