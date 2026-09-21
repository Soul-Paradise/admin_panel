import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  api,
  type AdminCustomPayment,
  type AdminCustomPaymentsResponse,
  type PaymentStatus,
  type PaymentStatusGroup,
} from '../lib/api';

const LIMIT = 25;

/**
 * A pending payment the bank never answered within this window almost always
 * means the customer closed the bank page. Shown differently so the admin does
 * not wait on money that is not coming.
 */
const ABANDONED_AFTER_MS = 30 * 60 * 1000;

type Filter = PaymentStatusGroup | 'all';

const TILES: { key: Filter; label: string; accent: string }[] = [
  { key: 'all', label: 'All payments', accent: 'bg-links' },
  { key: 'received', label: 'Received', accent: 'bg-success' },
  { key: 'pending', label: 'Pending', accent: 'bg-amber-500' },
  { key: 'failed', label: 'Failed / cancelled', accent: 'bg-danger' },
];

const STATUS_BADGE: Record<PaymentStatus, { label: string; cls: string }> = {
  PAID: { label: 'Received', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  INITIATED: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  REDIRECTED: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
  EXPIRED: { label: 'Expired', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
  REFUND_PENDING: { label: 'Refund pending', cls: 'bg-blue-50 text-links border-blue-200' },
  REFUNDED: { label: 'Refunded', cls: 'bg-blue-50 text-links border-blue-200' },
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
  const badge = abandoned
    ? { label: 'Not completed', cls: 'bg-gray-100 text-gray-600 border-gray-300' }
    : STATUS_BADGE[payment.status];

  return (
    <span
      title={abandoned ? 'No answer from the bank for over 30 minutes - the customer most likely left the payment page.' : undefined}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${badge.cls}`}
    >
      {badge.label}
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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Custom Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Payments customers made from the website&apos;s Custom Payment tab
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:text-foreground bg-peace border border-tertiary-button hover:bg-tertiary-button disabled:opacity-50 rounded-lg transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Summary tiles - double as the status filter */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-4">
        {TILES.map((tile) => {
          const active = filter === tile.key;
          const stats = data?.summary[tile.key];
          const amount = tile.key === 'all' ? null : data?.summary[tile.key].amount;
          return (
            <button
              key={tile.key}
              onClick={() => selectFilter(tile.key)}
              className={`rounded-xl border bg-peace p-4 text-left shadow-sm transition-colors sm:p-5 ${
                active
                  ? 'border-secondary-button ring-1 ring-secondary-button'
                  : 'border-tertiary-button hover:border-secondary-button'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${tile.accent}`} aria-hidden="true" />
                <p className="truncate text-xs font-semibold text-inactive sm:text-sm">{tile.label}</p>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                {stats ? stats.count.toLocaleString('en-IN') : '–'}
              </p>
              {amount !== null && (
                <p className="mt-0.5 text-xs font-medium tabular-nums text-gray-500">
                  {amount !== undefined ? formatAmount(amount) : '–'}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-4 bg-peace border border-tertiary-button rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer name, email or reference"
              className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPageNum(1);
              }}
              className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPageNum(1);
              }}
              className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading && !data ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No payments match these filters.</p>
        </div>
      ) : (
        <>
          <div className="bg-peace border border-tertiary-button rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-background">
                  <tr className="border-b border-tertiary-button">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Initiated</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-tertiary-button ${loading ? 'opacity-60' : ''}`}>
                  {items.map((p) => {
                    const outcome = outcomeTime(p);
                    return (
                      <tr key={p.id} className="hover:bg-background transition-colors align-top">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {formatDateTime(p.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-foreground font-medium">{p.customerName ?? '-'}</div>
                          <div className="text-xs text-gray-500">{p.customerEmail ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground whitespace-nowrap">
                          {formatAmount(p.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge payment={p} now={loadedAt} />
                          {outcome && (
                            <div className="text-[11px] text-gray-400 mt-1 whitespace-nowrap">
                              {formatDateTime(outcome)}
                            </div>
                          )}
                          {p.status !== 'PAID' && p.respDescription && (
                            <div className="text-[11px] text-gray-500 mt-1 max-w-[220px]" title={p.respDescription}>
                              {p.respDescription}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{p.paymentMode ?? '-'}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-gray-700">{p.merchantTxnNo}</div>
                          {p.txnId && (
                            <div className="font-mono text-[11px] text-gray-400 mt-0.5" title="Bank transaction ID">
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
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-500">
              Page {pageNum} of {totalPages} ({data?.pagination.total ?? 0} total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                disabled={pageNum <= 1}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-foreground bg-background hover:bg-tertiary-button disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-gray-600 rounded-lg transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                disabled={pageNum >= totalPages}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-foreground bg-background hover:bg-tertiary-button disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-gray-600 rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
