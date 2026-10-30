import { useEffect, useState, useCallback } from 'react';
import { Plus, TicketPercent } from 'lucide-react';
import {
  api,
  type PromoCode,
  type CreatePromoCodeInput,
  type UpdatePromoCodeInput,
  type CommissionType,
  type ServiceType,
} from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { Alert, Badge, EmptyState, PageHeader, SectionTitle, Spinner } from '../components/ui';
import {
  BTN_GHOST,
  BTN_PRIMARY,
  CARD,
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

const DISCOUNT_TYPES: CommissionType[] = ['PERCENTAGE', 'FIXED'];

const SERVICE_TYPES: ServiceType[] = ['FLIGHT', 'HOTEL', 'TRAVEL_PLAN', 'INSURANCE'];

const SERVICE_LABELS: Record<ServiceType, string> = {
  FLIGHT: 'Flights',
  HOTEL: 'Hotels',
  TRAVEL_PLAN: 'Travel Plans',
  INSURANCE: 'Insurance',
};

const serviceTone: Record<ServiceType, Tone> = {
  FLIGHT: 'blue',
  HOTEL: 'amber',
  TRAVEL_PLAN: 'green',
  INSURANCE: 'purple',
};

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

/** The backend rejects code changes outright, so it never leaves the client. */
function withoutCode({ code, ...updates }: CreatePromoCodeInput): UpdatePromoCodeInput {
  void code;
  return updates;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
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
        await api.updatePromoCode(editingId, withoutCode(payload));
        setMessage({ type: 'success', text: 'Coupon updated' });
      } else {
        await api.createPromoCode(payload);
        setMessage({ type: 'success', text: 'Coupon created' });
      }
      closeForm();
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to save coupon') });
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
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to delete coupon') });
    }
  }

  async function handleToggleActive(coupon: PromoCode) {
    try {
      await api.updatePromoCode(coupon.id, { isActive: !coupon.isActive });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to update coupon') });
    }
  }

  const isPercentage = form.discountType === 'PERCENTAGE';
  const suffix = 'pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-inactive';
  const hint = 'mt-1 text-[11px] text-inactive';

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Promotions"
        title="Coupons"
        subtitle="Manage promo codes and discounts"
        note={!editable ? 'You have read-only access to Coupons.' : undefined}
        actions={
          editable && (
            <button onClick={openCreate} className={BTN_PRIMARY}>
              <Plus className="h-4 w-4" /> New Coupon
            </button>
          )
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.type}>{message.text}</Alert>
        </div>
      )}

      {/* Form */}
      {editable && showForm && (
        <div className={`animate-fade-up mb-6 p-5 sm:p-6 ${CARD}`}>
          <SectionTitle>{editingId ? 'Edit Coupon' : 'New Coupon'}</SectionTitle>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Code */}
            <div>
              <label className={FIELD_LABEL}>Code</label>
              <input
                type="text"
                value={form.code}
                disabled={!!editingId}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className={`${INPUT} font-mono tracking-wider disabled:text-inactive`}
                placeholder="e.g. SOUL1500"
              />
              {editingId && <p className={hint}>Code cannot be changed after creation.</p>}
            </div>

            {/* Service Type */}
            <div>
              <label className={FIELD_LABEL}>Service (optional)</label>
              <select
                value={form.serviceType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, serviceType: e.target.value as ServiceType | '' }))
                }
                className={SELECT}
              >
                <option value="">All services</option>
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{SERVICE_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className={FIELD_LABEL}>Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className={`${INPUT} resize-none`}
                placeholder="e.g. 20% off on international flight bookings"
              />
            </div>

            {/* Discount Type */}
            <div>
              <label className={FIELD_LABEL}>Discount Type</label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountType: e.target.value as CommissionType }))
                }
                className={SELECT}
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
              <label className={FIELD_LABEL}>Discount Value</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={isPercentage ? 100 : undefined}
                  step="any"
                  value={form.discountValue}
                  onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                  className={`${INPUT} pr-9`}
                  placeholder={isPercentage ? '20' : '500'}
                />
                <span className={suffix}>{isPercentage ? '%' : '₹'}</span>
              </div>
            </div>

            {/* Min Order Amount */}
            <div>
              <label className={FIELD_LABEL}>Min Order Amount (optional)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                  className={`${INPUT} pr-9`}
                  placeholder="No minimum"
                />
                <span className={suffix}>₹</span>
              </div>
            </div>

            {/* Max Discount */}
            <div>
              <label className={FIELD_LABEL}>Max Discount (optional)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step="any"
                  disabled={!isPercentage}
                  value={isPercentage ? form.maxDiscount : ''}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                  className={`${INPUT} pr-9 disabled:opacity-50`}
                  placeholder="No cap"
                />
                <span className={suffix}>₹</span>
              </div>
              {!isPercentage && <p className={hint}>Only applies to percentage discounts.</p>}
            </div>

            {/* Usage Limit */}
            <div>
              <label className={FIELD_LABEL}>Usage Limit (optional)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={form.usageLimit}
                onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                className={INPUT}
                placeholder="Unlimited"
              />
              <p className={hint}>Leave blank for unlimited redemptions.</p>
            </div>

            {/* Is Active */}
            <div className="flex items-center gap-3 pt-7">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-tertiary-button transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-peace after:shadow-sm after:transition-all after:content-[''] peer-checked:bg-primary-button peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-links/30"></div>
              </label>
              <span className="text-sm font-semibold text-foreground">Active</span>
            </div>

            {/* Valid From */}
            <div>
              <label className={FIELD_LABEL}>Valid From (optional)</label>
              <input
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                className={INPUT}
              />
            </div>

            {/* Valid Until */}
            <div>
              <label className={FIELD_LABEL}>Valid Until (optional)</label>
              <input
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-tertiary-button pt-4">
            <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
              {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
            </button>
            <button onClick={closeForm} className={BTN_GHOST}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Coupons Table */}
      {loading ? (
        <div className={CARD}>
          <Spinner label="Loading coupons…" />
        </div>
      ) : coupons.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            icon={TicketPercent}
            title="No coupons yet"
            message="No coupons yet. Create one to start offering discounts."
            action={
              editable && (
                <button onClick={openCreate} className={BTN_PRIMARY}>
                  <Plus className="h-4 w-4" /> New Coupon
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full min-w-[680px] text-sm">
            <thead className={TABLE_HEAD}>
              <tr className="border-b border-tertiary-button">
                <th className={TH}>Code</th>
                <th className={TH}>Discount</th>
                <th className={TH}>Service</th>
                <th className={TH}>Usage</th>
                <th className={TH}>Validity</th>
                <th className={TH}>Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className={TBODY}>
              {coupons.map((coupon) => {
                const redeemed = coupon.usageCount > 0;
                const usagePercent =
                  coupon.usageLimit && coupon.usageLimit > 0
                    ? Math.min(100, (coupon.usageCount / coupon.usageLimit) * 100)
                    : 0;
                const exhausted = coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit;

                return (
                  <tr key={coupon.id} className={TROW}>
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold tracking-wide text-foreground">{coupon.code}</div>
                      {coupon.description && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-inactive">{coupon.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground">{formatDiscount(coupon)}</div>
                      {coupon.maxDiscount !== null && (
                        <div className="mt-0.5 text-[11px] text-inactive">max {inr(coupon.maxDiscount)}</div>
                      )}
                      {coupon.minOrderAmount !== null && (
                        <div className="text-[11px] text-inactive">min order {inr(coupon.minOrderAmount)}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={coupon.serviceType ? serviceTone[coupon.serviceType] : 'slate'}>
                        {coupon.serviceType ? SERVICE_LABELS[coupon.serviceType] : 'All'}
                      </Badge>
                    </td>
                    <td className="min-w-[7rem] px-5 py-3.5">
                      <div className="text-xs font-semibold text-inactive">
                        {coupon.usageCount} / {coupon.usageLimit ?? '∞'}
                      </div>
                      {coupon.usageLimit !== null && (
                        <div className="mt-1.5 h-1.5 w-20 overflow-hidden rounded-full bg-tertiary-button">
                          <div
                            className={`h-full rounded-full transition-all ${exhausted ? 'bg-danger' : 'bg-links'}`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-inactive">
                      {coupon.validFrom || coupon.validUntil ? (
                        <span>
                          {coupon.validFrom ? new Date(coupon.validFrom).toLocaleDateString() : '-'}
                          {' → '}
                          {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString() : '∞'}
                        </span>
                      ) : (
                        <span>Always</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {editable ? (
                        <button
                          onClick={() => handleToggleActive(coupon)}
                          title="Click to toggle"
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition-opacity hover:opacity-80 ${
                            TONES[coupon.isActive ? 'green' : 'slate']
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </button>
                      ) : (
                        <Badge tone={coupon.isActive ? 'green' : 'slate'} dot>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {editable && (
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEdit(coupon)} className={LINK_BTN}>
                            Edit
                          </button>
                          {redeemed ? (
                            /* Redemption history is load-bearing for reporting, so the
                               backend refuses the delete. Show why rather than 400-ing. */
                            <button
                              disabled
                              title="Redeemed coupons can't be deleted - deactivate instead"
                              className={`${LINK_BTN_DANGER} cursor-not-allowed`}
                            >
                              Delete
                            </button>
                          ) : (
                            <button onClick={() => handleDelete(coupon)} className={LINK_BTN_DANGER}>
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
