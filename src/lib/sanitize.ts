export function sanitizeInput(value: string) {
  if (!value) return "";
  const strippedScripts = value.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );
  const strippedTags = strippedScripts.replace(/<[^>]+>/g, "");
  return strippedTags.replace(/\s+/g, " ").trim();
}
