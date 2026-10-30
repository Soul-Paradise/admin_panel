import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Home,
  Images,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { api, type Destination, type DestinationInput, type DestinationList } from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import ImagePicker from '../components/ImagePicker';
import { Alert, Badge, EmptyState, HeroStat, Modal, PageHeader, Panel, Spinner } from '../components/ui';
import { BTN_DANGER, BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, BTN_SM, FIELD_LABEL, INPUT, PAGE } from '../lib/ui-styles';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

/** Card gradients when a destination has no photo (same palette as the site's trip cards). */
const GRADIENTS = [
  'from-blue-500 to-indigo-700',
  'from-emerald-500 to-teal-700',
  'from-orange-500 to-red-600',
  'from-purple-500 to-violet-700',
  'from-teal-500 to-cyan-700',
];

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Destinations group the Hall of Fame photos (by category). Up to five are
 * featured on the home page ("Trips our travellers loved") in the order chosen
 * here; with none chosen, the first five alphabetically are shown.
 */
export default function Destinations() {
  const { canWrite } = useAccess();
  const editable = canWrite('SITE_CONTENT');

  const [data, setData] = useState<DestinationList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  /** Draft home selection (ids, display order) until saved. */
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Destination | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Destination | null>(null);

  const apply = useCallback((d: DestinationList) => {
    setData(d);
    const shown = d.destinations.filter((x) => x.shownOnHome);
    // Featured rows follow their chosen order; the default selection is alphabetical.
    const ordered = d.usingDefault ? shown : [...shown].sort((a, b) => a.featuredOrder - b.featuredOrder);
    setDraft(ordered.map((x) => x.id));
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api.getDestinations());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, 'Could not load destinations'));
    }
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const byId = useMemo(() => new Map((data?.destinations ?? []).map((d) => [d.id, d])), [data]);
  const max = data?.maxFeatured ?? 5;

  const savedIds = useMemo(() => {
    if (!data) return [];
    const shown = data.destinations.filter((x) => x.shownOnHome);
    return (data.usingDefault ? shown : [...shown].sort((a, b) => a.featuredOrder - b.featuredOrder)).map((x) => x.id);
  }, [data]);
  const dirty = !sameIds(draft, savedIds);

  const stats = useMemo(() => {
    const list = data?.destinations ?? [];
    return { count: list.length, photos: list.reduce((n, d) => n + d.photoCount, 0) };
  }, [data]);

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = [...d];
      const j = i + dir;
      if (j < 0 || j >= next.length) return d;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeFromHome = (id: string) => setDraft((d) => d.filter((x) => x !== id));
  const addToHome = (id: string) => setDraft((d) => (d.length >= max || d.includes(id) ? d : [...d, id]));

  async function saveSelection(ids: string[], text: string) {
    setSaving(true);
    try {
      apply(await api.setFeaturedDestinations(ids));
      setMessage({ type: 'success', text });
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Could not save the home page selection') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${PAGE} ${dirty && editable ? 'pb-28' : ''}`}>
      <PageHeader
        eyebrow="Content"
        title="Destinations"
        subtitle={'Destinations group the Hall of Fame photos by place. Five of them are shown on the home page in "Trips our travellers loved" - choose which, in what order, and edit their text and cover photo.'}
        note={!editable ? 'You have read-only access.' : undefined}
        actions={
          editable ? (
            <button type="button" onClick={() => setEditing('new')} className={BTN_PRIMARY}>
              <Plus className="h-4 w-4" /> New destination
            </button>
          ) : undefined
        }
        stats={
          <>
            <HeroStat icon={MapPinned} label="Destinations" value={data ? stats.count : null} />
            <HeroStat icon={Home} label="Shown on home" value={data ? `${draft.length} / ${max}` : null} />
            <HeroStat icon={Images} label="Gallery photos" value={data ? stats.photos : null} />
          </>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.type} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </div>
      )}
      {loadError && (
        <div className="mb-4">
          <Alert tone="error">{loadError}</Alert>
        </div>
      )}

      {!data && !loadError ? (
        <Panel>
          <Spinner label="Loading destinations…" />
        </Panel>
      ) : data ? (
        <div className="space-y-6">
          {/* ---------------------------------------------------- home selection */}
          <Panel
            title="On the home page"
            aside={
              data.usingDefault && !dirty ? (
                <Badge tone="blue">Default selection</Badge>
              ) : dirty ? (
                <Badge tone="amber">Unsaved changes</Badge>
              ) : (
                <Badge tone="green">Custom selection</Badge>
              )
            }
          >
            <p className="mb-4 text-sm text-inactive">
              {data.usingDefault
                ? `Default selection: first ${max} alphabetically. Change the order or the destinations below, then save to make it your own.`
                : `These ${draft.length} cards are shown in this order. "Reset to default" goes back to the first ${max} alphabetically.`}
            </p>

            {draft.length === 0 ? (
              <EmptyState icon={Home} title="No destinations selected" message={`Saving an empty selection shows the first ${max} alphabetically.`} />
            ) : (
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {draft.map((id, i) => {
                  const d = byId.get(id);
                  if (!d) return null;
                  return (
                    <li key={id} className="flex flex-col">
                      <TripCard d={d} index={i} />
                      {editable && (
                        <div className="mt-2 flex items-center justify-center gap-1">
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${d.title} left`} className={`${BTN_GHOST} ${BTN_SM} !px-2`}>
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => removeFromHome(id)} aria-label={`Remove ${d.title} from the home page`} className={`${BTN_GHOST} ${BTN_SM}`}>
                            <X className="h-3.5 w-3.5" /> Remove
                          </button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label={`Move ${d.title} right`} className={`${BTN_GHOST} ${BTN_SM} !px-2`}>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            {editable && (
              <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-tertiary-button pt-4">
                {dirty && (
                  <button type="button" onClick={() => setDraft(savedIds)} disabled={saving} className={BTN_GHOST}>
                    Discard changes
                  </button>
                )}
                {!data.usingDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Go back to showing the first ${max} destinations alphabetically?`)) saveSelection([], 'Home page reset to the default selection.');
                    }}
                    disabled={saving}
                    className={BTN_OUTLINE}
                  >
                    <RotateCcw className="h-4 w-4" /> Reset to default
                  </button>
                )}
                <button type="button" onClick={() => saveSelection(draft, 'Home page selection saved - the website updates within a minute.')} disabled={saving || !dirty} className={BTN_PRIMARY}>
                  {saving ? 'Saving…' : 'Save selection'}
                </button>
              </div>
            )}
          </Panel>

          {/* ------------------------------------------------------ all of them */}
          <Panel title="All destinations" aside={<span className="text-xs font-semibold text-inactive">{data.destinations.length} total</span>}>
            {data.destinations.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No destinations yet"
                message="Upload Hall of Fame photos with a category, or create a destination here."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.destinations.map((d) => {
                  const onHome = draft.includes(d.id);
                  const full = draft.length >= max;
                  return (
                    <li key={d.id} className="flex gap-4 rounded-2xl border border-tertiary-button bg-peace p-3 transition-colors hover:border-links/30">
                      <Thumb d={d} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-extrabold text-foreground">{d.title}</p>
                          {onHome && <Badge tone="green">On home #{draft.indexOf(d.id) + 1}</Badge>}
                        </div>
                        <p className="truncate text-xs text-inactive">
                          Photo category: <span className="font-semibold text-foreground">{d.name}</span>
                        </p>
                        {d.subtitle && <p className="mt-0.5 truncate text-sm text-inactive">{d.subtitle}</p>}
                        <p className="mt-1 text-xs text-inactive">
                          {d.photoCount} photo{d.photoCount === 1 ? '' : 's'}
                          {d.photoCount !== d.visiblePhotoCount && ` (${d.visiblePhotoCount} visible)`}
                        </p>
                        {d.coverMissing && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-danger">
                            <AlertTriangle className="h-3.5 w-3.5" /> Cover deleted - choose another
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {editable &&
                            (onHome ? (
                              <button type="button" onClick={() => removeFromHome(d.id)} className={`${BTN_GHOST} ${BTN_SM}`}>
                                Remove from home
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToHome(d.id)}
                                disabled={full}
                                title={full ? `The home page shows ${max} destinations. Remove one first.` : undefined}
                                className={`${BTN_OUTLINE} ${BTN_SM}`}
                              >
                                <Plus className="h-3.5 w-3.5" /> Add to home
                              </button>
                            ))}
                          {editable && (
                            <button type="button" onClick={() => setEditing(d)} className={`${BTN_GHOST} ${BTN_SM}`}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                          )}
                          <Link to={`/media?category=${encodeURIComponent(d.name)}`} className={`${BTN_GHOST} ${BTN_SM}`}>
                            <Images className="h-3.5 w-3.5" /> View photos
                          </Link>
                          {editable && (
                            <button type="button" onClick={() => setDeleting(d)} className={`${BTN_GHOST} ${BTN_SM} hover:!border-danger hover:!text-danger`}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {editable && draft.length >= max && (
              <p className="mt-3 text-xs text-inactive">The home page shows {max} destinations. Remove one from the selection to add another.</p>
            )}
          </Panel>
        </div>
      ) : null}

      {/* Sticky save bar for the home selection */}
      {editable && dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-tertiary-button bg-peace/95 px-4 py-3 shadow-[0_-4px_16px_rgba(14,34,56,0.06)] backdrop-blur-sm lg:left-[var(--sidebar-w,17rem)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
            <p className="flex-1 text-sm font-semibold text-foreground">Unsaved home page selection ({draft.length} / {max})</p>
            <button type="button" onClick={() => setDraft(savedIds)} disabled={saving} className={`${BTN_GHOST} ${BTN_SM}`}>
              Discard
            </button>
            <button type="button" onClick={() => saveSelection(draft, 'Home page selection saved - the website updates within a minute.')} disabled={saving} className={`${BTN_PRIMARY} ${BTN_SM}`}>
              {saving ? 'Saving…' : 'Save selection'}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <DestinationForm
          destination={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (text) => {
            setEditing(null);
            setMessage({ type: 'success', text });
            await load();
          }}
        />
      )}

      {deleting && (
        <Modal
          title={`Delete ${deleting.title}?`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button type="button" onClick={() => setDeleting(null)} className={BTN_GHOST}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_DANGER}
                onClick={async () => {
                  const d = deleting;
                  setDeleting(null);
                  try {
                    await api.deleteDestination(d.id);
                    setMessage({ type: 'success', text: `${d.title} deleted.` });
                    await load();
                  } catch (err) {
                    setMessage({ type: 'error', text: errorText(err, 'Could not delete the destination') });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete destination
              </button>
            </>
          }
        >
          <p className="text-sm text-foreground">
            The destination is removed{deleting.shownOnHome ? ' and taken off the home page' : ''}. Its{' '}
            <strong>{deleting.photoCount}</strong> Hall of Fame photo{deleting.photoCount === 1 ? '' : 's'} stay in the gallery but lose the
            category "{deleting.name}", so they no longer show under a destination filter.
          </p>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Mimics the site's "Trips our travellers loved" card. */
function TripCard({ d, index }: { d: Destination; index: number }) {
  const [broken, setBroken] = useState(false);
  const img = d.resolvedImage && !broken ? d.resolvedImage : null;
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-br shadow-md ${GRADIENTS[index % GRADIENTS.length]}`}>
      {img ? (
        <img src={img} alt="" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <MapPin className="absolute top-3 right-3 h-6 w-6 text-white/50" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <p className="truncate text-sm font-extrabold">{d.title}</p>
        {d.subtitle && <p className="line-clamp-2 text-[11px] text-white/80">{d.subtitle}</p>}
      </div>
      <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-extrabold text-ink">#{index + 1}</span>
    </div>
  );
}

function Thumb({ d }: { d: Destination }) {
  const [broken, setBroken] = useState(false);
  if (d.resolvedImage && !broken) {
    return <img src={d.resolvedImage} alt="" onError={() => setBroken(true)} className="h-24 w-24 shrink-0 rounded-xl object-cover" />;
  }
  return (
    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 text-inactive">
      <MapPin className="h-7 w-7" />
    </span>
  );
}

// ---------------------------------------------------------------------------

function DestinationForm({
  destination,
  onClose,
  onSaved,
}: {
  destination: Destination | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<DestinationInput>(() => ({
    name: destination?.name ?? '',
    title: destination?.title ?? '',
    subtitle: destination?.subtitle ?? '',
    description: destination?.description ?? '',
    coverImageUrl: destination?.coverImageUrl ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  /** Name kept in step with the title for new destinations until edited. */
  const [nameEdited, setNameEdited] = useState(!!destination);

  const set = <K extends keyof DestinationInput>(key: K, value: DestinationInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const problems: string[] = [];
  if (!form.title.trim()) problems.push('Title is required');
  if (!form.name.trim()) problems.push('Photo category is required');
  if (form.title.trim().length > 120) problems.push('Title is over 120 characters');
  if (form.name.trim().length > 80) problems.push('Photo category is over 80 characters');
  if ((form.subtitle ?? '').trim().length > 200) problems.push('Subtitle is over 200 characters');
  if ((form.description ?? '').trim().length > 2000) problems.push('Description is over 2000 characters');
  const renamed = !!destination && form.name.trim() !== destination.name;

  async function save() {
    setTouched(true);
    if (problems.length) return;
    setSaving(true);
    setError(null);
    const payload: DestinationInput = {
      name: form.name.trim(),
      title: form.title.trim(),
      subtitle: (form.subtitle ?? '').trim() || null,
      description: (form.description ?? '').trim() || null,
      coverImageUrl: (form.coverImageUrl ?? '').trim() || null,
    };
    try {
      if (destination) {
        await api.updateDestination(destination.id, payload);
        onSaved(`${payload.title} saved.`);
      } else {
        await api.createDestination(payload);
        onSaved(`${payload.title} created. Add it to the home page or tag Hall of Fame photos with "${payload.name}".`);
      }
    } catch (err) {
      setError(errorText(err, 'Could not save the destination'));
      setSaving(false);
    }
  }

  const photos = destination?.photos ?? [];
  const cover = form.coverImageUrl ?? '';

  return (
    <Modal
      title={destination ? `Edit ${destination.title}` : 'New destination'}
      onClose={() => !saving && onClose()}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || (touched && problems.length > 0)} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : destination ? 'Save destination' : 'Create destination'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {touched && problems.length > 0 && (
          <Alert tone="error">
            <ul className="list-disc pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dst-title" className={FIELD_LABEL}>
              Title
            </label>
            <input
              id="dst-title"
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value);
                if (!nameEdited) set('name', e.target.value);
              }}
              maxLength={120}
              placeholder="e.g. North East"
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="dst-name" className={FIELD_LABEL}>
              Photo category
            </label>
            <input
              id="dst-name"
              value={form.name}
              onChange={(e) => {
                setNameEdited(true);
                set('name', e.target.value);
              }}
              maxLength={80}
              placeholder="e.g. Northeast"
              className={INPUT}
            />
          </div>
        </div>
        <p className={`-mt-2 text-xs ${renamed ? 'font-semibold text-amber-700' : 'text-inactive'}`}>
          {renamed
            ? `Renaming re-tags the ${destination?.photoCount ?? 0} Hall of Fame photo(s) from "${destination?.name}" to "${form.name.trim()}".`
            : 'Must match the category of this destination\'s Hall of Fame photos in the Media Library.'}
        </p>

        <div>
          <label htmlFor="dst-subtitle" className={FIELD_LABEL}>
            Subtitle <span className="font-normal text-inactive">(shown on the card)</span>
          </label>
          <input id="dst-subtitle" value={form.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} maxLength={200} placeholder="e.g. Hills, monasteries & sunrises" className={INPUT} />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="dst-description" className={FIELD_LABEL}>
              Description <span className="font-normal text-inactive">(optional)</span>
            </label>
            <span className="text-xs text-inactive">{(form.description ?? '').length}/2000</span>
          </div>
          <textarea id="dst-description" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={4} className={`${INPUT} resize-y leading-relaxed`} />
        </div>

        <div>
          <p className={FIELD_LABEL}>Cover photo</p>
          {photos.length > 0 && (
            <>
              <p className="mb-2 text-xs text-inactive">Pick one of this destination's photos:</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set('coverImageUrl', p.url)}
                    aria-pressed={cover === p.url}
                    title={p.title}
                    className={`relative aspect-square overflow-hidden rounded-lg ring-2 transition ${cover === p.url ? 'ring-links' : 'ring-transparent hover:ring-links/40'}`}
                  >
                    <img src={p.url} alt={p.title} className={`h-full w-full object-cover ${p.isVisible ? '' : 'opacity-50'}`} />
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="mt-3">
            <ImagePicker label="Or choose from the library" value={cover} onChange={(url) => set('coverImageUrl', url)} clearable />
          </div>
          <button
            type="button"
            onClick={() => set('coverImageUrl', '')}
            disabled={!cover}
            className={`${BTN_GHOST} ${BTN_SM} mt-2`}
          >
            Use the newest photo automatically
          </button>
          {!cover && <p className="mt-1 text-xs text-inactive">No cover chosen: the newest visible photo of this destination is used, or a coloured card if there are none.</p>}
        </div>
      </div>
    </Modal>
  );
}
