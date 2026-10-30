import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Copy,
  ExternalLink,
  FileText,
  History,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  api,
  ApiError,
  type LegalDocument,
  type LegalDocumentContent,
  type LegalRevision,
  type LegalRevisionDetail,
  type LegalSection,
} from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { siteUrl, timeAgo } from '../lib/site';
import PolicyPreview from '../components/PolicyPreview';
import { Alert, Badge, EmptyState, HeroStat, Modal, PageHeader, Panel, Spinner, Tabs } from '../components/ui';
import { BTN_GHOST, BTN_PRIMARY, BTN_SM, FIELD_LABEL, GRADIENTS, INPUT, LABEL, PAGE, type Accent } from '../lib/ui-styles';

// Server limits (src/legal/dto/legal.dto.ts) - mirrored so problems show before Save.
const MAX = { title: 200, description: 2000, meta: 320, helpTitle: 200, helpText: 2000, sections: 60 };
const ACCENT_CYCLE: Accent[] = ['blue', 'green', 'orange', 'purple', 'teal', 'pink'];

/** A section with a stable key so reordering doesn't remount the wrong inputs. */
interface EditSection extends LegalSection {
  key: string;
}
interface EditForm extends Omit<LegalDocumentContent, 'sections'> {
  sections: EditSection[];
}

let keySeq = 0;
const newKey = () => `s${++keySeq}`;

const toForm = (c: LegalDocumentContent): EditForm => ({
  title: c.title,
  description: c.description,
  metaDescription: c.metaDescription ?? '',
  helpTitle: c.helpTitle,
  helpText: c.helpText,
  isPublished: c.isPublished,
  sections: c.sections.map((s) => ({
    key: newKey(),
    title: s.title,
    paragraphs: [...s.paragraphs],
    subsections: s.subsections.map((x) => ({ ...x })),
  })),
});

const toContent = (f: EditForm): LegalDocumentContent => ({
  title: f.title,
  description: f.description,
  metaDescription: f.metaDescription?.trim() ? f.metaDescription : null,
  helpTitle: f.helpTitle,
  helpText: f.helpText,
  isPublished: f.isPublished,
  sections: f.sections.map(({ title, paragraphs, subsections }) => ({ title, paragraphs, subsections })),
});

/**
 * Comparable form of the editable content only. Picks the fields explicitly:
 * a full LegalDocument also carries id/slug/version/timestamps, and spreading
 * it would make a just-loaded policy look edited.
 */
const fingerprint = (c: LegalDocumentContent) =>
  JSON.stringify({
    title: c.title,
    description: c.description,
    metaDescription: c.metaDescription?.trim() || null,
    helpTitle: c.helpTitle,
    helpText: c.helpText,
    isPublished: c.isPublished,
    sections: c.sections.map(({ title, paragraphs, subsections }) => ({
      title,
      paragraphs,
      subsections: subsections.map(({ title: t, content }) => ({ title: t, content })),
    })),
  });

/** Problems that would make the server reject the save, in reading order. */
function validate(f: EditForm): string[] {
  const p: string[] = [];
  if (!f.title.trim()) p.push('The page title is empty');
  else if (f.title.trim().length > MAX.title) p.push(`The title is over ${MAX.title} characters`);
  if (!f.description.trim()) p.push('The intro text is empty');
  else if (f.description.trim().length > MAX.description) p.push(`The intro is over ${MAX.description} characters`);
  if ((f.metaDescription ?? '').trim().length > MAX.meta) p.push(`The search description is over ${MAX.meta} characters`);
  if (f.sections.length === 0) p.push('Add at least one section');
  if (f.sections.length > MAX.sections) p.push(`Keep it to ${MAX.sections} sections or fewer`);
  f.sections.forEach((s, i) => {
    const n = i + 1;
    if (!s.title.trim()) p.push(`Section ${n} has no title`);
    if (s.paragraphs.length + s.subsections.length === 0) p.push(`Section ${n} needs a paragraph or a highlight`);
    if (s.paragraphs.some((x) => !x.trim())) p.push(`Section ${n} has an empty paragraph`);
    if (s.subsections.some((x) => !x.title.trim() || !x.content.trim())) p.push(`Section ${n} has an incomplete highlight`);
  });
  if (!f.helpTitle.trim()) p.push('The help card title is empty');
  if (!f.helpText.trim()) p.push('The help card text is empty');
  return p;
}

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

