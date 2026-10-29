import { useEffect, useState, useCallback } from 'react';
import { api, type Offer, type OfferCategory, type ColorTheme } from '../lib/api';

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

const COLOR_PREVIEW: Record<ColorTheme, string> = {
  blue: 'bg-gradient-to-br from-blue-500 to-indigo-600',
  green: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  orange: 'bg-gradient-to-br from-orange-500 to-red-500',
  purple: 'bg-gradient-to-br from-purple-500 to-violet-600',
  teal: 'bg-gradient-to-br from-teal-500 to-cyan-600',
  pink: 'bg-gradient-to-br from-pink-500 to-rose-600',
};

const categoryBadgeColors: Record<OfferCategory, string> = {
  ALL_OFFERS: 'bg-gray-100 text-gray-600 border-gray-300',
  BANK_OFFERS: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  FLIGHTS: 'bg-blue-50 text-links border-blue-200',
  HOTELS: 'bg-amber-50 text-amber-700 border-amber-200',
  HOLIDAYS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VISA: 'bg-purple-50 text-purple-700 border-purple-200',
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save offer' });
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to delete offer' });
    }
  }

  async function handleToggleActive(offer: Offer) {
    try {
      await api.updateOffer(offer.id, { isActive: !offer.isActive });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to update offer' });
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Offers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage homepage offer banners</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary-button hover:bg-secondary-button text-peace text-sm font-medium rounded-lg transition-colors"
        >
          + New Offer
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 bg-peace border border-tertiary-button rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            {editingId ? 'Edit Offer' : 'New Offer'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:outline-none focus:border-blue-500"
                placeholder="e.g. Flat ₹1500 off on Flights"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="e.g. Use code SOUL1500 on your next international booking"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as OfferCategory }))}
                className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            {/* Color Theme */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Color Theme</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, colorTheme: theme }))}
                    className={`w-8 h-8 rounded-full ${COLOR_PREVIEW[theme]} transition-all ${
                      form.colorTheme === theme ? 'ring-2 ring-foreground ring-offset-2 ring-offset-peace scale-110' : ''
                    }`}
                    title={theme}
                  />
                ))}
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
              />
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
                <div className="w-10 h-5 bg-tertiary-button peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-button"></div>
              </label>
              <span className="text-sm text-gray-700">Active</span>
            </div>

            {/* Valid From */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid From (optional)</label>
              <input
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Valid Until */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until (optional)</label>
              <input
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                className="w-full bg-peace border border-gray-300 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4 pt-4 border-t border-tertiary-button">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-button hover:bg-secondary-button disabled:opacity-50 text-peace text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : editingId ? 'Update Offer' : 'Create Offer'}
            </button>
            <button
              onClick={closeForm}
              className="px-4 py-2 bg-background hover:bg-tertiary-button text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Offers Table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : offers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No offers yet. Create one to show it on the homepage.</p>
        </div>
      ) : (
        <div className="bg-peace border border-tertiary-button rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-background">
              <tr className="border-b border-tertiary-button">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Sort</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Validity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-tertiary-button">
              {offers.map((offer) => (
                <tr key={offer.id} className="hover:bg-background transition-colors">
                  <td className="px-4 py-3">
                    <div className={`w-7 h-7 rounded-full ${COLOR_PREVIEW[offer.colorTheme as ColorTheme] ?? 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{offer.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{offer.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${categoryBadgeColors[offer.category]}`}>
                      {CATEGORY_LABELS[offer.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{offer.sortOrder}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {offer.validFrom || offer.validUntil ? (
                      <span>
                        {offer.validFrom ? new Date(offer.validFrom).toLocaleDateString() : '-'}
                        {' → '}
                        {offer.validUntil ? new Date(offer.validUntil).toLocaleDateString() : '∞'}
                      </span>
                    ) : (
                      <span className="text-gray-400">Always</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(offer)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                        offer.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {offer.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(offer)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-foreground bg-background hover:bg-tertiary-button rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(offer.id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      >
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
