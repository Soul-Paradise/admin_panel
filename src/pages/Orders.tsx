import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, Building2, IndianRupee, Plane, Receipt, RefreshCw, Search, ShieldCheck, type LucideIcon } from 'lucide-react';
import {
  api,
  type AdminOrder,
  type AdminOrdersResponse,
  type CommissionAudience,
  type OrderService,
  type OrderStatusGroup,
} from '../lib/api';
import { Alert, Badge, EmptyState, HeroStat, IconTile, PageHeader, Pagination, Panel, Spinner } from '../components/ui';
import { OrderDetailModal } from '../components/OrderDetail';
import { FIELD_LABEL, INPUT, PAGE, SELECT, TABLE_HEAD, TBODY, TH, TROW, type Accent, type Tone } from '../lib/ui-styles';

const LIMIT = 25;

const SERVICES: Record<OrderService, { label: string; icon: LucideIcon; accent: Accent }> = {
  FLIGHT: { label: 'Flight', icon: Plane, accent: 'blue' },
  HOTEL: { label: 'Hotel', icon: Building2, accent: 'orange' },
  INSURANCE: { label: 'Insurance', icon: ShieldCheck, accent: 'purple' },
};

const STATUS: Record<OrderStatusGroup, { label: string; tone: Tone; hint: string }> = {
  confirmed: { label: 'Confirmed', tone: 'green', hint: 'Paid and issued - commission earned' },
  in_progress: { label: 'Processing', tone: 'amber', hint: 'Paid; the supplier booking is being made' },
  unpaid: { label: 'Unpaid', tone: 'slate', hint: 'Payment was started but never completed' },
  failed: { label: 'Failed', tone: 'red', hint: 'Paid but the supplier booking failed - refund due' },
  cancelled: { label: 'Cancelled', tone: 'slate', hint: 'Cancelled after booking' },
};

type StatusFilter = OrderStatusGroup | 'paid' | 'all';
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'paid', label: 'All paid orders' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'Processing' },
  { value: 'failed', label: 'Failed (refund due)' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'unpaid', label: 'Unpaid (abandoned)' },
  { value: 'all', label: 'Everything' },
];

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function CommissionCell({ order }: { order: AdminOrder }) {
  if (order.commissionAmount === null) {
    return (
      <span className="text-inactive" title="Booked before commission was recorded on each order">
        –
      </span>
    );
  }
  const earned = order.statusGroup === 'confirmed';
  return (
    <div title={earned ? 'Commission earned on this order' : 'Not earned: this order was not completed'}>
      <div className={`font-extrabold tabular-nums ${earned ? 'text-success' : 'text-inactive line-through'}`}>
        {inr(order.commissionAmount)}
      </div>
      {!earned && <div className="text-[11px] text-inactive">not earned</div>}
      {order.discountAmount ? (
        <div className="text-[11px] text-inactive" title={`Coupon ${order.promoCode}`}>
          − {inr(order.discountAmount)} coupon
        </div>
      ) : null}
    </div>
  );
}