/** Red outline for a field that would fail validation. */
const invalid = (bad: boolean) => (bad ? '!border-danger/60 ring-2 ring-danger/15' : '');

const TEXTAREA = `${INPUT} resize-y leading-relaxed [field-sizing:content]`;

const GLASS_PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20';

type Mode = 'edit' | 'preview';

export default function PolicyEditor() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { canWrite } = useAccess();
  const editable = canWrite('POLICIES');

  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [revisions, setRevisions] = useState<LegalRevision[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('edit');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [revisionPreview, setRevisionPreview] = useState<LegalRevisionDetail | null>(null);
  const [busyRevision, setBusyRevision] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, revs] = await Promise.all([api.getLegalDocument(slug), api.getLegalRevisions(slug)]);
      setDoc(d);
      setForm(toForm(d));
      setRevisions(revs);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError && err.statusCode === 404 ? 'This policy does not exist.' : errorText(err, 'Could not load this policy.'));
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const content = useMemo(() => (form ? toContent(form) : null), [form]);
  const dirty = !!(doc && content && fingerprint(content) !== fingerprint(doc));
  const problems = useMemo(() => (form ? validate(form) : []), [form]);

  // Leaving the tab (reload, close, external link) with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ------------------------------------------------------------- mutations

  const update = (patch: Partial<EditForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const updateSection = (index: number, patch: Partial<LegalSection>) =>
    setForm((f) => (f ? { ...f, sections: f.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : f));

  const moveSection = (index: number, delta: -1 | 1) =>
    setForm((f) => {
      if (!f) return f;
      const target = index + delta;
      if (target < 0 || target >= f.sections.length) return f;
      const sections = [...f.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...f, sections };
    });

  const duplicateSection = (index: number) =>
    setForm((f) => {
      if (!f) return f;
      const s = f.sections[index];
      const copy: EditSection = {
        key: newKey(),
        title: `${s.title} (copy)`,
        paragraphs: [...s.paragraphs],
        subsections: s.subsections.map((x) => ({ ...x })),
      };
      const sections = [...f.sections];
      sections.splice(index + 1, 0, copy);
      return { ...f, sections };
    });

  const removeSection = (index: number) => {
    const s = form?.sections[index];
    if (!s || !window.confirm(`Delete section ${index + 1}${s.title ? ` "${s.title}"` : ''}?`)) return;
    setForm((f) => (f ? { ...f, sections: f.sections.filter((_, i) => i !== index) } : f));
  };

  const addSection = () =>
    setForm((f) => (f ? { ...f, sections: [...f.sections, { key: newKey(), title: '', paragraphs: [''], subsections: [] }] } : f));

  async function save() {
    if (!doc || !content || problems.length || !dirty) return;
    setSaving(true);
    setMessage(null);
    setConflict(null);
    try {
      const saved = await api.updateLegalDocument(doc.slug, { ...content, version: doc.version });
      setDoc(saved);
      setForm(toForm(saved));
      setRevisions(await api.getLegalRevisions(doc.slug));
      setMessage({
        type: 'success',
        text: saved.isPublished
          ? `Saved as v${saved.version} - the website updates within a minute.`
          : `Saved as v${saved.version}. It's a draft, so it isn't on the website.`,
      });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) setConflict(err.message);
      else setMessage({ type: 'error', text: errorText(err, 'Could not save the policy.') });
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!doc || !window.confirm('Discard all unsaved changes?')) return;
    setForm(toForm(doc));
    setMessage(null);
  }

  async function reloadLatest() {
    if (dirty && !window.confirm('Reloading replaces your unsaved edits with the latest saved version. Continue?')) return;
    setConflict(null);
    setMessage(null);
    await load();
  }

  async function openRevision(version: number) {
    setBusyRevision(version);
    try {
      setRevisionPreview(await api.getLegalRevision(slug, version));
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Could not load that version.') });
    } finally {
      setBusyRevision(null);
    }
  }

  async function restore(version: number) {
    if (!doc) return;
    const warning = dirty ? '\n\nYour unsaved edits will be lost.' : '';
    if (!window.confirm(`Restore version ${version}? It becomes the new current version (v${doc.version + 1}); history is kept.${warning}`)) return;
    setBusyRevision(version);
    setMessage(null);
    setConflict(null);
    try {
      const saved = await api.restoreLegalDocument(doc.slug, version, doc.version);
      setDoc(saved);
      setForm(toForm(saved));
      setRevisions(await api.getLegalRevisions(doc.slug));
      setRevisionPreview(null);
      setMessage({ type: 'success', text: `Version ${version} restored as v${saved.version}.` });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) setConflict(err.message);
      else setMessage({ type: 'error', text: errorText(err, 'Could not restore that version.') });
    } finally {
      setBusyRevision(null);
    }
  }

  function goBack() {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    navigate('/policies');
  }

  // ------------------------------------------------------------------ render

  const backPill = (
    <button type="button" onClick={goBack} className={GLASS_PILL}>
      <ChevronLeft className="h-4 w-4" /> Back to policies
    </button>
  );

  if (loadError) {
    return (
      <div className={PAGE}>
        <PageHeader eyebrow="Content" title="Policy" actions={backPill} />
        <Alert tone="error">{loadError}</Alert>
      </div>
    );
  }

  if (!doc || !form || !content) {
    return (
      <div className={PAGE}>
        <PageHeader eyebrow="Content" title="Policy" subtitle="Loading…" actions={backPill} />
        <Panel>
          <Spinner label="Loading policy…" />
        </Panel>
      </div>
    );
  }

  const saveBlockedReason = !editable ? null : problems[0] ?? (!dirty ? 'No changes to save' : null);

  return (
    <div className={`${PAGE} ${dirty && editable ? 'pb-28' : ''}`}>
      <PageHeader
        eyebrow="Content"
        title={doc.title}
        subtitle={<span className="font-mono text-sm">{doc.path}</span>}
        note={!editable ? 'You have read-only access to Policies.' : undefined}
        actions={
          <>
            {backPill}
            {doc.isPublished && (
              <a href={siteUrl(doc.path)} target="_blank" rel="noopener noreferrer" className={GLASS_PILL}>
                View live <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <Tabs
              variant="glass"
              label="Editor mode"
              active={mode}
              onChange={setMode}
              options={[
                { key: 'edit', label: editable ? 'Edit' : 'Details' },
                { key: 'preview', label: 'Preview' },
              ]}
            />
          </>
        }
        stats={
          <>
            <HeroStat icon={Layers} label="Sections" value={form.sections.length} />
            <HeroStat icon={History} label="Version" value={`v${doc.version}`} />
            <HeroStat icon={FileText} label="Last edited" value={timeAgo(doc.updatedAt)} />
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={doc.isPublished ? 'green' : 'amber'} dot>
            {doc.isPublished ? 'Published' : 'Draft'}
          </Badge>
          {doc.isSystem && <Badge tone="slate">Built-in</Badge>}
          {dirty && <Badge tone="blue">Unsaved changes</Badge>}
        </div>
      </PageHeader>

      {conflict && (
        <div className="mb-4">
          <Alert tone="warn">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{conflict}</span>
              <button type="button" onClick={reloadLatest} className={`${BTN_GHOST} ${BTN_SM}`}>
                <RotateCcw className="h-3.5 w-3.5" /> Reload latest
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {mode === 'preview' ? (
            <PolicyPreview doc={content} />
          ) : (
            <fieldset disabled={!editable} className="min-w-0 space-y-6">
              <Panel title="Page details">
                <div className="space-y-4">
                  <Field label="Title" htmlFor="pol-title" count={[form.title.length, MAX.title]}>
                    <input
                      id="pol-title"
                      value={form.title}
                      onChange={(e) => update({ title: e.target.value })}
                      className={`${INPUT} ${invalid(!form.title.trim())}`}
                    />
                  </Field>
                  <Field label="Intro" hint="Shown under the title at the top of the page." htmlFor="pol-desc" count={[form.description.length, MAX.description]}>
                    <textarea
                      id="pol-desc"
                      rows={3}
                      value={form.description}
                      onChange={(e) => update({ description: e.target.value })}
                      className={`${TEXTAREA} ${invalid(!form.description.trim())}`}
                    />
                  </Field>
                  <Field
                    label="Search description"
                    hint="Shown by Google under the page link. Leave empty to use the intro."
                    htmlFor="pol-meta"
                    count={[(form.metaDescription ?? '').length, MAX.meta]}
                  >
                    <textarea
                      id="pol-meta"
                      rows={2}
                      value={form.metaDescription ?? ''}
                      onChange={(e) => update({ metaDescription: e.target.value })}
                      className={`${TEXTAREA} ${invalid((form.metaDescription ?? '').trim().length > MAX.meta)}`}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-background px-4 py-3">
                    <div>
                      <p className={LABEL}>Page URL</p>
                      <p className="mt-0.5 font-mono text-sm text-foreground">{doc.path}</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">{form.isPublished ? 'Published' : 'Draft'}</span>
                      <span className="relative inline-flex">
                        <input
                          type="checkbox"
                          role="switch"
                          aria-label="Published on the website"
                          checked={form.isPublished}
                          onChange={(e) => update({ isPublished: e.target.checked })}
                          className="peer sr-only"
                        />
                        <span className="peer h-6 w-11 rounded-full bg-tertiary-button transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-peace after:shadow-sm after:transition-all after:content-[''] peer-checked:bg-success peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-links/30" />
                      </span>
                    </label>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Sections"
                aside={<span className="text-xs font-semibold text-inactive">{form.sections.length} section{form.sections.length === 1 ? '' : 's'}</span>}
              >
                {form.sections.length === 0 ? (
                  <EmptyState icon={Layers} title="No sections" message="Add a section to start writing this policy." />
                ) : (
                  <div className="space-y-4">
                    {form.sections.map((s, i) => (
                      <SectionEditor
                        key={s.key}
                        index={i}
                        total={form.sections.length}
                        section={s}
                        onChange={(patch) => updateSection(i, patch)}
                        onMove={(d) => moveSection(i, d)}
                        onDuplicate={() => duplicateSection(i)}
                        onRemove={() => removeSection(i)}
                      />
                    ))}
                  </div>
                )}
                {editable && (
                  <button type="button" onClick={addSection} className={`${BTN_GHOST} mt-4 w-full border-dashed`}>
                    <Plus className="h-4 w-4" /> Add section
                  </button>
                )}
              </Panel>

              <Panel title="Help card" aside={<span className="text-xs text-inactive">Shown at the bottom of the page</span>}>
                <div className="space-y-4">
                  <Field label="Title" htmlFor="pol-help-title" count={[form.helpTitle.length, MAX.helpTitle]}>
                    <input
                      id="pol-help-title"
                      value={form.helpTitle}
                      onChange={(e) => update({ helpTitle: e.target.value })}
                      className={`${INPUT} ${invalid(!form.helpTitle.trim())}`}
                    />
                  </Field>
                  <Field label="Text" hint="Our email, address and a Contact page link are added below it automatically." htmlFor="pol-help-text" count={[form.helpText.length, MAX.helpText]}>
                    <textarea
                      id="pol-help-text"
                      rows={2}
                      value={form.helpText}
                      onChange={(e) => update({ helpText: e.target.value })}
                      className={`${TEXTAREA} ${invalid(!form.helpText.trim())}`}
                    />
                  </Field>
                </div>
              </Panel>
            </fieldset>
          )}
        </div>

        {/* Side column */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Publishing">
            <dl className="space-y-2.5 text-sm">
              <Row label="Status">
                <Badge tone={form.isPublished ? 'green' : 'amber'} dot>
                  {form.isPublished ? 'Published' : 'Draft'}
                </Badge>
              </Row>
              <Row label="Version">v{doc.version}</Row>
              <Row label="Last edited">{timeAgo(doc.updatedAt)}</Row>
              <Row label="By">
                <span className="max-w-[170px] truncate">{doc.updatedByEmail ?? '-'}</span>
              </Row>
            </dl>
            {editable && (
              <div className="mt-4 space-y-2 border-t border-tertiary-button pt-4">
                <button type="button" onClick={save} disabled={saving || !!saveBlockedReason} className={`${BTN_PRIMARY} w-full`}>
                  <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
                </button>
                {saveBlockedReason && dirty && <p className="text-center text-xs font-semibold text-danger">{saveBlockedReason}</p>}
                {dirty && (
                  <button type="button" onClick={discard} disabled={saving} className={`${BTN_GHOST} w-full`}>
                    Discard changes
                  </button>
                )}
                {problems.length > 1 && (
                  <ul className="mt-2 space-y-1 rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                    {problems.slice(0, 5).map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                    {problems.length > 5 && <li>…and {problems.length - 5} more</li>}
                  </ul>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Version history" aside={<span className="text-xs font-semibold text-inactive">{revisions.length}</span>} flush>
            {revisions.length === 0 ? (
              <EmptyState icon={History} title="No history yet" />
            ) : (
              <ol className="max-h-[420px] divide-y divide-tertiary-button overflow-y-auto">
                {revisions.map((r) => (
                  <li key={r.version} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-xs font-extrabold text-links">
                      v{r.version}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{r.editedByEmail ?? 'Unknown'}</p>
                      <p className="text-xs text-inactive">{timeAgo(r.createdAt)}</p>
                    </div>
                    {r.isCurrent ? (
                      <Badge tone="green">Current</Badge>
                    ) : (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => openRevision(r.version)}
                          disabled={busyRevision !== null}
                          className="text-xs font-bold text-links hover:underline disabled:opacity-50"
                        >
                          Preview
                        </button>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => restore(r.version)}
                            disabled={busyRevision !== null || saving}
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

      {/* Sticky save bar, like User Access's */}
      {dirty && editable && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-tertiary-button bg-peace/95 px-4 py-3 shadow-[0_-4px_16px_rgba(14,34,56,0.06)] backdrop-blur-sm lg:left-[var(--sidebar-w,17rem)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
            <p className="flex-1 text-sm font-semibold text-foreground">
              Unsaved changes
              {saveBlockedReason && <span className="ml-2 text-xs font-semibold text-danger">· {saveBlockedReason}</span>}
            </p>
            <button type="button" onClick={discard} disabled={saving} className={`${BTN_GHOST} ${BTN_SM}`}>
              Discard
            </button>
            <button type="button" onClick={save} disabled={saving || !!saveBlockedReason} className={`${BTN_PRIMARY} ${BTN_SM}`}>
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {revisionPreview && (
        <Modal
          wide
          title={`Version ${revisionPreview.version}`}
          onClose={() => setRevisionPreview(null)}
          footer={
            <>
              <span className="mr-auto self-center text-xs text-inactive">
                {revisionPreview.editedByEmail ?? 'Unknown'} · {timeAgo(revisionPreview.createdAt)}
              </span>
              <button type="button" onClick={() => setRevisionPreview(null)} className={BTN_GHOST}>
                Close
              </button>
              {editable && (
                <button type="button" onClick={() => restore(revisionPreview.version)} disabled={busyRevision !== null} className={BTN_PRIMARY}>
                  <RotateCcw className="h-4 w-4" /> Restore this version
                </button>
              )}
            </>
          }
        >
          <PolicyPreview doc={revisionPreview.snapshot} />
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  htmlFor,
  count,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  /** [current, max] character count. */
  count?: [number, number];
  children: ReactNode;
}) {
  const over = count ? count[0] > count[1] : false;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className={FIELD_LABEL}>
          {label}
        </label>
        {count && (
          <span className={`text-xs tabular-nums ${over ? 'font-bold text-danger' : 'text-inactive'}`}>
            {count[0]}/{count[1]}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-inactive">{hint}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-inactive">{label}</dt>
      <dd className="flex min-w-0 justify-end font-semibold text-foreground">{children}</dd>
    </div>
  );
}

const ICON_BTN =
  'flex h-8 w-8 items-center justify-center rounded-lg text-inactive transition-colors hover:bg-primary-tint hover:text-links disabled:pointer-events-none disabled:opacity-35';

function SectionEditor({
  index,
  total,
  section,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  total: number;
  section: LegalSection;
  onChange: (patch: Partial<LegalSection>) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const empty = section.paragraphs.length + section.subsections.length === 0;

  const setParagraph = (i: number, value: string) => onChange({ paragraphs: section.paragraphs.map((p, j) => (j === i ? value : p)) });
  const setHighlight = (i: number, patch: Partial<{ title: string; content: string }>) =>
    onChange({ subsections: section.subsections.map((h, j) => (j === i ? { ...h, ...patch } : h)) });

  return (
    <div className={`rounded-2xl border bg-peace p-4 sm:p-5 ${empty ? 'border-danger/40' : 'border-tertiary-button'}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
            GRADIENTS[ACCENT_CYCLE[index % ACCENT_CYCLE.length]]
          } text-sm font-extrabold text-white shadow-md`}
        >
          {String(n).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={`sec-${index}-title`} className="sr-only">
            Section {n} title
          </label>
          <input
            id={`sec-${index}-title`}
            value={section.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder={`Section ${n} title`}
            className={`${INPUT} !text-base font-bold ${invalid(!section.title.trim())}`}
          />
        </div>
        <div className="flex shrink-0 items-center" role="group" aria-label={`Section ${n} actions`}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={ICON_BTN} title="Move up" aria-label={`Move section ${n} up`}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className={ICON_BTN} title="Move down" aria-label={`Move section ${n} down`}>
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDuplicate} className={ICON_BTN} title="Duplicate" aria-label={`Duplicate section ${n}`}>
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className={`${ICON_BTN} hover:!bg-danger/10 hover:!text-danger`}
            title="Delete section"
            aria-label={`Delete section ${n}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3 sm:pl-[3.25rem]">
        <p className={LABEL}>Paragraphs</p>
        {section.paragraphs.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <label htmlFor={`sec-${index}-p-${i}`} className="sr-only">
              Section {n} paragraph {i + 1}
            </label>
            <textarea
              id={`sec-${index}-p-${i}`}
              rows={3}
              value={p}
              onChange={(e) => setParagraph(i, e.target.value)}
              placeholder="Paragraph text"
              className={`${TEXTAREA} ${invalid(!p.trim())}`}
            />
            <button
              type="button"
              onClick={() => onChange({ paragraphs: section.paragraphs.filter((_, j) => j !== i) })}
              className={`${ICON_BTN} mt-1 shrink-0 hover:!bg-danger/10 hover:!text-danger`}
              title="Remove paragraph"
              aria-label={`Remove paragraph ${i + 1} of section ${n}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ paragraphs: [...section.paragraphs, ''] })} className="inline-flex items-center gap-1 text-sm font-bold text-links hover:underline disabled:hidden">
          <Plus className="h-4 w-4" /> Add paragraph
        </button>

        <div className="border-t border-tertiary-button pt-3">
          <p className={LABEL}>Highlights</p>
          <p className="mt-0.5 text-xs text-inactive">Callouts with a blue edge, for key points.</p>
        </div>
        {section.subsections.map((h, i) => (
          <div key={i} className="rounded-xl border-l-4 border-links bg-links/5 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  aria-label={`Section ${n} highlight ${i + 1} title`}
                  value={h.title}
                  onChange={(e) => setHighlight(i, { title: e.target.value })}
                  placeholder="Highlight title"
                  className={`${INPUT} font-semibold ${invalid(!h.title.trim())}`}
                />
                <textarea
                  aria-label={`Section ${n} highlight ${i + 1} text`}
                  rows={2}
                  value={h.content}
                  onChange={(e) => setHighlight(i, { content: e.target.value })}
                  placeholder="Highlight text"
                  className={`${TEXTAREA} ${invalid(!h.content.trim())}`}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange({ subsections: section.subsections.filter((_, j) => j !== i) })}
                className={`${ICON_BTN} shrink-0 hover:!bg-danger/10 hover:!text-danger`}
                title="Remove highlight"
                aria-label={`Remove highlight ${i + 1} of section ${n}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ subsections: [...section.subsections, { title: '', content: '' }] })}
          className="inline-flex items-center gap-1 text-sm font-bold text-links hover:underline disabled:hidden"
        >
          <Plus className="h-4 w-4" /> Add highlight
        </button>
        {empty && <p className="text-xs font-semibold text-danger">Add a paragraph or a highlight - empty sections can't be saved.</p>}
      </div>
    </div>
  );
}

