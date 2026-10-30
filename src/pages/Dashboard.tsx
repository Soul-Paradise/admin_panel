import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BadgePercent,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Handshake,
  IndianRupee,
  Mail,
  Plane,
  ShieldCheck,
  Star,
  TicketPercent,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { api, type AdminPage, type AnalyticsOverview, type AuditLogEntry, type User } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useAccess } from '../hooks/useAccess';
import { Alert, Badge, EmptyState, HeroStat, IconTile, PageHeader, SectionTitle, StatTile, Tabs } from '../components/ui';
import { CARD, CARD_LINK, LABEL, PAGE, type Accent, type Tone } from '../lib/ui-styles';

type Range = 'today' | '7d' | '30d';

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
];

interface UserCounts {
  total: number;
  customers: number;
  agents: number;
  admins: number;
}


const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const ROLE_TONE: Record<string, Tone> = { USER: 'green', AGENT: 'amber', ADMIN: 'purple', SUPER_ADMIN: 'blue' };

export default function Dashboard() {
  const { user } = useAuth();
  const { canRead } = useAccess();
  const showUsers = canRead('USERS');
  const showAnalytics = canRead('UTILITIES');
  const showAudit = canRead('AUDIT_LOGS');

  const [range, setRange] = useState<Range>('7d');
  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(showUsers);
  const [loadingAnalytics, setLoadingAnalytics] = useState(showAnalytics);
  const [error, setError] = useState<string | null>(null);

  // People + activity: independent of the range switch, fetched once.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [all, customers, agents, admins, recent, logs] = await Promise.all([
          showUsers ? api.getUsers({ limit: 1 }) : null,
          showUsers ? api.getUsers({ role: 'USER', limit: 1 }) : null,
          showUsers ? api.getUsers({ role: 'AGENT', limit: 1 }) : null,
          showUsers ? api.getUsers({ role: 'ADMIN', limit: 1 }) : null,
          showUsers ? api.getUsers({ limit: 5 }) : null,
          showAudit ? api.getAuditLogs({ limit: 5 }) : null,
        ]);
        if (cancelled) return;
        if (all && customers && agents && admins) {
          setCounts({
            total: all.pagination.total,
            customers: customers.pagination.total,
            agents: agents.pagination.total,
            admins: admins.pagination.total,
          });
        }
        if (recent) setRecentUsers(recent.users);
        if (logs) setActivity(logs.items);
      } catch (err) {
        console.error('Failed to load dashboard people data:', err);
        if (!cancelled) setError('Some dashboard data could not be loaded. Please refresh.');
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [showUsers, showAudit]);

  // Platform analytics for the selected range.
  useEffect(() => {
    if (!showAnalytics) return;
    let cancelled = false;
    api
      .getAnalyticsOverview(range)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err) => {
        console.error('Failed to load analytics:', err);
        if (!cancelled) setError('Some dashboard data could not be loaded. Please refresh.');
      })
      .finally(() => {
        if (!cancelled) setLoadingAnalytics(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, showAnalytics]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const rangeLabel = RANGES.find((r) => r.key === range)?.label.toLowerCase();

  const shortcuts = (
    [
      { to: '/users', label: 'User Details', page: 'USERS' as const, hint: 'Browse and manage customer accounts', icon: Users, accent: 'blue' as const },
      { to: '/partners', label: 'Booking Partners', page: 'BOOKING_PARTNERS' as const, hint: 'Approve and review partner agents', icon: Handshake, accent: 'orange' as const },
      { to: '/commissions', label: 'Commission', page: 'COMMISSION' as const, hint: 'Set service commission rates', icon: BadgePercent, accent: 'green' as const },
      { to: '/coupons', label: 'Coupons', page: 'COUPONS' as const, hint: 'Create and manage discount codes', icon: TicketPercent, accent: 'purple' as const },
    ] as const
  ).filter((s) => canRead(s.page));

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow={
          <>
            <CalendarDays className="h-3.5 w-3.5" /> {today}
          </>
        }
        section="dashboard"
        title={`${greeting()}, ${firstName}`}
        subtitle={`Here's how Soul Paradise is doing${showAnalytics ? ` over the last ${rangeLabel === 'today' ? 'day' : rangeLabel}` : ''}.`}
        actions={showAnalytics ? <Tabs options={RANGES} active={range} onChange={setRange} label="Date range" variant="glass" /> : undefined}
        stats={
          showAnalytics ? (
            <>
              <HeroStat icon={IndianRupee} label="Revenue" value={analytics ? inr(analytics.bookings.totalRevenue) : null} />
              <HeroStat icon={TrendingUp} label="Bookings" value={analytics ? analytics.bookings.totalCount.toLocaleString('en-IN') : null} />
              <HeroStat icon={UserPlus} label="New users" value={analytics ? analytics.users.newInRange.toLocaleString('en-IN') : null} />
            </>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-6">
          <Alert tone="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* People */}
      {showUsers && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {loadingUsers || !counts ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)
          ) : (
            <>
              <StatTile
                label="Total Users"
                value={counts.total.toLocaleString('en-IN')}
                icon={Users}
                accent="blue"
                sub={analytics ? `${analytics.users.loggedInInRange} signed in ${rangeLabel === 'today' ? 'today' : `over ${rangeLabel}`}` : undefined}
              />
              <StatTile label="Customers" value={counts.customers.toLocaleString('en-IN')} icon={UserRound} accent="green" sub={analytics ? `+${analytics.users.newInRange} new` : undefined} />
              <StatTile
                label="Booking Partners"
                value={counts.agents.toLocaleString('en-IN')}
                icon={Handshake}
                accent="orange"
                sub={analytics ? `${analytics.partners.active} active · ${analytics.partners.revoked} revoked` : undefined}
              />
              <StatTile label="Admins" value={counts.admins.toLocaleString('en-IN')} icon={ShieldCheck} accent="purple" sub="Panel access" />
            </>
          )}
        </div>
      )}

      {/* Bookings */}
      {showAnalytics && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className={`p-5 lg:col-span-2 ${CARD}`}>
            <SectionTitle
              aside={
                <div className="flex items-center gap-3 text-xs font-semibold text-inactive">
                  <Legend className="bg-blue-500" label="Flights" />
                  <Legend className="bg-orange-500" label="Hotels" />
                  <Legend className="bg-purple-500" label="Insurance" />
                </div>
              }
            >
              Bookings trend
            </SectionTitle>
            {loadingAnalytics || !analytics ? <div className="h-48 animate-pulse rounded-xl bg-slate-100" /> : <BookingsChart days={analytics.dailyBookings} />}
          </section>

          <section className={`p-5 ${CARD}`}>
            <SectionTitle>Revenue by service</SectionTitle>
            {loadingAnalytics || !analytics ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <ServiceBreakdown analytics={analytics} />
            )}
          </section>
        </div>
      )}

      {/* Attention / sign-ups / activity */}
      {(showAnalytics || showUsers || showAudit) && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {showAnalytics && (
            <section className={`p-5 ${CARD}`}>
              <SectionTitle>Needs your attention</SectionTitle>
              {analytics ? <Attention analytics={analytics} canRead={canRead} /> : <ListSkeleton />}
            </section>
          )}

          {showUsers && (
            <section className={`p-5 ${CARD}`}>
              <SectionTitle
                aside={
                  <Link to="/users" className="text-xs font-bold text-links hover:underline">
                    View all
                  </Link>
                }
              >
                Recent sign-ups
              </SectionTitle>
              {loadingUsers ? (
                <ListSkeleton />
              ) : recentUsers.length === 0 ? (
                <EmptyState icon={UserPlus} title="No users yet" />
              ) : (
                <ul className="divide-y divide-tertiary-button">
                  {recentUsers.map((u) => (
                    <li key={u.id}>
                      <Link to={`/users/${u.id}`} className="group flex items-center gap-3 py-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-primary-button text-sm font-bold text-white">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-foreground group-hover:text-links">{u.name}</span>
                          <span className="block truncate text-xs text-inactive">{timeAgo(u.createdAt)}</span>
                        </span>
                        <Badge tone={ROLE_TONE[u.role] ?? 'slate'}>{u.role}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {showAudit && (
            <section className={`p-5 ${CARD}`}>
              <SectionTitle
                aside={
                  <Link to="/audit-logs" className="text-xs font-bold text-links hover:underline">
                    View all
                  </Link>
                }
              >
                Recent admin activity
              </SectionTitle>
              {loadingUsers ? (
                <ListSkeleton />
              ) : activity.length === 0 ? (
                <EmptyState icon={Activity} title="No activity yet" />
              ) : (
                <ol className="relative space-y-4 border-l-2 border-tertiary-button pl-4">
                  {activity.map((a) => (
                    <li key={a.id} className="relative">
                      <span
                        className={`absolute top-1 -left-[1.4rem] h-3 w-3 rounded-full ring-4 ring-peace ${a.statusCode < 400 ? 'bg-success' : 'bg-danger'}`}
                        aria-hidden="true"
                      />
                      <p className="truncate text-sm font-bold text-foreground">{a.action.replace(/^(GET|POST|PATCH|PUT|DELETE) /, '').replace(/Admin(\w+)Controller\./, '$1 · ')}</p>
                      <p className="truncate text-xs text-inactive">
                        {a.actorEmail} · {timeAgo(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      )}

      {shortcuts.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Quick links</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((s) => (
              <Link key={s.to} to={s.to} className={`group p-4 ${CARD_LINK}`}>
                <div className="flex items-center gap-3">
                  <IconTile icon={s.icon} accent={s.accent} size="sm" />
                  <span className="flex-1 text-sm font-bold text-foreground group-hover:text-links">{s.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-links transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-inactive">{s.hint}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------


function SkeletonTile() {
  return (
    <div className={`flex items-start gap-3 p-4 ${CARD}`}>
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-slate-100" />
      <div className="flex-1">
        <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-3 h-6 w-12 animate-pulse rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

/** Stacked daily bars: flights / hotels / insurance. */
function BookingsChart({ days }: { days: AnalyticsOverview['dailyBookings'] }) {
  const totals = days.map((d) => d.flights + d.hotels + d.insurance);
  const max = Math.max(1, ...totals);
  if (days.length === 0 || totals.every((t) => t === 0)) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl bg-background text-center">
        <Plane className="h-6 w-6 text-links" />
        <p className="mt-2 text-sm font-bold text-foreground">No bookings in this period</p>
        <p className="text-xs text-inactive">New flight, hotel and insurance bookings will show up here.</p>
      </div>
    );
  }
  const labelEvery = Math.ceil(days.length / 10);
  return (
    <div>
      <div className="flex h-48 items-end gap-1.5 border-b border-tertiary-button pb-px">
        {days.map((d, i) => {
          const total = totals[i];
          const label = new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          return (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${label}: ${d.flights} flights, ${d.hotels} hotels, ${d.insurance} insurance`}>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md transition-opacity group-hover:opacity-80" style={{ height: `${(total / max) * 100}%` }}>
                {d.flights > 0 && <div className="bg-blue-500" style={{ flexGrow: d.flights }} />}
                {d.hotels > 0 && <div className="bg-orange-500" style={{ flexGrow: d.hotels }} />}
                {d.insurance > 0 && <div className="bg-purple-500" style={{ flexGrow: d.insurance }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {days.map((d, i) => (
          <span key={d.date} className="flex-1 truncate text-center text-[10px] text-inactive">
            {i % labelEvery === 0 ? new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function ServiceBreakdown({ analytics }: { analytics: AnalyticsOverview }) {
  const b = analytics.bookings;
  const rows: { label: string; icon: LucideIcon; accent: Accent; bar: string; count: number; revenue: number }[] = [
    { label: 'Flights', icon: Plane, accent: 'blue', bar: 'bg-blue-500', count: b.flights.count, revenue: b.flights.revenue },
    { label: 'Hotels', icon: Building2, accent: 'orange', bar: 'bg-orange-500', count: b.hotels.count, revenue: b.hotels.revenue },
    { label: 'Insurance', icon: ShieldCheck, accent: 'purple', bar: 'bg-purple-500', count: b.insurance.count, revenue: b.insurance.revenue },
  ];
  const total = Math.max(1, b.totalRevenue);
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.label} className="group">
          <div className="flex items-center gap-3">
            <IconTile icon={r.icon} accent={r.accent} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{r.label}</p>
              <p className="text-xs text-inactive">
                {r.count} booking{r.count === 1 ? '' : 's'}
              </p>
            </div>
            <p className="text-sm font-extrabold tabular-nums text-foreground">{inr(r.revenue)}</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${(r.revenue / total) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-tertiary-button pt-3">
        <span className={LABEL}>Total</span>
        <span className="text-base font-extrabold tabular-nums text-foreground">{inr(b.totalRevenue)}</span>
      </div>
    </div>
  );
}

function Attention({ analytics, canRead }: { analytics: AnalyticsOverview; canRead: (page: AdminPage) => boolean }) {
  const items: { key: string; icon: LucideIcon; accent: Accent; label: string; detail: string; count: number; to?: string }[] = [
    {
      key: 'reviews',
      icon: Star,
      accent: 'orange',
      label: 'Reviews to moderate',
      detail: 'Awaiting approval',
      count: analytics.reviews.pending,
      to: canRead('REVIEWS') ? '/reviews' : undefined,
    },
    {
      key: 'payments',
      icon: CreditCard,
      accent: 'pink',
      label: 'Failed payments',
      detail: 'In the selected period',
      count: analytics.payments.failed.count,
      to: canRead('CUSTOM_PAYMENTS') ? '/custom-payments' : undefined,
    },
    {
      key: 'partners',
      icon: Handshake,
      accent: 'slate',
      label: 'Revoked partners',
      detail: 'Access currently removed',
      count: analytics.partners.revoked,
      to: canRead('BOOKING_PARTNERS') ? '/partners' : undefined,
    },
    {
      key: 'contacts',
      icon: Mail,
      accent: 'teal',
      label: 'Contact messages',
      detail: analytics.contacts.failed ? `${analytics.contacts.failed} failed to send` : 'Not yet forwarded',
      count: analytics.contacts.pending + analytics.contacts.failed,
    },
  ];
  const open = items.filter((i) => i.count > 0);
  if (open.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl bg-success/10 px-4 py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" />
        <p className="mt-2 text-sm font-bold text-foreground">All caught up</p>
        <p className="text-xs text-inactive">Nothing needs your attention right now.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((i) => {
        const body: ReactNode = (
          <>
            <IconTile icon={i.icon} accent={i.accent} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground group-hover:text-links">{i.label}</span>
              <span className="block truncate text-xs text-inactive">{i.detail}</span>
            </span>
            <span className={`min-w-8 rounded-full px-2.5 py-0.5 text-center text-sm font-extrabold tabular-nums ${i.count > 0 ? 'bg-danger/10 text-danger' : 'bg-slate-100 text-inactive'}`}>
              {i.count}
            </span>
          </>
        );
        return (
          <li key={i.key}>
            {i.to ? (
              <Link to={i.to} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-primary-tint/50">
                {body}
              </Link>
            ) : (
              <div className="group flex items-center gap-3 rounded-xl p-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
