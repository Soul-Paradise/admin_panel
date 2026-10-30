import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileX2,
  HardDrive,
  Images,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, ApiError, type BrokenSectionRef, type MediaAsset, type MediaCollection } from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { formatBytes } from '../lib/site-content';
import { timeAgo } from '../lib/site';
import { checkImageFile, prepareImage, titleFromFileName } from '../lib/image-upload';
import Switch from '../components/Switch';
import { Alert, Badge, EmptyState, HeroStat, Modal, PageHeader, Panel, Spinner, Tabs } from '../components/ui';
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, BTN_SM, CARD, FIELD_LABEL, INPUT, LABEL, PAGE, SELECT } from '../lib/ui-styles';

type Tab = MediaCollection | 'ALL';

const COLLECTION_LABEL: Record<MediaCollection, string> = { HALL_OF_FAME: 'Hall of Fame', LIBRARY: 'Library' };

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

interface PendingUpload {
  id: string;
  file: File;
  title: string;
  category: string;
  collection: MediaCollection;
  isVisible: boolean;
  status: 'ready' | 'uploading' | 'done' | 'error';
  error?: string;
  previewUrl: string;
}

let uploadSeq = 0;

/** Images in the customer_trip_images bucket: upload, caption, hide, order, delete. */
export default function MediaLibrary() {
  const { canWrite } = useAccess();
  const editable = canWrite('SITE_CONTENT');

  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tab, setTab] = useState<Tab>('HALL_OF_FAME');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState<MediaAsset | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [brokenSections, setBrokenSections] = useState<BrokenSectionRef[]>([]);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [media, missing] = await Promise.all([
        api.getMedia(),
        api.getMissingMedia().catch(() => ({ records: [], brokenSections: [] as BrokenSectionRef[] })),
      ]);
      setItems(media);
      setBrokenSections(missing.brokenSections);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Could not load the media library.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => [...new Set((items ?? []).map((m) => m.category).filter((c): c is string => !!c))].sort(),
    [items],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? [])
      .filter((m) => tab === 'ALL' || m.collection === tab)
      .filter((m) => !category || m.category === category)
      .filter((m) => !q || [m.title, m.caption, m.category, m.objectName].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => (a.collection === b.collection ? a.sortOrder - b.sortOrder : a.collection.localeCompare(b.collection)));
  }, [items, tab, category, search]);

  const stats = useMemo(() => {
    const all = items ?? [];
    return {
      total: all.length,
      visible: all.filter((m) => m.isVisible && !m.missing).length,
      hidden: all.filter((m) => !m.isVisible && !m.missing).length,
      missing: all.filter((m) => m.missing).length,
      size: all.reduce((n, m) => n + m.sizeBytes, 0),
    };
  }, [items]);

  const replace = (asset: MediaAsset) => setItems((list) => (list ? list.map((m) => (m.id === asset.id ? asset : m)) : list));

  async function patch(asset: MediaAsset, changes: Parameters<typeof api.updateMedia>[1], done?: string) {
    setBusy(asset.id);
    try {
      replace(await api.updateMedia(asset.id, changes));
      if (done) setMessage({ type: 'success', text: done });
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Could not update the image.') });
    } finally {
      setBusy(null);
    }
  }

  /** Swap with the neighbour in the same collection and save that collection's order. */
  async function move(asset: MediaAsset, delta: -1 | 1) {
    if (!items) return;
    const list = items.filter((m) => m.collection === asset.collection).sort((a, b) => a.sortOrder - b.sortOrder);
    const i = list.findIndex((m) => m.id === asset.id);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const order = new Map(list.map((m, k) => [m.id, k + 1]));
    const before = items;
    setItems(items.map((m) => (order.has(m.id) ? { ...m, sortOrder: order.get(m.id)! } : m)));
    setBusy(asset.id);
    try {
      await api.reorderMedia(list.map((m) => m.id));
    } catch (err) {
      setItems(before);
      setMessage({ type: 'error', text: errorText(err, 'Could not save the order.') });
    } finally {
      setBusy(null);
    }
  }

  async function copyUrl(asset: MediaAsset) {
    try {
      await navigator.clipboard.writeText(asset.url);
      setMessage({ type: 'success', text: 'Image URL copied.' });
    } catch {
      window.prompt('Copy the image URL:', asset.url);
    }
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function bulkVisibility(isVisible: boolean) {
    const targets = (items ?? []).filter((m) => selected.has(m.id) && m.isVisible !== isVisible);
    setBusy('__bulk');
    try {
      for (const m of targets) replace(await api.updateMedia(m.id, { isVisible }));
      setMessage({ type: 'success', text: `${targets.length} image${targets.length === 1 ? '' : 's'} ${isVisible ? 'shown' : 'hidden'}.` });
      setSelected(new Set());
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Some images could not be updated.') });
    } finally {
      setBusy(null);
    }
  }

  async function bulkDelete() {
    const targets = (items ?? []).filter((m) => selected.has(m.id));
    if (!window.confirm(`Permanently delete ${targets.length} image${targets.length === 1 ? '' : 's'} from the bucket? Images still used on a page are skipped.`)) return;
    setBusy('__bulk');
    const skipped: string[] = [];
    let deleted = 0;
    for (const m of targets) {
      try {
        await api.deleteMedia(m.id);
        deleted++;
      } catch (err) {
        skipped.push(err instanceof ApiError && err.statusCode === 409 ? `${m.title} (in use)` : m.title);
      }
    }
    setSelected(new Set());
    setBusy(null);
    await load();
    setMessage({
      type: skipped.length ? 'error' : 'success',
      text: `${deleted} deleted.${skipped.length ? ` Skipped: ${skipped.join(', ')}.` : ''}`,
    });
  }

  /** Deletes the records of files someone removed straight from the bucket. */
  async function removeMissing() {
    const n = stats.missing;
    if (!window.confirm(`Remove the ${n} record${n === 1 ? '' : 's'} of images that are no longer in the bucket? The files are already gone; this only tidies up the library.`)) return;
    setCleaning(true);
    try {
      const res = await api.removeMissingMedia();
      setMessage({ type: 'success', text: `Removed ${res.removed} missing image record${res.removed === 1 ? '' : 's'}.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Could not remove the missing records.') });
    } finally {
      setCleaning(false);
    }
  }

  // One line per section that still shows a deleted file.
  const brokenBySection = Object.values(
    brokenSections.reduce<Record<string, { section: string; page: string; count: number }>>((acc, b) => {
      const k = `${b.page}.${b.key}`;
      acc[k] = acc[k] ? { ...acc[k], count: acc[k].count + 1 } : { section: b.section, page: b.page, count: 1 };
      return acc;
    }, {}),
  );

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Content"
        title="Media Library"
        subtitle="Photos for the Hall of Fame gallery and the page sections. Images are stored in the customer_trip_images bucket; hidden ones stay stored but aren't shown to visitors."
        note={!editable ? 'You have read-only access to the media library.' : undefined}
        actions={
          editable ? (
            <button type="button" onClick={() => setUploadOpen(true)} className={BTN_PRIMARY}>
              <Upload className="h-4 w-4" /> Upload images
            </button>
          ) : undefined
        }
        stats={
          <>
            <HeroStat icon={Images} label="Images" value={items ? stats.total : null} />
            <HeroStat icon={Eye} label="Visible / hidden" value={items ? `${stats.visible} / ${stats.hidden}` : null} />
            {stats.missing > 0 && <HeroStat icon={FileX2} label="Missing from bucket" value={stats.missing} />}
            <HeroStat icon={HardDrive} label="Total size" value={items ? formatBytes(stats.size) : null} />
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {message && (
        <div className="mb-4">
          <Alert tone={message.type} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </div>
      )}

      {(stats.missing > 0 || brokenBySection.length > 0) && (
        <div className="mb-4">
          <Alert tone="warn">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {stats.missing > 0 && (
                  <p>
                    {stats.missing === 1
                      ? '1 image was deleted from the bucket outside the admin panel. Visitors no longer see it.'
                      : `${stats.missing} images were deleted from the bucket outside the admin panel. Visitors no longer see them.`}
                  </p>
                )}
                {brokenBySection.length > 0 && (
                  <div className="mt-2 font-normal">
                    <p className="font-semibold">Still used on the site - choose a replacement image there:</p>
                    <ul className="mt-1 space-y-0.5">
                      {brokenBySection.map((b) => (
                        <li key={`${b.page}-${b.section}`}>
                          <Link to={`/site-content/${b.page}`} className="font-bold underline hover:no-underline">
                            {b.section}
                          </Link>
                          <span className="opacity-80">
                            {` (${b.page.replace('_', ' ').toLowerCase()} · ${b.count} image${b.count === 1 ? '' : 's'})`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {editable && stats.missing > 0 && (
                <button type="button" onClick={removeMissing} disabled={cleaning} className={`${BTN_DANGER} ${BTN_SM} shrink-0`}>
                  <Trash2 className="h-3.5 w-3.5" /> {cleaning ? 'Removing…' : 'Remove missing records'}
                </button>
              )}
            </div>
          </Alert>
        </div>
      )}

      <Panel
        title="Images"
        aside={
          <Tabs
            label="Collection"
            active={tab}
            onChange={(t) => {
              setTab(t);
              setSelected(new Set());
            }}
            options={[
              { key: 'HALL_OF_FAME', label: 'Hall of Fame', count: items?.filter((m) => m.collection === 'HALL_OF_FAME').length },
              { key: 'LIBRARY', label: 'Library', count: items?.filter((m) => m.collection === 'LIBRARY').length },
              { key: 'ALL', label: 'All', count: items?.length },
            ]}
          />
        }
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-inactive" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, caption, category or file" aria-label="Search images" className={`${INPUT} pl-10`} />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={`${SELECT} sm:w-48`}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {editable && selected.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-primary-tint px-4 py-2.5">
            <span className="flex-1 text-sm font-bold text-links">{selected.size} selected</span>
            <button type="button" onClick={() => bulkVisibility(true)} disabled={busy !== null} className={`${BTN_GHOST} ${BTN_SM}`}>
              <Eye className="h-3.5 w-3.5" /> Show
            </button>
            <button type="button" onClick={() => bulkVisibility(false)} disabled={busy !== null} className={`${BTN_GHOST} ${BTN_SM}`}>
              <EyeOff className="h-3.5 w-3.5" /> Hide
            </button>
            <button type="button" onClick={bulkDelete} disabled={busy !== null} className={`${BTN_DANGER} ${BTN_SM}`}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-bold text-inactive hover:text-foreground">
              Clear
            </button>
          </div>
        )}

        {!items && !error ? (
          <Spinner label="Loading images…" />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Images}
            title="No images here"
            message={search || category ? 'Try another search or category.' : 'Upload photos to add them to this collection.'}
            action={
              editable && !search && !category ? (
                <button type="button" onClick={() => setUploadOpen(true)} className={BTN_PRIMARY}>
                  <Upload className="h-4 w-4" /> Upload images
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((m) => {
              const siblings = (items ?? []).filter((x) => x.collection === m.collection).sort((a, b) => a.sortOrder - b.sortOrder);
              const pos = siblings.findIndex((x) => x.id === m.id);
              return (
                <li key={m.id} className={`group overflow-hidden ${CARD} ${!m.isVisible ? 'opacity-75' : ''} ${selected.has(m.id) ? 'ring-2 ring-links' : ''}`}>
                  <div className="relative">
                    {m.missing ? (
                      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 bg-slate-100 text-inactive">
                        <FileX2 className="h-8 w-8" />
                        <span className="text-xs font-bold">File deleted</span>
                      </div>
                    ) : (
                      <img src={m.url} alt={m.title} loading="lazy" className="aspect-[4/3] w-full bg-slate-100 object-cover" />
                    )}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      <Badge tone={m.collection === 'HALL_OF_FAME' ? 'purple' : 'slate'}>{COLLECTION_LABEL[m.collection]}</Badge>
                      {m.missing && <Badge tone="red">Missing from bucket</Badge>}
                      {!m.isVisible && !m.missing && <Badge tone="amber">Hidden</Badge>}
                    </div>
                    {editable && (
                      <label className="absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/90 shadow">
                        <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} aria-label={`Select ${m.title}`} className="h-4 w-4 accent-primary-button" />
                      </label>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="truncate text-sm font-extrabold text-foreground" title={m.title}>
                      {m.title}
                    </p>
                    {m.caption && <p className="mt-0.5 line-clamp-2 text-xs text-inactive">{m.caption}</p>}
                    <p className="mt-1.5 text-[11px] text-inactive">
                      {[m.category, formatBytes(m.sizeBytes), m.width && m.height ? `${m.width}×${m.height}` : null, `added ${timeAgo(m.createdAt)}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-tertiary-button pt-3">
                      {editable && (
                        <Switch
                          checked={m.isVisible}
                          onChange={(v) => patch(m, { isVisible: v }, `${m.title} is now ${v ? 'visible' : 'hidden'}.`)}
                          label={`Show ${m.title} to visitors`}
                          disabled={busy !== null}
                          onLabel="Visible"
                          offLabel="Hidden"
                        />
                      )}
                      <span className="flex-1" />
                      {editable && (
                        <>
                          <IconButton label="Move earlier" onClick={() => move(m, -1)} disabled={busy !== null || pos <= 0}>
                            <ArrowLeft className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Move later" onClick={() => move(m, 1)} disabled={busy !== null || pos === siblings.length - 1}>
                            <ArrowRight className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Edit details" onClick={() => setEditing(m)} disabled={busy !== null}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                        </>
                      )}
                      <IconButton label="Copy URL" onClick={() => copyUrl(m)} disabled={m.missing}>
                        <Copy className="h-4 w-4" />
                      </IconButton>
                      {m.missing ? (
                        <span title="File deleted" aria-hidden="true" className={`${ICON_BTN} pointer-events-none opacity-30`}>
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      ) : (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" title="Open original" aria-label={`Open ${m.title}`} className={ICON_BTN}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {editable && (
                        <IconButton label="Delete" onClick={() => setDeleting(m)} disabled={busy !== null} danger>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {editing && (
        <EditModal
          asset={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(a) => {
            replace(a);
            setEditing(null);
            setMessage({ type: 'success', text: `${a.title} updated.` });
          }}
        />
      )}
      {deleting && (
        <DeleteModal
          asset={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(a) => {
            setItems((list) => (list ? list.filter((m) => m.id !== a.id) : list));
            setDeleting(null);
            setMessage({ type: 'success', text: `${a.title} was deleted from the bucket.` });
          }}
        />
      )}
      {uploadOpen && (
        <UploadModal
          categories={categories}
          defaultCollection={tab === 'ALL' ? 'HALL_OF_FAME' : tab}
          onClose={(uploaded) => {
            setUploadOpen(false);
            if (uploaded) {
              load();
              setMessage({ type: 'success', text: `${uploaded} image${uploaded === 1 ? '' : 's'} uploaded to the bucket.` });
            }
          }}
        />
      )}
    </div>
  );
}

const ICON_BTN =
  'flex h-8 w-8 items-center justify-center rounded-lg text-inactive transition-colors hover:bg-primary-tint hover:text-links disabled:pointer-events-none disabled:opacity-30';

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`${ICON_BTN} ${danger ? 'hover:!bg-danger/10 hover:!text-danger' : ''}`}
    >
      {children}
    </button>
  );
}

function EditModal({ asset, categories, onClose, onSaved }: { asset: MediaAsset; categories: string[]; onClose: () => void; onSaved: (a: MediaAsset) => void }) {
  const [title, setTitle] = useState(asset.title);
  const [caption, setCaption] = useState(asset.caption ?? '');
  const [category, setCategory] = useState(asset.category ?? '');
  const [collection, setCollection] = useState<MediaCollection>(asset.collection);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.updateMedia(asset.id, { title: title.trim(), caption: caption.trim() || null, category: category.trim() || null, collection }));
    } catch (err) {
      setError(errorText(err, 'Could not save.'));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit image details"
      onClose={() => !saving && onClose()}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !title.trim()} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <img src={asset.url} alt={asset.title} className="mb-4 aspect-[16/9] w-full rounded-xl object-cover" />
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label htmlFor="media-title" className={FIELD_LABEL}>
            Title (alt text)
          </label>
          <input id="media-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={INPUT} />
        </div>
        <div>
          <label htmlFor="media-caption" className={FIELD_LABEL}>
            Caption
          </label>
          <textarea id="media-caption" rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} className={`${INPUT} resize-y`} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="media-category" className={FIELD_LABEL}>
              Category / destination
            </label>
            <input id="media-category" list="media-categories" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} className={INPUT} />
            <datalist id="media-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="media-collection" className={FIELD_LABEL}>
              Collection
            </label>
            <select id="media-collection" value={collection} onChange={(e) => setCollection(e.target.value as MediaCollection)} className={SELECT}>
              <option value="HALL_OF_FAME">Hall of Fame gallery</option>
              <option value="LIBRARY">Library (for page sections)</option>
            </select>
          </div>
        </div>
        <p className={`${LABEL} !normal-case !tracking-normal`}>
          File: <span className="font-mono">{asset.objectName}</span>
        </p>
      </div>
    </Modal>
  );
}

