import { useEffect, useState, useCallback } from 'react';
import { BadgePercent, CheckCircle2, Layers, Plus } from 'lucide-react';
import {
  api,
  type ServiceCommission,
  type ServiceType,
  type CommissionType,
  type CommissionAudience,
} from '../lib/api';
import { Alert, Badge, EmptyState, HeroStat, PageHeader, Panel, Spinner, Tabs } from '../components/ui';
import {
  BTN_GHOST,
  BTN_PRIMARY,
  CHECKBOX,
  FIELD_LABEL,
  INPUT,
  LINK_BTN,
  LINK_BTN_DANGER,
  PAGE,
  SELECT,
  TABLE_HEAD,
  TBODY,
  TH,
  TROW,
  TONES,
  type Tone,
} from '../lib/ui-styles';

const SERVICE_LABELS: Record<ServiceType, string> = {
  FLIGHT: 'Flight',
  HOTEL: 'Hotel',
  TRAVEL_PLAN: 'Travel Plan',
  INSURANCE: 'Travel Insurance',
};

const SERVICE_TYPES: ServiceType[] = ['FLIGHT', 'HOTEL', 'TRAVEL_PLAN', 'INSURANCE'];

const SUBTYPE_OPTIONS: Record<ServiceType, { value: string | null; label: string }[]> = {
  FLIGHT: [
    { value: 'domestic', label: 'Domestic' },
    { value: 'international', label: 'International' },
  ],
  HOTEL: [
    { value: 'domestic', label: 'Domestic' },
    { value: 'international', label: 'International' },
  ],
  TRAVEL_PLAN: [{ value: null, label: 'All Travel Plans' }],
  INSURANCE: [{ value: null, label: 'All (Domestic & International)' }],
};

const serviceTone: Record<ServiceType, Tone> = {
  FLIGHT: 'blue',
  HOTEL: 'amber',
  TRAVEL_PLAN: 'green',
  INSURANCE: 'purple',
};

// Rendered in this order under every service. B2C is the retail consumer; B2B
// is the approved booking partner (agent).
const AUDIENCE_ORDER: CommissionAudience[] = ['B2C', 'B2B'];

const AUDIENCE_LABELS: Record<CommissionAudience, string> = {
  B2C: 'Common User (B2C)',
  B2B: 'Agents (B2B)',
};

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback;

