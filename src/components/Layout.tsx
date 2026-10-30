import { useEffect, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BadgePercent,
  ChevronRight,
  CreditCard,
  FileText,
  Handshake,
  Images,
  Inbox,
  MapPinned,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
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
import BrandLogo from './BrandLogo';
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
 * The sections, grouped the way the sidebar shows them. `page` ties each entry
 * to the backend AdminPage grant that governs it - an admin without a grant
 * never sees the link, and the API would refuse them anyway.
 */
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', page: 'DASHBOARD', end: true, icon: LayoutDashboard },
      { to: '/utilities', label: 'Utilities', page: 'UTILITIES', icon: Wrench },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/users', label: 'User Details', page: 'USERS', icon: Users },
      { to: '/partners', label: 'Booking Partners', page: 'BOOKING_PARTNERS', icon: Handshake },
      { to: '/messages', label: 'Customer Messages', page: 'CUSTOMER_MESSAGES', icon: Inbox },
    ],
  },
  {
    title: 'Business',
    items: [
      { to: '/orders', label: 'Orders', page: 'ORDERS', icon: Receipt },
      { to: '/commissions', label: 'Commission', page: 'COMMISSION', icon: BadgePercent },
      { to: '/coupons', label: 'Coupons', page: 'COUPONS', icon: TicketPercent },
      { to: '/offers', label: 'Offers', page: 'OFFERS', icon: Tag },
      { to: '/custom-payments', label: 'Custom Payments', page: 'CUSTOM_PAYMENTS', icon: CreditCard },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/reviews', label: 'Reviews', page: 'REVIEWS', icon: Star },
      { to: '/policies', label: 'Policies', page: 'POLICIES', icon: FileText },
      { to: '/site-content', label: 'Site Content', page: 'SITE_CONTENT', icon: LayoutTemplate },
      { to: '/media', label: 'Media Library', page: 'SITE_CONTENT', icon: Images },
      { to: '/destinations', label: 'Destinations', page: 'SITE_CONTENT', icon: MapPinned },
    ],
  },
  {
    title: 'Security',
    items: [
      { to: '/user-access', label: 'User Access', page: 'USER_ACCESS', icon: ShieldCheck },
      { to: '/audit-logs', label: 'Audit Logs', page: 'AUDIT_LOGS', icon: ScrollText },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Sidebar widths on desktop; pages read --sidebar-w (e.g. User Access's sticky bar). */
const WIDE = '17rem';
const NARROW = '5rem';
const COLLAPSE_KEY = 'sp-admin:sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { canRead, isSuperAdmin, isLoading } = useAccess();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  // Desktop-only icon rail. The mobile drawer always opens full width.
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Storage blocked - the preference just won't persist.
    }
  }, [collapsed]);

  const visibleGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => canRead(item.page)) })).filter(
    (g) => g.items.length > 0,
  );
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

  /** Classes that apply only to the collapsed desktop rail. */
  const rail = (classes: string) => (collapsed ? classes : '');

  // Navy sidebar in the customer site's footer style: white/65 links that
  // brighten on hover, and a brand-blue glowing pill for the current section.
  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-3 rounded-xl px-2.5 py-1 text-sm transition-all duration-200 ${rail('lg:justify-center lg:px-0')} ${
      isActive
        ? 'bg-gradient-to-r from-primary-button to-blue-500 font-bold text-white shadow-lg shadow-blue-950/40'
        : 'font-semibold text-white/65 hover:bg-white/[0.06] hover:text-white'
    }`;

  const collapseButton = (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/15 hover:text-white lg:flex"
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );

  const sidebar = (
    <>
      {/* Same brand stripe as the top of the site's footer */}
      <div className="h-1 shrink-0 bg-gradient-to-r from-links via-sky-400 to-accent-light" aria-hidden="true" />

      {/* Soft glows, like the site's auth pages */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <span className="absolute -top-20 -left-16 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
        <span className="absolute -right-24 bottom-24 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className={`relative flex shrink-0 items-center justify-between gap-2 px-5 pt-3 pb-2 ${rail('lg:flex-col lg:px-3')}`}>
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo className={`h-11 w-auto ${rail('lg:h-10')}`} wordmark={false} />
          <div className={`min-w-0 leading-tight ${rail('lg:hidden')}`}>
            <p className="truncate text-sm font-extrabold tracking-tight text-white">Soul Paradise</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Admin console</p>
          </div>
        </div>
        {collapseButton}
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="Close menu"
          className="-mr-2 rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <nav className={`relative flex-1 overflow-y-auto px-3 pb-3 ${rail('lg:px-3')}`}>
        {isLoading ? (
          <div className="px-3 py-2 text-xs text-white/50">Loading…</div>
        ) : visibleGroups.length === 0 ? (
          // An admin with no grants at all. Say so plainly rather than showing
          // an empty sidebar that looks like a broken page.
          <div className={`mx-1 rounded-xl bg-white/5 px-3 py-3 text-xs leading-relaxed text-white/70 ring-1 ring-white/10 ${rail('lg:hidden')}`}>
            No sections have been assigned to your account yet. Ask a super admin to grant you access.
          </div>
        ) : (
          visibleGroups.map((group) => (
            <div key={group.title} className="mt-2 first:mt-0">
              <p className={`mb-0.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 ${rail('lg:hidden')}`}>{group.title}</p>
              {/* In the icon rail a thin rule stands in for the group title. */}
              <div className={`mx-auto mb-2 hidden h-px w-8 bg-white/10 ${rail('lg:block')}`} aria-hidden="true" />
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setNavOpen(false)}
                    className={linkClasses}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isActive ? 'bg-white/20' : 'bg-white/[0.06] group-hover:bg-white/10'
                          } ${rail('lg:h-9 lg:w-9')}`}
                        >
                          <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.25 : 1.9} />
                        </span>
                        <span className={`flex-1 ${rail('lg:hidden')}`}>{item.label}</span>
                        {isActive && <ChevronRight className={`h-4 w-4 shrink-0 opacity-80 ${rail('lg:hidden')}`} strokeWidth={2.25} />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Account card */}
      <div className="relative shrink-0 p-3">
        <div className={`rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur ${rail('lg:p-2')}`}>
          <div className={`flex items-center gap-2.5 ${rail('lg:justify-center')}`}>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-primary-button text-xs font-extrabold tracking-wide text-white ring-2 ring-white/20"
              title={collapsed ? `${user?.name ?? ''} · ${isSuperAdmin ? 'Super Admin' : 'Admin'}` : undefined}
            >
              {initials(user?.name)}
            </div>
            <div className={`min-w-0 flex-1 ${rail('lg:hidden')}`}>
              <p className="truncate text-sm leading-tight font-bold text-white">{user?.name}</p>
              <p className="truncate text-xs leading-tight text-white/55">{user?.email}</p>
            </div>
          </div>

          <div className="my-2.5 h-px bg-white/10" />

          {/* Role and sign-out share a row: the badge is a label, not an action,
              so it reads better beside the button than stacked above it. */}
          <div className={`flex items-center justify-between gap-2 ${rail('lg:justify-center')}`}>
            <span
              className={`inline-flex h-7 min-w-0 items-center gap-1.5 truncate rounded-full px-2.5 text-[11px] leading-none font-bold ${
                isSuperAdmin ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30' : 'bg-white/10 text-white/75 ring-1 ring-white/15'
              } ${rail('lg:hidden')}`}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>

            <button
              onClick={logout}
              aria-label="Sign out"
              title={collapsed ? 'Sign out' : undefined}
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-bold text-white/80 ring-1 ring-white/15 transition-colors duration-200 hover:bg-danger hover:text-white hover:ring-danger ${rail('lg:h-9 lg:w-9 lg:justify-center lg:px-0')}`}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className={rail('lg:hidden')}>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-background lg:flex" style={{ '--sidebar-w': collapsed ? NARROW : WIDE } as CSSProperties}>
      {/* Mobile top bar - the only way to reach the nav below lg. */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-white/10 bg-gradient-to-r from-ink-soft to-ink px-4 text-white shadow-md lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={navOpen}
          className="-ml-2 rounded-lg p-2 text-white transition-colors duration-200 hover:bg-white/10"
        >
          <Menu className="h-6 w-6" strokeWidth={1.75} />
        </button>
        <BrandLogo className="h-10 w-auto" />
        <span className="truncate text-sm font-bold">{currentLabel}</span>
      </header>

      {/* Backdrop for the mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
      )}

      {/*
       * One sidebar for both breakpoints: a fixed off-canvas drawer that slides
       * in below lg, and a static column at lg and up. Rendering it twice would
       * mean two copies of the nav state to keep in step.
       */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden bg-gradient-to-b from-ink-soft to-ink shadow-2xl shadow-ink/30 transition-[transform,width] duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[var(--sidebar-w)] lg:max-w-none lg:translate-x-0 ${
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
