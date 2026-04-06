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
  ALL_OFFERS: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  BANK_OFFERS: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  FLIGHTS: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  HOTELS: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  HOLIDAYS: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  VISA: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Offers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage homepage offer banners</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Offer
        </button>
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
      {showForm && (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            {editingId ? 'Edit Offer' : 'New Offer'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="e.g. Flat ₹1500 off on Flights"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="e.g. Use code SOUL1500 on your next international booking"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as OfferCategory }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            {/* Color Theme */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Color Theme</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, colorTheme: theme }))}
                    className={`w-8 h-8 rounded-full ${COLOR_PREVIEW[theme]} transition-all ${
                      form.colorTheme === theme ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''
                    }`}
                    title={theme}
                  />
                ))}
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
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
              {saving ? 'Saving...' : editingId ? 'Update Offer' : 'Create Offer'}
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

      {/* Offers Table */}
      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : offers.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No offers yet. Create one to show it on the homepage.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Sort</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Validity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {offers.map((offer) => (
                <tr key={offer.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className={`w-7 h-7 rounded-full ${COLOR_PREVIEW[offer.colorTheme as ColorTheme] ?? 'bg-gray-600'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{offer.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{offer.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${categoryBadgeColors[offer.category]}`}>
                      {CATEGORY_LABELS[offer.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{offer.sortOrder}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {offer.validFrom || offer.validUntil ? (
                      <span>
                        {offer.validFrom ? new Date(offer.validFrom).toLocaleDateString() : '—'}
                        {' → '}
                        {offer.validUntil ? new Date(offer.validUntil).toLocaleDateString() : '∞'}
                      </span>
                    ) : (
                      <span className="text-gray-600">Always</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(offer)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                        offer.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-gray-500/15 text-gray-400 border-gray-500/30 hover:bg-gray-500/25'
                      }`}
                    >
                      {offer.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(offer)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(offer.id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
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
