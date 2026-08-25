import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useAccess } from '../hooks/useAccess';

interface Stats {
  total: number;
  customers: number;
  agents: number;
  admins: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { canRead } = useAccess();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [all, customers, agents, admins] = await Promise.all([
          api.getUsers({ limit: 1 }),
          api.getUsers({ role: 'USER', limit: 1 }),
          api.getUsers({ role: 'AGENT', limit: 1 }),
          api.getUsers({ role: 'ADMIN', limit: 1 }),
        ]);
        setStats({
          total: all.pagination.total,
          customers: customers.pagination.total,
          agents: agents.pagination.total,
          admins: admins.pagination.total,
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Could not load statistics. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards: { label: string; value: number; accent: string }[] = stats
    ? [
        { label: 'Total Users', value: stats.total, accent: 'bg-links' },
        { label: 'Customers', value: stats.customers, accent: 'bg-success' },
        { label: 'Booking Partners', value: stats.agents, accent: 'bg-warn' },
        { label: 'Admins', value: stats.admins, accent: 'bg-primary-button' },
      ]
    : [];

  // Shortcuts are filtered by the same grants that drive the sidebar, so the
  // landing page never offers a section the user would be refused.
  const shortcuts = (
    [
      { to: '/users', label: 'User Details', page: 'USERS' as const, hint: 'Browse and manage customer accounts' },
      { to: '/partners', label: 'Booking Partners', page: 'BOOKING_PARTNERS' as const, hint: 'Approve and review partner agents' },
      { to: '/commissions', label: 'Commission', page: 'COMMISSION' as const, hint: 'Set service commission rates' },
      { to: '/coupons', label: 'Coupons', page: 'COUPONS' as const, hint: 'Create and manage discount codes' },
    ] as const
  ).filter((s) => canRead(s.page));

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 text-sm text-foreground">
          Here's a snapshot of the Soul Paradise platform.
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stat cards — 2 across on phones so the numbers stay readable, 4 on desktop. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-tertiary-button bg-peace p-4 shadow-sm sm:p-5">
                <div className="h-3 w-20 animate-pulse rounded bg-tertiary-button" />
                <div className="mt-3 h-7 w-12 animate-pulse rounded bg-tertiary-button" />
              </div>
            ))
          : cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-tertiary-button bg-peace p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${card.accent}`} aria-hidden="true" />
                  <p className="truncate text-xs font-semibold text-inactive sm:text-sm">{card.label}</p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                  {card.value.toLocaleString('en-IN')}
                </p>
              </div>
            ))}
      </div>

      {shortcuts.length > 0 && (
        <section className="mt-8 sm:mt-10">
          <h2 className="mb-3 text-sm font-bold text-foreground">Quick links</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="rounded-xl border border-tertiary-button bg-peace p-4 shadow-sm transition-colors duration-200 hover:border-secondary-button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{s.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-links" strokeWidth={2} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.hint}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
