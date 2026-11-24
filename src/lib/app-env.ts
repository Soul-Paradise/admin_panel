/**
 * Which deployment this bundle was built for. Set VITE_APP_ENV=staging on the
 * staging Vercel project; anything else (or unset) is treated as production.
 */
export const IS_STAGING = (import.meta.env.VITE_APP_ENV as string | undefined)?.trim().toLowerCase() === 'staging';

/** Height reserved at the top of the viewport for the staging banner. */
const STAGING_BANNER_HEIGHT = '1.75rem';

/**
 * Marks the document as staging before the first render: prefixes the tab
 * title and reserves room for the banner through the --staging-h variable, which
 * the layout's sticky/fixed elements offset themselves by (0px in production).
 */
export function applyStagingDocumentState(): void {
  if (!IS_STAGING) return;
  if (!document.title.startsWith('[STAGING] ')) document.title = `[STAGING] ${document.title}`;
  document.documentElement.style.setProperty('--staging-h', STAGING_BANNER_HEIGHT);
}
