import { useEffect, useState, useCallback } from 'react';
import { Plus, Tag } from 'lucide-react';
import { api, type Offer, type OfferCategory, type ColorTheme } from '../lib/api';
import { Alert, Badge, EmptyState, PageHeader, SectionTitle, Spinner } from '../components/ui';
import {
  BTN_GHOST,
  BTN_PRIMARY,
  CARD,
  FIELD_LABEL,
  GRADIENTS,
  INPUT,
  LINK_BTN,
  LINK_BTN_DANGER,
  PAGE,
  SELECT,
  TABLE_HEAD,
  TBODY,
  TH,
  TONES,
  TROW,
  type Tone,
} from '../lib/ui-styles';

const CATEGORY_LABELS: Record<OfferCategory, string> = {
  ALL_OFFERS: 'All Offers',
  BANK_OFFERS: 'Bank Offers',
  FLIGHTS: 'Flights',
  HOTELS: 'Hotels',
  HOLIDAYS: 'Holidays',
  VISA: 'Visa',
};

const CATEGORIES: OfferCategory[] = ['ALL_OFFERS', 'BANK_OFFERS', 'FLIGHTS', 'HOTELS', 'HOLIDAYS', 'VISA'];
const COLOR_THEMES: ColorTheme[] = ['blue', 'green', 'orange', 'purple', 'teal', 'pink'];

/** Same gradients the homepage Offers cards use for each theme. */
const COLOR_PREVIEW: Record<ColorTheme, string> = {
  blue: `bg-gradient-to-br ${GRADIENTS.blue}`,
  green: `bg-gradient-to-br ${GRADIENTS.green}`,
  orange: `bg-gradient-to-br ${GRADIENTS.orange}`,
  purple: `bg-gradient-to-br ${GRADIENTS.purple}`,
  teal: `bg-gradient-to-br ${GRADIENTS.teal}`,
  pink: `bg-gradient-to-br ${GRADIENTS.pink}`,
};

const categoryTone: Record<OfferCategory, Tone> = {
  ALL_OFFERS: 'slate',
  BANK_OFFERS: 'amber',
  FLIGHTS: 'blue',
  HOTELS: 'amber',
  HOLIDAYS: 'green',
  VISA: 'purple',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'FLIGHTS' as OfferCategory,
  colorTheme: 'blue' as ColorTheme,
  isActive: true,
  sortOrder: 0,
  validFrom: '',
  validUntil: '',
};

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function Offers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getOffers();
      setOffers(data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load offers' });
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

  function openEdit(offer: Offer) {
    setForm({
      title: offer.title,
      description: offer.description,
      category: offer.category,
      colorTheme: offer.colorTheme,
      isActive: offer.isActive,
      sortOrder: offer.sortOrder,
      validFrom: offer.validFrom ? offer.validFrom.slice(0, 16) : '',
      validUntil: offer.validUntil ? offer.validUntil.slice(0, 16) : '',
    });
    setEditingId(offer.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.description.trim()) {
      setMessage({ type: 'error', text: 'Title and description are required' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        colorTheme: form.colorTheme,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      };
      if (editingId) {
        await api.updateOffer(editingId, payload);
        setMessage({ type: 'success', text: 'Offer updated' });
      } else {
        await api.createOffer(payload);
        setMessage({ type: 'success', text: 'Offer created' });
      }
      closeForm();
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to save offer') });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this offer?')) return;
    try {
      await api.deleteOffer(id);
      setMessage({ type: 'success', text: 'Offer deleted' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to delete offer') });
    }
  }

  async function handleToggleActive(offer: Offer) {
    try {
      await api.updateOffer(offer.id, { isActive: !offer.isActive });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'Failed to update offer') });
    }
  }

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Promotions"
        title="Offers"
        subtitle="Manage homepage offer banners"
        actions={
          <button onClick={openCreate} className={BTN_PRIMARY}>
            <Plus className="h-4 w-4" /> New Offer
          </button>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.type}>{message.text}</Alert>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className={`animate-fade-up mb-6 p-5 sm:p-6 ${CARD}`}>
          <SectionTitle>{editingId ? 'Edit Offer' : 'New Offer'}</SectionTitle>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Title */}
            <div className="md:col-span-2">
              <label className={FIELD_LABEL}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={INPUT}
                placeholder="e.g. Flat ₹1500 off on Flights"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className={FIELD_LABEL}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className={`${INPUT} resize-none`}
                placeholder="e.g. Use code SOUL1500 on your next international booking"
              />
            </div>

            {/* Category */}
            <div>
              <label className={FIELD_LABEL}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as OfferCategory }))}
                className={SELECT}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            {/* Color Theme */}
            <div>
              <label className={FIELD_LABEL}>Color Theme</label>
              <div className="flex flex-wrap gap-2.5 pt-1">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, colorTheme: theme }))}
                    className={`h-8 w-8 rounded-full shadow-md ${COLOR_PREVIEW[theme]} transition-all ${
                      form.colorTheme === theme ? 'scale-110 ring-2 ring-links ring-offset-2 ring-offset-peace' : 'hover:scale-105'
                    }`}
                    title={theme}
                  />
                ))}
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <label className={FIELD_LABEL}>Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className={INPUT}
              />
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
              {saving ? 'Saving...' : editingId ? 'Update Offer' : 'Create Offer'}
            </button>
            <button onClick={closeForm} className={BTN_GHOST}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Offers Table */}
      {loading ? (
        <div className={CARD}>
          <Spinner label="Loading offers…" />
        </div>
      ) : offers.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            icon={Tag}
            title="No offers yet"
            message="No offers yet. Create one to show it on the homepage."
            action={
              <button onClick={openCreate} className={BTN_PRIMARY}>
                <Plus className="h-4 w-4" /> New Offer
              </button>
            }
          />
        </div>
      ) : (
        <div className={`overflow-x-auto ${CARD}`}>
          <table className="w-full min-w-[680px] text-sm">
            <thead className={TABLE_HEAD}>
              <tr className="border-b border-tertiary-button">
                <th className={TH}>Color</th>
                <th className={TH}>Title</th>
                <th className={TH}>Category</th>
                <th className={TH}>Sort</th>
                <th className={TH}>Validity</th>
                <th className={TH}>Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className={TBODY}>
              {offers.map((offer) => (
                <tr key={offer.id} className={TROW}>
                  <td className="px-5 py-3.5">
                    <div className={`h-8 w-8 rounded-lg shadow-md ${COLOR_PREVIEW[offer.colorTheme as ColorTheme] ?? 'bg-tertiary-button'}`} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-foreground">{offer.title}</div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-inactive">{offer.description}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={categoryTone[offer.category]}>{CATEGORY_LABELS[offer.category]}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-inactive">{offer.sortOrder}</td>
                  <td className="px-5 py-3.5 text-xs text-inactive">
                    {offer.validFrom || offer.validUntil ? (
                      <span>
                        {offer.validFrom ? new Date(offer.validFrom).toLocaleDateString() : '-'}
                        {' → '}
                        {offer.validUntil ? new Date(offer.validUntil).toLocaleDateString() : '∞'}
                      </span>
                    ) : (
                      <span>Always</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleToggleActive(offer)}
                      title="Click to toggle"
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition-opacity hover:opacity-80 ${
                        TONES[offer.isActive ? 'green' : 'slate']
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {offer.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEdit(offer)} className={LINK_BTN}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(offer.id)} className={LINK_BTN_DANGER}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
