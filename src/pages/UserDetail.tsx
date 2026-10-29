import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  api,
  type UserDetail as UserDetailData,
  type UserBooking,
  type BookingType,
  type UserRole,
  type AgentStatus,
} from '../lib/api';

const roleBadgeColors: Record<UserRole, string> = {
  USER: 'bg-green-50 text-green-700 border-green-200',
  AGENT: 'bg-amber-50 text-amber-700 border-amber-200',
  ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
  SUPER_ADMIN: 'bg-blue-50 text-links border-blue-200',
};

const agentStatusColors: Record<AgentStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  UNDER_REVIEW: 'bg-blue-50 text-links border-blue-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const typeBadgeColors: Record<BookingType, string> = {
  FLIGHT: 'bg-blue-50 text-links border-blue-200',
  HOTEL: 'bg-amber-50 text-amber-700 border-amber-200',
  INSURANCE: 'bg-purple-50 text-purple-700 border-purple-200',
};

const typeBorderColors: Record<BookingType, string> = {
  FLIGHT: 'border-l-blue-500',
  HOTEL: 'border-l-amber-500',
  INSURANCE: 'border-l-purple-500',
};

const GRAY_BADGE = 'bg-gray-100 text-gray-600 border-gray-300';

/**
 * Status strings come straight from three different booking tables (and, through
 * them, from the supplier). Match case-insensitively and fall back to gray so an
 * unrecognised value renders as a neutral badge instead of `undefined` classes.
 */
function statusBadgeColor(status: string): string {
  switch (status?.toUpperCase()) {
    case 'CONFIRMED':
    case 'SUCCESS':
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PENDING':
    case 'INITIATED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'FAILED':
    case 'CANCELLED':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return GRAY_BADGE;
  }
}

