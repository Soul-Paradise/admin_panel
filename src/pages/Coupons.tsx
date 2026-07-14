import { useEffect, useState, useCallback } from 'react';
import {
  api,
  type PromoCode,
  type CreatePromoCodeInput,
  type CommissionType,
  type ServiceType,
} from '../lib/api';
import { useAccess } from '../hooks/useAccess';

const DISCOUNT_TYPES: CommissionType[] = ['PERCENTAGE', 'FIXED'];

const SERVICE_TYPES: ServiceType[] = ['FLIGHT', 'HOTEL', 'TRAVEL_PLAN', 'INSURANCE'];

const SERVICE_LABELS: Record<ServiceType, string> = {
  FLIGHT: 'Flights',
  HOTEL: 'Hotels',
  TRAVEL_PLAN: 'Travel Plans',
  INSURANCE: 'Insurance',
};

const serviceBadgeColors: Record<ServiceType, string> = {
  FLIGHT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  HOTEL: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  TRAVEL_PLAN: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  INSURANCE: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const ALL_SERVICES_BADGE = 'bg-gray-500/15 text-gray-400 border-gray-500/30';

const EMPTY_FORM = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE' as CommissionType,
  discountValue: '',
  minOrderAmount: '',
  maxDiscount: '',
  validFrom: '',
  validUntil: '',
  usageLimit: '',
  serviceType: '' as ServiceType | '',
  isActive: true,
};

type FormState = typeof EMPTY_FORM;

function inr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatDiscount(coupon: PromoCode): string {
  return coupon.discountType === 'PERCENTAGE'
    ? `${coupon.discountValue}%`
    : inr(coupon.discountValue);
}

