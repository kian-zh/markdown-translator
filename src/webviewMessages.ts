export function isRefreshRequest(message: { type?: unknown }): boolean {
  return message.type === 'refresh';
}