function DeleteModal({ asset, onClose, onDeleted }: { asset: MediaAsset; onClose: () => void; onDeleted: (a: MediaAsset) => void }) {
  const [usedIn, setUsedIn] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMediaUsage(asset.id)
      .then((r) => setUsedIn(r.usedIn))
      .catch(() => setUsedIn([]));
  }, [asset.id]);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteMedia(asset.id, (usedIn?.length ?? 0) > 0);
      onDeleted(asset);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        const data = err.data as { usedIn?: string[] } | null;
        setUsedIn(data?.usedIn ?? []);
        setError(err.message);
      } else setError(errorText(err, 'Could not delete the image.'));
      setDeleting(false);
    }
  }

  const inUse = (usedIn?.length ?? 0) > 0;
  return (
    <Modal
      title="Delete image"
      onClose={() => !deleting && onClose()}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={deleting} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="button" onClick={remove} disabled={deleting || usedIn === null} className={BTN_DANGER}>
            <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : inUse ? 'Delete anyway' : 'Delete permanently'}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <img src={asset.url} alt={asset.title} className="h-20 w-28 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="font-extrabold text-foreground">{asset.title}</p>
          <p className="mt-1 text-sm text-inactive">
            This permanently removes the file <span className="font-mono text-xs">{asset.objectName}</span> from the customer_trip_images bucket. It can't be undone. To keep it but stop showing it, hide it instead.
          </p>
        </div>
      </div>
      <div className="mt-4">
        {usedIn === null ? (
          <Spinner label="Checking where this image is used…" />
        ) : inUse ? (
          <Alert tone="warn">
            <p>This image is shown in:</p>
            <ul className="mt-1 list-disc pl-5 font-normal">
              {usedIn.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
            <p className="mt-1 font-normal">Deleting it leaves a broken image there until you pick a replacement in Site Content.</p>
          </Alert>
        ) : (
          <Alert tone="info">Not used in any page section.</Alert>
        )}
        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}

