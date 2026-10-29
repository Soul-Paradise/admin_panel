import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type AccessLevel,
  type AdminAccessRow,
  type AdminPage,
  type PageAccessMap,
} from '../lib/api';
import { ChevronDown, ShieldAlert } from 'lucide-react';
import { useAccess } from '../hooks/useAccess';

type LevelKey = 'NONE' | AccessLevel;

/**
 * What each grant actually opens up. The hint matters: a super admin handing
 * out access should not have to guess what "Utilities" contains.
 */
const PAGE_META: Record<AdminPage, { label: string; hint: string; sensitive?: boolean }> = {
  DASHBOARD: { label: 'Dashboard', hint: 'Platform totals and overview' },
  USERS: { label: 'User Details', hint: 'Customer accounts and ticket history' },
  BOOKING_PARTNERS: { label: 'Booking Partners', hint: 'Agent applications and approvals' },
  COMMISSION: { label: 'Commission', hint: 'Service commission rates' },
  COUPONS: { label: 'Coupons', hint: 'Discount codes and usage limits' },
  OFFERS: { label: 'Offers', hint: 'Promotional offers on the homepage' },
  REVIEWS: { label: 'Reviews', hint: 'Customer reviews and moderation' },
  UTILITIES: { label: 'Utilities', hint: 'Reports and platform tools' },
  CUSTOM_PAYMENTS: { label: 'Custom Payments', hint: 'Payments made from the website Custom Payment tab' },
  USER_ACCESS: {
    label: 'User Access',
    hint: 'Admin permissions - this page',
    sensitive: true,
  },
  AUDIT_LOGS: { label: 'Audit Logs', hint: 'Record of every admin action' },
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
  'CUSTOM_PAYMENTS',
  'USER_ACCESS',
  'AUDIT_LOGS',
];

const LEVELS: { key: LevelKey; label: string; on: string }[] = [
  { key: 'NONE', label: 'None', on: 'bg-peace text-gray-600 ring-1 ring-gray-300' },
  { key: 'READ', label: 'Read', on: 'bg-blue-50 text-links ring-1 ring-blue-200' },
  { key: 'WRITE', label: 'Write', on: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
];

function levelOf(map: PageAccessMap, page: AdminPage): LevelKey {
  return map[page] ?? 'NONE';
}

/** Pages whose grant differs between the saved row and the working copy. */
function changedPages(saved: PageAccessMap, draft: PageAccessMap, pages: AdminPage[]): AdminPage[] {
  return pages.filter((p) => levelOf(saved, p) !== levelOf(draft, p));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}

/** A three-way choice, spelled out. The old cell cycled None→Read→Write on
 *  click, which gave no hint that a third state existed or how to go back. */
function LevelPicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: LevelKey;
  onChange: (next: LevelKey) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={`Access level for ${label}`}
      className="inline-flex shrink-0 rounded-lg bg-background p-0.5 ring-1 ring-tertiary-button"
    >
      {LEVELS.map((lvl) => {
        const active = value === lvl.key;
        return (
          <button
            key={lvl.key}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(lvl.key)}
            className={`rounded-[7px] px-2.5 py-1 text-xs font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
              active ? lvl.on : 'text-gray-500 hover:text-foreground'
            }`}
          >
            {lvl.label}
          </button>
        );
      })}
    </div>
  );
}

