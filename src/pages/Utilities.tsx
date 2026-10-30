import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BadgeIndianRupee,
  CalendarCheck,
  LogIn,
  Megaphone,
  Tag,
  TicketPercent,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { api, type AnalyticsOverview } from '../lib/api';
import { Alert, EmptyState, HeroStat, PageHeader, Panel, SectionTitle, StatTile, Tabs } from '../components/ui';
import { CARD, PAGE, TABLE_HEAD, TBODY, TH, TROW, type Accent } from '../lib/ui-styles';

type RangeKey = 'today' | '7d' | '30d';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
];

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

/** A row of label/value pairs inside one card, e.g. Partners: total/active/revoked. */
function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string | number; tone?: string }[];
}) {
  return (
    <Panel title={title}>
      <div className="divide-y divide-tertiary-button/70">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
            <span className="text-sm text-inactive">{r.label}</span>
            <span className={`text-sm font-bold tabular-nums ${r.tone ?? 'text-foreground'}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string | number; icon: LucideIcon; accent: Accent }) {
  return <StatTile label={label} value={value} icon={icon} accent={accent} />;
}

export default function Utilities() {
  const [range, setRange] = useState<RangeKey>('today');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAnalyticsOverview(range);
      setOverview(data);
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || 'Failed to load analytics');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const daily = overview?.dailyBookings ?? [];
  // Guard the chart against an all-zero range: a max of 0 would make every height NaN.
  const maxTotal = daily.reduce(
    (max, d) => Math.max(max, d.flights + d.hotels + d.insurance),
    0,
  );

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Operations"
        title="Utilities"
        subtitle="Operational stats at a glance"
        actions={<Tabs options={RANGES} active={range} onChange={setRange} label="Date range" variant="glass" />}
        stats={
          <>
            <HeroStat icon={BadgeIndianRupee} label="Revenue" value={overview ? money(overview.bookings.totalRevenue) : null} />
            <HeroStat icon={CalendarCheck} label="Completed bookings" value={overview ? overview.bookings.totalCount.toLocaleString('en-IN') : null} />
            <HeroStat icon={UserPlus} label="New users" value={overview ? overview.users.newInRange.toLocaleString('en-IN') : null} />
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className={`flex items-start gap-3 p-4 ${CARD}`}>
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                <div className="flex-1">
                  <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-100" />
                  <div className="mt-3 h-6 w-14 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
          <div className={`h-48 animate-pulse ${CARD}`} />
        </div>
      ) : !overview ? (
        <div className={CARD}>
          <EmptyState icon={BarChart3} title="No analytics available." />
        </div>
      ) : (
        <>
          {/* Backend caveats - these explain zeros that would otherwise look like real data. */}
          {overview.notes.length > 0 && (
            <div className="mb-6 space-y-2">
              {overview.notes.map((note, i) => (
                <Alert key={i} tone="warn">
                  {note}
                </Alert>
              ))}
            </div>
          )}

          {/* Range window */}
          <p className="mb-2 text-xs font-semibold text-inactive">
            {overview.range.key} · {new Date(overview.range.from).toLocaleString()} →{' '}
            {new Date(overview.range.to).toLocaleString()}
          </p>

          <Section title="Users">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Logged in" value={overview.users.loggedInInRange} icon={LogIn} accent="blue" />
              <Stat label="New" value={overview.users.newInRange} icon={UserPlus} accent="green" />
              <Stat label="Total" value={overview.users.total} icon={Users} accent="purple" />
              <Stat label="Active" value={overview.users.activeTotal} icon={UserCheck} accent="teal" />
            </div>
          </Section>

          <Section title="Bookings">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Completed bookings" value={overview.bookings.totalCount} icon={CalendarCheck} accent="blue" />
              <Stat label="Revenue (paid & issued)" value={money(overview.bookings.totalRevenue)} icon={BadgeIndianRupee} accent="green" />
              <Stat label="Active offers" value={overview.offers.active} icon={Megaphone} accent="orange" />
              <Stat label="Total offers" value={overview.offers.total} icon={Tag} accent="pink" />
            </div>
          </Section>

          <Section title="Bookings by service">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <BreakdownCard
                title="Flights"
                rows={[
                  { label: 'Bookings', value: overview.bookings.flights.count },
                  { label: 'Revenue', value: money(overview.bookings.flights.revenue) },
                ]}
              />
              <BreakdownCard
                title="Hotels"
                rows={[
                  { label: 'Bookings', value: overview.bookings.hotels.count },
                  { label: 'Revenue', value: money(overview.bookings.hotels.revenue) },
                ]}
              />
              <BreakdownCard
                title="Insurance"
                rows={[
                  { label: 'Bookings', value: overview.bookings.insurance.count },
                  { label: 'Revenue', value: money(overview.bookings.insurance.revenue) },
                ]}
              />
            </div>
          </Section>

          <Section title="Coupons">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Stat label="Bookings with coupon" value={overview.coupons.bookingsWithCoupon} icon={TicketPercent} accent="purple" />
              <Stat label="Total discount given" value={money(overview.coupons.totalDiscountGiven)} icon={BadgeIndianRupee} accent="orange" />
              <div className="md:col-span-1" />
            </div>

            <Panel title="Top coupon codes" flush className="mt-4">
              <div className="overflow-x-auto">
              {overview.coupons.topCodes.length === 0 ? (
                <EmptyState icon={TicketPercent} title="No coupon redemptions recorded." />
              ) : (
                <table className="w-full min-w-[680px] text-sm">
                  <thead className={TABLE_HEAD}>
                    <tr className="border-b border-tertiary-button">
                      <th className={TH}>Code</th>
                      <th className={TH}>Uses</th>
                      <th className={TH}>Discount</th>
                    </tr>
                  </thead>
                  <tbody className={TBODY}>
                    {overview.coupons.topCodes.map((c) => (
                      <tr key={c.code} className={TROW}>
                        <td className="px-5 py-3.5 font-bold text-foreground">{c.code}</td>
                        <td className="px-5 py-3.5 text-inactive">{c.uses}</td>
                        <td className="px-5 py-3.5 text-inactive">{money(c.discount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              </div>
            </Panel>
          </Section>

          <Section title="Operational">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <BreakdownCard
                title="Partners"
                rows={[
                  { label: 'Total', value: overview.partners.total, tone: 'text-foreground' },
                  { label: 'Active', value: overview.partners.active, tone: 'text-success' },
                  { label: 'Revoked', value: overview.partners.revoked, tone: 'text-danger' },
                ]}
              />
              <BreakdownCard
                title="Reviews"
                rows={[
                  { label: 'Pending', value: overview.reviews.pending, tone: 'text-amber-700' },
                  { label: 'Approved', value: overview.reviews.approved, tone: 'text-success' },
                  { label: 'Total', value: overview.reviews.total },
                ]}
              />
              <BreakdownCard
                title="Contacts"
                rows={[
                  { label: 'Pending', value: overview.contacts.pending, tone: 'text-amber-700' },
                  { label: 'Sent', value: overview.contacts.sent, tone: 'text-success' },
                  { label: 'Failed', value: overview.contacts.failed, tone: 'text-danger' },
                ]}
              />
              <BreakdownCard
                title="Payments"
                rows={[
                  {
                    label: 'Paid',
                    value: `${overview.payments.paid.count} · ${money(overview.payments.paid.amount)}`,
                    tone: 'text-success',
                  },
                  {
                    label: 'Failed',
                    value: overview.payments.failed.count,
                    tone: 'text-danger',
                  },
                  {
                    label: 'Refunded',
                    value: `${overview.payments.refunded.count} · ${money(overview.payments.refunded.amount)}`,
                    tone: 'text-foreground',
                  },
                ]}
              />
            </div>
          </Section>

          {/* Daily bookings chart */}
          <Panel
            title="Daily bookings"
            className="mt-8"
            aside={
              /* Legend */
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-inactive">
                  <span className="h-2.5 w-2.5 rounded-full bg-links" /> Flights
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-inactive">
                  <span className="h-2.5 w-2.5 rounded-full bg-warn" /> Hotels
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-inactive">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Insurance
                </span>
              </div>
            }
          >

              {daily.length === 0 ? (
                <EmptyState icon={BarChart3} title="No bookings in this range." />
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex h-48 min-w-max items-end gap-2">
                    {daily.map((d) => {
                      const total = d.flights + d.hotels + d.insurance;
                      // maxTotal === 0 → every bar is empty; never divide by zero.
                      const pct = (n: number) => (maxTotal > 0 ? (n / maxTotal) * 100 : 0);
                      return (
                        <div
                          key={d.date}
                          className="flex h-full min-w-[2.5rem] flex-1 flex-col items-center justify-end"
                          title={`${shortDate(d.date)} - Flights: ${d.flights}, Hotels: ${d.hotels}, Insurance: ${d.insurance} (total ${total})`}
                        >
                          <span className="mb-1 text-[11px] font-bold text-inactive">{total || ''}</span>
                          <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-t-lg bg-background">
                            <div className="w-full bg-purple-500" style={{ height: `${pct(d.insurance)}%` }} />
                            <div className="w-full bg-warn" style={{ height: `${pct(d.hotels)}%` }} />
                            <div className="w-full bg-links" style={{ height: `${pct(d.flights)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X axis */}
                  <div className="mt-2 flex min-w-max gap-2">
                    {daily.map((d) => (
                      <div key={d.date} className="min-w-[2.5rem] flex-1 text-center text-[11px] text-inactive">
                        {shortDate(d.date)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </Panel>
        </>
      )}
    </div>
  );
}
