import { useCallback, useEffect, useState } from 'react';
import { MessageSquareQuote } from 'lucide-react';
import { api, type Testimonial } from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { Alert, Badge, EmptyState, PageHeader, Pagination, Spinner, Tabs } from '../components/ui';
import { BTN_DANGER, BTN_GHOST, BTN_SM, BTN_SUCCESS, CARD, PAGE } from '../lib/ui-styles';

type TabKey = 'pending' | 'approved' | 'all';

const TABS: { key: TabKey; label: string; approved: boolean | undefined }[] = [
  { key: 'pending', label: 'Pending', approved: false },
  { key: 'approved', label: 'Approved', approved: true },
  { key: 'all', label: 'All', approved: undefined },
];

const EMPTY_COPY: Record<TabKey, string> = {
  pending: 'No pending reviews. Nothing to moderate.',
  approved: 'No approved reviews yet.',
  all: 'No reviews have been submitted yet.',
};

const PAGE_SIZE = 20;

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-sm leading-none tracking-tight" title={`${filled} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= filled ? 'text-warn' : 'text-tertiary-button'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function Reviews() {
  const { canWrite } = useAccess();
  const writable = canWrite('REVIEWS');

  const [tab, setTab] = useState<TabKey>('pending');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Testimonial[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const approvedFilter = TABS.find((t) => t.key === tab)?.approved;

  const loadPendingCount = useCallback(async () => {
    try {
      const res = await api.getTestimonials({ page: 1, limit: 1, approved: false });
      setPendingCount(res.pagination.total);
    } catch {
      setPendingCount(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getTestimonials({
        page,
        limit: PAGE_SIZE,
        approved: approvedFilter,
      });
      setItems(res.data);
      setTotalPages(Math.max(1, res.pagination.totalPages));
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to load reviews') });
      setItems([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, approvedFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  async function refresh() {
    await Promise.all([load(), loadPendingCount()]);
  }

  function selectTab(next: TabKey) {
    setTab(next);
    setPage(1);
  }

  async function handleApproval(t: Testimonial, isApproved: boolean) {
    setBusyId(t.id);
    try {
      await api.setTestimonialApproval(t.id, isApproved);
      setMessage({
        type: 'success',
        text: isApproved ? 'Review approved' : 'Review unapproved',
      });
      await refresh();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to update review') });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(t: Testimonial) {
    if (!confirm(`Delete the review by ${t.name}? This cannot be undone.`)) return;
    setBusyId(t.id);
    try {
      await api.deleteTestimonial(t.id);
      setMessage({ type: 'success', text: 'Review deleted' });
      await refresh();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to delete review') });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Content"
        title="Reviews"
        subtitle="Moderate customer testimonials"
        actions={!writable ? <Badge tone="slate">Read-only access</Badge> : undefined}
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.type}>{message.text}</Alert>
        </div>
      )}

      {/* Filter tabs - the pending count only shows while there's something to moderate. */}
      <div className="mb-5">
        <Tabs
          label="Filter reviews"
          active={tab}
          onChange={selectTab}
          options={TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: t.key === 'pending' && pendingCount !== null && pendingCount > 0 ? pendingCount : undefined,
          }))}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className={CARD}>
          <Spinner label="Loading reviews…" />
        </div>
      ) : items.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={MessageSquareQuote} title="Nothing here" message={EMPTY_COPY[tab]} />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className={`p-5 transition-colors hover:border-links/30 ${CARD}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold text-foreground">{t.name}</span>
                    <Stars rating={t.rating} />
                    {t.service && <Badge tone="blue">{t.service}</Badge>}
                    <Badge tone={t.isApproved ? 'green' : 'slate'} dot>
                      {t.isApproved ? 'Approved' : 'Pending'}
                    </Badge>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">{t.review}</p>

                  <p className="mt-3 text-xs text-inactive">{new Date(t.createdAt).toLocaleString()}</p>
                </div>

                {writable && (
                  <div className="flex shrink-0 items-center gap-2">
                    {t.isApproved ? (
                      <button
                        onClick={() => handleApproval(t, false)}
                        disabled={busyId === t.id}
                        className={`${BTN_GHOST} ${BTN_SM}`}
                      >
                        Unapprove
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApproval(t, true)}
                        disabled={busyId === t.id}
                        className={`${BTN_SUCCESS} ${BTN_SM}`}
                      >
                        Approve
                      </button>
                    )}
                    <button onClick={() => handleDelete(t)} disabled={busyId === t.id} className={`${BTN_DANGER} ${BTN_SM}`}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className={`mt-5 overflow-hidden ${CARD}`}>
          <Pagination page={page} totalPages={totalPages} onPage={(p) => setPage(Math.min(totalPages, Math.max(1, p)))} />
        </div>
      )}
    </div>
  );
}