export default function UserAccess() {
  const { isSuperAdmin } = useAccess();

  const [pages, setPages] = useState<AdminPage[]>(FALLBACK_PAGES);
  const [admins, setAdmins] = useState<AdminAccessRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PageAccessMap>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAdminAccess();
      setPages(data.pages?.length ? data.pages : FALLBACK_PAGES);
      setAdmins(data.admins);
      setDrafts(Object.fromEntries(data.admins.map((a) => [a.id, { ...a.access }])));
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
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  function setLevel(adminId: string, page: AdminPage, next: LevelKey) {
    setDrafts((prev) => {
      const map: PageAccessMap = { ...(prev[adminId] ?? {}) };
      if (next === 'NONE') delete map[page];
      else map[page] = next;
      return { ...prev, [adminId]: map };
    });
  }

  function setAll(adminId: string, next: LevelKey) {
    setDrafts((prev) => {
      const map: PageAccessMap = {};
      if (next !== 'NONE') for (const p of pages) map[p] = next;
      return { ...prev, [adminId]: map };
    });
  }

  function resetRow(admin: AdminAccessRow) {
    setDrafts((prev) => ({ ...prev, [admin.id]: { ...admin.access } }));
  }

  const saveRow = useCallback(
    async (admin: AdminAccessRow, draft: PageAccessMap) => {
      // Wholesale replace: pages left at None are simply absent, and the
      // backend reads absence as revocation.
      await api.setAdminAccess(admin.id, draft);
    },
    [],
  );

  async function handleSave(admin: AdminAccessRow) {
    setSavingId(admin.id);
    try {
      await saveRow(admin, drafts[admin.id] ?? {});
      setMessage({ type: 'success', text: `Access updated for ${admin.name}` });
      await load();
    } catch (err) {
      const text = (err as { message?: string })?.message || 'Failed to update access';
      setMessage({ type: 'error', text });
    } finally {
      setSavingId(null);
    }
  }

  const editable = useMemo(
    () => admins.filter((a) => a.role !== 'SUPER_ADMIN'),
    [admins],
  );

  const dirtyAdmins = useMemo(
    () => editable.filter((a) => changedPages(a.access, drafts[a.id] ?? {}, pages).length > 0),
    [editable, drafts, pages],
  );

  async function handleSaveAll() {
    setSavingAll(true);
    const failed: string[] = [];
    for (const admin of dirtyAdmins) {
      try {
        await saveRow(admin, drafts[admin.id] ?? {});
      } catch {
        failed.push(admin.name);
      }
    }
    setSavingAll(false);
    setMessage(
      failed.length
        ? { type: 'error', text: `Could not save: ${failed.join(', ')}` }
        : { type: 'success', text: `Saved access for ${dirtyAdmins.length} admin${dirtyAdmins.length === 1 ? '' : 's'}` },
    );
    await load();
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }, [admins, search]);

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-tertiary-button bg-peace p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background">
            <ShieldAlert className="h-6 w-6 text-gray-500" strokeWidth={1.75} />
          </div>
          <h1 className="mb-1 text-base font-bold text-foreground">Restricted</h1>
          <p className="text-sm text-gray-500">Only a super admin can manage page access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">User Access</h1>
        <p className="mt-2 text-sm text-foreground">
          Choose what each admin can open. A section left at <strong className="font-bold">None</strong> is
          hidden from their sidebar and refused by the API.
        </p>
      </div>

      {message && (
        <div
          role="alert"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm font-semibold ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {admins.length > 4 && (
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search admins by name or email…"
            className="block w-full rounded-lg border border-gray-300 bg-peace px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none sm:max-w-sm"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-tertiary-button bg-peace p-5 shadow-sm">
              <div className="h-4 w-40 animate-pulse rounded bg-tertiary-button" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="h-12 animate-pulse rounded-lg bg-background" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-tertiary-button bg-peace py-16 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            {search ? 'No admin matches that search.' : 'No admins yet. Promote a user to admin to grant them access.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((admin) => {
            const isSuper = admin.role === 'SUPER_ADMIN';
            const draft = drafts[admin.id] ?? {};
            const changed = isSuper ? [] : changedPages(admin.access, draft, pages);
            const saving = savingId === admin.id;
            const isCollapsed = collapsed[admin.id] ?? false;

            const granted = isSuper ? pages.length : pages.filter((p) => draft[p]).length;
            const writes = isSuper ? pages.length : pages.filter((p) => draft[p] === 'WRITE').length;

            return (
              <section
                key={admin.id}
                className={`overflow-hidden rounded-xl border bg-peace shadow-sm transition-colors ${
                  changed.length ? 'border-warn' : 'border-tertiary-button'
                }`}
              >
                {/* Admin header */}
                <div className="flex items-start gap-3 border-b border-tertiary-button p-4 sm:items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-button text-xs font-bold text-peace">
                    {initials(admin.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-bold text-foreground">{admin.name}</span>
                      {isSuper && (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          Super Admin
                        </span>
                      )}
                      {!admin.isActive && (
                        <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                          Inactive
                        </span>
                      )}
                      {changed.length > 0 && (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          {changed.length} unsaved
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500">{admin.email}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs font-semibold text-gray-500 sm:inline">
                      {granted} of {pages.length} sections
                      {writes > 0 && ` · ${writes} write`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [admin.id]: !isCollapsed }))}
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? `Show sections for ${admin.name}` : `Hide sections for ${admin.name}`}
                      className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-background hover:text-foreground"
                    >
                      <ChevronDown
                        className={`h-5 w-5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <>
                    {isSuper ? (
                      <p className="px-4 py-6 text-sm text-gray-500">
                        Super admins always have full access to every section. There is nothing to
                        configure here.
                      </p>
                    ) : (
                      <>
                        {/* Bulk actions - granting all ten one control at a time was 20 clicks. */}
                        <div className="flex flex-wrap items-center gap-2 border-b border-tertiary-button bg-background px-4 py-2.5">
                          <span className="mr-1 text-xs font-semibold text-gray-500">Set all:</span>
                          {LEVELS.map((lvl) => (
                            <button
                              key={lvl.key}
                              type="button"
                              onClick={() => setAll(admin.id, lvl.key)}
                              className="rounded-lg border border-tertiary-button bg-peace px-2.5 py-1 text-xs font-bold text-gray-600 transition-colors hover:border-secondary-button hover:text-foreground"
                            >
                              {lvl.label}
                            </button>
                          ))}
                        </div>

                        <div className="grid gap-2 p-4 sm:grid-cols-2">
                          {pages.map((page) => {
                            const meta = PAGE_META[page] ?? { label: page, hint: '' };
                            const level = levelOf(draft, page);
                            const isChanged = changed.includes(page);

                            return (
                              <div
                                key={page}
                                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                                  isChanged ? 'border-amber-200 bg-amber-50/50' : 'border-tertiary-button'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-foreground">{meta.label}</p>
                                  <p className="truncate text-xs text-gray-500">
                                    {meta.sensitive && level === 'WRITE'
                                      ? 'Lets them change any admin’s access'
                                      : meta.hint}
                                  </p>
                                </div>
                                <LevelPicker
                                  label={meta.label}
                                  value={level}
                                  disabled={saving || savingAll}
                                  onChange={(next) => setLevel(admin.id, page, next)}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {changed.length > 0 && (
                          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-tertiary-button bg-background px-4 py-3">
                            <span className="mr-auto text-xs font-semibold text-amber-700">
                              {changed.length} section{changed.length === 1 ? '' : 's'} changed
                            </span>
                            <button
                              type="button"
                              onClick={() => resetRow(admin)}
                              disabled={saving || savingAll}
                              className="rounded-lg border border-tertiary-button bg-peace px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:border-secondary-button hover:text-foreground disabled:opacity-50"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSave(admin)}
                              disabled={saving || savingAll}
                              className="rounded-lg bg-primary-button px-4 py-1.5 text-xs font-bold text-peace shadow-sm transition-colors hover:bg-secondary-button disabled:opacity-50"
                            >
                              {saving ? 'Saving…' : 'Save changes'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Catches the case of editing several admins and forgetting to save the
          ones scrolled off screen. */}
      {dirtyAdmins.length > 1 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-tertiary-button bg-peace/95 px-4 py-3 backdrop-blur-sm lg:left-64">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground sm:text-sm">
              {dirtyAdmins.length} admins have unsaved changes
            </span>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={savingAll}
              className="shrink-0 rounded-lg bg-primary-button px-4 py-2 text-xs font-bold text-peace shadow-sm transition-colors hover:bg-secondary-button disabled:opacity-50 sm:text-sm"
            >
              {savingAll ? 'Saving…' : 'Save all'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
