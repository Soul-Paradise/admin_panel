import { useCallback, useEffect, useState } from 'react';
import { Eye, ScrollText, Search, ShieldAlert } from 'lucide-react';
import { api, type AdminPage, type AuditLogEntry } from '../lib/api';
import { Alert, Badge, EmptyState, HeroStat, PageHeader, Pagination, Panel, Spinner } from '../components/ui';
import { FIELD_LABEL, INPUT, LABEL, PAGE, SELECT, TABLE_HEAD, TBODY, TH, TROW, type Tone } from '../lib/ui-styles';

const PAGE_LABELS: Record<AdminPage, string> = {
  DASHBOARD: 'Dashboard',
  USERS: 'Users',
  BOOKING_PARTNERS: 'Booking Partners',
  CUSTOMER_MESSAGES: 'Customer Messages',
  ORDERS: 'Orders',
  COMMISSION: 'Commission',
  COUPONS: 'Coupons',
  OFFERS: 'Offers',
  REVIEWS: 'Reviews',
  UTILITIES: 'Utilities',
  CUSTOM_PAYMENTS: 'Custom Payments',
  POLICIES: 'Policies',
  SITE_CONTENT: 'Site Content',
  USER_ACCESS: 'User Access',
  AUDIT_LOGS: 'Audit Logs',
};

const PAGES: AdminPage[] = [
  'DASHBOARD',
  'USERS',
  'BOOKING_PARTNERS',
  'CUSTOMER_MESSAGES',
  'ORDERS',
  'COMMISSION',
  'COUPONS',
  'OFFERS',
  'REVIEWS',
  'UTILITIES',
  'CUSTOM_PAYMENTS',
  'POLICIES',
  'SITE_CONTENT',
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

function statusTone(code: number): Tone {
  if (code >= 500) return 'red';
  if (code >= 400) return 'amber';
  if (code >= 200 && code < 300) return 'green';
  return 'slate';
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

  // Denied or failed entries among the rows on this page.
  const flagged = logs.filter((l) => l.action === 'ACCESS_DENIED' || l.statusCode >= 400).length;

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Security"
        title="Audit Logs"
        subtitle="Every change made from the admin panel"
        note="This log is append-only - entries cannot be edited or deleted."
        stats={
          <>
            <HeroStat icon={ScrollText} label="Total entries" value={loading ? null : total.toLocaleString('en-IN')} />
            <HeroStat icon={Eye} label="Shown on this page" value={loading ? null : logs.length.toLocaleString('en-IN')} />
            <HeroStat icon={ShieldAlert} label="Denied or errors (this page)" value={loading ? null : flagged.toLocaleString('en-IN')} />
          </>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.type}>{message.text}</Alert>
        </div>
      )}

      {/* Filters */}
      <Panel title="Filters" className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className={FIELD_LABEL}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-inactive" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Actor email, action or entity"
                className={`${INPUT} pl-10`}
              />
            </div>
          </div>

          <div>
            <label className={FIELD_LABEL}>Section</label>
            <select
              value={pageFilter}
              onChange={(e) => {
                setPageFilter(e.target.value as AdminPage | '');
                setPageNum(1);
              }}
              className={SELECT}
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
              <label className={FIELD_LABEL}>From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPageNum(1);
                }}
                className={`${INPUT} !px-3`}
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
                className={`${INPUT} !px-3`}
              />
            </div>
          </div>
        </div>
      </Panel>

      {/* Table */}
      <Panel
        title="Activity"
        aside={
          <span className="text-sm text-inactive">
            <span className="font-bold text-foreground">{total.toLocaleString('en-IN')}</span> entr{total === 1 ? 'y' : 'ies'}
          </span>
        }
        flush
      >
        {loading ? (
          <Spinner label="Loading audit logs…" />
        ) : logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries match these filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className={TABLE_HEAD}>
                  <tr className="border-b border-tertiary-button">
                    <th className={TH}>When</th>
                    <th className={TH}>Who</th>
                    <th className={TH}>Action</th>
                    <th className={TH}>Target</th>
                    <th className={TH}>Section</th>
                    <th className={TH}>Result</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {logs.map((log) => {
                    const denied = log.action === 'ACCESS_DENIED';
                    const expanded = expandedId === log.id;

                    return [
                      <tr
                        key={log.id}
                        onClick={() => setExpandedId(expanded ? null : log.id)}
                        className={`cursor-pointer ${
                          denied ? 'border-l-2 border-l-danger bg-danger/10 transition-colors hover:bg-danger/15' : TROW
                        }`}
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-foreground">{new Date(log.createdAt).toLocaleString()}</div>
                          <div className="mt-0.5 text-xs text-inactive">{relativeTime(log.createdAt)}</div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="text-foreground">{log.actorEmail}</div>
                          <div className="mt-1">
                            <Badge tone="slate">{log.actorRole}</Badge>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={`font-bold ${denied ? 'text-danger' : 'text-foreground'}`}>{log.action}</span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="text-foreground">{log.entityType}</div>
                          {log.entityId ? (
                            <div className="mt-0.5 font-mono text-xs text-inactive" title={log.entityId}>
                              {truncate(log.entityId)}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-5 py-3.5">
                          {log.page ? (
                            <Badge tone="blue">{PAGE_LABELS[log.page] ?? log.page}</Badge>
                          ) : (
                            <span className="text-inactive">-</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 font-mono text-[11px] font-bold text-inactive ring-1 ring-tertiary-button">
                              {log.method}
                            </span>
                            <Badge tone={statusTone(log.statusCode)}>{log.statusCode}</Badge>
                          </div>
                        </td>
                      </tr>,

                      expanded ? (
                        <tr key={`${log.id}-details`} className={denied ? 'bg-danger/10' : 'bg-background/60'}>
                          <td colSpan={6} className="px-5 py-4">
                            <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                              <div>
                                <div className={`mb-1 ${LABEL}`}>Path</div>
                                <div className="font-mono text-xs break-all text-foreground">{log.path}</div>
                              </div>
                              <div>
                                <div className={`mb-1 ${LABEL}`}>IP Address</div>
                                <div className="font-mono text-xs text-foreground">{log.ipAddress ?? '-'}</div>
                              </div>
                              <div>
                                <div className={`mb-1 ${LABEL}`}>User Agent</div>
                                <div className="text-xs break-all text-foreground">{log.userAgent ?? '-'}</div>
                              </div>
                            </div>

                            <div className={`mb-1 ${LABEL}`}>Metadata</div>
                            <pre className="overflow-x-auto rounded-xl border border-tertiary-button bg-peace p-3 font-mono text-xs text-foreground">
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

            <Pagination
              page={pageNum}
              totalPages={totalPages}
              total={total}
              onPage={(p) => setPageNum(Math.min(totalPages, Math.max(1, p)))}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
