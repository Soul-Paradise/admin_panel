import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgePercent, Handshake, ShieldCheck, TicketPercent, UserRound, Users, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useAccess } from '../hooks/useAccess';
import { Alert, IconTile, PageHeader, SectionTitle, StatTile } from '../components/ui';
import { CARD, CARD_LINK, PAGE, type Accent } from '../lib/ui-styles';

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

  const cards: { label: string; value: number; icon: LucideIcon; accent: Accent }[] = stats
    ? [
        { label: 'Total Users', value: stats.total, icon: Users, accent: 'blue' },
        { label: 'Customers', value: stats.customers, icon: UserRound, accent: 'green' },
        { label: 'Booking Partners', value: stats.agents, icon: Handshake, accent: 'orange' },
        { label: 'Admins', value: stats.admins, icon: ShieldCheck, accent: 'purple' },
      ]
    : [];

  // Shortcuts are filtered by the same grants that drive the sidebar, so the
  // landing page never offers a section the user would be refused.
  const shortcuts = (
    [
      { to: '/users', label: 'User Details', page: 'USERS' as const, hint: 'Browse and manage customer accounts', icon: Users, accent: 'blue' as const },
      { to: '/partners', label: 'Booking Partners', page: 'BOOKING_PARTNERS' as const, hint: 'Approve and review partner agents', icon: Handshake, accent: 'orange' as const },
      { to: '/commissions', label: 'Commission', page: 'COMMISSION' as const, hint: 'Set service commission rates', icon: BadgePercent, accent: 'green' as const },
      { to: '/coupons', label: 'Coupons', page: 'COUPONS' as const, hint: 'Create and manage discount codes', icon: TicketPercent, accent: 'purple' as const },
    ] as const
  ).filter((s) => canRead(s.page));

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className={PAGE}>
      <PageHeader eyebrow="Dashboard" title={`Welcome back, ${firstName}`} subtitle="Here's a snapshot of the Soul Paradise platform." />

      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {/* Stat cards - 2 across on phones so the numbers stay readable, 4 on desktop. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 ${CARD}`}>
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                <div className="flex-1">
                  <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-100" />
                  <div className="mt-3 h-6 w-12 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))
          : cards.map((card) => (
              <StatTile key={card.label} label={card.label} value={card.value.toLocaleString('en-IN')} icon={card.icon} accent={card.accent} />
            ))}
      </div>

      {shortcuts.length > 0 && (
        <section className="mt-8 sm:mt-10">
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
