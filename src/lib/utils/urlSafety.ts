// URL safety utilities — enforce https and warn on non-Dynatrace endpoints.
// Validate on WRITE only (form submit, call sites).
// Never add these checks to schema parsing — would silently wipe saved configs.

const DYNATRACE_HOST_RE = /\.(dynatrace\.com|dynatracelabs\.com|apps\.dynatrace\.com)$/i;

/**
 * Asserts that rawUrl uses https://.
 * Throws with a user-friendly message if not.
 * Returns the parsed URL on success.
 */
export function assertHttps(rawUrl: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https:// — credentials are sent to this endpoint`);
  }
  return url;
}

/**
 * Returns true if rawUrl is a known Dynatrace-managed host.
 * Non-DT hosts are valid (Managed), but callers may want to show a warning.
 */
export function isKnownDynatraceHost(rawUrl: string): boolean {
  try {
    return DYNATRACE_HOST_RE.test(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}
