import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAccess } from '../hooks/useAccess';
import type { AdminPage } from '../lib/api';
import { BTN_PRIMARY, CARD } from '../lib/ui-styles';
import { EmptyState, Spinner } from './ui';

/**
 * Refuses a section the admin has no grant for. Hiding the sidebar link alone
 * would still leave the page reachable by typing the URL - and while the API
 * would reject the data calls, the user would land on a broken-looking screen of
 * failed requests instead of a clear explanation.
 *
 * This is a UX guard, not a security boundary: PageAccessGuard on the backend is
 * what actually protects the data.
 */
export default function SectionRoute({
  page,
  children,
}: {
  page: AdminPage;
  children: ReactNode;
}) {
  const { canRead, isLoading } = useAccess();

  if (isLoading) {
    return <Spinner />;
  }

  if (!canRead(page)) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <div className={`mx-auto mt-16 max-w-md sm:mt-24 ${CARD}`}>
          <EmptyState
            icon={Lock}
            title="No access to this section"
            message="Ask a super admin to grant you access if you need it."
            action={
              <Link to="/" className={BTN_PRIMARY}>
                Back to dashboard
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
