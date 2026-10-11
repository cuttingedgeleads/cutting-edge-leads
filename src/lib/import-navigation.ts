export function safeImportReturn(value: string | null | undefined) {
  return value && /^\/admin\/imports(?:\/[A-Za-z0-9_-]{1,128})?$/.test(value)
    ? value
    : '/';
}
