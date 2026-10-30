import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, ChevronLeft, Handshake, Plane, ReceiptText, ShieldCheck, Ticket, Wallet } from 'lucide-react';
import {
  api,
  type UserDetail as UserDetailData,
  type UserBooking,
  type BookingType,
  type UserRole,
  type AgentStatus,
} from '../lib/api';
import { Alert, Badge, EmptyState, IconTile, SectionTitle, Spinner, StatTile, Tabs } from '../components/ui';
import { CARD, LABEL, PAGE, type Accent, type Tone } from '../lib/ui-styles';

const roleTone: Record<UserRole, Tone> = {
  USER: 'green',
  AGENT: 'amber',
  ADMIN: 'purple',
  SUPER_ADMIN: 'blue',
};

const agentStatusTone: Record<AgentStatus, Tone> = {
  PENDING: 'amber',
  UNDER_REVIEW: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
};

const typeTone: Record<BookingType, Tone> = {
  FLIGHT: 'blue',
  HOTEL: 'amber',
  INSURANCE: 'purple',
};

const typeBorderColors: Record<BookingType, string> = {
  FLIGHT: 'border-l-links',
  HOTEL: 'border-l-warn',
  INSURANCE: 'border-l-purple-500',
};

/**
 * Status strings come straight from three different booking tables (and, through
 * them, from the supplier). Match case-insensitively and fall back to gray so an
 * unrecognised value renders as a neutral badge instead of `undefined` classes.
 */
