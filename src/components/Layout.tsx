import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BadgePercent,
  ChevronRight,
  CreditCard,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  Star,
  Tag,
  TicketPercent,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAccess } from '../hooks/useAccess';
import type { AdminPage } from '../lib/api';

interface NavItem {
  to: string;
  label: string;
  page: AdminPage;
  icon: LucideIcon;
  end?: boolean;
}

/**
 * The sections, in the order the sidebar shows them. `page` ties each entry
 * to the backend AdminPage grant that governs it - an admin without a grant
 * never sees the link, and the API would refuse them anyway.
 */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', page: 'DASHBOARD', end: true, icon: LayoutDashboard },
  { to: '/users', label: 'User Details', page: 'USERS', icon: Users },
  { to: '/partners', label: 'Booking Partners', page: 'BOOKING_PARTNERS', icon: Handshake },
  { to: '/commissions', label: 'Commission', page: 'COMMISSION', icon: BadgePercent },
  { to: '/coupons', label: 'Coupons', page: 'COUPONS', icon: TicketPercent },
  { to: '/offers', label: 'Offers', page: 'OFFERS', icon: Tag },
  { to: '/reviews', label: 'Reviews', page: 'REVIEWS', icon: Star },
  { to: '/utilities', label: 'Utilities', page: 'UTILITIES', icon: Wrench },
  { to: '/custom-payments', label: 'Custom Payments', page: 'CUSTOM_PAYMENTS', icon: CreditCard },
  { to: '/user-access', label: 'User Access', page: 'USER_ACCESS', icon: ShieldCheck },
  { to: '/audit-logs', label: 'Audit Logs', page: 'AUDIT_LOGS', icon: ScrollText },
];

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  // Same active / hover treatment as the customer site's navbar links.
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
    isActive
      ? 'bg-primary-tint font-bold text-links'
      : 'font-semibold text-inactive hover:bg-primary-tint/50 hover:text-links'
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
  // should close it - both are expected of anything that behaves like a modal.
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
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="px-3 py-2 text-xs text-inactive">Loading…</div>
        ) : visibleItems.length === 0 ? (
          // An admin with no grants at all. Say so plainly rather than showing
          // an empty sidebar that looks like a broken page.
          <div className="px-3 py-2 text-xs leading-relaxed text-inactive">
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
              {({ isActive }) => (
                <>
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-opacity ${isActive ? 'opacity-60' : 'opacity-0'}`}
                  />
                </>
              )}
            </NavLink>
          ))
        )}
      </nav>

      {/* Account card */}
      <div className="shrink-0 border-t border-tertiary-button p-3">
        <div className="rounded-2xl border border-tertiary-button bg-background p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-button text-[11px] font-bold tracking-wide text-peace ring-2 ring-peace">
              {initials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight font-bold text-foreground">{user?.name}</p>
              <p className="truncate text-xs leading-tight text-inactive">{user?.email}</p>
            </div>
          </div>

          <div className="my-2.5 h-px bg-tertiary-button" />

          {/* Role and sign-out share a row: the badge is a label, not an action,
              so it reads better beside the button than stacked above it. */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex h-7 min-w-0 items-center truncate rounded-full border px-2.5 text-[11px] leading-none font-bold ${
                isSuperAdmin
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-tertiary-button bg-peace text-inactive'
              }`}
            >
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>

            <button
              onClick={logout}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-tertiary-button bg-peace px-3 text-xs font-bold text-inactive transition-colors duration-200 hover:border-danger hover:bg-danger hover:text-peace"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {/* Mobile top bar - the only way to reach the nav below lg. */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-tertiary-button bg-peace px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={navOpen}
          className="-ml-2 rounded-lg p-2 text-foreground transition-colors duration-200 hover:bg-background"
        >
          <Menu className="h-6 w-6" strokeWidth={1.75} />
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
