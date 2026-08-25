import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAccess } from '../hooks/useAccess';
import type { AdminPage } from '../lib/api';

/**
 * Refuses a section the admin has no grant for. Hiding the sidebar link alone
 * would still leave the page reachable by typing the URL — and while the API
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
    return (
      <div className="p-4 text-sm text-gray-500 sm:p-6">Loading…</div>
    );
  }

  if (!canRead(page)) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-tertiary-button bg-peace p-6 text-center shadow-sm sm:mt-24 sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background">
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="mb-1 text-base font-bold text-foreground">
            No access to this section
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Ask a super admin to grant you access if you need it.
          </p>
          <Link
            to="/"
            className="inline-block rounded-lg bg-primary-button px-4 py-2 text-sm font-semibold text-peace shadow-sm transition-colors duration-200 hover:bg-secondary-button"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