function statusTone(status: string): Tone {
  switch (status?.toUpperCase()) {
    case 'CONFIRMED':
    case 'SUCCESS':
    case 'PAID':
      return 'green';
    case 'PENDING':
    case 'INITIATED':
      return 'amber';
    case 'FAILED':
    case 'CANCELLED':
      return 'red';
    default:
      return 'slate';
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

function Field({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className={`mt-0.5 text-sm text-foreground ${strong ? 'font-bold' : 'font-semibold'} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function BookingCard({ booking }: { booking: UserBooking }) {
  return (
    <div className={`${CARD} border-l-4 ${typeBorderColors[booking.type] ?? 'border-l-inactive'} p-5 transition-shadow hover:shadow-md`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={typeTone[booking.type] ?? 'slate'}>{booking.type}</Badge>
          <Badge tone={statusTone(booking.status)} dot>
            {booking.status}
          </Badge>
          <span className="font-mono text-xs text-inactive">{booking.bookingId}</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold tracking-tight text-foreground">{money(booking.totalAmount)}</p>
          <p className="mt-0.5 text-xs text-inactive">{formatDate(booking.createdAt)}</p>
        </div>
      </div>

      {/* Type-specific detail */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
        {booking.type === 'FLIGHT' && (
          <>
            <div className="col-span-2 md:col-span-1">
              <Field label="Route" value={`${booking.fromCode ?? '-'} → ${booking.toCode ?? '-'}`} strong />
            </div>
            <Field label="Airline" value={booking.airline ?? '-'} />
            <Field label="Departure" value={formatDate(booking.departureDate)} />
            <Field label="PNR" value={booking.pnr ?? '-'} mono />
            <Field label="Passengers" value={booking.passengerCount != null ? String(booking.passengerCount) : '-'} />
          </>
        )}

        {booking.type === 'HOTEL' && (
          <>
            <div className="col-span-2 md:col-span-1">
              <Field label="Hotel" value={booking.hotelName ?? '-'} strong />
            </div>
            <Field label="City" value={booking.city ?? '-'} />
            <div className="col-span-2 md:col-span-1">
              <Field label="Stay" value={`${formatDate(booking.checkInDate)} → ${formatDate(booking.checkOutDate)}`} />
            </div>
            <Field label="Nights" value={booking.nights != null ? String(booking.nights) : '-'} />
            <Field label="Confirmation" value={booking.confirmationId ?? '-'} mono />
          </>
        )}

        {booking.type === 'INSURANCE' && (
          <>
            <div className="col-span-2 md:col-span-1">
              <Field label="Policy Type" value={booking.policyType ?? '-'} strong />
            </div>
            <div className="col-span-2 md:col-span-2">
              <Field label="Cover Period" value={`${formatDate(booking.startDate)} → ${formatDate(booking.endDate)}`} />
            </div>
            <Field label="Policy No." value={booking.policyNumber ?? '-'} mono />
            <Field label="Travellers" value={booking.travellerCount != null ? String(booking.travellerCount) : '-'} />
          </>
        )}
      </div>

      {booking.promoCode && (
        <div className="mt-4 flex items-center gap-2 border-t border-tertiary-button pt-3">
          <Badge tone="green">Coupon: {booking.promoCode}</Badge>
          <span className="text-xs font-bold text-success">−{money(booking.discountAmount)}</span>
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
      } catch (err: unknown) {
        if (cancelled) return;
        const msg: string = (err instanceof Error && err.message) || 'Failed to load user';
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
    const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filter === 'ALL' ? sorted : sorted.filter((b) => b.type === filter);
  }, [data, filter]);

  const backLink = (
    <button
      onClick={() => navigate('/users')}
      className="group mb-6 inline-flex items-center gap-1 text-sm font-bold text-links transition-opacity hover:opacity-80"
    >
      <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      Back to users
    </button>
  );

  if (loading) {
    return (
      <div className={PAGE}>
        {backLink}
        <div className={CARD}>
          <Spinner label="Loading user…" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={PAGE}>
        {backLink}
        <Alert tone="error">{error ?? 'User not found'}</Alert>
      </div>
    );
  }

  const { user, summary } = data;

  const stats: { label: string; value: string; icon: typeof Ticket; accent: Accent }[] = [
    { label: 'Total Bookings', value: String(summary.total), icon: Ticket, accent: 'blue' },
    { label: 'Flights', value: String(summary.flights), icon: Plane, accent: 'teal' },
    { label: 'Hotels', value: String(summary.hotels), icon: Building2, accent: 'orange' },
    { label: 'Insurance', value: String(summary.insurance), icon: ShieldCheck, accent: 'purple' },
    { label: 'Total Spent', value: money(summary.totalSpent), icon: Wallet, accent: 'green' },
  ];

  return (
    <div className={PAGE}>
      {backLink}

      {/* Profile header */}
      <div className={`animate-fade-up mb-6 p-6 ${CARD}`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-button text-2xl font-bold text-peace ring-4 ring-primary-tint">
            {user.profilePicture ? (
              <img src={user.profilePicture} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              user.name?.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-links">People</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground">{user.name}</h1>
              <Badge tone={roleTone[user.role] ?? 'slate'}>{user.role}</Badge>
              <Badge tone={user.emailVerified ? 'green' : 'slate'}>{user.emailVerified ? 'Verified' : 'Unverified'}</Badge>
              <Badge tone={user.isActive ? 'green' : 'red'} dot>
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-inactive">{user.email}</p>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-tertiary-button pt-4 md:grid-cols-3">
              <Field label="Provider" value={user.provider?.toLowerCase() ?? '-'} />
              <Field label="Joined" value={formatDate(user.createdAt)} />
              <Field label="Last Login" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'} />
            </div>
          </div>
        </div>
      </div>

      {/* Booking partner */}
      {user.agentProfile && (
        <div className={`mb-6 p-5 ${CARD}`}>
          <p className={`mb-3 ${LABEL}`}>Booking Partner</p>
          <div className="flex flex-wrap items-center gap-3">
            <IconTile icon={Handshake} accent="orange" size="sm" />
            <p className="text-sm font-bold text-foreground">{user.agentProfile.agencyName}</p>
            <Badge tone={agentStatusTone[user.agentProfile.status] ?? 'slate'}>{user.agentProfile.status.replace('_', ' ')}</Badge>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        {stats.map((stat) => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} accent={stat.accent} />
        ))}
      </div>

      {/* Ticket history */}
      <SectionTitle aside={<Tabs label="Filter bookings" options={FILTERS} active={filter} onChange={setFilter} />}>
        Ticket History
      </SectionTitle>

      {data.bookings.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={ReceiptText} title="No bookings yet" message="This user hasn't booked anything yet." />
        </div>
      ) : bookings.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={ReceiptText} title="Nothing here" message="No bookings in this category." />
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
