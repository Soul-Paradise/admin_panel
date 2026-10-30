import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  EyeOff,
  History,
  Layers,
  Lock,
  Pencil,
  Save,
} from 'lucide-react';
import { api, ApiError, type SitePage, type SiteSection, type SiteSectionRevision } from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { useSiteImages } from '../hooks/useSiteImages';
import { pageMeta } from '../lib/site-content';
import { siteUrl, timeAgo } from '../lib/site';
import { clean, emptyRequired, fingerprint, normalize, pathLabel, type Json } from '../lib/content-form';
import ContentForm from '../components/ContentForm';
import ContentView from '../components/ContentView';
import Switch from '../components/Switch';
import { Alert, Badge, EmptyState, HeroStat, Modal, PageHeader, Panel, Spinner } from '../components/ui';
import { BTN_GHOST, BTN_PRIMARY, BTN_SM, LABEL, PAGE } from '../lib/ui-styles';

const GLASS_PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20';

const ICON_BTN =
  'flex h-8 w-8 items-center justify-center rounded-lg text-inactive transition-colors hover:bg-primary-tint hover:text-links disabled:pointer-events-none disabled:opacity-30';

/** Server 400s carry `message: string[]`; show each line. */
function errorLines(err: unknown, fallback: string): string[] {
  if (err instanceof ApiError) {
    const data = err.data as { message?: unknown } | null;
    if (data && Array.isArray(data.message)) return data.message.map(String);
    return [err.message || fallback];
  }
  return [err instanceof Error && err.message ? err.message : fallback];
}

const cleaned = (v: Json) => clean(v) ?? {};
const isEmptyContent = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0;