export default function Orders() {
  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [service, setService] = useState<OrderService | ''>('');
  const [status, setStatus] = useState<StatusFilter>('paid');
  const [audience, setAudience] = useState<CommissionAudience | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<{ service: OrderService; bookingId: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(
        await api.getOrders({
          service: service || undefined,
          status: status === 'all' ? undefined : status,
          audience: audience || undefined,
          search: debouncedSearch || undefined,
          page,
          limit: LIMIT,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [service, status, audience, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items ?? [];
  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Bookings"
        title="Orders"
        subtitle="Every flight, hotel and insurance booking, with the commission Soul Paradise earned on it"
        actions={
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
        stats={
          <>
            <HeroStat icon={BadgePercent} label="Commission" value={data ? inr(data.totals.commission) : null} />
            <HeroStat icon={IndianRupee} label="Order value" value={data ? inr(data.totals.amount) : null} />
            <HeroStat icon={Receipt} label="Orders" value={data ? data.totals.orders.toLocaleString('en-IN') : null} />
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <Panel title="Filters" className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className={FIELD_LABEL} htmlFor="orders-search">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-inactive" />
              <input
                id="orders-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Booking ID, PNR, policy, customer name or email"
                className={`${INPUT} pl-10`}
              />
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="orders-service">Service</label>
            <select id="orders-service" value={service} onChange={(e) => filter(setService)(e.target.value as OrderService | '')} className={SELECT}>
              <option value="">All services</option>
              <option value="FLIGHT">Flights</option>
              <option value="HOTEL">Hotels</option>
              <option value="INSURANCE">Insurance</option>
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="orders-status">Status</label>
            <select id="orders-status" value={status} onChange={(e) => filter(setStatus)(e.target.value as StatusFilter)} className={SELECT}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="orders-audience">Booked by</label>
            <select id="orders-audience" value={audience} onChange={(e) => filter(setAudience)(e.target.value as CommissionAudience | '')} className={SELECT}>
              <option value="">Everyone</option>
              <option value="B2C">Customers (B2C)</option>
              <option value="B2B">Booking partners (B2B)</option>
            </select>
          </div>
        </div>
      </Panel>

      <Panel
        title="Orders"
        aside={data ? <Badge tone="blue">{data.pagination.total.toLocaleString('en-IN')}</Badge> : undefined}
        flush
      >
        {loading && !data ? (
          <Spinner label="Loading orders…" />
        ) : items.length === 0 ? (
          <EmptyState icon={Receipt} title="No orders found" message="No bookings match these filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className={TABLE_HEAD}>
                  <tr className="border-b border-tertiary-button">
                    <th className={TH}>Order</th>
                    <th className={TH}>Booked by</th>
                    <th className={TH}>Details</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} !text-right`}>Paid</th>
                    <th className={`${TH} !text-right`}>Commission</th>
                    <th className={TH}>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={`${TBODY} ${loading ? 'opacity-60' : ''}`}>
                  {items.map((o) => {
                    const svc = SERVICES[o.service];
                    const st = STATUS[o.statusGroup];
                    return (
                      <tr key={`${o.service}-${o.id}`} className={`align-top ${TROW}`} data-testid="order-row">
                        <td className="px-5 py-3.5">
                          <div className="flex items-start gap-2.5">
                            <IconTile icon={svc.icon} accent={svc.accent} size="sm" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setViewing({ service: o.service, bookingId: o.bookingId })}
                                className="font-mono text-xs font-bold whitespace-nowrap text-foreground hover:text-links hover:underline"
                              >
                                {o.bookingId}
                              </button>
                              <div className="text-[11px] text-inactive">
                                {svc.label}
                                {o.reference ? ` · ${o.reference}` : ''}
                              </div>
                              <div className="text-[11px] whitespace-nowrap text-inactive">{formatDateTime(o.createdAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Link to={`/users/${o.user.id}`} className="font-bold text-foreground hover:text-links">
                            {o.user.name}
                          </Link>
                          <div className="text-xs text-inactive">{o.user.email}</div>
                          <div className="mt-1">
                            {(o.commissionAudience ?? (o.user.role === 'AGENT' ? 'B2B' : 'B2C')) === 'B2B' ? (
                              <Badge tone="amber">Partner</Badge>
                            ) : (
                              <Badge tone="green">Customer</Badge>
                            )}
                          </div>
                        </td>
                        <td className="min-w-[200px] px-5 py-3.5 text-foreground">{o.summary || '–'}</td>
                        <td className="px-5 py-3.5">
                          <span title={`${st.hint} (${o.status})`}>
                            <Badge tone={st.tone} dot>
                              {st.label}
                            </Badge>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-extrabold whitespace-nowrap text-foreground tabular-nums">
                          {inr(o.totalAmount)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap" data-testid="order-commission">
                          <CommissionCell order={o} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setViewing({ service: o.service, bookingId: o.bookingId })}
                            className="rounded-full px-3 py-1 text-xs font-bold text-links ring-1 ring-tertiary-button hover:bg-primary-tint/50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={data?.pagination.total ?? 0}
              onPage={(p) => setPage(Math.min(totalPages, Math.max(1, p)))}
            />
          </>
        )}
      </Panel>

      {viewing && <OrderDetailModal service={viewing.service} bookingId={viewing.bookingId} onClose={() => setViewing(null)} />}
    </div>
  );
}
