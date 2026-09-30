/** Reject ambiguous origins before opening the API listener. */
export function corsOrigins(env: NodeJS.ProcessEnv): string[] {
  const production = env.NODE_ENV === 'production';
  const raw = env.CORS_ORIGIN;
  if (!raw?.trim()) {
    if (production) throw new Error('CORS_ORIGIN is required in production');
    return ['http://localhost:3000'];
  }
  return [...new Set(raw.split(',').map((entry) => {
    const origin = entry.trim();
    let url: URL;
    try { url = new URL(origin); } catch {
      throw new Error('CORS_ORIGIN must contain exact HTTP(S) origins');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin ||
        url.username || url.password || url.hostname.includes('*') ||
        (production && url.protocol !== 'https:')) {
      throw new Error('CORS_ORIGIN must contain exact origins; production requires HTTPS');
    }
    return origin;
  }))];
}
