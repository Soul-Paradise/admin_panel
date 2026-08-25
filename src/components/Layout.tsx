import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAccess } from '../hooks/useAccess';
import type { AdminPage } from '../lib/api';

interface NavItem {
  to: string;
  label: string;
  page: AdminPage;
  icon: ReactNode;
  end?: boolean;
}

/**
 * The ten sections, in the order the sidebar shows them. `page` ties each entry
 * to the backend AdminPage grant that governs it — an admin without a grant
 * never sees the link, and the API would refuse them anyway.
 */
const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    page: 'DASHBOARD',
    end: true,
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    ),
  },
  {
    to: '/users',
    label: 'User Details',
    page: 'USERS',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    ),
  },
  {
    to: '/partners',
    label: 'Booking Partners',
    page: 'BOOKING_PARTNERS',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.746 3.746 0 0121 12z" />
    ),
  },
  {
    to: '/commissions',
    label: 'Commission',
    page: 'COMMISSION',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    to: '/coupons',
    label: 'Coupons',
    page: 'COUPONS',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    ),
  },
  {
    to: '/offers',
    label: 'Offers',
    page: 'OFFERS',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    ),
  },
  {
    to: '/reviews',
    label: 'Reviews',
    page: 'REVIEWS',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    ),
  },
  {
    to: '/utilities',
    label: 'Utilities',
    page: 'UTILITIES',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
  },
  {
    to: '/user-access',
    label: 'User Access',
    page: 'USER_ACCESS',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    ),
  },
  {
    to: '/audit-logs',
    label: 'Audit Logs',
    page: 'AUDIT_LOGS',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
  },
];

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${
    isActive
      ? 'bg-tertiary-button font-bold text-active'
      : 'font-semibold text-inactive hover:bg-background hover:text-active'
  }`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { canRead, isSuperAdmin, isLoading } = useAccess();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => canRead(item.page));
  const currentLabel =
    NAV_ITEMS.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))?.label ??
    'Admin Panel';

  // While the drawer is open the page behind it must not scroll, and Escape
  // should close it — both are expected of anything that behaves like a modal.
  useEffect(() => {
    if (!navOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [navOpen]);

  const sidebar = (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-tertiary-button px-4">
        <img src="/logo.png" alt="Soul Paradise" className="h-11 w-auto" />
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="Close menu"
          className="-mr-2 rounded-lg p-2 text-foreground transition-colors hover:bg-background lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
        ) : visibleItems.length === 0 ? (
          // An admin with no grants at all. Say so plainly rather than showing
          // an empty sidebar that looks like a broken page.
          <div className="px-3 py-2 text-xs leading-relaxed text-gray-500">
            No sections have been assigned to your account yet. Ask a super admin
            to grant you access.
          </div>
        ) : (
          visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setNavOpen(false)}
              className={linkClasses}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {item.icon}
              </svg>
              {item.label}
            </NavLink>
          ))
        )}
      </nav>

      {/* Account card */}
      <div className="shrink-0 border-t border-tertiary-button p-3">
        <div className="rounded-xl border border-tertiary-button bg-background p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-button text-[11px] font-bold tracking-wide text-peace ring-2 ring-peace">
              {initials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight font-bold text-foreground">{user?.name}</p>
              <p className="truncate text-xs leading-tight text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="my-2.5 h-px bg-tertiary-button" />

          {/* Role and sign-out share a row: the badge is a label, not an action,
              so it reads better beside the button than stacked above it. */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex h-7 min-w-0 items-center truncate rounded-full border px-2.5 text-[11px] leading-none font-bold ${
                isSuperAdmin
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-tertiary-button bg-peace text-gray-600'
              }`}
            >
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>

            <button
              onClick={logout}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-tertiary-button bg-peace px-2.5 text-xs font-bold text-gray-600 shadow-sm transition-colors duration-200 hover:border-red-200 hover:bg-red-50 hover:text-danger"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {/* Mobile top bar — the only way to reach the nav below lg. */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-tertiary-button bg-peace px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={navOpen}
          className="-ml-2 rounded-lg p-2 text-foreground transition-colors duration-200 hover:bg-background"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>
        <img src="/logo.png" alt="Soul Paradise" className="h-10 w-auto" />
        <span className="truncate text-sm font-bold text-foreground">{currentLabel}</span>
      </header>

      {/* Backdrop for the mobile drawer */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/*
       * One sidebar for both breakpoints: a fixed off-canvas drawer that slides
       * in below lg, and a static column at lg and up. Rendering it twice would
       * mean two copies of the nav state to keep in step.
       */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-tertiary-button bg-peace transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-64 lg:max-w-none lg:translate-x-0 lg:transition-none ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1 lg:h-dvh lg:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
