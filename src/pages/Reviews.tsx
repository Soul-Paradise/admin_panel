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
        <span key={i} className={i <= filled ? 'text-amber-400' : 'text-gray-700'}>
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">Moderate customer testimonials</p>
        </div>
        {!writable && (
          <span className="text-xs font-medium text-gray-500 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5">
            Read-only access
          </span>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pendingCount !== null && pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
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
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">{EMPTY_COPY[tab]}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-white">{t.name}</span>
                    <Stars rating={t.rating} />
                    {t.service && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-blue-500/15 text-blue-400 border-blue-500/30">
                        {t.service}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        t.isApproved
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                      }`}
                    >
                      {t.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap break-words">
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
                        className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        Unapprove
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApproval(t, true)}
                        disabled={busyId === t.id}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(t)}
                      disabled={busyId === t.id}
                      className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 rounded-lg transition-colors"
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
            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