/** Blank string means "not set" for every optional numeric field. */
function toNullableNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function Coupons() {
  const { canWrite } = useAccess();
  const editable = canWrite('COUPONS');

  const [coupons, setCoupons] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPromoCodes();
      setCoupons(data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load coupons' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(coupon: PromoCode) {
    setForm({
      code: coupon.code,
      description: coupon.description ?? '',
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minOrderAmount: coupon.minOrderAmount === null ? '' : String(coupon.minOrderAmount),
      maxDiscount: coupon.maxDiscount === null ? '' : String(coupon.maxDiscount),
      validFrom: coupon.validFrom ? coupon.validFrom.slice(0, 16) : '',
      validUntil: coupon.validUntil ? coupon.validUntil.slice(0, 16) : '',
      usageLimit: coupon.usageLimit === null ? '' : String(coupon.usageLimit),
      serviceType: coupon.serviceType ?? '',
      isActive: coupon.isActive,
    });
    setEditingId(coupon.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave() {
    const code = form.code.trim().toUpperCase();
    const discountValue = Number(form.discountValue);

    // Mirror the backend rules so the user does not need a round-trip to learn them.
    if (!code) {
      setMessage({ type: 'error', text: 'Code is required' });
      return;
    }
    if (!form.discountValue.trim() || !Number.isFinite(discountValue) || discountValue <= 0) {
      setMessage({ type: 'error', text: 'Discount value must be greater than 0' });
      return;
    }
    if (form.discountType === 'PERCENTAGE' && discountValue > 100) {
      setMessage({ type: 'error', text: 'A percentage discount cannot exceed 100%' });
      return;
    }
    if (form.validFrom && form.validUntil && new Date(form.validUntil) <= new Date(form.validFrom)) {
      setMessage({ type: 'error', text: 'Valid Until must be after Valid From' });
      return;
    }

    const usageLimitRaw = toNullableNumber(form.usageLimit);

    setSaving(true);
    try {
      const payload: CreatePromoCodeInput = {
        code,
        description: form.description.trim() || null,
        discountType: form.discountType,
        discountValue,
        minOrderAmount: toNullableNumber(form.minOrderAmount),
        // maxDiscount is a percentage-only cap; a fixed discount is already its own ceiling.
        maxDiscount: form.discountType === 'PERCENTAGE' ? toNullableNumber(form.maxDiscount) : null,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
        isActive: form.isActive,
        usageLimit: usageLimitRaw === null ? null : Math.trunc(usageLimitRaw),
        serviceType: form.serviceType || null,
      };

      if (editingId) {
        // The backend rejects code changes outright, so it never leaves the client.
        const { code: _code, ...updates } = payload;
        await api.updatePromoCode(editingId, updates);
        setMessage({ type: 'success', text: 'Coupon updated' });
      } else {
        await api.createPromoCode(payload);
        setMessage({ type: 'success', text: 'Coupon created' });
      }
      closeForm();
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save coupon' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(coupon: PromoCode) {
    if (!confirm(`Delete coupon ${coupon.code}?`)) return;
    try {
      await api.deletePromoCode(coupon.id);
      setMessage({ type: 'success', text: 'Coupon deleted' });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to delete coupon' });
    }
  }

  async function handleToggleActive(coupon: PromoCode) {
    try {
      await api.updatePromoCode(coupon.id, { isActive: !coupon.isActive });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to update coupon' });
    }
  }

  const isPercentage = form.discountType === 'PERCENTAGE';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Coupons</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage promo codes and discounts</p>
          {!editable && (
            <p className="text-xs text-gray-600 mt-1">You have read-only access to Coupons.</p>
          )}
        </div>
        {editable && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Coupon
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Form */}
      {editable && showForm && (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            {editingId ? 'Edit Coupon' : 'New Coupon'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Code</label>
              <input
                type="text"
                value={form.code}
                disabled={!!editingId}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-wider placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-gray-500"
                placeholder="e.g. SOUL1500"
              />
              {editingId && (
                <p className="text-[11px] text-gray-600 mt-1">Code cannot be changed after creation.</p>
              )}
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Service (optional)</label>
              <select
                value={form.serviceType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, serviceType: e.target.value as ServiceType | '' }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">All services</option>
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{SERVICE_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="e.g. 20% off on international flight bookings"
              />
            </div>

            {/* Discount Type */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountType: e.target.value as CommissionType }))
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {DISCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'PERCENTAGE' ? 'Percentage (%)' : 'Fixed (₹)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Discount Value */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Discount Value</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={isPercentage ? 100 : undefined}
                  step="any"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={isPercentage ? '20' : '500'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                  {isPercentage ? '%' : '₹'}
                </span>
              </div>
            </div>

            {/* Min Order Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Min Order Amount (optional)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder="No minimum"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                  ₹
                </span>
              </div>
            </div>

            {/* Max Discount */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Max Discount (optional)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step="any"
                  disabled={!isPercentage}
                  value={isPercentage ? form.maxDiscount : ''}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  placeholder="No cap"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                  ₹
                </span>
              </div>
              {!isPercentage && (
                <p className="text-[11px] text-gray-600 mt-1">
                  Only applies to percentage discounts.
                </p>
              )}
            </div>

            {/* Usage Limit */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Usage Limit (optional)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={form.usageLimit}
                onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Unlimited"
              />
              <p className="text-[11px] text-gray-600 mt-1">Leave blank for unlimited redemptions.</p>
            </div>

            {/* Is Active */}
            <div className="flex items-center gap-3 pt-5">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <span className="text-sm text-gray-300">Active</span>
            </div>

            {/* Valid From */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Valid From (optional)</label>
              <input
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Valid Until */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Valid Until (optional)</label>
              <input
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-800">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
            </button>
            <button
              onClick={closeForm}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Coupons Table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No coupons yet. Create one to start offering discounts.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Validity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {coupons.map((coupon) => {
                const redeemed = coupon.usageCount > 0;
                const usagePercent =
                  coupon.usageLimit && coupon.usageLimit > 0
                    ? Math.min(100, (coupon.usageCount / coupon.usageLimit) * 100)
                    : 0;
                const exhausted = coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit;

                return (
                  <tr key={coupon.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-white tracking-wide">{coupon.code}</div>
                      {coupon.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{coupon.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{formatDiscount(coupon)}</div>
                      {coupon.maxDiscount !== null && (
                        <div className="text-[11px] text-gray-500 mt-0.5">max {inr(coupon.maxDiscount)}</div>
                      )}
                      {coupon.minOrderAmount !== null && (
                        <div className="text-[11px] text-gray-500">min order {inr(coupon.minOrderAmount)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          coupon.serviceType
                            ? serviceBadgeColors[coupon.serviceType]
                            : ALL_SERVICES_BADGE
                        }`}
                      >
                        {coupon.serviceType ? SERVICE_LABELS[coupon.serviceType] : 'All'}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[7rem]">
                      <div className="text-gray-400 text-xs">
                        {coupon.usageCount} / {coupon.usageLimit ?? '∞'}
                      </div>
                      {coupon.usageLimit !== null && (
                        <div className="mt-1.5 h-1 w-20 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              exhausted ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {coupon.validFrom || coupon.validUntil ? (
                        <span>
                          {coupon.validFrom ? new Date(coupon.validFrom).toLocaleDateString() : '—'}
                          {' → '}
                          {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString() : '∞'}
                        </span>
                      ) : (
                        <span className="text-gray-600">Always</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                            coupon.isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-gray-500/15 text-gray-400 border-gray-500/30 hover:bg-gray-500/25'
                          }`}
                        >
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            coupon.isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                          }`}
                        >
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editable && (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(coupon)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          {redeemed ? (
                            /* Redemption history is load-bearing for reporting, so the
                               backend refuses the delete. Show why rather than 400-ing. */
                            <button
                              disabled
                              title="Redeemed coupons can't be deleted — deactivate instead"
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-800/50 rounded-lg cursor-not-allowed"
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDelete(coupon)}
                              className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
