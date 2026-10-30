import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ExternalLink, FileText, Globe, Plus } from 'lucide-react';
import { api, type LegalDocumentSummary } from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { siteUrl, timeAgo } from '../lib/site';
import { Alert, Badge, EmptyState, HeroStat, Modal, PageHeader, Panel, Spinner } from '../components/ui';
import {
  BTN_GHOST,
  BTN_PRIMARY,
  FIELD_LABEL,
  INPUT,
  LINK_BTN,
  LINK_BTN_DANGER,
  PAGE,
  TABLE_HEAD,
  TBODY,
  TH,
  TROW,
} from '../lib/ui-styles';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Routes the built-in pages already own on the public site. */
const RESERVED = new Set(['terms', 'privacy-policy', 'refund-cancellation-policy']);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

export default function Policies() {
  const navigate = useNavigate();
  const { canWrite } = useAccess();
  const editable = canWrite('POLICIES');

  const [docs, setDocs] = useState<LegalDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New-policy dialog
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDocs(await api.getLegalDocuments());
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Could not load policies.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const published = docs.filter((d) => d.isPublished).length;
  const lastUpdated = docs.reduce<string | null>((latest, d) => (!latest || d.updatedAt > latest ? d.updatedAt : latest), null);

  function openCreate() {
    setNewTitle('');
    setNewSlug('');
    setSlugEdited(false);
    setCreateError(null);
    setCreating(true);
  }

  const slugProblem = !newSlug
    ? 'A URL is required'
    : !SLUG_RE.test(newSlug)
      ? 'Use lowercase letters, numbers and single hyphens'
      : RESERVED.has(newSlug)
        ? 'This URL belongs to a built-in policy'
        : docs.some((d) => d.slug === newSlug)
          ? 'A policy already uses this URL'
          : null;
  const titleProblem = !newTitle.trim() ? 'A title is required' : newTitle.trim().length > 200 ? 'Keep the title under 200 characters' : null;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (slugProblem || titleProblem) return;
    setSaving(true);
    setCreateError(null);
    try {
      const doc = await api.createLegalDocument({
        slug: newSlug,
        title: newTitle.trim(),
        description: `This page explains our ${newTitle.trim().toLowerCase()}.`,
        metaDescription: null,
        sections: [
          {
            title: 'Introduction',
            paragraphs: ['Write the first paragraph of this policy here.'],
            subsections: [],
          },
        ],
        helpTitle: 'Questions about this policy?',
        helpText: 'Get in touch with our team:',
        isPublished: false,
      });
      navigate(`/policies/${doc.slug}`);
    } catch (err) {
      setCreateError(errorText(err, 'Could not create the policy.'));
      setSaving(false);
    }
  }

  async function handleDelete(doc: LegalDocumentSummary) {
    if (!window.confirm(`Delete "${doc.title}"? Its page (${doc.path}) will stop working and its history is removed.`)) return;
    try {
      await api.deleteLegalDocument(doc.slug);
      setMessage({ type: 'success', text: `"${doc.title}" was deleted.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Could not delete the policy.') });
    }
  }

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Content"
        title="Policies"
        subtitle="Edit the terms, privacy and other legal pages shown on the website. Every save is versioned and can be restored."
        note={!editable ? 'You have read-only access to Policies.' : undefined}
        actions={
          editable && (
            <button type="button" onClick={openCreate} className={BTN_PRIMARY}>
              <Plus className="h-4 w-4" /> New policy
            </button>
          )
        }
        stats={
          <>
            <HeroStat icon={FileText} label="Policies" value={loading ? null : docs.length} />
            <HeroStat icon={Globe} label="Published" value={loading ? null : published} />
            <HeroStat icon={Clock} label="Last updated" value={loading ? null : timeAgo(lastUpdated)} />
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

      <Panel
        title="All policies"
        aside={!loading && <span className="text-xs font-semibold text-inactive">{docs.length} total</span>}
        flush
      >
        {loading ? (
          <Spinner label="Loading policies…" />
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No policies yet"
            message="Create your first policy page."
            action={
              editable && (
                <button type="button" onClick={openCreate} className={BTN_PRIMARY}>
                  <Plus className="h-4 w-4" /> New policy
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className={TABLE_HEAD}>
                <tr className="border-b border-tertiary-button">
                  <th className={TH}>Policy</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Sections</th>
                  <th className={TH}>Version</th>
                  <th className={TH}>Last edited</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className={TBODY}>
                {docs.map((d) => (
                  <tr key={d.id} className={TROW}>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/policies/${d.slug}`} className="text-sm font-bold text-foreground hover:text-links">
                          {d.title}
                        </Link>
                        {d.isSystem && <Badge tone="slate">Built-in</Badge>}
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-inactive">{d.path}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={d.isPublished ? 'green' : 'amber'} dot>
                        {d.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground tabular-nums">{d.sectionCount}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-foreground tabular-nums">v{d.version}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-foreground">{timeAgo(d.updatedAt)}</p>
                      <p className="max-w-[200px] truncate text-xs text-inactive">{d.updatedByEmail ?? '-'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-4">
                        <Link to={`/policies/${d.slug}`} className={LINK_BTN}>
                          {editable ? 'Edit' : 'View'}
                        </Link>
                        {d.isPublished && (
                          <a href={siteUrl(d.path)} target="_blank" rel="noopener noreferrer" className={`${LINK_BTN} inline-flex items-center gap-1`}>
                            View live <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {editable && !d.isSystem && (
                          <button type="button" onClick={() => handleDelete(d)} className={LINK_BTN_DANGER}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating && (
        <Modal
          title="New policy"
          onClose={() => !saving && setCreating(false)}
          footer={
            <>
              <button type="button" onClick={() => setCreating(false)} disabled={saving} className={BTN_GHOST}>
                Cancel
              </button>
              <button type="submit" form="new-policy-form" disabled={saving || !!slugProblem || !!titleProblem} className={BTN_PRIMARY}>
                {saving ? 'Creating…' : 'Create and edit'}
              </button>
            </>
          }
        >
          <form id="new-policy-form" onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert tone="error">{createError}</Alert>}
            <div>
              <label htmlFor="policy-title" className={FIELD_LABEL}>
                Title
              </label>
              <input
                id="policy-title"
                autoFocus
                value={newTitle}
                maxLength={200}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!slugEdited) setNewSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Visa Policy"
                className={INPUT}
              />
              {newTitle && titleProblem && <p className="mt-1 text-xs font-semibold text-danger">{titleProblem}</p>}
            </div>
            <div>
              <label htmlFor="policy-slug" className={FIELD_LABEL}>
                Page URL
              </label>
              <div className="flex items-stretch overflow-hidden rounded-xl border border-tertiary-button focus-within:border-links focus-within:ring-2 focus-within:ring-links/20">
                <span className="flex items-center bg-background px-3 font-mono text-xs text-inactive">/policies/</span>
                <input
                  id="policy-slug"
                  value={newSlug}
                  maxLength={80}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setNewSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="visa-policy"
                  className="min-w-0 flex-1 bg-peace px-3 py-2.5 font-mono text-sm text-foreground outline-none"
                />
              </div>
              {(newSlug || slugEdited) && slugProblem ? (
                <p className="mt-1 text-xs font-semibold text-danger">{slugProblem}</p>
              ) : (
                <p className="mt-1 text-xs text-inactive">The URL can't be changed after the policy is created.</p>
              )}
            </div>
            <p className="rounded-xl bg-primary-tint px-3 py-2 text-xs font-semibold text-links">
              The policy starts as a draft with one section. It won't appear on the website until you publish it.
            </p>
          </form>
        </Modal>
      )}
    </div>
  );
}
