import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Mail,
  MailCheck,
  MailOpen,
  MailWarning,
  Phone,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  api,
  type ContactEmailStatus,
  type ContactFilter,
  type ContactInboxStatus,
  type ContactMessage,
  type ContactMessagesResponse,
  type ContactSettings,
} from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { Alert, Badge, EmptyState, HeroStat, Modal, PageHeader, Pagination, Panel, Spinner, StatTile } from '../components/ui';
import {
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SM,
  FIELD_LABEL,
  INPUT,
  LABEL,
  PAGE,
  TABLE_HEAD,
  TBODY,
  TH,
  TROW,
  type Accent,
  type Tone,
} from '../lib/ui-styles';

const LIMIT = 25;

/** Mirrors MAX_CONTACT_RECIPIENTS in the backend. */
const MAX_RECIPIENTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Filter = ContactFilter | 'all';

const TILES: { key: Filter; label: string; icon: LucideIcon; accent: Accent }[] = [
  { key: 'all', label: 'All messages', icon: Inbox, accent: 'blue' },
  { key: 'NEW', label: 'New', icon: Mail, accent: 'orange' },
  { key: 'READ', label: 'Read', icon: MailOpen, accent: 'purple' },
  { key: 'RESOLVED', label: 'Resolved', icon: CheckCircle2, accent: 'green' },
  { key: 'EMAIL_FAILED', label: 'Not emailed', icon: MailWarning, accent: 'pink' },
];

const INBOX_BADGE: Record<ContactInboxStatus, { label: string; tone: Tone }> = {
  NEW: { label: 'New', tone: 'amber' },
  READ: { label: 'Read', tone: 'blue' },
  RESOLVED: { label: 'Resolved', tone: 'green' },
};