/** Edits the sections of one public page: content, visibility, order, history. */
export default function SitePageEditor() {
  const { page: rawPage = '' } = useParams<{ page: string }>();
  const page = rawPage.toUpperCase() as SitePage;
  const meta = pageMeta(page);
  const navigate = useNavigate();
  const { canWrite } = useAccess();
  const editable = canWrite('SITE_CONTENT');
  const { refresh: refreshSiteImages } = useSiteImages();
  // Section image URLs whose files were deleted from the bucket.
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    api
      .getMissingMedia()
      .then((r) => {
        if (!cancelled) setBrokenUrls(new Set([...r.brokenSections.map((b) => b.url), ...r.records.map((m) => m.url)]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [page]);

  const [sections, setSections] = useState<SiteSection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Json | null>(null);
  const [revisions, setRevisions] = useState<SiteSectionRevision[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);
  const [preview, setPreview] = useState<SiteSectionRevision | null>(null);

  const load = useCallback(async () => {
    try {
      setSections(await api.getSitePage(page));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorLines(err, 'Could not load this page.')[0]);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const open = sections?.find((s) => s.key === openKey) ?? null;

  const loadRevisions = useCallback(
    async (key: string) => {
      try {
        setRevisions(await api.getSiteSectionRevisions(page, key));
      } catch {
        setRevisions([]);
      }
    },
    [page],
  );

  const dirty = useMemo(() => {
    if (!open || draft === null) return false;
    return fingerprint(cleaned(draft)) !== fingerprint(cleaned(normalize(open.content as Json)));
  }, [open, draft]);
  // Site-wide images: every slot is optional (an empty slot = no-image design).
  const isImageSlots = page === 'GLOBAL' && openKey === 'images';
  const empties = useMemo(() => (draft === null || isImageSlots ? [] : emptyRequired(draft)), [draft, isImageSlots]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const replaceSection = (row: SiteSection) => setSections((list) => (list ? list.map((s) => (s.key === row.key ? row : s)) : list));

  function openSection(key: string | null) {
    if (dirty && !window.confirm('You have unsaved changes in this section. Discard them?')) return;
    setMessage(null);
    setFormErrors([]);
    setConflict(null);
    if (!key || key === openKey) {
      setOpenKey(null);
      setDraft(null);
      setRevisions([]);
      return;
    }
    const row = sections?.find((s) => s.key === key);
    setOpenKey(key);
    setDraft(row ? normalize(row.content as Json) : null);
    loadRevisions(key);
  }

  async function toggleVisible(s: SiteSection, next: boolean) {
    setBusyKey(s.key);
    setMessage(null);
    try {
      const row = await api.updateSiteSection(page, s.key, { isVisible: next, version: s.version });
      replaceSection(row);
      if (s.key === openKey) loadRevisions(s.key);
      setMessage({ type: 'success', text: `${s.label} is now ${next ? 'shown' : 'hidden'} on the website.` });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) setConflict(err.message);
      else setMessage({ type: 'error', text: errorLines(err, 'Could not change visibility.').join(' ') });
    } finally {
      setBusyKey(null);
    }
  }

  async function moveSection(index: number, delta: -1 | 1) {
    if (!sections) return;
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const before = sections;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    setBusyKey('__order');
    try {
      const saved = await api.reorderSitePage(
        page,
        next.map((s) => s.key),
      );
      setSections(saved);
      setMessage({ type: 'success', text: 'Order saved.' });
    } catch (err) {
      setSections(before);
      setMessage({ type: 'error', text: errorLines(err, 'Could not save the order.').join(' ') });
    } finally {
      setBusyKey(null);
    }
  }

  async function save() {
    if (!open || draft === null || !dirty || empties.length) return;
    setSaving(true);
    setMessage(null);
    setFormErrors([]);
    setConflict(null);
    try {
      const row = await api.updateSiteSection(page, open.key, { content: isImageSlots ? draft : cleaned(draft), version: open.version });
      replaceSection(row);
      if (isImageSlots) void refreshSiteImages();
      setDraft(normalize(row.content as Json));
      loadRevisions(open.key);
      setMessage({
        type: 'success',
        text: row.isVisible
          ? `${row.label} saved as v${row.version} - the website updates within a minute.`
          : `${row.label} saved as v${row.version}. It's hidden, so visitors won't see it until you show it.`,
      });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) setConflict(err.message);
      else setFormErrors(errorLines(err, 'Could not save this section.'));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!open || !window.confirm('Discard your unsaved changes to this section?')) return;
    setDraft(normalize(open.content as Json));
    setFormErrors([]);
  }

  async function reloadLatest() {
    if (dirty && !window.confirm('Reloading replaces your unsaved edits with the latest saved version. Continue?')) return;
    setConflict(null);
    setMessage(null);
    const fresh = await api.getSitePage(page).catch(() => null);
    if (!fresh) return;
    setSections(fresh);
    const row = fresh.find((s) => s.key === openKey);
    setDraft(row ? normalize(row.content as Json) : null);
    if (openKey) loadRevisions(openKey);
  }

  async function restore(version: number) {
    if (!open) return;
    const warning = dirty ? '\n\nYour unsaved edits will be lost.' : '';
    if (!window.confirm(`Restore version ${version} of ${open.label}? It becomes the new current version (v${open.version + 1}); history is kept.${warning}`)) return;
    setBusyKey(open.key);
    setMessage(null);
    setConflict(null);
    try {
      const row = await api.restoreSiteSection(page, open.key, version, open.version);
      replaceSection(row);
      setDraft(normalize(row.content as Json));
      setPreview(null);
      loadRevisions(open.key);
      setMessage({ type: 'success', text: `Version ${version} restored as v${row.version}.` });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) setConflict(err.message);
      else setMessage({ type: 'error', text: errorLines(err, 'Could not restore that version.').join(' ') });
    } finally {
      setBusyKey(null);
    }
  }

  function goBack() {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    navigate('/site-content');
  }

  // ------------------------------------------------------------------ render

  const title = meta?.label ?? 'Page';
  const actions = (
    <>
      <button type="button" onClick={goBack} className={GLASS_PILL}>
        <ChevronLeft className="h-4 w-4" /> Back to pages
      </button>
      {meta?.path && (
        <a href={siteUrl(meta.path)} target="_blank" rel="noopener noreferrer" className={GLASS_PILL}>
          View live <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </>
  );

  if (!meta) {
    return (
      <div className={PAGE}>
        <PageHeader eyebrow="Content" title="Unknown page" actions={actions} />
        <Alert tone="error">There is no page called "{rawPage}".</Alert>
      </div>
    );
  }

  if (loadError || !sections) {
    return (
      <div className={PAGE}>
        <PageHeader eyebrow="Content" title={title} subtitle={meta.hint} actions={actions} />
        {loadError ? (
          <Alert tone="error">{loadError}</Alert>
        ) : (
          <Panel>
            <Spinner label="Loading sections…" />
          </Panel>
        )}
      </div>
    );
  }

  const hidden = sections.filter((s) => !s.isVisible).length;
  const lastEdited = sections.reduce<string | null>((m, s) => (!m || s.updatedAt > m ? s.updatedAt : m), null);
  const saveBlocked = !editable ? null : empties.length ? `Fill in ${pathLabel(empties[0])}` : !dirty ? 'No changes to save' : null;

  return (
    <div className={`${PAGE} ${dirty && editable ? 'pb-28' : ''}`}>
      <PageHeader
        eyebrow="Content"
        title={title}
        subtitle={meta.path ? <span className="font-mono text-sm">{meta.path}</span> : 'Shown across the whole website'}
        note={!editable ? 'You have read-only access to Site Content.' : undefined}
        actions={actions}
        stats={
          <>
            <HeroStat icon={Layers} label="Sections" value={sections.length} />
            <HeroStat icon={EyeOff} label="Hidden" value={hidden} />
            <HeroStat icon={History} label="Last edited" value={timeAgo(lastEdited)} />
          </>
        }
      />

      {conflict && (
        <div className="mb-4">
          <Alert tone="warn">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{conflict}</span>
              <button type="button" onClick={reloadLatest} className={`${BTN_PRIMARY} ${BTN_SM}`}>
                Reload latest
              </button>
            </div>
          </Alert>
        </div>
      )}
      {message && (
        <div className="mb-4">
          <Alert tone={message.type} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Panel title="Sections" aside={<span className="text-xs font-semibold text-inactive">In page order</span>}>
          <ol className="space-y-3">
            {sections.map((s, i) => {
              const isOpen = s.key === openKey;
              const ctaOnly = isEmptyContent(s.content);
              return (
                <li key={s.key} className={`overflow-hidden rounded-2xl border transition ${isOpen ? 'border-links/40 shadow-md' : 'border-tertiary-button'} ${!s.isVisible ? 'bg-background' : 'bg-peace'}`}>
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-xs font-extrabold text-links">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className={`text-sm font-extrabold ${s.isVisible ? 'text-foreground' : 'text-inactive'}`}>{s.label}</h3>
                        {!s.isVisible && <Badge tone="amber">Hidden</Badge>}
                        {!s.hideable && (
                          <Badge tone="slate">
                            <Lock className="h-3 w-3" /> Required
                          </Badge>
                        )}
                        <Badge tone="slate">v{s.version}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-inactive">{s.description}</p>
                      <p className="mt-0.5 text-[11px] text-inactive">
                        Edited {timeAgo(s.updatedAt)}
                        {s.updatedByEmail ? ` by ${s.updatedByEmail}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {editable && (
                        <>
                          <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0 || busyKey !== null} className={ICON_BTN} title="Move up" aria-label={`Move ${s.label} up`}>
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(i, 1)}
                            disabled={i === sections.length - 1 || busyKey !== null}
                            className={ICON_BTN}
                            title="Move down"
                            aria-label={`Move ${s.label} down`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <Switch
                        checked={s.isVisible}
                        onChange={(next) => toggleVisible(s, next)}
                        label={`Show ${s.label} on the website`}
                        disabled={!editable || !s.hideable || busyKey !== null}
                        title={!s.hideable ? 'The website needs this section, so it can be edited but not hidden.' : undefined}
                        onLabel="Visible"
                        offLabel="Hidden"
                      />
                      <button
                        type="button"
                        onClick={() => openSection(s.key)}
                        aria-expanded={isOpen}
                        className={`${isOpen ? BTN_PRIMARY : BTN_GHOST} ${BTN_SM} ml-1`}
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {isOpen ? 'Close' : editable ? 'Edit' : 'View'}
                      </button>
                    </div>
                  </div>

                  {isOpen && draft !== null && (
                    <div className="border-t border-tertiary-button bg-background/50 p-4 sm:p-5">
                      {ctaOnly ? (
                        <p className="text-sm text-inactive">
                          This section has no text of its own: it places the shared "Planning something bigger?" banner on this page. Use the switch to show or hide it here; edit its
                          text and photo under <strong className="text-foreground">Site-wide details</strong>.
                        </p>
                      ) : (
                        <>
                          {formErrors.length > 0 && (
                            <div className="mb-4">
                              <Alert tone="error" onClose={() => setFormErrors([])}>
                                <p>The server rejected this section:</p>
                                <ul className="mt-1 list-disc pl-5 font-normal">
                                  {formErrors.map((e) => (
                                    <li key={e}>{e}</li>
                                  ))}
                                </ul>
                              </Alert>
                            </div>
                          )}
                          <ContentForm value={draft} onChange={setDraft} disabled={!editable} emptyPaths={empties} imageSlots={isImageSlots} brokenUrls={brokenUrls} />
                          {editable && (
                            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-tertiary-button pt-4">
                              {saveBlocked && dirty && <span className="mr-auto text-xs font-semibold text-danger">{saveBlocked}</span>}
                              {dirty && (
                                <button type="button" onClick={discard} disabled={saving} className={BTN_GHOST}>
                                  Discard changes
                                </button>
                              )}
                              <button type="button" onClick={save} disabled={saving || !!saveBlocked} className={BTN_PRIMARY}>
                                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save section'}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Page summary">
            <dl className="space-y-2 text-sm">
              <SummaryRow label="Sections">{sections.length}</SummaryRow>
              <SummaryRow label="Visible">{sections.length - hidden}</SummaryRow>
              <SummaryRow label="Hidden">{hidden}</SummaryRow>
              <SummaryRow label="Last edited">{timeAgo(lastEdited)}</SummaryRow>
            </dl>
            <p className="mt-3 border-t border-tertiary-button pt-3 text-xs leading-relaxed text-inactive">
              Hidden sections stay saved here but aren't shown to visitors. Changes reach the website within a minute.
            </p>
          </Panel>

          <Panel title="Version history" aside={open ? <span className="max-w-[140px] truncate text-xs font-semibold text-inactive">{open.label}</span> : undefined} flush>
            {!open ? (
              <EmptyState icon={History} title="Open a section" message="Its saved versions appear here." />
            ) : revisions.length === 0 ? (
              <EmptyState icon={History} title="No history yet" />
            ) : (
              <ol className="max-h-[420px] divide-y divide-tertiary-button overflow-y-auto">
                {revisions.map((r) => (
                  <li key={r.version} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-xs font-extrabold text-links">v{r.version}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{r.editedByEmail ?? 'Unknown'}</p>
                      <p className="text-xs text-inactive">
                        {timeAgo(r.createdAt)} · {r.snapshot.isVisible ? 'visible' : 'hidden'}
                      </p>
                    </div>
                    {r.isCurrent ? (
                      <Badge tone="green">Current</Badge>
                    ) : (
                      <div className="flex shrink-0 gap-1.5">
                        <button type="button" onClick={() => setPreview(r)} className="text-xs font-bold text-links hover:underline">
                          Preview
                        </button>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => restore(r.version)}
                            disabled={busyKey !== null || saving}
                            className="text-xs font-bold text-foreground hover:text-links hover:underline disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </aside>
      </div>

      {preview && open && (
        <Modal
          title={`${open.label} · version ${preview.version}`}
          onClose={() => setPreview(null)}
          wide
          footer={
            <>
              <button type="button" onClick={() => setPreview(null)} className={BTN_GHOST}>
                Close
              </button>
              {editable && !preview.isCurrent && (
                <button type="button" onClick={() => restore(preview.version)} disabled={busyKey !== null} className={BTN_PRIMARY}>
                  Restore this version
                </button>
              )}
            </>
          }
        >
          <p className={`mb-3 ${LABEL}`}>
            Saved {timeAgo(preview.createdAt)} by {preview.editedByEmail ?? 'unknown'} · {preview.snapshot.isVisible ? 'Visible' : 'Hidden'}
          </p>
          <ContentView value={preview.snapshot.content as Json} />
        </Modal>
      )}

      {dirty && editable && open && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-tertiary-button bg-peace/95 px-4 py-3 shadow-[0_-4px_16px_rgba(14,34,56,0.06)] backdrop-blur-sm lg:left-[var(--sidebar-w,17rem)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
            <p className="flex-1 text-sm font-semibold text-foreground">
              Unsaved changes in {open.label}
              {saveBlocked && <span className="ml-2 text-xs font-semibold text-danger">· {saveBlocked}</span>}
            </p>
            <button type="button" onClick={discard} disabled={saving} className={`${BTN_GHOST} ${BTN_SM}`}>
              Discard
            </button>
            <button type="button" onClick={save} disabled={saving || !!saveBlocked} className={`${BTN_PRIMARY} ${BTN_SM}`}>
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save section'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-inactive">{label}</dt>
      <dd className="font-bold text-foreground">{children}</dd>
    </div>
  );
}
