import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { api, type CustomPayment, type PaymentStatus } from '../lib/api';
import { useAccess } from '../hooks/useAccess';

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

/** Statuses where the bank hasn't told us the outcome yet. */
const PENDING: PaymentStatus[] = ['INITIATED', 'REDIRECTED'];
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

const STATUS_STYLE: Record<PaymentStatus, { label: string; cls: string }> = {
  PAID: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
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

function formatAmount(value: string | number): string {
  return inr.format(typeof value === 'string' ? Number(value) : value);
}

/** "5,000" / "5000.5" → 5000.5; anything else → null. */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n >= 1 ? n : null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CustomPayments() {
  const { canWrite } = useAccess();
  const writable = canWrite('CUSTOM_PAYMENTS');
  const [searchParams, setSearchParams] = useSearchParams();

  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<CustomPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // The payment the bank just returned us from, if any.
  const [result, setResult] = useState<CustomPayment | null>(null);
  const [resultTimedOut, setResultTimedOut] = useState(false);
  const returnedTxn = searchParams.get('txn');

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api.getCustomPayments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Back from the bank: the query string only says where to look. The status
  // shown comes from the API, polled until the gateway result has been applied.
  useEffect(() => {
    if (!returnedTxn) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setResultTimedOut(false);

    const poll = async () => {
      try {
        const p = await api.getCustomPayment(returnedTxn);
        if (cancelled) return;
        setResult(p);
        if (!PENDING.includes(p.status)) {
          loadHistory();
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not fetch payment status');
        return;
      }
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setResultTimedOut(true);
        loadHistory();
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [returnedTxn, loadHistory]);

  function dismissResult() {
    setResult(null);
    setResultTimedOut(false);
    setSearchParams({}, { replace: true });
  }

  const amount = parseAmount(amountInput);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (amount === null) {
      setError('Enter an amount of at least ₹1, with up to 2 decimal places.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { redirectUrl } = await api.createCustomPayment(amount);
      // Hand the browser to ICICI's hosted page; it returns to this page.
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment');
      setSubmitting(false);
    }
  }

  const resultPending = result !== null && PENDING.includes(result.status);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Custom Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Collect any amount through the ICICI payment gateway
          </p>
        </div>
        {!writable && (
          <span className="text-xs font-medium text-gray-500 bg-background border border-gray-300 rounded-lg px-3 py-1.5">
            Read-only access
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: pay form + outcome */}
        <div className="space-y-4">
          {returnedTxn && (result || !error) && (
            <ResultCard
              payment={result}
              pending={resultPending || result === null}
              timedOut={resultTimedOut}
              onDismiss={dismissResult}
            />
          )}

          <form
            onSubmit={handlePay}
            className="bg-peace border border-tertiary-button rounded-xl shadow-sm p-5 sm:p-6"
          >
            <label htmlFor="custom-amount" className="block text-xs font-medium text-gray-600 mb-1">
              Amount (INR)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-gray-500">
                ₹
              </span>
              <input
                id="custom-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amountInput}
                disabled={!writable || submitting}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="5,000"
                className="w-full bg-peace border border-gray-300 rounded-lg pl-8 pr-3 py-3 text-lg font-semibold text-foreground placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={!writable || submitting}
                  onClick={() => setAmountInput(q.toLocaleString('en-IN'))}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-foreground bg-background hover:bg-tertiary-button disabled:opacity-50 rounded-lg transition-colors"
                >
                  {formatAmount(q)}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!writable || submitting || amount === null}
              className="mt-5 w-full px-4 py-3 bg-primary-button hover:bg-secondary-button disabled:opacity-50 disabled:hover:bg-primary-button text-peace text-sm font-semibold rounded-lg transition-colors"
            >
              {submitting
                ? 'Redirecting to payment gateway…'
                : amount !== null
                  ? `Pay Now · ${formatAmount(amount)}`
                  : 'Pay Now'}
            </button>
            <p className="mt-3 text-[11px] text-gray-400">
              You'll be sent to ICICI's secure payment page and brought back here once it's done.
            </p>
          </form>
        </div>

        {/* Right: history */}
        <div className="bg-peace border border-tertiary-button rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-tertiary-button">
            <h2 className="text-sm font-semibold text-foreground">Payment history</h2>
          </div>
          {historyLoading ? (
            <div className="px-5 py-6 text-gray-500 text-sm">Loading...</div>
          ) : history.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              No custom payments yet.
            </div>
          ) : (
            <ul className="divide-y divide-tertiary-button max-h-[70dvh] overflow-y-auto">
              {history.map((p) => {
                const s = STATUS_STYLE[p.status];
                return (
                  <li key={p.merchantTxnNo} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{formatAmount(p.amount)}</p>
                      <p className="text-xs text-gray-500">{formatDate(p.paidAt ?? p.createdAt)}</p>
                      <p className="truncate font-mono text-[11px] text-gray-400">{p.merchantTxnNo}</p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.cls}`}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  payment,
  pending,
  timedOut,
  onDismiss,
}: {
  payment: CustomPayment | null;
  pending: boolean;
  timedOut: boolean;
  onDismiss: () => void;
}) {
  if (pending) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <Clock className={`h-6 w-6 shrink-0 text-amber-700 ${timedOut ? '' : 'animate-pulse'}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-800">
            {timedOut ? 'Still waiting for the bank' : 'Confirming payment…'}
          </p>
          <p className="text-sm text-amber-700">
            {timedOut
              ? 'The bank has not confirmed this payment yet. It will update in the history once it does.'
              : 'Checking the result with ICICI. This usually takes a few seconds.'}
          </p>
        </div>
        {timedOut && <DismissButton onClick={onDismiss} />}
      </div>
    );
  }

  const paid = payment!.status === 'PAID';
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-5 ${
        paid ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      {paid ? (
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-700" />
      ) : (
        <XCircle className="h-6 w-6 shrink-0 text-red-700" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${paid ? 'text-emerald-800' : 'text-red-800'}`}>
          {paid
            ? `Payment of ${formatAmount(payment!.amount)} completed successfully`
            : `Payment ${STATUS_STYLE[payment!.status].label.toLowerCase()}`}
        </p>
        <p className={`text-sm ${paid ? 'text-emerald-700' : 'text-red-700'}`}>
          {paid
            ? `Reference ${payment!.merchantTxnNo}`
            : `${formatAmount(payment!.amount)} was not charged. You can try again.`}
        </p>
      </div>
      <DismissButton onClick={onDismiss} />
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-foreground bg-peace hover:bg-tertiary-button rounded-lg transition-colors"
    >
      Dismiss
    </button>
  );
}
