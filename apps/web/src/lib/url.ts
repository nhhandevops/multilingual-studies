/**
 * Resolve a stored root-relative URL against the app's deploy base.
 *
 * Some `sources.license_url` values point at a file WE ship ('/licenses/ARPHICPL.TXT').
 * Those are stored root-relative, which is wrong the moment the app is served from a
 * subpath (GitHub Pages project site). External http(s) URLs pass through untouched.
 */
export function assetUrl(url: string): string {
  if (/^[a-z]+:/i.test(url)) return url; // http:, https:, data:, mailto:…
  const base = import.meta.env.BASE_URL; // always ends with '/'
  return url.startsWith('/') ? base + url.slice(1) : base + url;
}
