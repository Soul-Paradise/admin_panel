import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileText, Handshake, UserCheck, UserX } from 'lucide-react';
import {
  api,
  type AgentApplication,
  type AgentDocument,
  type AgentListItem,
} from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { Alert, Badge, EmptyState, HeroStat, PageHeader, Panel, Spinner, Tabs } from '../components/ui';
import {
  BTN_DANGER,
  BTN_GHOST,
  BTN_SM,
  BTN_SUCCESS,
  CARD,
  CARD_LINK,
  LABEL,
  PAGE,
  TABLE_HEAD,
  TBODY,
  TH,
  TROW,
} from '../lib/ui-styles';

type AccessTab = 'ACTIVE' | 'REVOKED' | 'ALL';

const ACCESS_TABS: Array<{ id: AccessTab; label: string }> = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'REVOKED', label: 'Revoked' },
  { id: 'ALL', label: 'All' },
];

function AccessBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge tone="green" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="red" dot>
      Revoked
    </Badge>
  );
}

const DOC_LABELS: Record<string, string> = {
  PAN_CARD: 'PAN Card',
  AADHAAR_FRONT: 'Aadhaar (Front)',
  AADHAAR_BACK: 'Aadhaar (Back)',
  GST_CERTIFICATE: 'GST Certificate',
};

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Agents() {
  const { canWrite } = useAccess();
  const canDecide = canWrite('BOOKING_PARTNERS');

  const [tab, setTab] = useState<AccessTab>('ACTIVE');
  const [items, setItems] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [selected, setSelected] = useState<AgentApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Shown as a badge on the Revoked tab, fetched independently of the current
  // tab so revoked partners stay visible while you're looking at Active.
  const [revokedCount, setRevokedCount] = useState(0);

  const fetchRevokedCount = useCallback(async () => {
    try {
      const result = await api.getAgents({ active: false, limit: 1 });
      setRevokedCount(result.pagination.total);
    } catch {
      // A failed badge count must not take the page down with it.
    }
  }, []);

  useEffect(() => {
    void fetchRevokedCount();
  }, [fetchRevokedCount]);

  const fetchAgents = useCallback(async () => {
    setLoading(true);

    try {
      const result = await api.getAgents({
        active: tab === 'ALL' ? undefined : tab === 'ACTIVE',
        limit: 50,
      });
      setItems(result.items);
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error, 'Failed to load partners') });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);

    try {
      setSelected(await api.getAgent(id));
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error, 'Failed to load partner') });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAccessChange = async (
    application: AgentApplication,
    action: 'revoke' | 'restore',
  ) => {
    if (action === 'revoke') {
      // Reason is optional - it's an audit-trail note, and if entered it's
      // emailed to the partner. Cancelling the prompt aborts the revoke.
      const reason = prompt(
        `Revoke access for ${application.agencyName}?\n\nThey will be signed out and unable to log in until you restore access.\n\nOptional reason (emailed to the partner):`,
      );

      if (reason === null) return;

      try {
        await api.revokeAgent(application.id, reason.trim() || undefined);
        setMessage({
          type: 'success',
          text: `${application.agencyName} revoked. They can no longer sign in.`,
        });
        setSelected(null);
        void fetchAgents();
        void fetchRevokedCount();
      } catch (error) {
        setMessage({ type: 'error', text: errorText(error, 'Failed to revoke access') });
      }

      return;
    }

    if (
      !confirm(
        `Restore access for ${application.agencyName}? They will be able to sign in and book again.`,
      )
    ) {
      return;
    }

    try {
      await api.restoreAgent(application.id);
      setMessage({
        type: 'success',
        text: `${application.agencyName} restored. They can sign in again.`,
      });
      setSelected(null);
      void fetchAgents();
      void fetchRevokedCount();
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error, 'Failed to restore access') });
    }
  };

  const tabLabel = ACCESS_TABS.find((t) => t.id === tab)?.label ?? 'All';
  const activeShown = items.filter((i) => i.user.isActive).length;

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Partners"
        title="Booking Partners"
        subtitle="Booking partners are active as soon as they register. Review their KYC details and revoke or restore access here."
        note={!canDecide ? 'You have read-only access to Booking Partners.' : undefined}
        actions={
          <Tabs
            variant="glass"
            label="Partner access"
            active={tab}
            onChange={setTab}
            options={ACCESS_TABS.map((t) => ({
              key: t.id,
              label: t.label,
              count: t.id === 'REVOKED' && revokedCount > 0 ? revokedCount : undefined,
            }))}
          />
        }
        stats={
          <>
            <HeroStat icon={Handshake} label={`${tabLabel} partners`} value={loading ? null : items.length.toLocaleString('en-IN')} />
            <HeroStat icon={UserCheck} label="Active in view" value={loading ? null : activeShown.toLocaleString('en-IN')} />
            <HeroStat icon={UserX} label="Revoked" value={revokedCount.toLocaleString('en-IN')} />
          </>
        }
      />

      {message && (
        <div className="mb-6">
          <Alert tone={message.type} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </div>
      )}

      {selected ? (
        <ApplicationDetail
          application={selected}
          onBack={() => setSelected(null)}
          onAccessChange={handleAccessChange}
          onError={(text) => setMessage({ type: 'error', text })}
          canDecide={canDecide}
        />
      ) : (
        <Panel
          title={`${tabLabel} partners`}
          aside={!loading && <span className="text-xs font-semibold text-inactive">{items.length} shown</span>}
          flush
        >
          {loading ? (
            <Spinner label="Loading partners…" />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title={tab === 'REVOKED' ? 'No revoked partners.' : tab === 'ACTIVE' ? 'No active partners yet.' : 'Nothing here.'}
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className={TABLE_HEAD}>
                <tr className="border-b border-tertiary-button">
                  {['Agency', 'Contact', 'Location', 'Registered', 'Access', ''].map((h) => (
                    <th key={h} className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={TBODY}>
                {items.map((item) => (
                  <tr key={item.id} className={TROW}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-bold text-foreground">{item.agencyName}</p>
                      <p className="text-xs text-inactive">{item.user.name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-foreground">{item.user.email}</p>
                      <p className="text-xs text-inactive">{item.contactPhone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground">
                      {item.city}, {item.state}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-inactive">{formatDate(item.submittedAt)}</td>
                    <td className="px-5 py-3.5">
                      <AccessBadge isActive={item.user.isActive} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => void openDetail(item.id)}
                        disabled={detailLoading}
                        className={`${BTN_GHOST} ${BTN_SM}`}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function ApplicationDetail({
  application,
  onBack,
  onAccessChange,
  onError,
  canDecide,
}: {
  application: AgentApplication;
  onBack: () => void;
  onAccessChange: (a: AgentApplication, action: 'revoke' | 'restore') => void;
  onError: (text: string) => void;
  canDecide: boolean;
}) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const reveal = async (field: 'pan' | 'aadhaar') => {
    if (
      !confirm(
        `Reveal the full ${field.toUpperCase()} number?\n\nThis is recorded against your admin account in the audit log.`,
      )
    ) {
      return;
    }

    try {
      const { value } = await api.revealAgentNumber(application.id, field);
      setRevealed((prev) => ({ ...prev, [field]: value }));
    } catch (error) {
      onError(errorText(error, 'Failed to reveal number'));
    }
  };

  const isActive = application.user.isActive;

  return (
    <div className="animate-fade-up space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-links hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to list
      </button>

      <Panel title={application.agencyName} aside={<AccessBadge isActive={isActive} />}>
        <p className="-mt-1 mb-5 text-sm text-inactive">Registered {formatDate(application.submittedAt)}</p>

        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          <Field label="Contact person" value={application.user.name} />
          <Field
            label="Email"
            value={application.user.email}
            hint={application.user.emailVerified ? undefined : 'Email not verified'}
          />
          <Field label="Phone" value={application.contactPhone} />
          <Field label="GSTIN" value={application.gstNumber || '-'} />
          <Field
            label="Address"
            value={[
              application.addressLine1,
              application.addressLine2,
              `${application.city}, ${application.state} ${application.pincode}`,
            ]
              .filter(Boolean)
              .join(', ')}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-tertiary-button pt-6 md:grid-cols-2">
          <RevealableField
            label="PAN"
            masked={application.panNumberMasked}
            revealed={revealed.pan}
            onReveal={() => void reveal('pan')}
          />
          <RevealableField
            label="Aadhaar"
            masked={application.aadhaarNumberMasked}
            revealed={revealed.aadhaar}
            onReveal={() => void reveal('aadhaar')}
          />
        </div>
      </Panel>

      <Panel title="Documents" aside={<span className="text-xs text-inactive">Opening a document is recorded in the audit log.</span>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {application.documents.map((doc) => (
            <DocumentCard key={doc.id} applicationId={application.id} doc={doc} onError={onError} />
          ))}
        </div>
      </Panel>

      {application.rejectionReason && (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-danger">Previous rejection reason</p>
          <p className="text-sm text-foreground">{application.rejectionReason}</p>
        </div>
      )}

      <Panel title="Audit trail">
        <ol className="space-y-3">
          {application.events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="w-28 shrink-0 text-inactive">{formatDate(event.createdAt)}</span>
              <span className="text-foreground">
                <strong className="font-bold text-foreground">{event.action}</strong>
                {event.actor && <span className="text-inactive"> by {event.actor.name}</span>}
                {event.note && <span className="mt-0.5 block text-inactive">{event.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      {!canDecide ? (
        <p className="text-sm text-inactive">
          You have read-only access to Booking Partners, so you cannot change this
          partner's access.
        </p>
      ) : isActive ? (
        <div className={`flex flex-wrap items-center justify-between gap-4 p-5 ${CARD}`}>
          <p className="text-sm text-inactive">This partner is active and can sign in.</p>
          <button onClick={() => onAccessChange(application, 'revoke')} className={BTN_DANGER}>
            Revoke access
          </button>
        </div>
      ) : (
        <div className={`flex flex-wrap items-center justify-between gap-4 p-5 ${CARD}`}>
          <p className="text-sm text-inactive">This partner's access is revoked - they cannot sign in.</p>
          <button onClick={() => onAccessChange(application, 'restore')} className={BTN_SUCCESS}>
            Restore access
          </button>
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  applicationId,
  doc,
  onError,
}: {
  applicationId: string;
  doc: AgentDocument;
  onError: (text: string) => void;
}) {
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);

    try {
      const info = await api.getAgentDocumentUrl(applicationId, doc.id);

      if (info.mode === 'signed' && info.url) {
        // GCS: the browser fetches straight from Google. Opened immediately and
        // never persisted - the URL expires in ~5 minutes and is a bearer
        // credential for a raw identity document.
        window.open(info.url, '_blank', 'noopener,noreferrer');
        return;
      }

      // Local storage: no browser-reachable URL exists, and the streaming
      // endpoint needs an Authorization header that window.open() cannot send.
      // So pull the bytes ourselves and open them as a blob.
      const blob = await api.getAgentDocumentBlob(applicationId, doc.id);
      const objectUrl = URL.createObjectURL(blob);

      window.open(objectUrl, '_blank', 'noopener,noreferrer');

      // The new tab has already loaded it by now. Revoking frees the buffer -
      // these are multi-megabyte scans and would otherwise be pinned in memory
      // for the life of the page.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      onError(errorText(error, 'Failed to open document'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      onClick={() => void open()}
      disabled={opening}
      className={`group flex items-center gap-3 px-4 py-3 text-left disabled:opacity-50 ${CARD_LINK}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-links">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground group-hover:text-links">
          {DOC_LABELS[doc.type] ?? doc.type}
        </span>
        <span className="block text-xs text-inactive">
          {opening ? 'Opening…' : `${Math.round(doc.sizeBytes / 1024)} KB`}
        </span>
      </span>
    </button>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className={`mb-1 ${LABEL}`}>{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs font-semibold text-amber-700">{hint}</p>}
    </div>
  );
}

function RevealableField({
  label,
  masked,
  revealed,
  onReveal,
}: {
  label: string;
  masked: string;
  revealed?: string;
  onReveal: () => void;
}) {
  return (
    <div>
      <p className={`mb-1 ${LABEL}`}>{label}</p>
      <div className="flex items-center gap-3">
        <p className="font-mono text-sm text-foreground">{revealed ?? masked}</p>
        {!revealed && (
          <button onClick={onReveal} className="text-xs font-bold text-links hover:underline">
            Reveal
          </button>
        )}
      </div>
    </div>
  );
}
