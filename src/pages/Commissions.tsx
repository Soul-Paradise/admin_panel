import { useEffect, useState, useCallback } from 'react';
import {
  api,
  type ServiceCommission,
  type ServiceType,
  type CommissionType,
  type CommissionAudience,
} from '../lib/api';

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

const serviceBadgeColors: Record<ServiceType, string> = {
  FLIGHT: 'bg-blue-50 text-links border-blue-200',
  HOTEL: 'bg-amber-50 text-amber-700 border-amber-200',
  TRAVEL_PLAN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INSURANCE: 'bg-purple-50 text-purple-700 border-purple-200',
};

// Rendered in this order under every service. B2C is the retail consumer; B2B
// is the approved booking partner (agent).
const AUDIENCE_ORDER: CommissionAudience[] = ['B2C', 'B2B'];

const AUDIENCE_LABELS: Record<CommissionAudience, string> = {
  B2C: 'Common User (B2C)',
  B2B: 'Agents (B2B)',
};

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
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save commission' });
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete commission' });
    }
  };

  const handleToggleActive = async (c: ServiceCommission) => {
    setMessage(null);
    try {
      await api.updateCommission(c.id, { isActive: !c.isActive });
      await fetchCommissions();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update status' });
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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Commission Rates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set markup rates for each service. Commission is added to the base price shown to customers.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setFormAudience(activeTab); setShowForm(true); setMessage(null); }}
            className="px-4 py-2.5 bg-primary-button hover:bg-secondary-button text-peace text-sm font-medium rounded-lg transition-colors"
          >
            + Add Rate
          </button>
        )}
      </div>

      {/* Audience tabs */}
      <div className="flex gap-1 mb-6 border-b border-tertiary-button">
        {AUDIENCE_ORDER.map((aud) => (
          <button
            key={aud}
            onClick={() => setActiveTab(aud)}
            className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
              activeTab === aud
                ? 'border-primary-button text-foreground'
                : 'border-transparent text-gray-500 hover:text-foreground'
            }`}
          >
            {AUDIENCE_LABELS[aud]}
          </button>
        ))}
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm flex justify-between items-center ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="hover:opacity-75 ml-2">&times;</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 bg-peace border border-tertiary-button rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {editingId ? 'Edit Commission Rate' : 'New Commission Rate'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Service Type</label>
                <select
                  value={formServiceType}
                  onChange={(e) => {
                    const svc = e.target.value as ServiceType;
                    setFormServiceType(svc);
                    setFormSubType(SUBTYPE_OPTIONS[svc][0].value);
                  }}
                  disabled={!!editingId}
                  className="w-full px-4 py-2.5 bg-peace border border-gray-300 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {SERVICE_TYPES.map((svc) => (
                    <option key={svc} value={svc}>{SERVICE_LABELS[svc]}</option>
                  ))}
                </select>
              </div>

              {/* Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Applies To</label>
                <select
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value as CommissionAudience)}
                  disabled={!!editingId}
                  className="w-full px-4 py-2.5 bg-peace border border-gray-300 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {AUDIENCE_ORDER.map((aud) => (
                    <option key={aud} value={aud}>{AUDIENCE_LABELS[aud]}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
                <select
                  value={formSubType ?? ''}
                  onChange={(e) => setFormSubType(e.target.value || null)}
                  disabled={!!editingId}
                  className="w-full px-4 py-2.5 bg-peace border border-gray-300 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(SUBTYPE_OPTIONS[formServiceType] || []).map((opt) => (
                    <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Commission Type */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Commission Type</label>
                <select
                  value={formCommissionType}
                  onChange={(e) => setFormCommissionType(e.target.value as CommissionType)}
                  className="w-full px-4 py-2.5 bg-peace border border-gray-300 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (₹)</option>
                </select>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  {formCommissionType === 'PERCENTAGE' ? 'Percentage Value' : 'Amount in ₹'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
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
                    className="w-full pl-8 pr-4 py-2.5 bg-peace border border-gray-300 rounded-lg text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 bg-tertiary-button"
              />
              Active (commission will be applied to prices)
            </label>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-primary-button hover:bg-secondary-button text-peace text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 bg-background hover:bg-tertiary-button text-gray-600 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      )}

      {/* Empty state for the active tab */}
      {!loading && servicesWithRates.length === 0 && (
        <div className="bg-peace border border-tertiary-button rounded-xl shadow-sm py-16 text-center">
          <p className="text-gray-500">
            No {AUDIENCE_LABELS[activeTab]} commission rates configured yet.
          </p>
          <p className="text-gray-400 text-sm mt-1">Click "+ Add Rate" to get started.</p>
        </div>
      )}

      {/* Commission tables for the active tab (audience), grouped by service */}
      {!loading &&
        servicesWithRates.map((serviceType) => {
          const items = grouped[serviceType];
          return (
            <div key={serviceType} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${
                    serviceBadgeColors[serviceType]
                  }`}
                >
                  {SERVICE_LABELS[serviceType]}
                </span>
              </div>

              <div className="bg-peace border border-tertiary-button rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead className="bg-background">
                      <tr className="border-b border-tertiary-button">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                          Category
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                          Type
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                          Value
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                          Status
                        </th>
                        <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tertiary-button">
                      {items.map((c) => (
                        <tr key={c.id} className="hover:bg-background transition-colors">
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-foreground">
                              {c.subType
                                ? c.subType.charAt(0).toUpperCase() + c.subType.slice(1)
                                : 'All'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-600">
                              {c.commissionType === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-semibold text-foreground">
                              {c.commissionType === 'PERCENTAGE'
                                ? `${c.value}%`
                                : `₹${c.value}`}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => handleToggleActive(c)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
                                c.isActive
                                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                              }`}
                            >
                              <span
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  c.isActive ? 'bg-success' : 'bg-gray-400'
                                }`}
                              />
                              {c.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => handleEdit(c)}
                              className="text-sm text-links hover:text-blue-800 mr-3 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
                              className="text-sm text-red-700 hover:text-red-800 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