function money(amount: number | null | undefined): string {
  return `₹${(amount ?? 0).toLocaleString('en-IN')}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FILTERS: Array<{ key: 'ALL' | BookingType; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'FLIGHT', label: 'Flights' },
  { key: 'HOTEL', label: 'Hotels' },
  { key: 'INSURANCE', label: 'Insurance' },
];

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-sm text-gray-700 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function BookingCard({ booking }: { booking: UserBooking }) {
  return (
    <div
      className={`bg-peace border border-tertiary-button border-l-4 ${typeBorderColors[booking.type] ?? 'border-l-gray-600'} rounded-xl p-5`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${typeBadgeColors[booking.type] ?? GRAY_BADGE}`}
          >
            {booking.type}
          </span>
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadgeColor(booking.status)}`}
          >
            {booking.status}
          </span>
          <span className="text-xs font-mono text-gray-500">{booking.bookingId}</span>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-foreground">{money(booking.totalAmount)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(booking.createdAt)}</p>
        </div>
      </div>

      {/* Type-specific detail */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        {booking.type === 'FLIGHT' && (
          <>
            <div className="col-span-2 md:col-span-1">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">Route</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {booking.fromCode ?? '-'} → {booking.toCode ?? '-'}
              </p>
            </div>
            <Field label="Airline" value={booking.airline ?? '-'} />
            <Field label="Departure" value={formatDate(booking.departureDate)} />
            <Field label="PNR" value={booking.pnr ?? '-'} mono />
            <Field
              label="Passengers"
              value={booking.passengerCount != null ? String(booking.passengerCount) : '-'}
            />
          </>
        )}

        {booking.type === 'HOTEL' && (
          <>
            <div className="col-span-2 md:col-span-1">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">Hotel</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{booking.hotelName ?? '-'}</p>
            </div>
            <Field label="City" value={booking.city ?? '-'} />
            <div className="col-span-2 md:col-span-1">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">Stay</p>
              <p className="text-sm text-gray-700 mt-0.5">
                {formatDate(booking.checkInDate)} → {formatDate(booking.checkOutDate)}
              </p>
            </div>
            <Field label="Nights" value={booking.nights != null ? String(booking.nights) : '-'} />
            <Field label="Confirmation" value={booking.confirmationId ?? '-'} mono />
          </>
        )}

        {booking.type === 'INSURANCE' && (
          <>
            <div className="col-span-2 md:col-span-1">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">Policy Type</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{booking.policyType ?? '-'}</p>
            </div>
            <div className="col-span-2 md:col-span-2">
              <p className="text-[11px] uppercase tracking-wider text-gray-400">Cover Period</p>
              <p className="text-sm text-gray-700 mt-0.5">
                {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
              </p>
            </div>
            <Field label="Policy No." value={booking.policyNumber ?? '-'} mono />
            <Field
              label="Travellers"
              value={booking.travellerCount != null ? String(booking.travellerCount) : '-'}
            />
          </>
        )}
      </div>

      {booking.promoCode && (
        <div className="mt-4 pt-3 border-t border-tertiary-button flex items-center gap-2">
          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
            Coupon: {booking.promoCode}
          </span>
          <span className="text-xs text-emerald-700">−{money(booking.discountAmount)}</span>
        </div>
      )}
    </div>
  );
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | BookingType>('ALL');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getUserDetail(id);
        if (!cancelled) setData(result);
      } catch (err: any) {
        if (cancelled) return;
        const msg: string = err?.message || 'Failed to load user';
        setError(/404|not found/i.test(msg) ? 'User not found' : msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const bookings = useMemo(() => {
    const list = data?.bookings ?? [];
    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return filter === 'ALL' ? sorted : sorted.filter((b) => b.type === filter);
  }, [data, filter]);

  const backLink = (
    <button
      onClick={() => navigate('/users')}
      className="text-sm text-gray-500 hover:text-foreground transition-colors mb-6"
    >
      ← Back to users
    </button>
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {backLink}
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {backLink}
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          {error ?? 'User not found'}
        </div>
      </div>
    );
  }

  const { user, summary } = data;

  const stats = [
    { label: 'Total Bookings', value: String(summary.total) },
    { label: 'Flights', value: String(summary.flights) },
    { label: 'Hotels', value: String(summary.hotels) },
    { label: 'Insurance', value: String(summary.insurance) },
    { label: 'Total Spent', value: money(summary.totalSpent) },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {backLink}

      {/* Profile header */}
      <div className="bg-peace border border-tertiary-button rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 bg-primary-button rounded-full flex items-center justify-center text-peace text-xl font-medium shrink-0">
            {user.profilePicture ? (
              <img src={user.profilePicture} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              user.name?.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground truncate">{user.name}</h1>
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${roleBadgeColors[user.role] ?? GRAY_BADGE}`}
              >
                {user.role}
              </span>
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${
                  user.emailVerified
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : GRAY_BADGE
                }`}
              >
                {user.emailVerified ? 'Verified' : 'Unverified'}
              </span>
              <span
                className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${
                  user.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1 truncate">{user.email}</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5">
              <Field label="Provider" value={user.provider?.toLowerCase() ?? '-'} />
              <Field label="Joined" value={formatDate(user.createdAt)} />
              <Field
                label="Last Login"
                value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Booking partner */}
      {user.agentProfile && (
        <div className="bg-peace border border-tertiary-button rounded-xl shadow-sm p-5 mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Booking Partner
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-medium text-foreground">{user.agentProfile.agencyName}</p>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                agentStatusColors[user.agentProfile.status] ?? GRAY_BADGE
              }`}
            >
              {user.agentProfile.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-peace border border-tertiary-button rounded-xl shadow-sm p-4">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-xl font-semibold text-foreground mt-1.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Ticket history */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Ticket History</h2>
        <div className="flex gap-1 bg-peace border border-tertiary-button rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f.key
                  ? 'bg-primary-button/15 text-links'
                  : 'text-gray-500 hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {data.bookings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">This user hasn't booked anything yet.</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No bookings in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard key={`${booking.type}-${booking.id}`} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}
