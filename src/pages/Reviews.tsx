import { useCallback, useEffect, useState } from 'react';
import { Clock, FileText, MapPin, MessageSquareQuote, Pencil, Pin, PinOff, Plus, Star } from 'lucide-react';
import { api, type Testimonial, type TestimonialInput } from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import ImagePicker from '../components/ImagePicker';
import Switch from '../components/Switch';
import { Alert, Badge, EmptyState, HeroStat, Modal, PageHeader, Pagination, Panel, Spinner, Tabs } from '../components/ui';
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, BTN_SM, BTN_SUCCESS, CARD, FIELD_LABEL, INPUT, PAGE } from '../lib/ui-styles';

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

/** Suggestions for the service field (free text is still allowed). */
const SERVICES = ['Flights', 'Hotels', 'Holiday Packages', 'Travel Insurance', 'Visa'];

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="text-sm leading-none tracking-tight" title={`${filled} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= filled ? 'text-warn' : 'text-tertiary-button'}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Reviewer photo, falling back to initials (also when the file is gone). */
function Avatar({ t }: { t: Testimonial }) {
  const [broken, setBroken] = useState(false);
  if (t.photoUrl && !broken) {
    return <img src={t.photoUrl} alt="" onError={() => setBroken(true)} className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-tertiary-button" />;
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-button text-sm font-extrabold text-peace">
      {initialsOf(t.name)}
    </span>
  );
}

export default function Reviews() {
  const { canWrite, canRead } = useAccess();
  const writable = canWrite('REVIEWS');

  const [tab, setTab] = useState<TabKey>('pending');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Testimonial[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [tabTotal, setTabTotal] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  /** null = closed; 'new' = add; otherwise the review being edited. */
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null);
  const [destinations, setDestinations] = useState<string[] | null>(null);

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
      setTabTotal(res.pagination.total);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to load reviews') });
      setItems([]);
      setTotalPages(1);
      setTabTotal(0);
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

  // Destination suggestions come from the Destinations page, if this admin can see it.
  const canSeeDestinations = canRead('SITE_CONTENT');
  useEffect(() => {
    if (!canSeeDestinations) return;
    api
      .getDestinations()
      .then((d) => setDestinations(d.destinations.map((x) => x.title)))
      .catch(() => setDestinations(null));
  }, [canSeeDestinations]);

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
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to update review') });
    } finally {
      setBusyId(null);
    }
  }

  async function handlePin(t: Testimonial) {
    setBusyId(t.id);
    try {
      await api.updateTestimonial(t.id, { isPinned: !t.isPinned });
      setMessage({ type: 'success', text: t.isPinned ? 'Review unpinned' : 'Review pinned - it is now shown first on the site' });
      await refresh();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to update review') });
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
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to delete review') });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Content"
        title="Reviews"
        subtitle="Moderate customer testimonials and add, edit, pin or remove the reviews shown on the Home and Hall of Fame pages."
        note={!writable ? 'Read-only access' : undefined}
        actions={
          <>
            {/* Filter tabs - the pending count only shows while there's something to moderate. */}
            <Tabs
              label="Filter reviews"
              variant="glass"
              active={tab}
              onChange={selectTab}
              options={TABS.map((t) => ({
                key: t.key,
                label: t.label,
                count: t.key === 'pending' && pendingCount !== null && pendingCount > 0 ? pendingCount : undefined,
              }))}
            />
            {writable && (
              <button type="button" onClick={() => setEditing('new')} className={BTN_PRIMARY}>
                <Plus className="h-4 w-4" /> Add review
              </button>
            )}
          </>
        }
        stats={
          <>
            <HeroStat icon={Clock} label="Pending" value={pendingCount === null ? null : pendingCount.toLocaleString('en-IN')} />
            <HeroStat
              icon={FileText}
              label={`${TABS.find((t) => t.key === tab)?.label ?? ''} reviews`}
              value={loading || tabTotal === null ? null : tabTotal.toLocaleString('en-IN')}
            />
            <HeroStat icon={MessageSquareQuote} label="Page" value={loading ? null : `${page} of ${totalPages}`} />
          </>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.type}>{message.text}</Alert>
        </div>
      )}

      <Panel
        title="Reviews"
        aside={tabTotal !== null && !loading ? <Badge tone="blue">{tabTotal.toLocaleString('en-IN')}</Badge> : undefined}
      >
        {loading ? (
          <Spinner label="Loading reviews…" />
        ) : items.length === 0 ? (
          <EmptyState icon={MessageSquareQuote} title="Nothing here" message={EMPTY_COPY[tab]} />
        ) : (
          <div className="space-y-3">
            {items.map((t) => (
              <div
                key={t.id}
                className={`rounded-2xl border bg-peace p-5 transition-colors hover:border-links/30 ${t.isPinned ? 'border-warn/50' : 'border-tertiary-button'}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <Avatar t={t} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground">{t.name}</span>
                        <Stars rating={t.rating} />
                        {t.service && <Badge tone="blue">{t.service}</Badge>}
                        {t.destination && (
                          <Badge tone="purple">
                            <MapPin className="h-3 w-3" /> {t.destination}
                          </Badge>
                        )}
                        <Badge tone={t.isApproved ? 'green' : 'slate'} dot>
                          {t.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                        {t.isPinned && (
                          <Badge tone="amber">
                            <Pin className="h-3 w-3" /> Pinned
                          </Badge>
                        )}
                        {t.source === 'ADMIN' && <Badge tone="slate">Added by admin</Badge>}
                      </div>

                      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">{t.review}</p>

                      <p className="mt-3 text-xs text-inactive">{new Date(t.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {writable && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setEditing(t)} disabled={busyId === t.id} className={`${BTN_GHOST} ${BTN_SM}`}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePin(t)}
                        disabled={busyId === t.id}
                        className={`${BTN_GHOST} ${BTN_SM}`}
                        title={t.isPinned ? 'Stop showing this review first' : 'Show this review first on the site'}
                      >
                        {t.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        {t.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                      {t.isApproved ? (
                        <button onClick={() => handleApproval(t, false)} disabled={busyId === t.id} className={`${BTN_GHOST} ${BTN_SM}`}>
                          Unapprove
                        </button>
                      ) : (
                        <button onClick={() => handleApproval(t, true)} disabled={busyId === t.id} className={`${BTN_SUCCESS} ${BTN_SM}`}>
                          Approve
                        </button>
                      )}
                      <button onClick={() => handleDelete(t)} disabled={busyId === t.id} className={`${BTN_DANGER} ${BTN_SM}`}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {!loading && totalPages > 1 && (
        <div className={`mt-5 overflow-hidden ${CARD}`}>
          <Pagination page={page} totalPages={totalPages} onPage={(p) => setPage(Math.min(totalPages, Math.max(1, p)))} />
        </div>
      )}

      {editing && (
        <ReviewForm
          review={editing === 'new' ? null : editing}
          destinations={destinations}
          onClose={() => setEditing(null)}
          onSaved={async (text, published) => {
            setEditing(null);
            setMessage({ type: 'success', text });
            // Show the review where it now lives: a published one would
            // otherwise vanish from the Pending tab the moment it's saved.
            const target: TabKey = published === undefined || tab === 'all' ? tab : published ? 'approved' : 'pending';
            if (target !== tab) selectTab(target);
            else await refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Add / edit a review. Validation mirrors the backend's AdminTestimonialSchema. */
function ReviewForm({
  review,
  destinations,
  onClose,
  onSaved,
}: {
  review: Testimonial | null;
  /** Destination titles to suggest; null = free text only. */
  destinations: string[] | null;
  onClose: () => void;
  /** `published` = where the review now lives, when that changed. */
  onSaved: (message: string, published?: boolean) => void;
}) {
  const [form, setForm] = useState<TestimonialInput>(() => ({
    name: review?.name ?? '',
    review: review?.review ?? '',
    rating: review?.rating ?? 5,
    service: review?.service ?? '',
    destination: review?.destination ?? '',
    photoUrl: review?.photoUrl ?? '',
    isApproved: review?.isApproved ?? true,
    isPinned: review?.isPinned ?? false,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof TestimonialInput>(key: K, value: TestimonialInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const problems: Partial<Record<keyof TestimonialInput, string>> = {};
  if (form.name.trim().length < 2) problems.name = 'At least 2 characters';
  else if (form.name.trim().length > 100) problems.name = 'At most 100 characters';
  if (form.review.trim().length < 10) problems.review = 'At least 10 characters';
  else if (form.review.trim().length > 1000) problems.review = 'At most 1000 characters';
  if (form.service.trim().length < 3) problems.service = 'At least 3 characters';
  else if (form.service.trim().length > 100) problems.service = 'At most 100 characters';
  if ((form.destination ?? '').trim().length > 120) problems.destination = 'At most 120 characters';
  if (form.rating < 1 || form.rating > 5) problems.rating = 'Choose 1 to 5 stars';
  const invalid = Object.keys(problems).length > 0;

  async function save() {
    setTouched(true);
    if (invalid) return;
    setSaving(true);
    setError(null);
    const payload: TestimonialInput = {
      name: form.name.trim(),
      review: form.review.trim(),
      rating: form.rating,
      service: form.service.trim(),
      destination: (form.destination ?? '').trim() || null,
      photoUrl: (form.photoUrl ?? '').trim() || null,
      isApproved: form.isApproved,
      isPinned: form.isPinned,
    };
    try {
      if (review) {
        await api.updateTestimonial(review.id, payload);
        onSaved('Review updated', review.isApproved !== payload.isApproved ? payload.isApproved : undefined);
      } else {
        await api.createTestimonial(payload);
        onSaved(payload.isApproved ? 'Review added and published' : 'Review added as pending', payload.isApproved);
      }
    } catch (err) {
      setError(errorText(err, 'Could not save the review'));
      setSaving(false);
    }
  }

  const fieldError = (key: keyof TestimonialInput) =>
    touched && problems[key] ? <p className="mt-1 text-xs font-semibold text-danger">{problems[key]}</p> : null;

  return (
    <Modal
      title={review ? `Edit review by ${review.name}` : 'Add a review'}
      onClose={() => !saving && onClose()}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || (touched && invalid)} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : review ? 'Save changes' : 'Add review'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rv-name" className={FIELD_LABEL}>
              Reviewer name
            </label>
            <input id="rv-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} className={INPUT} />
            {fieldError('name')}
          </div>
          <div>
            <p className={FIELD_LABEL}>Rating</p>
            <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1 pt-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={form.rating === n}
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  onClick={() => set('rating', n)}
                  className="rounded p-0.5 transition-transform hover:scale-110"
                >
                  <Star className={`h-6 w-6 ${n <= form.rating ? 'fill-warn text-warn' : 'text-tertiary-button'}`} />
                </button>
              ))}
              <span className="ml-2 text-sm font-semibold text-inactive">{form.rating} / 5</span>
            </div>
            {fieldError('rating')}
          </div>
          <div>
            <label htmlFor="rv-service" className={FIELD_LABEL}>
              Service
            </label>
            <input id="rv-service" list="rv-services" value={form.service} onChange={(e) => set('service', e.target.value)} maxLength={100} placeholder="e.g. Holiday Packages" className={INPUT} />
            <datalist id="rv-services">
              {SERVICES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {fieldError('service')}
          </div>
          <div>
            <label htmlFor="rv-destination" className={FIELD_LABEL}>
              Destination <span className="font-normal text-inactive">(optional)</span>
            </label>
            {destinations && destinations.length > 0 ? (
              <select
                id="rv-destination"
                value={form.destination ?? ''}
                onChange={(e) => set('destination', e.target.value)}
                className={INPUT}
              >
                <option value="">No destination</option>
                {/* Keep an older free-text value selectable. */}
                {form.destination && !destinations.includes(form.destination) && <option value={form.destination}>{form.destination}</option>}
                {destinations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              <input id="rv-destination" value={form.destination ?? ''} onChange={(e) => set('destination', e.target.value)} maxLength={120} placeholder="e.g. Kerala" className={INPUT} />
            )}
            {fieldError('destination')}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="rv-review" className={FIELD_LABEL}>
              Review
            </label>
            <span className={`text-xs ${form.review.trim().length > 1000 ? 'font-bold text-danger' : 'text-inactive'}`}>{form.review.trim().length}/1000</span>
          </div>
          <textarea id="rv-review" value={form.review} onChange={(e) => set('review', e.target.value)} rows={5} className={`${INPUT} resize-y leading-relaxed`} />
          {fieldError('review')}
        </div>

        <ImagePicker label="Reviewer photo (optional)" value={form.photoUrl ?? ''} onChange={(url) => set('photoUrl', url)} clearable />

        <div className="flex flex-wrap items-center gap-6 rounded-xl bg-background px-4 py-3">
          <Switch checked={form.isApproved} onChange={(v) => set('isApproved', v)} label="Published on the website" onLabel="Published" offLabel="Pending" />
          <Switch checked={form.isPinned} onChange={(v) => set('isPinned', v)} label="Pin to the top" onLabel="Pinned first" offLabel="Not pinned" />
        </div>
      </div>
    </Modal>
  );
}
