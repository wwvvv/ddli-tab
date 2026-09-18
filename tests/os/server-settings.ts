/** Resolve Next and legacy test origins independently; never log supplied URLs. */
export function readOsE2eSettings(env: Record<string, string | undefined> = process.env) {
  const port = Number(env.OS_E2E_PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('OS_E2E_PORT must be an integer between 1 and 65535');
  function origin(value: string | undefined, fallback: string, name: string) {
    if (!value?.trim()) return fallback;
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new Error(`${name} must be an HTTP(S) origin`);
    }
    if (
      !['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash
    ) throw new Error(`${name} must be an HTTP(S) origin without credentials, path, query or hash`);
    return url.origin;
  }
  return {
    port,
    osBaseURL: origin(env.OS_E2E_BASE_URL, `http://127.0.0.1:${port}`, 'OS_E2E_BASE_URL'),
    legacyBaseURL: origin(env.LEGACY_E2E_BASE_URL, 'http://127.0.0.1:4180', 'LEGACY_E2E_BASE_URL'),
    startOs: !env.OS_E2E_BASE_URL?.trim(),
    startLegacy: !env.LEGACY_E2E_BASE_URL?.trim(),
  };
}
