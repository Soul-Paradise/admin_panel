import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type AccessLevel,
  type AdminAccessRow,
  type AdminPage,
  type PageAccessMap,
} from '../lib/api';
import { useAccess } from '../hooks/useAccess';

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

/** Fallback ordering if the backend ever sends the pages unordered. */
const FALLBACK_PAGES: AdminPage[] = [
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

/** None -> Read -> Write -> None. `undefined` is the absence of a grant. */
function cycle(level: AccessLevel | undefined): AccessLevel | undefined {
  if (level === undefined) return 'READ';
  if (level === 'READ') return 'WRITE';
  return undefined;
}

const CELL_STYLES: Record<'NONE' | AccessLevel, string> = {
  NONE: 'bg-gray-800 text-gray-600 border-gray-700',
  READ: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  WRITE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const CELL_TITLES: Record<'NONE' | AccessLevel, string> = {
  NONE: 'No access',
  READ: 'Read only',
  WRITE: 'Read & write',
};

const CELL_TEXT: Record<'NONE' | AccessLevel, string> = {
  NONE: '—',
  READ: 'R',
  WRITE: 'W',
};

function sameMap(a: PageAccessMap, b: PageAccessMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<AdminPage>;
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export default function UserAccess() {
  const { isSuperAdmin } = useAccess();

  const [pages, setPages] = useState<AdminPage[]>(FALLBACK_PAGES);
  const [admins, setAdmins] = useState<AdminAccessRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PageAccessMap>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAdminAccess();
      setPages(data.pages?.length ? data.pages : FALLBACK_PAGES);
      setAdmins(data.admins);
      setDrafts(
        Object.fromEntries(data.admins.map((a) => [a.id, { ...a.access }])),
      );
    } catch {
      setMessage({ type: 'error', text: 'Failed to load admin access' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // A non–super admin must not even ask: the endpoint would 403 and the
    // refusal would land in the audit log as a denied attempt.
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    load();
  }, [isSuperAdmin, load]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  function toggleCell(adminId: string, page: AdminPage) {
    setDrafts((prev) => {
      const current = prev[adminId] ?? {};
      const next: PageAccessMap = { ...current };
      const level = cycle(current[page]);
      if (level === undefined) delete next[page];
      else next[page] = level;
      return { ...prev, [adminId]: next };
    });
  }

  function resetRow(admin: AdminAccessRow) {
    setDrafts((prev) => ({ ...prev, [admin.id]: { ...admin.access } }));
  }

  async function saveRow(admin: AdminAccessRow) {
    const draft = drafts[admin.id] ?? {};
    setSavingId(admin.id);
    try {
      // Wholesale replace: pages left at None are simply absent, and the
      // backend reads absence as revocation.
      await api.setAdminAccess(admin.id, draft);
      setMessage({ type: 'success', text: `Access updated for ${admin.email}` });
      await load();
    } catch (err) {
      const text = (err as { message?: string })?.message || 'Failed to update access';
      setMessage({ type: 'error', text });
    } finally {
      setSavingId(null);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-24">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-md text-center">
            <div className="text-3xl mb-3">🔒</div>
            <h1 className="text-base font-semibold text-white">Restricted</h1>
            <p className="text-sm text-gray-500 mt-2">
              Only a super admin can manage page access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">User Access</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Grant each admin access to specific sections
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

      {/* Explainer + legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-xs text-gray-500">
          Admins see only the sections they're granted. Absence of a grant is a denial — a
          section with no access is hidden from their sidebar entirely.
        </p>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-flex h-5 w-6 items-center justify-center rounded-md border text-[11px] font-semibold ${CELL_STYLES.NONE}`}>
              —
            </span>
            None
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-flex h-5 w-6 items-center justify-center rounded-md border text-[11px] font-semibold ${CELL_STYLES.READ}`}>
              R
            </span>
            Read
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-flex h-5 w-6 items-center justify-center rounded-md border text-[11px] font-semibold ${CELL_STYLES.WRITE}`}>
              W
            </span>
            Write
          </span>
        </div>
      </div>

      {/* Matrix */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : admins.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No admins yet. Promote a user to admin to grant them access.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-900 z-10">
                    Admin
                  </th>
                  {pages.map((page) => (
                    <th
                      key={page}
                      className="px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center whitespace-nowrap"
                    >
                      {PAGE_LABELS[page] ?? page}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {admins.map((admin) => {
                  const isSuper = admin.role === 'SUPER_ADMIN';
                  const draft = drafts[admin.id] ?? {};
                  const dirty = !isSuper && !sameMap(draft, admin.access);
                  const saving = savingId === admin.id;

                  return (
                    <tr key={admin.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 sticky left-0 bg-gray-900 z-10">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white whitespace-nowrap">{admin.name}</span>
                          {isSuper && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                              Super Admin
                            </span>
                          )}
                          {!admin.isActive && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-gray-500/15 text-gray-400 border-gray-500/30">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{admin.email}</div>
                      </td>

                      {pages.map((page) => {
                        if (isSuper) {
                          return (
                            <td key={page} className="px-3 py-3 text-center">
                              <span
                                title="Super admins always have full access"
                                className={`inline-flex h-7 w-9 items-center justify-center rounded-md border text-xs font-semibold opacity-70 cursor-not-allowed ${CELL_STYLES.WRITE}`}
                              >
                                W
                              </span>
                            </td>
                          );
                        }

                        const level = draft[page];
                        const key: 'NONE' | AccessLevel = level ?? 'NONE';

                        return (
                          <td key={page} className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleCell(admin.id, page)}
                              title={`${PAGE_LABELS[page] ?? page} — ${CELL_TITLES[key]}`}
                              className={`inline-flex h-7 w-9 items-center justify-center rounded-md border text-xs font-semibold transition-colors hover:brightness-125 ${CELL_STYLES[key]}`}
                            >
                              {CELL_TEXT[key]}
                            </button>
                          </td>
                        );
                      })}

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {dirty && (
                            <>
                              <button
                                onClick={() => saveRow(admin)}
                                disabled={saving}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => resetRow(admin)}
                                disabled={saving}
                                className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                Reset
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
