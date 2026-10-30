/**
 * The public website's origin, for "View live" links. VITE_SITE_URL wins;
 * otherwise a local admin points at the local site and a deployed one at
 * production.
 */
export const SITE_URL: string = (
  import.meta.env.VITE_SITE_URL ||
  (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3000'
    : 'https://soulparadisetravels.com')
).replace(/\/$/, '');

export const siteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** "3m ago", "2h ago", "5d ago", then a short date. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '-';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
