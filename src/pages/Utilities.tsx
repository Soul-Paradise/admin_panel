import { useCallback, useEffect, useState } from 'react';
import { api, type AnalyticsOverview } from '../lib/api';

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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-1.5">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-gray-400">{r.label}</span>
            <span className={`text-sm font-semibold ${r.tone ?? 'text-white'}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white">Utilities</h1>
          <p className="text-sm text-gray-500 mt-0.5">Operational stats at a glance</p>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse"
              >
                <div className="h-3 w-20 bg-gray-800 rounded" />
                <div className="h-6 w-14 bg-gray-800 rounded mt-3" />
              </div>
            ))}
          </div>
          <div className="h-48 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
        </div>
      ) : !overview ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No analytics available.</p>
        </div>
      ) : (
        <>
          {/* Backend caveats — these explain zeros that would otherwise look like real data. */}
          {overview.notes.length > 0 && (
            <div className="space-y-2 mb-6">
              {overview.notes.map((note, i) => (
                <div
                  key={i}
                  className="px-4 py-3 rounded-lg text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20"
                >
                  {note}
                </div>
              ))}
            </div>
          )}

          {/* Range window */}
          <p className="text-xs text-gray-500 mb-5">
            {overview.range.key} · {new Date(overview.range.from).toLocaleString()} →{' '}
            {new Date(overview.range.to).toLocaleString()}
          </p>

          {/* Users */}
          <Section title="Users">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Logged in" value={overview.users.loggedInInRange} />
              <StatCard label="New" value={overview.users.newInRange} />
              <StatCard label="Total" value={overview.users.total} />
              <StatCard label="Active" value={overview.users.activeTotal} />
            </div>
          </Section>

          {/* Bookings */}
          <Section title="Bookings">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total bookings" value={overview.bookings.totalCount} />
              <StatCard label="Total revenue" value={money(overview.bookings.totalRevenue)} />
              <StatCard label="Active offers" value={overview.offers.active} />
              <StatCard label="Total offers" value={overview.offers.total} />
            </div>
          </Section>

          {/* Bookings by service */}
          <Section title="Bookings by service">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Coupons */}
          <Section title="Coupons">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="Bookings with coupon"
                value={overview.coupons.bookingsWithCoupon}
              />
              <StatCard
                label="Total discount given"
                value={money(overview.coupons.totalDiscountGiven)}
              />
              <div className="md:col-span-1" />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-4">
              {overview.coupons.topCodes.length === 0 ? (
                <div className="text-center py-10 text-gray-600">
                  <p className="text-sm">No coupon redemptions recorded.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uses
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Discount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {overview.coupons.topCodes.map((c) => (
                      <tr key={c.code} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{c.code}</td>
                        <td className="px-4 py-3 text-gray-400">{c.uses}</td>
                        <td className="px-4 py-3 text-gray-400">{money(c.discount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>

          {/* Operational */}
          <Section title="Operational">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BreakdownCard
                title="Partners"
                rows={[
                  { label: 'Total', value: overview.partners.total, tone: 'text-gray-200' },
                  { label: 'Active', value: overview.partners.active, tone: 'text-emerald-400' },
                  { label: 'Revoked', value: overview.partners.revoked, tone: 'text-red-400' },
                ]}
              />
              <BreakdownCard
                title="Reviews"
                rows={[
                  { label: 'Pending', value: overview.reviews.pending, tone: 'text-amber-400' },
                  { label: 'Approved', value: overview.reviews.approved, tone: 'text-emerald-400' },
                  { label: 'Total', value: overview.reviews.total },
                ]}
              />
              <BreakdownCard
                title="Contacts"
                rows={[
                  { label: 'Pending', value: overview.contacts.pending, tone: 'text-amber-400' },
                  { label: 'Sent', value: overview.contacts.sent, tone: 'text-emerald-400' },
                  { label: 'Failed', value: overview.contacts.failed, tone: 'text-red-400' },
                ]}
              />
              <BreakdownCard
                title="Payments"
                rows={[
                  {
                    label: 'Paid',
                    value: `${overview.payments.paid.count} · ${money(overview.payments.paid.amount)}`,
                    tone: 'text-emerald-400',
                  },
                  {
                    label: 'Failed',
                    value: overview.payments.failed.count,
                    tone: 'text-red-400',
                  },
                  {
                    label: 'Refunded',
                    value: `${overview.payments.refunded.count} · ${money(overview.payments.refunded.amount)}`,
                    tone: 'text-gray-300',
                  },
                ]}
              />
            </div>
          </Section>

          {/* Daily bookings chart */}
          <Section title="Daily bookings">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              {/* Legend */}
              <div className="flex items-center gap-4 mb-5">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Flights
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Hotels
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> Insurance
                </span>
              </div>

              {daily.length === 0 ? (
                <div className="text-center py-10 text-gray-600">
                  <p className="text-sm">No bookings in this range.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-2 h-48 min-w-max">
                    {daily.map((d) => {
                      const total = d.flights + d.hotels + d.insurance;
                      // maxTotal === 0 → every bar is empty; never divide by zero.
                      const pct = (n: number) => (maxTotal > 0 ? (n / maxTotal) * 100 : 0);
                      return (
                        <div
                          key={d.date}
                          className="flex flex-col items-center justify-end h-full min-w-[2.5rem] flex-1"
                          title={`${shortDate(d.date)} — Flights: ${d.flights}, Hotels: ${d.hotels}, Insurance: ${d.insurance} (total ${total})`}
                        >
                          <span className="text-[11px] text-gray-500 mb-1">{total || ''}</span>
                          <div className="w-full flex flex-col justify-end flex-1 rounded-t-md overflow-hidden bg-gray-800/40">
                            <div
                              className="w-full bg-purple-500"
                              style={{ height: `${pct(d.insurance)}%` }}
                            />
                            <div
                              className="w-full bg-amber-500"
                              style={{ height: `${pct(d.hotels)}%` }}
                            />
                            <div
                              className="w-full bg-blue-500"
                              style={{ height: `${pct(d.flights)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X axis */}
                  <div className="flex gap-2 mt-2 min-w-max">
                    {daily.map((d) => (
                      <div
                        key={d.date}
                        className="text-[11px] text-gray-500 text-center min-w-[2.5rem] flex-1"
                      >
                        {shortDate(d.date)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
