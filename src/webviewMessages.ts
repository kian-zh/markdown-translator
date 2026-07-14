export function isRefreshRequest(message: { type?: unknown }): boolean {
  return message.type === 'refresh';
}

export function isSourceAnchorRequest(message: { type?: unknown; sourceOffset?: unknown }): message is { type: 'sourceAnchor'; sourceOffset: number } {
  return message.type === 'sourceAnchor' && typeof message.sourceOffset === 'number' && Number.isSafeInteger(message.sourceOffset) && message.sourceOffset >= 0;
}
