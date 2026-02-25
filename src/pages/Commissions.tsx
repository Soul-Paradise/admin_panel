import { useEffect, useState, useCallback } from 'react';
import {
  api,
  type ServiceCommission,
  type ServiceType,
  type CommissionType,
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
  FLIGHT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  HOTEL: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  TRAVEL_PLAN: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  INSURANCE: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

export default function Commissions() {
  const [commissions, setCommissions] = useState<ServiceCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formServiceType, setFormServiceType] = useState<ServiceType>('FLIGHT');
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
    if (!confirm(`Delete ${SERVICE_LABELS[c.serviceType]} ${c.subType || ''} commission?`)) return;

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

  // Group by service type
  const grouped = commissions.reduce(
    (acc, c) => {
      if (!acc[c.serviceType]) acc[c.serviceType] = [];
      acc[c.serviceType].push(c);
      return acc;
    },
    {} as Record<string, ServiceCommission[]>,
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Commission Rates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set markup rates for each service. Commission is added to the base price shown to customers.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setMessage(null); }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Rate
          </button>
        )}
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm flex justify-between items-center ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="hover:opacity-75 ml-2">&times;</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Commission Rate' : 'New Commission Rate'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Service Type</label>
                <select
                  value={formServiceType}
                  onChange={(e) => {
                    const svc = e.target.value as ServiceType;
                    setFormServiceType(svc);
                    setFormSubType(SUBTYPE_OPTIONS[svc][0].value);
                  }}
                  disabled={!!editingId}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {SERVICE_TYPES.map((svc) => (
                    <option key={svc} value={svc}>{SERVICE_LABELS[svc]}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                <select
                  value={formSubType ?? ''}
                  onChange={(e) => setFormSubType(e.target.value || null)}
                  disabled={!!editingId}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(SUBTYPE_OPTIONS[formServiceType] || []).map((opt) => (
                    <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Commission Type */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Commission Type</label>
                <select
                  value={formCommissionType}
                  onChange={(e) => setFormCommissionType(e.target.value as CommissionType)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (₹)</option>
                </select>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
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
                    className="w-full pl-8 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800"
              />
              Active (commission will be applied to prices)
            </label>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm font-medium rounded-lg transition-colors"
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

      {/* Empty state */}
      {!loading && commissions.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl py-16 text-center">
          <p className="text-gray-500">No commission rates configured yet.</p>
          <p className="text-gray-600 text-sm mt-1">Click "+ Add Rate" to get started.</p>
        </div>
      )}

      {/* Commission tables grouped by service type */}
      {!loading &&
        Object.entries(grouped).map(([serviceType, items]) => (
          <div key={serviceType} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${
                  serviceBadgeColors[serviceType as ServiceType]
                }`}
              >
                {SERVICE_LABELS[serviceType as ServiceType]}
              </span>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
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
                  <tbody className="divide-y divide-gray-800">
                    {items.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4">
                          <span className="text-sm font-medium text-white">
                            {c.subType
                              ? c.subType.charAt(0).toUpperCase() + c.subType.slice(1)
                              : 'All'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm text-gray-400">
                            {c.commissionType === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold text-white">
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
                                ? 'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25'
                                : 'bg-gray-500/15 text-gray-500 border-gray-500/30 hover:bg-gray-500/25'
                            }`}
                          >
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${
                                c.isActive ? 'bg-green-400' : 'bg-gray-500'
                              }`}
                            />
                            {c.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleEdit(c)}
                            className="text-sm text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="text-sm text-red-400 hover:text-red-300 transition-colors"
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
        ))}
    </div>
  );
}