function UploadModal({ categories, defaultCollection, onClose }: { categories: string[]; defaultCollection: MediaCollection; onClose: (uploaded: number) => void }) {
  const [files, setFiles] = useState<PendingUpload[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedRef = useRef(0);

  // Latest list for the sequential upload loop, and to release preview
  // object URLs when the modal goes away.
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl)), []);

  function add(list: FileList | null) {
    if (!list) return;
    const bad: string[] = [];
    const good: PendingUpload[] = [];
    for (const file of Array.from(list)) {
      const problem = checkImageFile(file);
      if (problem) bad.push(`${file.name}: ${problem}`);
      else
        good.push({
          id: `u${++uploadSeq}`,
          file,
          title: titleFromFileName(file.name),
          category: '',
          collection: defaultCollection,
          isVisible: true,
          status: 'ready',
          previewUrl: URL.createObjectURL(file),
        });
    }
    setRejected(bad);
    setFiles((f) => [...f, ...good]);
  }

  const update = (id: string, patch: Partial<PendingUpload>) => setFiles((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  async function uploadAll() {
    setRunning(true);
    for (const f of filesRef.current.filter((x) => x.status === 'ready' || x.status === 'error')) {
      if (!f.title.trim()) {
        update(f.id, { status: 'error', error: 'Add a title' });
        continue;
      }
      update(f.id, { status: 'uploading', error: undefined });
      try {
        const img = await prepareImage(f.file);
        await api.uploadMedia(img.blob, img.fileName, {
          title: f.title.trim(),
          category: f.category.trim() || undefined,
          collection: f.collection,
          isVisible: f.isVisible,
          width: img.width,
          height: img.height,
        });
        uploadedRef.current++;
        update(f.id, { status: 'done' });
      } catch (err) {
        update(f.id, { status: 'error', error: errorText(err, 'Upload failed') });
      }
    }
    setRunning(false);
  }

  const pending = files.filter((f) => f.status === 'ready' || f.status === 'error').length;
  const allDone = files.length > 0 && files.every((f) => f.status === 'done');

  return (
    <Modal
      title="Upload images"
      onClose={() => !running && onClose(uploadedRef.current)}
      wide
      footer={
        <>
          <button type="button" onClick={() => onClose(uploadedRef.current)} disabled={running} className={BTN_GHOST}>
            {allDone ? 'Done' : 'Close'}
          </button>
          {!allDone && (
            <button type="button" onClick={uploadAll} disabled={running || pending === 0} className={BTN_PRIMARY}>
              <Upload className="h-4 w-4" /> {running ? 'Uploading…' : `Upload ${pending || ''} image${pending === 1 ? '' : 's'}`}
            </button>
          )}
        </>
      }
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!running) add(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${dragging ? 'border-links bg-primary-tint' : 'border-tertiary-button bg-background'}`}
      >
        <Upload className="h-8 w-8 text-links" />
        <p className="mt-2 text-sm font-bold text-foreground">Drag & drop photos here</p>
        <p className="text-xs text-inactive">JPEG, PNG or WebP, up to 10 MB each. Large photos are resized to 2400px.</p>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={running} className={`${BTN_GHOST} ${BTN_SM} mt-3`}>
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {rejected.length > 0 && (
        <div className="mt-3">
          <Alert tone="error" onClose={() => setRejected([])}>
            <ul className="list-disc pl-5 font-normal">
              {rejected.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      <datalist id="upload-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {files.length > 0 && (
        <ul className="mt-4 space-y-3">
          {files.map((f) => {
            const locked = running || f.status === 'done' || f.status === 'uploading';
            return (
              <li key={f.id} className="flex gap-3 rounded-xl border border-tertiary-button p-3">
                <img src={f.previewUrl} alt="" className="h-20 w-24 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={f.title}
                      onChange={(e) => update(f.id, { title: e.target.value })}
                      disabled={locked}
                      aria-label={`Title for ${f.file.name}`}
                      placeholder="Title (alt text)"
                      className={`${INPUT} !py-1.5`}
                    />
                    <StatusIcon status={f.status} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      list="upload-categories"
                      value={f.category}
                      onChange={(e) => update(f.id, { category: e.target.value })}
                      disabled={locked}
                      aria-label={`Category for ${f.file.name}`}
                      placeholder="Category (e.g. Kerala)"
                      className={`${INPUT} !py-1.5`}
                    />
                    <select
                      value={f.collection}
                      onChange={(e) => update(f.id, { collection: e.target.value as MediaCollection })}
                      disabled={locked}
                      aria-label={`Collection for ${f.file.name}`}
                      className={`${SELECT} !py-1.5`}
                    >
                      <option value="HALL_OF_FAME">Hall of Fame</option>
                      <option value="LIBRARY">Library</option>
                    </select>
                    <Switch checked={f.isVisible} onChange={(v) => update(f.id, { isVisible: v })} disabled={locked} label={`Visible: ${f.file.name}`} onLabel="Visible" offLabel="Hidden" />
                  </div>
                  <p className="text-[11px] text-inactive">
                    {f.file.name} · {formatBytes(f.file.size)}
                    {f.error && <span className="ml-1 font-semibold text-danger">· {f.error}</span>}
                  </p>
                </div>
                {f.status === 'ready' && !running && (
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(f.previewUrl);
                      setFiles((list) => list.filter((x) => x.id !== f.id));
                    }}
                    aria-label={`Remove ${f.file.name}`}
                    className="self-start text-inactive hover:text-danger"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

function StatusIcon({ status }: { status: PendingUpload['status'] }) {
  if (status === 'uploading') return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-links" aria-label="Uploading" />;
  if (status === 'done') return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Uploaded" />;
  if (status === 'error') return <XCircle className="h-5 w-5 shrink-0 text-danger" aria-label="Failed" />;
  return null;
}
