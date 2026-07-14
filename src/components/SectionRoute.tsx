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
      <div className="p-6 text-sm text-gray-500">Loading…</div>
    );
  }

  if (!canRead(page)) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto mt-24 bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
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
          <h2 className="text-sm font-semibold text-white mb-1">
            No access to this section
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Ask a super admin to grant you access if you need it.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
