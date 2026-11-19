import { FlaskConical } from 'lucide-react';
import { IS_STAGING } from '../lib/app-env';
import { STAGING_BANNER } from '../lib/ui-styles';

/**
 * Slim strip pinned above everything on the staging build so nobody mistakes it
 * for the live console. Its height is reserved via --staging-h (see
 * lib/app-env.ts), so it never sits on top of the nav or the mobile top bar.
 */
export default function StagingBanner() {
  if (!IS_STAGING) return null;
  return (
    <div role="region" aria-label="Environment notice" className={STAGING_BANNER}>
      <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      <p className="truncate">
        <strong className="font-extrabold">STAGING</strong> — test environment.
        {/* Phones show the short form; screen readers always get the full sentence. */}
        <span className="sr-only sm:not-sr-only"> Changes here don&apos;t affect the live site.</span>
      </p>
    </div>
  );
}
