import { useCallback, useEffect, useState } from 'react';
import { api, type Testimonial } from '../lib/api';
import { useAccess } from '../hooks/useAccess';

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

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-sm leading-none tracking-tight" title={`${filled} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= filled ? 'text-amber-700' : 'text-gray-700'}>
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load reviews' });
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to update review' });
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to delete review' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">Moderate customer testimonials</p>
        </div>
        {!writable && (
          <span className="text-xs font-medium text-gray-500 bg-background border border-gray-300 rounded-lg px-3 py-1.5">
            Read-only access
          </span>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 bg-peace border border-tertiary-button rounded-xl shadow-sm p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-tertiary-button text-foreground'
                : 'text-gray-600 hover:text-foreground'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pendingCount !== null && pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">{EMPTY_COPY[tab]}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="bg-peace border border-tertiary-button rounded-xl shadow-sm p-5 hover:border-secondary-button transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-foreground">{t.name}</span>
                    <Stars rating={t.rating} />
                    {t.service && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-blue-50 text-links border-blue-200">
                        {t.service}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        t.isApproved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border-gray-300'
                      }`}
                    >
                      {t.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap break-words">
                    {t.review}
                  </p>

                  <p className="text-xs text-gray-500 mt-3">
                    {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>

                {writable && (
                  <div className="flex items-center gap-2 shrink-0">
                    {t.isApproved ? (
                      <button
                        onClick={() => handleApproval(t, false)}
                        disabled={busyId === t.id}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-foreground bg-background hover:bg-tertiary-button disabled:opacity-50 rounded-lg transition-colors"
                      >
                        Unapprove
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApproval(t, true)}
                        disabled={busyId === t.id}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(t)}
                      disabled={busyId === t.id}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-foreground bg-background hover:bg-tertiary-button disabled:opacity-40 disabled:hover:bg-background rounded-lg transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-foreground bg-background hover:bg-tertiary-button disabled:opacity-40 disabled:hover:bg-background rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
