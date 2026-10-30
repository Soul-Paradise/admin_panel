import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, CircleX, Clock, CreditCard, Receipt, RefreshCw, Search, type LucideIcon } from 'lucide-react';
import {
  api,
  type AdminCustomPayment,
  type AdminCustomPaymentsResponse,
  type PaymentStatus,
  type PaymentStatusGroup,
} from '../lib/api';
import { Alert, Badge, EmptyState, PageHeader, Pagination, Spinner, StatTile } from '../components/ui';
import {
  BTN_OUTLINE,
  BTN_SM,
  CARD,
  FIELD_LABEL,
  INPUT,
  PAGE,
  TABLE_HEAD,
  TBODY,
  TH,
  TROW,
  type Accent,
  type Tone,
} from '../lib/ui-styles';

const LIMIT = 25;

/**
 * A pending payment the bank never answered within this window almost always
 * means the customer closed the bank page. Shown differently so the admin does
 * not wait on money that is not coming.
 */
const ABANDONED_AFTER_MS = 30 * 60 * 1000;

type Filter = PaymentStatusGroup | 'all';

const TILES: { key: Filter; label: string; icon: LucideIcon; accent: Accent }[] = [
  { key: 'all', label: 'All payments', icon: Receipt, accent: 'blue' },
  { key: 'received', label: 'Received', icon: CircleCheck, accent: 'green' },
  { key: 'pending', label: 'Pending', icon: Clock, accent: 'orange' },
  { key: 'failed', label: 'Failed / cancelled', icon: CircleX, accent: 'pink' },
];

const STATUS_BADGE: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PAID: { label: 'Received', tone: 'green' },
  INITIATED: { label: 'Pending', tone: 'amber' },
  REDIRECTED: { label: 'Pending', tone: 'amber' },
  FAILED: { label: 'Failed', tone: 'red' },
  CANCELLED: { label: 'Cancelled', tone: 'slate' },
  EXPIRED: { label: 'Expired', tone: 'slate' },
  REFUND_PENDING: { label: 'Refund pending', tone: 'blue' },
  REFUNDED: { label: 'Refunded', tone: 'blue' },
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatAmount(value: string): string {
  return inr.format(Number(value));
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isPending(status: PaymentStatus): boolean {
  return status === 'INITIATED' || status === 'REDIRECTED';
}

function StatusBadge({ payment, now }: { payment: AdminCustomPayment; now: number }) {
  const abandoned =
    isPending(payment.status) &&
    now - new Date(payment.createdAt).getTime() > ABANDONED_AFTER_MS;
  const badge = abandoned ? { label: 'Not completed', tone: 'slate' as Tone } : STATUS_BADGE[payment.status];

  return (
    <span title={abandoned ? 'No answer from the bank for over 30 minutes - the customer most likely left the payment page.' : undefined}>
      <Badge tone={badge.tone} dot>
        {badge.label}
      </Badge>
    </span>
  );
}

/** When the outcome happened, falling back to when it started. */
function outcomeTime(p: AdminCustomPayment): string | null {
  return p.paidAt ?? p.failedAt ?? p.cancelledAt ?? null;
}

export default function CustomPayments() {
  const [data, setData] = useState<AdminCustomPaymentsResponse | null>(null);
  // Reference time for "Not completed", taken when the data arrives.
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageNum, setPageNum] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPageNum(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getCustomPayments({
        status: filter === 'all' ? undefined : filter,
        search: debouncedSearch || undefined,
        from: from || undefined,
        to: to || undefined,
        pageNum,
        limit: LIMIT,
      });
      setData(res);
      setLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch, from, to, pageNum]);

  useEffect(() => {
    load();
  }, [load]);

  function selectFilter(next: Filter) {
    setFilter(next);
    setPageNum(1);
  }

  const items = data?.items ?? [];
  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Payments"
        title="Custom Payments"
        subtitle={<>Payments customers made from the website&apos;s Custom Payment tab</>}
        actions={
          <button onClick={() => load()} disabled={loading} className={`${BTN_OUTLINE} ${BTN_SM}`}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {/* Summary tiles - double as the status filter */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {TILES.map((tile) => {
          const stats = data?.summary[tile.key];
          const amount = tile.key === 'all' ? null : data?.summary[tile.key].amount;
          return (
            <StatTile
              key={tile.key}
              label={tile.label}
              value={stats ? stats.count.toLocaleString('en-IN') : '–'}
              sub={amount !== null ? (amount !== undefined ? formatAmount(amount) : '–') : undefined}
              icon={tile.icon}
              accent={tile.accent}
              active={filter === tile.key}
              onClick={() => selectFilter(tile.key)}
            />
          );
        })}
      </div>

      {/* Filters */}
      <div className={`mb-4 p-4 sm:p-5 ${CARD}`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className={FIELD_LABEL}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-inactive" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Customer name, email or reference"
                className={`${INPUT} pl-10`}
              />
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPageNum(1);
              }}
              className={INPUT}
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPageNum(1);
              }}
              className={INPUT}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading && !data ? (
        <div className={CARD}>
          <Spinner label="Loading payments…" />
        </div>
      ) : items.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={CreditCard} title="No payments found" message="No payments match these filters." />
        </div>
      ) : (
        <div className={`overflow-hidden ${CARD}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className={TABLE_HEAD}>
                <tr className="border-b border-tertiary-button">
                  <th className={TH}>Initiated</th>
                  <th className={TH}>Customer</th>
                  <th className={`${TH} !text-right`}>Amount</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Method</th>
                  <th className={TH}>Reference</th>
                </tr>
              </thead>
              <tbody className={`${TBODY} ${loading ? 'opacity-60' : ''}`}>
                {items.map((p) => {
                  const outcome = outcomeTime(p);
                  return (
                    <tr key={p.id} className={`align-top ${TROW}`}>
                      <td className="px-5 py-3.5 whitespace-nowrap text-foreground">{formatDateTime(p.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground">{p.customerName ?? '-'}</div>
                        <div className="text-xs text-inactive">{p.customerEmail ?? '-'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-extrabold whitespace-nowrap text-foreground tabular-nums">
                        {formatAmount(p.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge payment={p} now={loadedAt} />
                        {outcome && (
                          <div className="mt-1 text-[11px] whitespace-nowrap text-inactive">{formatDateTime(outcome)}</div>
                        )}
                        {p.status !== 'PAID' && p.respDescription && (
                          <div className="mt-1 max-w-[220px] text-[11px] text-inactive" title={p.respDescription}>
                            {p.respDescription}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-foreground">{p.paymentMode ?? '-'}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs text-foreground">{p.merchantTxnNo}</div>
                        {p.txnId && (
                          <div className="mt-0.5 font-mono text-[11px] text-inactive" title="Bank transaction ID">
                            Bank: {p.txnId}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={pageNum}
            totalPages={totalPages}
            total={data?.pagination.total ?? 0}
            onPage={(p) => setPageNum(Math.min(totalPages, Math.max(1, p)))}
          />
        </div>
      )}
    </div>
  );
}