export default function Commissions() {
  const [commissions, setCommissions] = useState<ServiceCommission[]>([]);
  const [activeTab, setActiveTab] = useState<CommissionAudience>('B2C');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formServiceType, setFormServiceType] = useState<ServiceType>('FLIGHT');
  const [formAudience, setFormAudience] = useState<CommissionAudience>('B2C');
  const [formSubType, setFormSubType] = useState<string | null>('domestic');
  const [formCommissionType, setFormCommissionType] = useState<CommissionType>('PERCENTAGE');
  const [formValue, setFormValue] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const fetchCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCommissions();
      setCommissions(data);
    } catch (err) {
      console.error('Failed to fetch commissions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  const resetForm = () => {
    setFormServiceType('FLIGHT');
    setFormAudience('B2C');
    setFormSubType('domestic');
    setFormCommissionType('PERCENTAGE');
    setFormValue('');
    setFormIsActive(true);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (c: ServiceCommission) => {
    setEditingId(c.id);
    setFormServiceType(c.serviceType);
    setFormAudience(c.audience);
    setFormSubType(c.subType);
    setFormCommissionType(c.commissionType);
    setFormValue(String(c.value));
    setFormIsActive(c.isActive);
    setShowForm(true);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(formValue);
    if (isNaN(value) || value <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid positive number' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        await api.updateCommission(editingId, {
          commissionType: formCommissionType,
          value,
          isActive: formIsActive,
        });
        setMessage({ type: 'success', text: 'Commission rate updated successfully' });
      } else {
        await api.createCommission({
          serviceType: formServiceType,
          subType: formSubType,
          audience: formAudience,
          commissionType: formCommissionType,
          value,
          isActive: formIsActive,
        });
        setMessage({ type: 'success', text: 'Commission rate created successfully' });
      }
      resetForm();
      await fetchCommissions();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to save commission') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: ServiceCommission) => {
    if (!confirm(`Delete the ${AUDIENCE_LABELS[c.audience]} ${SERVICE_LABELS[c.serviceType]} ${c.subType || ''} commission?`)) return;

    setMessage(null);
    try {
      await api.deleteCommission(c.id);
      setMessage({ type: 'success', text: 'Commission rate deleted' });
      await fetchCommissions();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to delete commission') });
    }
  };

  const handleToggleActive = async (c: ServiceCommission) => {
    setMessage(null);
    try {
      await api.updateCommission(c.id, { isActive: !c.isActive });
      await fetchCommissions();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to update status') });
    }
  };

  // Rates for the active tab (audience), grouped by service type.
  const grouped = commissions
    .filter((c) => c.audience === activeTab)
    .reduce(
      (acc, c) => {
        if (!acc[c.serviceType]) acc[c.serviceType] = [];
        acc[c.serviceType].push(c);
        return acc;
      },
      {} as Record<ServiceType, ServiceCommission[]>,
    );

  const servicesWithRates = SERVICE_TYPES.filter((svc) => grouped[svc]?.length);
  const tabRates = commissions.filter((c) => c.audience === activeTab);

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Pricing"
        title="Commission Rates"
        subtitle="Set markup rates for each service. Commission is added to the base price shown to customers."
        actions={
          <>
            {/* Audience tabs */}
            <Tabs
              label="Audience"
              variant="glass"
              active={activeTab}
              onChange={setActiveTab}
              options={AUDIENCE_ORDER.map((aud) => ({ key: aud, label: AUDIENCE_LABELS[aud] }))}
            />
            {!showForm && (
              <button
                onClick={() => {
                  setFormAudience(activeTab);
                  setShowForm(true);
                  setMessage(null);
                }}
                className={BTN_PRIMARY}
              >
                <Plus className="h-4 w-4" /> Add Rate
              </button>
            )}
          </>
        }
        stats={
          <>
            <HeroStat icon={BadgePercent} label={`${activeTab} rates`} value={loading ? null : tabRates.length} />
            <HeroStat icon={CheckCircle2} label="Active rates" value={loading ? null : tabRates.filter((c) => c.isActive).length} />
            <HeroStat icon={Layers} label="Services covered" value={loading ? null : `${servicesWithRates.length} of ${SERVICE_TYPES.length}`} />
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

      {/* Form */}
      {showForm && (
        <Panel title={editingId ? 'Edit Commission Rate' : 'New Commission Rate'} className="animate-fade-up mb-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Service Type */}
              <div>
                <label className={FIELD_LABEL}>Service Type</label>
                <select
                  value={formServiceType}
                  onChange={(e) => {
                    const svc = e.target.value as ServiceType;
                    setFormServiceType(svc);
                    setFormSubType(SUBTYPE_OPTIONS[svc][0].value);
                  }}
                  disabled={!!editingId}
                  className={SELECT}
                >
                  {SERVICE_TYPES.map((svc) => (
                    <option key={svc} value={svc}>
                      {SERVICE_LABELS[svc]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audience */}
              <div>
                <label className={FIELD_LABEL}>Applies To</label>
                <select
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value as CommissionAudience)}
                  disabled={!!editingId}
                  className={SELECT}
                >
                  {AUDIENCE_ORDER.map((aud) => (
                    <option key={aud} value={aud}>
                      {AUDIENCE_LABELS[aud]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className={FIELD_LABEL}>Category</label>
                <select
                  value={formSubType ?? ''}
                  onChange={(e) => setFormSubType(e.target.value || null)}
                  disabled={!!editingId}
                  className={SELECT}
                >
                  {(SUBTYPE_OPTIONS[formServiceType] || []).map((opt) => (
                    <option key={opt.label} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Commission Type */}
              <div>
                <label className={FIELD_LABEL}>Commission Type</label>
                <select
                  value={formCommissionType}
                  onChange={(e) => setFormCommissionType(e.target.value as CommissionType)}
                  className={SELECT}
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (₹)</option>
                </select>
              </div>

              {/* Value */}
              <div>
                <label className={FIELD_LABEL}>
                  {formCommissionType === 'PERCENTAGE' ? 'Percentage Value' : 'Amount in ₹'}
                </label>
                <div className="relative">
                  <span className="absolute top-1/2 left-4 -translate-y-1/2 text-sm font-semibold text-inactive">
                    {formCommissionType === 'PERCENTAGE' ? '%' : '₹'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder={formCommissionType === 'PERCENTAGE' ? 'e.g. 5' : 'e.g. 200'}
                    required
                    className={`${INPUT} pl-9`}
                  />
                </div>
                {formCommissionType === 'FIXED' && (
                  <p className="mt-1.5 text-xs text-inactive">
                    {formServiceType === 'FLIGHT'
                      ? 'Charged per passenger: 4 tickets in one booking pay this 4 times.'
                      : formServiceType === 'HOTEL'
                        ? 'Charged per room.'
                        : 'Charged once per booking.'}
                  </p>
                )}
              </div>
            </div>

            {/* Active toggle */}
            <label className="mb-5 flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className={CHECKBOX}
              />
              Active (commission will be applied to prices)
            </label>

            {/* Actions */}
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className={BTN_GHOST}>
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Loading */}
      {loading && (
        <Panel title="Commission rates" flush>
          <Spinner label="Loading commission rates…" />
        </Panel>
      )}

      {/* Empty state for the active tab */}
      {!loading && servicesWithRates.length === 0 && (
        <Panel title="Commission rates" flush>
          <EmptyState
            icon={BadgePercent}
            title={`No ${AUDIENCE_LABELS[activeTab]} commission rates configured yet.`}
            message='Click "+ Add Rate" to get started.'
          />
        </Panel>
      )}

      {/* Commission tables for the active tab (audience), grouped by service */}
      {!loading &&
        servicesWithRates.map((serviceType) => {
          const items = grouped[serviceType];
          const activeCount = items.filter((c) => c.isActive).length;
          return (
            <Panel
              key={serviceType}
              title={SERVICE_LABELS[serviceType]}
              aside={
                <Badge tone={serviceTone[serviceType]} dot>
                  {activeCount} of {items.length} active
                </Badge>
              }
              flush
              className="mb-6"
            >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead className={TABLE_HEAD}>
                      <tr className="border-b border-tertiary-button">
                        <th className={TH}>Category</th>
                        <th className={TH}>Type</th>
                        <th className={TH}>Value</th>
                        <th className={TH}>Status</th>
                        <th className={`${TH} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={TBODY}>
                      {items.map((c) => (
                        <tr key={c.id} className={TROW}>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-bold text-foreground">
                              {c.subType ? c.subType.charAt(0).toUpperCase() + c.subType.slice(1) : 'All'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm text-inactive">
                              {c.commissionType === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-extrabold text-foreground">
                              {c.commissionType === 'PERCENTAGE' ? `${c.value}%` : `₹${c.value}`}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {/* The status chip doubles as the toggle. */}
                            <button
                              onClick={() => handleToggleActive(c)}
                              title={c.isActive ? 'Click to deactivate' : 'Click to activate'}
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition-opacity hover:opacity-80 ${
                                TONES[c.isActive ? 'green' : 'slate']
                              }`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                              {c.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button onClick={() => handleEdit(c)} className={`${LINK_BTN} mr-4`}>
                              Edit
                            </button>
                            <button onClick={() => handleDelete(c)} className={LINK_BTN_DANGER}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </Panel>
          );
        })}
    </div>
  );
}
