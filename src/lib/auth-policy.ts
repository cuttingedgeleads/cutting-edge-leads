// Server configuration only: never infer reset destinations from request headers.
export function authOrigin(env: Record<string, string | undefined> = process.env) {
  const explicit = env.AUTH_TRUSTED_ORIGIN;
  const value = explicit || env.NEXTAUTH_URL || 'https://www.cuttingedgeleads.net';
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('INVALID_AUTH_ORIGIN');
  const canonical = url.origin === 'https://www.cuttingedgeleads.net';
  const local = !env.VERCEL && ['localhost','127.0.0.1'].includes(url.hostname) && ['http:','https:'].includes(url.protocol);
  const preview = env.VERCEL_ENV === 'preview' && explicit && url.protocol === 'https:' && !['localhost','127.0.0.1'].includes(url.hostname);
  if (!canonical && !local && !preview) throw new Error('INVALID_AUTH_ORIGIN');
  return url.origin;
}
export const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_SECONDS = 24 * 60 * 60;
export function passwordError(password: string, confirmation: string) {
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return 'weak_password';
  if (password !== confirmation) return 'password_mismatch';
  return null;
}
export function validResetToken(value: string) { return /^[a-f0-9]{64}$/.test(value); }
