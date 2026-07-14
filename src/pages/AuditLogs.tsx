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
  if (code >= 500) return 'bg-red-500/15 text-red-400 border-red-500/30';
  if (code >= 400) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (code >= 200 && code < 300) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every change made from the admin panel</p>
        <p className="text-xs text-gray-600 mt-1">
          This log is append-only — entries cannot be edited or deleted.
        </p>
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

      {/* Filters */}
      <div className="mb-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Actor email, action or entity"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Section</label>
            <select
              value={pageFilter}
              onChange={(e) => {
                setPageFilter(e.target.value as AdminPage | '');
                setPageNum(1);
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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
              <label className="block text-xs font-medium text-gray-400 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPageNum(1);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPageNum(1);
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No audit entries match these filters.</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">When</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Who</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {logs.map((log) => {
                    const denied = log.action === 'ACCESS_DENIED';
                    const expanded = expandedId === log.id;

                    return [
                      <tr
                        key={log.id}
                        onClick={() => setExpandedId(expanded ? null : log.id)}
                        className={`cursor-pointer transition-colors ${
                          denied
                            ? 'bg-red-500/[0.07] border-l-2 border-l-red-500 hover:bg-red-500/[0.12]'
                            : 'hover:bg-gray-800/30'
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-gray-300">
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {relativeTime(log.createdAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-white">{log.actorEmail}</div>
                          <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[11px] font-medium border bg-gray-500/15 text-gray-400 border-gray-500/30">
                            {log.actorRole}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${denied ? 'text-red-400' : 'text-gray-300'}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-gray-300">{log.entityType}</div>
                          {log.entityId ? (
                            <div
                              className="text-xs text-gray-600 font-mono mt-0.5"
                              title={log.entityId}
                            >
                              {truncate(log.entityId)}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3">
                          {log.page ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-blue-500/15 text-blue-400 border-blue-500/30 whitespace-nowrap">
                              {PAGE_LABELS[log.page] ?? log.page}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border bg-gray-800 text-gray-400 border-gray-700">
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
                        <tr key={`${log.id}-details`} className={denied ? 'bg-red-500/[0.04]' : 'bg-gray-900'}>
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                              <div>
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Path</div>
                                <div className="text-xs text-gray-300 font-mono break-all">{log.path}</div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">IP Address</div>
                                <div className="text-xs text-gray-300 font-mono">{log.ipAddress ?? '—'}</div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">User Agent</div>
                                <div className="text-xs text-gray-300 break-all">{log.userAgent ?? '—'}</div>
                              </div>
                            </div>

                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Metadata</div>
                            <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto">
                              {log.metadata ? JSON.stringify(log.metadata, null, 2) : '—'}
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
                className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 disabled:hover:text-gray-400 rounded-lg transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                disabled={pageNum >= totalPages}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 disabled:hover:text-gray-400 rounded-lg transition-colors"
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
