import { useCallback, useEffect, useState } from 'react';
import { api, type AdminPage, type AuditLogEntry } from '../lib/api';

const PAGE_LABELS: Record<AdminPage, string> = {
  DASHBOARD: 'Dashboard',
  USERS: 'Users',
  BOOKING_PARTNERS: 'Booking Partners',
  COMMISSION: 'Commission',
  COUPONS: 'Coupons',
  OFFERS: 'Offers',
  REVIEWS: 'Reviews',
  UTILITIES: 'Utilities',
  CUSTOM_PAYMENTS: 'Custom Payments',
  USER_ACCESS: 'User Access',
  AUDIT_LOGS: 'Audit Logs',
};

const PAGES: AdminPage[] = [
  'DASHBOARD',
  'USERS',
  'BOOKING_PARTNERS',
  'COMMISSION',
  'COUPONS',
  'OFFERS',
  'REVIEWS',
  'UTILITIES',
  'CUSTOM_PAYMENTS',
  'USER_ACCESS',
  'AUDIT_LOGS',
];

const LIMIT = 25;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function statusColor(code: number): string {
  if (code >= 500) return 'bg-red-50 text-red-700 border-red-200';
  if (code >= 400) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (code >= 200 && code < 300) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-gray-100 text-gray-600 border-gray-300';
}

function truncate(value: string, max = 10): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters. `search` is what the input holds; `debouncedSearch` is what we query with.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageFilter, setPageFilter] = useState<AdminPage | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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
      const data = await api.getAuditLogs({
        search: debouncedSearch || undefined,
        page: pageFilter || undefined,
        from: from || undefined,
        to: to || undefined,
        pageNum,
        limit: LIMIT,
      });
      setLogs(data.items);
      setTotal(data.pagination.total);
      setTotalPages(Math.max(1, data.pagination.totalPages));
    } catch {
      setMessage({ type: 'error', text: 'Failed to load audit logs' });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, pageFilter, from, to, pageNum]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every change made from the admin panel</p>
        <p className="text-xs text-gray-400 mt-1">
          This log is append-only - entries cannot be edited or deleted.
        </p>
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

      {/* Filters */}
      <div className="mb-4 bg-peace border border-tertiary-button rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Actor email, action or entity"
              className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
            <select
              value={pageFilter}
              onChange={(e) => {
                setPageFilter(e.target.value as AdminPage | '');
                setPageNum(1);
              }}
              className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
            >
              <option value="">All sections</option>
              {PAGES.map((p) => (
                <option key={p} value={p}>
                  {PAGE_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No audit entries match these filters.</p>
        </div>
      ) : (
        <>
          <div className="bg-peace border border-tertiary-button rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-background">
                  <tr className="border-b border-tertiary-button">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">When</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Who</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tertiary-button">
                  {logs.map((log) => {
                    const denied = log.action === 'ACCESS_DENIED';
                    const expanded = expandedId === log.id;

                    return [
                      <tr
                        key={log.id}
                        onClick={() => setExpandedId(expanded ? null : log.id)}
                        className={`cursor-pointer transition-colors ${
                          denied
                            ? 'bg-red-50 border-l-2 border-l-danger hover:bg-red-100'
                            : 'hover:bg-background'
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-gray-700">
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {relativeTime(log.createdAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-foreground">{log.actorEmail}</div>
                          <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[11px] font-medium border bg-gray-100 text-gray-600 border-gray-300">
                            {log.actorRole}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${denied ? 'text-red-700' : 'text-gray-700'}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-gray-700">{log.entityType}</div>
                          {log.entityId ? (
                            <div
                              className="text-xs text-gray-400 font-mono mt-0.5"
                              title={log.entityId}
                            >
                              {truncate(log.entityId)}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3">
                          {log.page ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-blue-50 text-links border-blue-200 whitespace-nowrap">
                              {PAGE_LABELS[log.page] ?? log.page}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border bg-gray-100 text-gray-600 border-gray-300">
                              {log.method}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusColor(log.statusCode)}`}
                            >
                              {log.statusCode}
                            </span>
                          </div>
                        </td>
                      </tr>,

                      expanded ? (
                        <tr key={`${log.id}-details`} className={denied ? 'bg-red-50' : 'bg-peace'}>
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div>
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Path</div>
                                <div className="text-xs text-gray-700 font-mono break-all">{log.path}</div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">IP Address</div>
                                <div className="text-xs text-gray-700 font-mono">{log.ipAddress ?? '-'}</div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">User Agent</div>
                                <div className="text-xs text-gray-700 break-all">{log.userAgent ?? '-'}</div>
                              </div>
                            </div>

                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Metadata</div>
                            <pre className="bg-background border border-tertiary-button rounded-lg p-3 text-xs text-gray-700 font-mono overflow-x-auto">
                              {log.metadata ? JSON.stringify(log.metadata, null, 2) : '-'}
                            </pre>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-500">
              Page {pageNum} of {totalPages} ({total} total)
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