const EMAIL_BADGE: Record<ContactEmailStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Sending', tone: 'slate' },
  SENT: { label: 'Emailed', tone: 'green' },
  FAILED: { label: 'Not delivered', tone: 'red' },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export default function CustomerMessages() {
  const { canWrite } = useAccess();
  const writable = canWrite('CUSTOMER_MESSAGES');

  const [data, setData] = useState<ContactMessagesResponse | null>(null);
  const [settings, setSettings] = useState<ContactSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageNum, setPageNum] = useState(1);

  const [openId, setOpenId] = useState<string | null>(null);

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
      setError(null);
      const res = await api.getContactMessages({
        filter: filter === 'all' ? undefined : filter,
        search: debouncedSearch || undefined,
        from: from || undefined,
        to: to || undefined,
        pageNum,
        limit: LIMIT,
      });
      setData(res);
    } catch (err) {
      setError(errorText(err, 'Failed to load messages'));
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch, from, to, pageNum]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .getContactSettings()
      .then(setSettings)
      .catch((err) => setError(errorText(err, 'Failed to load delivery settings')));
  }, []);

  function selectFilter(next: Filter) {
    setFilter(next);
    setPageNum(1);
  }

  /** Swap one message in the table after the modal changes it. */
  function replaceItem(updated: ContactMessage) {
    setData((d) => (d ? { ...d, items: d.items.map((m) => (m.id === updated.id ? updated : m)) } : d));
  }

  const items = data?.items ?? [];
  const totalPages = Math.max(1, data?.pagination.totalPages ?? 1);
  const open = items.find((m) => m.id === openId) ?? null;

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="People"
        title="Customer Messages"
        subtitle="Queries, questions, suggestions and feedback sent from the website's Contact Us page"
        note={writable ? undefined : 'You have read-only access'}
        actions={
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
        stats={
          <>
            <HeroStat icon={Mail} label="New" value={data ? data.summary.NEW.toLocaleString('en-IN') : null} />
            <HeroStat icon={Inbox} label="All messages" value={data ? data.summary.all.toLocaleString('en-IN') : null} />
            <HeroStat
              icon={MailCheck}
              label="Emailed to"
              value={settings ? (settings.effective.length ? settings.effective.join(', ') : 'No inbox set') : null}
            />
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert tone="success" onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        </div>
      )}

      <DeliverySettings
        settings={settings}
        writable={writable}
        onSaved={(s) => {
          setSettings(s);
          setNotice(`Contact messages will now be emailed to ${s.effective.join(', ')}.`);
        }}
      />

      {/* Summary tiles - double as the filter */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {TILES.map((tile) => (
          <StatTile
            key={tile.key}
            label={tile.label}
            value={data ? data.summary[tile.key].toLocaleString('en-IN') : '–'}
            icon={tile.icon}
            accent={tile.accent}
            active={filter === tile.key}
            onClick={() => selectFilter(tile.key)}
          />
        ))}
      </div>

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
                placeholder="Name, email, phone, subject or message"
                className={`${INPUT} pl-10`}
              />
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPageNum(1);
              }}
              className={INPUT}
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
              className={INPUT}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Messages"
        aside={data ? <Badge tone="blue">{data.pagination.total.toLocaleString('en-IN')}</Badge> : undefined}
        flush
      >
        {loading && !data ? (
          <Spinner label="Loading messages…" />
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title="No messages found" message="No Contact Us messages match these filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className={TABLE_HEAD}>
                  <tr className="border-b border-tertiary-button">
                    <th className={TH}>Received</th>
                    <th className={TH}>From</th>
                    <th className={TH}>Message</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Email</th>
                  </tr>
                </thead>
                <tbody className={`${TBODY} ${loading ? 'opacity-60' : ''}`}>
                  {items.map((m) => {
                    const unread = m.inboxStatus === 'NEW';
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setOpenId(m.id)}
                        className={`cursor-pointer align-top ${TROW} ${unread ? 'bg-primary-tint/20' : ''}`}
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap text-foreground">{formatDateTime(m.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <div className={`text-foreground ${unread ? 'font-extrabold' : 'font-bold'}`}>{m.fullName}</div>
                          <div className="text-xs text-inactive">{m.email}</div>
                          <div className="text-xs text-inactive">{m.phoneNumber}</div>
                        </td>
                        <td className="max-w-[380px] px-5 py-3.5">
                          <div className={`truncate text-foreground ${unread ? 'font-extrabold' : 'font-semibold'}`}>{m.subject}</div>
                          <div className="line-clamp-2 text-xs text-inactive">{m.message}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={INBOX_BADGE[m.inboxStatus].tone} dot>
                            {INBOX_BADGE[m.inboxStatus].label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <span title={m.status === 'FAILED' ? (m.errorMessage ?? undefined) : m.deliveredTo.join(', ')}>
                            <Badge tone={EMAIL_BADGE[m.status].tone}>{EMAIL_BADGE[m.status].label}</Badge>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pageNum}
              totalPages={totalPages}
              total={data?.pagination.total ?? 0}
              onPage={(p) => setPageNum(Math.min(totalPages, Math.max(1, p)))}
            />
          </>
        )}
      </Panel>

      {open && (
        <MessageModal
          message={open}
          writable={writable}
          onClose={() => setOpenId(null)}
          onChanged={(m) => {
            replaceItem(m);
            // Tile counts move when a status changes.
            void api
              .getContactMessages({
                filter: filter === 'all' ? undefined : filter,
                search: debouncedSearch || undefined,
                from: from || undefined,
                to: to || undefined,
                pageNum,
                limit: LIMIT,
              })
              .then((res) => setData((d) => (d ? { ...d, summary: res.summary } : res)))
              .catch(() => undefined);
          }}
          onDeleted={() => {
            setOpenId(null);
            setNotice('Message deleted.');
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Which inboxes receive the messages
// ---------------------------------------------------------------------------

function DeliverySettings({
  settings,
  writable,
  onSaved,
}: {
  settings: ContactSettings | null;
  writable: boolean;
  onSaved: (s: ContactSettings) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(settings?.effective ?? []);
    setInput('');
    setError(null);
    setEditing(true);
  }

  function add() {
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) return setError(`"${email}" is not a valid email address.`);
    if (draft.includes(email)) return setError(`${email} is already in the list.`);
    if (draft.length >= MAX_RECIPIENTS) return setError(`You can add up to ${MAX_RECIPIENTS} addresses.`);
    setDraft([...draft, email]);
    setInput('');
    setError(null);
  }

  async function save() {
    // An address typed but not yet added still counts.
    const pending = input.trim().toLowerCase();
    const list = pending && !draft.includes(pending) ? [...draft, pending] : draft;
    if (pending && !EMAIL_RE.test(pending)) return setError(`"${pending}" is not a valid email address.`);
    if (!list.length) return setError('Add at least one email address.');
    try {
      setSaving(true);
      setError(null);
      onSaved(await api.updateContactSettings(list));
      setEditing(false);
    } catch (err) {
      setError(errorText(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  const usingFallback = !!settings && !settings.recipients.length && settings.fallback.length > 0;
  const noInbox = !!settings && !settings.effective.length;

  return (
    <Panel
      title="Where messages are delivered"
      className="mb-4"
      aside={
        writable && settings && !editing ? (
          <button type="button" onClick={startEdit} className={`${BTN_GHOST} ${BTN_SM}`}>
            Change inboxes
          </button>
        ) : undefined
      }
    >
      {!settings ? (
        <div className="h-8 w-64 animate-pulse rounded-full bg-background" />
      ) : editing ? (
        <div className="space-y-3">
          <p className="text-sm text-inactive">
            Every new Contact Us message is saved here and emailed to these addresses at once. Up to {MAX_RECIPIENTS}.
          </p>
          <div className="flex flex-wrap gap-2">
            {draft.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint py-1 pr-1.5 pl-3 text-sm font-semibold text-links"
              >
                {email}
                <button
                  type="button"
                  onClick={() => setDraft(draft.filter((e) => e !== email))}
                  aria-label={`Remove ${email}`}
                  className="rounded-full p-0.5 hover:bg-links/15"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {!draft.length && <span className="text-sm text-inactive">No addresses yet.</span>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="support@example.com"
              className={`${INPUT} sm:max-w-sm`}
              disabled={draft.length >= MAX_RECIPIENTS}
            />
            <button type="button" onClick={add} className={`${BTN_GHOST} ${BTN_SM}`} disabled={draft.length >= MAX_RECIPIENTS}>
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className={`${BTN_PRIMARY} ${BTN_SM}`}>
              {saving ? 'Saving…' : 'Save inboxes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className={`${BTN_GHOST} ${BTN_SM}`}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {noInbox ? (
            <Alert tone="warn">
              No inbox is set, so messages are saved here but not emailed to anyone.
              {writable ? ' Choose "Change inboxes" to add one.' : ''}
            </Alert>
          ) : (
            <div className="flex flex-wrap gap-2">
              {settings.effective.map((email) => (
                <span key={email} className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-sm font-semibold text-links">
                  <Mail className="h-3.5 w-3.5" />
                  {email}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-inactive">
            {usingFallback
              ? "Using the server's default address (ADMIN_EMAIL) until an admin picks inboxes here."
              : settings.updatedAt
                ? `Last changed ${formatDateTime(settings.updatedAt)}${settings.updatedByEmail ? ` by ${settings.updatedByEmail}` : ''}.`
                : null}
          </p>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// One message
// ---------------------------------------------------------------------------

function MessageModal({
  message,
  writable,
  onClose,
  onChanged,
  onDeleted,
}: {
  message: ContactMessage;
  writable: boolean;
  onClose: () => void;
  onChanged: (m: ContactMessage) => void;
  onDeleted: () => void;
}) {
  const [note, setNote] = useState(message.adminNote ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Opening a new message marks it read (admins with write access only).
  useEffect(() => {
    if (writable && message.inboxStatus === 'NEW') {
      api.updateContactMessage(message.id, { inboxStatus: 'READ' }).then(onChanged).catch(() => undefined);
    }
    // Only on open, not on every change to the message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  async function run(key: string, action: () => Promise<ContactMessage>, done?: (m: ContactMessage) => string) {
    try {
      setBusy(key);
      setError(null);
      setInfo(null);
      const updated = await action();
      onChanged(updated);
      if (done) setInfo(done(updated));
    } catch (err) {
      setError(errorText(err, 'Something went wrong'));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`Delete the message from ${message.fullName}? This cannot be undone.`)) return;
    try {
      setBusy('delete');
      await api.deleteContactMessage(message.id);
      onDeleted();
    } catch (err) {
      setError(errorText(err, 'Failed to delete'));
      setBusy(null);
    }
  }

  const replyHref = `mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`;
  const noteChanged = (note.trim() || null) !== (message.adminNote ?? null);

  return (
    <Modal
      title={message.subject}
      onClose={onClose}
      wide
      footer={
        <>
          {writable && (
            <button type="button" onClick={remove} disabled={!!busy} className={`${BTN_DANGER} ${BTN_SM} sm:mr-auto`}>
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          {writable && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                run(
                  'resend',
                  () => api.resendContactMessage(message.id),
                  (m) => (m.status === 'SENT' ? `Emailed to ${m.deliveredTo.join(', ')}.` : 'The email could not be sent - see the error above.'),
                )
              }
              className={`${BTN_GHOST} ${BTN_SM}`}
            >
              <Send className="h-4 w-4" />
              {busy === 'resend' ? 'Sending…' : message.status === 'SENT' ? 'Email again' : 'Resend email'}
            </button>
          )}
          <a href={replyHref} className={`${BTN_PRIMARY} ${BTN_SM}`}>
            <Reply className="h-4 w-4" />
            Reply by email
          </a>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className={LABEL}>From</p>
            <p className="mt-1 font-bold text-foreground">{message.fullName}</p>
            <a href={`mailto:${message.email}`} className="block text-sm break-all text-links hover:underline">
              {message.email}
            </a>
            <a href={`tel:${message.phoneNumber}`} className="inline-flex items-center gap-1 text-sm text-links hover:underline">
              <Phone className="h-3.5 w-3.5" />
              {message.phoneNumber}
            </a>
          </div>
          <div>
            <p className={LABEL}>Received</p>
            <p className="mt-1 text-sm text-foreground">{formatDateTime(message.createdAt)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={INBOX_BADGE[message.inboxStatus].tone} dot>
                {INBOX_BADGE[message.inboxStatus].label}
              </Badge>
              <Badge tone={EMAIL_BADGE[message.status].tone}>{EMAIL_BADGE[message.status].label}</Badge>
            </div>
          </div>
        </div>

        <div>
          <p className={LABEL}>Message</p>
          <div className="mt-1.5 rounded-xl border border-tertiary-button bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {message.message}
          </div>
        </div>

        <div className="rounded-xl border border-tertiary-button p-4 text-sm">
          <p className={LABEL}>Email to the team</p>
          {message.status === 'SENT' ? (
            <p className="mt-1.5 text-foreground">
              Sent to <span className="font-semibold">{message.deliveredTo.join(', ')}</span>
              {message.sentAt && <> on {formatDateTime(message.sentAt)}</>}.
            </p>
          ) : message.status === 'FAILED' ? (
            <div className="mt-1.5 flex items-start gap-2 text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Not delivered{message.deliveredTo.length ? ` to ${message.deliveredTo.join(', ')}` : ''}.{' '}
                {message.errorMessage}
              </p>
            </div>
          ) : (
            <p className="mt-1.5 text-inactive">Waiting to be sent.</p>
          )}
          {message.emailAttempts > 1 && <p className="mt-1 text-xs text-inactive">{message.emailAttempts} attempts</p>}
        </div>

        {writable && (
          <div>
            <p className={`${LABEL} mb-1.5`}>Status</p>
            <div className="inline-flex flex-wrap gap-0.5 rounded-full bg-slate-100 p-1">
              {(['NEW', 'READ', 'RESOLVED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!!busy}
                  aria-pressed={message.inboxStatus === s}
                  onClick={() => message.inboxStatus !== s && run(`status-${s}`, () => api.updateContactMessage(message.id, { inboxStatus: s }))}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-60 ${
                    message.inboxStatus === s ? 'bg-peace text-links shadow-sm' : 'text-inactive hover:text-foreground'
                  }`}
                >
                  {s === 'NEW' ? 'Mark unread' : INBOX_BADGE[s].label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="admin-note" className={FIELD_LABEL}>
            Internal note
          </label>
          {writable ? (
            <>
              <textarea
                id="admin-note"
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Only the team sees this, e.g. 'Called back, sent Kerala quote'"
                className={`${INPUT} resize-y`}
              />
              <button
                type="button"
                disabled={!noteChanged || !!busy}
                onClick={() => run('note', () => api.updateContactMessage(message.id, { adminNote: note.trim() || null }), () => 'Note saved.')}
                className={`${BTN_GHOST} ${BTN_SM} mt-2`}
              >
                {busy === 'note' ? 'Saving…' : 'Save note'}
              </button>
            </>
          ) : (
            <p className="text-sm text-inactive">{message.adminNote || 'No note.'}</p>
          )}
          {message.handledByEmail && (
            <p className="mt-2 text-xs text-inactive">Last updated by {message.handledByEmail}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
