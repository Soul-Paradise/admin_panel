import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type AgentApplication,
  type AgentDocument,
  type AgentListItem,
  type AgentStatus,
} from '../lib/api';

const STATUS_TABS: Array<{ id: AgentStatus | 'ALL'; label: string }> = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'ALL', label: 'All' },
];

const statusBadgeColors: Record<AgentStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  UNDER_REVIEW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  APPROVED: 'bg-green-500/15 text-green-400 border-green-500/30',
  REJECTED: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const DOC_LABELS: Record<string, string> = {
  PAN_CARD: 'PAN Card',
  AADHAAR_FRONT: 'Aadhaar (Front)',
  AADHAAR_BACK: 'Aadhaar (Back)',
  GST_CERTIFICATE: 'GST Certificate',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Agents() {
  const [tab, setTab] = useState<AgentStatus | 'ALL'>('PENDING');
  const [items, setItems] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [selected, setSelected] = useState<AgentApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Shown as a badge on the Pending tab. Fetched independently of the current
  // tab, so a waiting application is visible even while you're looking at
  // Approved — otherwise a new applicant can sit unreviewed and unnoticed.
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    try {
      const result = await api.getAgents({ status: 'PENDING', limit: 1 });
      setPendingCount(result.pagination.total);
    } catch {
      // A failed badge count must not take the page down with it.
    }
  }, []);

  useEffect(() => {
    void fetchPendingCount();
  }, [fetchPendingCount]);

  const fetchAgents = useCallback(async () => {
    setLoading(true);

    try {
      const result = await api.getAgents({
        status: tab === 'ALL' ? undefined : tab,
        limit: 50,
      });
      setItems(result.items);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load agents' });
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
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load application' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDecision = async (
    application: AgentApplication,
    decision: 'approve' | 'reject',
  ) => {
    if (decision === 'approve') {
      if (
        !confirm(
          `Approve ${application.agencyName}? They will immediately be able to sign in and book as a partner.`,
        )
      ) {
        return;
      }

      try {
        await api.approveAgent(application.id);
        setMessage({
          type: 'success',
          text: `${application.agencyName} approved. They can now sign in.`,
        });
        setSelected(null);
        void fetchAgents();
        void fetchPendingCount();
      } catch (error: any) {
        setMessage({ type: 'error', text: error.message || 'Failed to approve' });
      }

      return;
    }

    // The reason is emailed verbatim to the applicant and is the only guidance
    // they get for fixing their submission, so require something actionable.
    const reason = prompt(
      'Why is this application being rejected?\n\nThis is emailed to the applicant along with a link to upload corrected documents.',
    );

    if (reason === null) return;

    if (reason.trim().length < 10) {
      setMessage({
        type: 'error',
        text: 'Give the applicant an actionable reason (at least 10 characters).',
      });
      return;
    }

    try {
      await api.rejectAgent(application.id, reason.trim());
      setMessage({
        type: 'success',
        text: `${application.agencyName} rejected. They have been emailed a resubmission link.`,
      });
      setSelected(null);
      void fetchAgents();
      void fetchPendingCount();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to reject' });
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Booking Partners</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review agent KYC documents and approve or reject applications.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 flex items-start justify-between gap-4 px-4 py-3 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <span className="text-sm">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-lg leading-none opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.id === 'PENDING' && pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {selected ? (
        <ApplicationDetail
          application={selected}
          onBack={() => setSelected(null)}
          onDecision={handleDecision}
          onError={(text) => setMessage({ type: 'error', text })}
        />
      ) : loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-12 text-center">
          <p className="text-gray-400">
            {tab === 'PENDING'
              ? 'No applications waiting for review.'
              : 'Nothing here.'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Agency', 'Contact', 'Location', 'Submitted', 'Status', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-white">
                        {item.agencyName}
                      </p>
                      <p className="text-xs text-gray-500">{item.user.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-300">{item.user.email}</p>
                      <p className="text-xs text-gray-500">{item.contactPhone}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300">
                      {item.city}, {item.state}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {formatDate(item.submittedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${statusBadgeColors[item.status]}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {/* A real button, not a text link: this is the primary action
                          on the page, and approve/reject live behind it. */}
                      <button
                        onClick={() => void openDetail(item.id)}
                        disabled={detailLoading}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                          item.status === 'PENDING'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'border border-gray-700 text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        {item.status === 'PENDING'
                          ? 'Review documents'
                          : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationDetail({
  application,
  onBack,
  onDecision,
  onError,
}: {
  application: AgentApplication;
  onBack: () => void;
  onDecision: (a: AgentApplication, d: 'approve' | 'reject') => void;
  onError: (text: string) => void;
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
    } catch (error: any) {
      onError(error.message || 'Failed to reveal number');
    }
  };

  const isDecided = application.status === 'APPROVED';

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-sm font-medium text-gray-400 hover:text-white"
      >
        &larr; Back to list
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">
              {application.agencyName}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Submitted {formatDate(application.submittedAt)}
            </p>
          </div>
          <span
            className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border shrink-0 ${statusBadgeColors[application.status]}`}
          >
            {application.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <Field label="Contact person" value={application.user.name} />
          <Field
            label="Email"
            value={application.user.email}
            hint={application.user.emailVerified ? undefined : 'Email not verified'}
          />
          <Field label="Phone" value={application.contactPhone} />
          <Field label="GSTIN" value={application.gstNumber || '—'} />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-6 pt-6 border-t border-gray-800">
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
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Documents</h3>
        <p className="text-xs text-gray-500 mb-4">
          Opening a document is recorded in the audit log.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {application.documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              applicationId={application.id}
              doc={doc}
              onError={onError}
            />
          ))}
        </div>
      </div>

      {application.rejectionReason && (
        <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-1">
            Previous rejection reason
          </p>
          <p className="text-sm text-gray-300">{application.rejectionReason}</p>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Audit trail</h3>
        <ol className="space-y-3">
          {application.events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="text-gray-600 shrink-0 w-28">
                {formatDate(event.createdAt)}
              </span>
              <span className="text-gray-300">
                <strong className="text-white">{event.action}</strong>
                {event.actor && (
                  <span className="text-gray-500"> by {event.actor.name}</span>
                )}
                {event.note && (
                  <span className="block text-gray-500 mt-0.5">{event.note}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {isDecided ? (
        <p className="text-sm text-gray-500">
          This partner is already approved and can sign in.
        </p>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => onDecision(application, 'approve')}
            className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
          >
            Approve partner
          </button>
          <button
            onClick={() => onDecision(application, 'reject')}
            className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
          >
            Reject
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
        // never persisted — the URL expires in ~5 minutes and is a bearer
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

      // The new tab has already loaded it by now. Revoking frees the buffer —
      // these are multi-megabyte scans and would otherwise be pinned in memory
      // for the life of the page.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error: any) {
      onError(error.message || 'Failed to open document');
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      onClick={() => void open()}
      disabled={opening}
      className="flex flex-col items-start gap-1 px-4 py-3 rounded-lg border border-gray-800 bg-gray-800/40 hover:border-blue-500/50 hover:bg-gray-800 transition-colors text-left disabled:opacity-50"
    >
      <span className="text-sm font-medium text-white">
        {DOC_LABELS[doc.type] ?? doc.type}
      </span>
      <span className="text-xs text-gray-500">
        {opening ? 'Opening…' : `${Math.round(doc.sizeBytes / 1024)} KB`}
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
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm text-gray-200">{value}</p>
      {hint && <p className="text-xs text-amber-400 mt-0.5">{hint}</p>}
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
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-center gap-3">
        <p className="text-sm font-mono text-gray-200">{revealed ?? masked}</p>
        {!revealed && (
          <button
            onClick={onReveal}
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Reveal
          </button>
        )}
      </div>
    </div>
  );
}
