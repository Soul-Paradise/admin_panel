const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// 'USER' is what the backend Role enum actually calls a customer. This used to
// say 'CUSTOMER', which matched nothing - the Dashboard's customer count silently
// returned 0 and the Users role filter never matched.
export type UserRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

/** Sidebar sections. Mirrors the backend AdminPage enum - keep in sync. */
export type AdminPage =
  | 'DASHBOARD'
  | 'USERS'
  | 'BOOKING_PARTNERS'
  | 'COMMISSION'
  | 'COUPONS'
  | 'OFFERS'
  | 'REVIEWS'
  | 'UTILITIES'
  | 'USER_ACCESS'
  | 'AUDIT_LOGS'
  | 'CUSTOM_PAYMENTS'
  | 'POLICIES'
  | 'SITE_CONTENT'
  | 'ORDERS'
  | 'CUSTOMER_MESSAGES';

export type AccessLevel = 'READ' | 'WRITE';

/** A page missing from the map means no access at all - absence is denial. */
export type PageAccessMap = Partial<Record<AdminPage, AccessLevel>>;

export interface MyAccess {
  role: UserRole;
  isSuperAdmin: boolean;
  access: PageAccessMap;
}

export interface AdminAccessRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  access: PageAccessMap;
}

export interface AdminAccessResponse {
  pages: AdminPage[];
  levels: AccessLevel[];
  admins: AdminAccessRow[];
}

/**
 * A real Error subclass so failures always carry a message + stack and never
 * serialize to "{}" in the console. Read `.statusCode` or use `instanceof ApiError`.
 */
export class ApiError extends Error {
  statusCode: number;
  /** Parsed error body, for extra fields such as 409 `usedIn` / `currentVersion`. */
  data: unknown;

  constructor(message: string, statusCode: number, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  provider: string;
  isActive: boolean;
  emailVerified: boolean;
  profilePicture: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    profilePicture: string | null;
  };
}

export type AgentStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export type AgentDocumentType =
  | 'PAN_CARD'
  | 'AADHAAR_FRONT'
  | 'AADHAAR_BACK'
  | 'GST_CERTIFICATE';

export interface AgentListItem {
  id: string;
  agencyName: string;
  contactPhone: string;
  city: string;
  state: string;
  status: AgentStatus;
  submittedAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    // false = access revoked by an admin. This, not `status`, is the access gate.
    isActive: boolean;
  };
}

export interface AgentDocument {
  id: string;
  type: AgentDocumentType;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface AgentVerificationEvent {
  id: string;
  action: string;
  fromStatus: AgentStatus | null;
  toStatus: AgentStatus | null;
  note: string | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

/**
 * Identity numbers arrive MASKED. The full value requires an explicit, audited
 * call to revealAgentNumber() - the backend never sends it with the application.
 */
export interface AgentApplication {
  id: string;
  agencyName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  gstNumber: string | null;
  panLast4: string;
  aadhaarLast4: string;
  panNumberMasked: string;
  aadhaarNumberMasked: string;
  status: AgentStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    isActive: boolean;
    createdAt: string;
  };
  documents: AgentDocument[];
  events: AgentVerificationEvent[];
}

export interface PaginatedAgents {
  items: AgentListItem[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export type ServiceType = 'FLIGHT' | 'HOTEL' | 'TRAVEL_PLAN' | 'INSURANCE';
export type CommissionType = 'PERCENTAGE' | 'FIXED';
// B2C = retail consumer (Role.USER); B2B = approved booking partner (Role.AGENT).
export type CommissionAudience = 'B2C' | 'B2B';

export interface ServiceCommission {
  id: string;
  serviceType: ServiceType;
  subType: string | null;
  audience: CommissionAudience;
  commissionType: CommissionType;
  value: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommissionInput {
  serviceType: ServiceType;
  subType: string | null;
  audience: CommissionAudience;
  commissionType: CommissionType;
  value: number;
  isActive: boolean;
}

export interface UpdateCommissionInput {
  commissionType?: CommissionType;
  value?: number;
  isActive?: boolean;
}

export type OfferCategory = 'ALL_OFFERS' | 'BANK_OFFERS' | 'FLIGHTS' | 'HOTELS' | 'HOLIDAYS' | 'VISA';
export type ColorTheme = 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'pink';

export interface Offer {
  id: string;
  title: string;
  description: string;
  category: OfferCategory;
  colorTheme: ColorTheme;
  isActive: boolean;
  sortOrder: number;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfferInput {
  title: string;
  description: string;
  category: OfferCategory;
  colorTheme: ColorTheme;
  isActive: boolean;
  sortOrder: number;
  validFrom: string | null;
  validUntil: string | null;
}

export interface UpdateOfferInput {
  title?: string;
  description?: string;
  category?: OfferCategory;
  colorTheme?: ColorTheme;
  isActive?: boolean;
  sortOrder?: number;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface PaginatedUsers {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------- Ticket history

export type BookingType = 'FLIGHT' | 'HOTEL' | 'INSURANCE';

/**
 * The three booking tables share no parent, so the backend merges them into one
 * timeline and tags each row with `type`. Fields outside the common core are
 * present only for their own type.
 */
export interface UserBooking {
  id: string;
  type: BookingType;
  bookingId: string;
  status: string;
  totalAmount: number;
  currency: string;
  promoCode: string | null;
  discountAmount: number | null;
  createdAt: string;

  // FLIGHT
  pnr?: string | null;
  fromCode?: string | null;
  toCode?: string | null;
  departureDate?: string | null;
  airline?: string | null;
  passengerCount?: number;

  // HOTEL
  confirmationId?: string | null;
  hotelName?: string | null;
  city?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  nights?: number;

  // INSURANCE
  policyNumber?: string | null;
  policyType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  travellerCount?: number;
}

export interface UserDetail {
  user: User & {
    agentProfile: { id: string; agencyName: string; status: AgentStatus } | null;
  };
  bookings: UserBooking[];
  summary: {
    total: number;
    flights: number;
    hotels: number;
    insurance: number;
    totalSpent: number;
  };
}

// --------------------------------------------------------------------- Coupons

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: CommissionType;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  serviceType: ServiceType | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromoCodeInput {
  code: string;
  description: string | null;
  discountType: CommissionType;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  usageLimit: number | null;
  serviceType: ServiceType | null;
}

/** `code` is intentionally not updatable - see the backend DTO for why. */
export type UpdatePromoCodeInput = Partial<Omit<CreatePromoCodeInput, 'code'>>;

// --------------------------------------------------------------------- Reviews

export interface Testimonial {
  id: string;
  name: string;
  review: string;
  rating: number;
  service: string;
  isApproved: boolean;
  /** Reviewer photo from the media library. */
  photoUrl: string | null;
  destination: string | null;
  /** Pinned reviews are listed first on the site. */
  isPinned: boolean;
  /** CUSTOMER = submitted on the site; ADMIN = added here. */
  source: 'CUSTOMER' | 'ADMIN' | string;
  createdAt: string;
  updatedAt: string;
}

export interface TestimonialInput {
  name: string;
  review: string;
  rating: number;
  service: string;
  destination?: string | null;
  photoUrl?: string | null;
  isApproved: boolean;
  isPinned: boolean;
}

// ---------------------------------------------------------------- Destinations

export interface DestinationPhoto {
  id: string;
  url: string;
  title: string;
  isVisible: boolean;
}

export interface Destination {
  id: string;
  /** Matches the Hall of Fame photo category. */
  name: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImageUrl: string | null;
  coverMissing: boolean;
  isFeatured: boolean;
  featuredOrder: number;
  photoCount: number;
  visiblePhotoCount: number;
  photos: DestinationPhoto[];
  shownOnHome: boolean;
  resolvedImage: string | null;
  updatedAt: string;
  updatedByEmail: string | null;
}

export interface DestinationList {
  usingDefault: boolean;
  maxFeatured: number;
  destinations: Destination[];
}

export interface DestinationInput {
  name: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
}

export interface PaginatedTestimonials {
  success: boolean;
  data: Testimonial[];
  pagination: { total: number; page: number; totalPages: number; limit: number };
}

// ------------------------------------------------------------------- Utilities

export interface CommissionSlice {
  amount: number;
  count: number;
}

// ---------------------------------------------------------------------- Orders

export type OrderService = 'FLIGHT' | 'HOTEL' | 'INSURANCE';
export type OrderStatusGroup = 'confirmed' | 'in_progress' | 'unpaid' | 'failed' | 'cancelled';

export interface AdminOrder {
  id: string;
  service: OrderService;
  bookingId: string;
  /** PNR / hotel confirmation / policy number, once issued. */
  reference: string | null;
  summary: string;
  status: string;
  statusGroup: OrderStatusGroup;
  totalAmount: number;
  currency: string;
  /** Null for older bookings that did not record it. */
  commissionAmount: number | null;
  commissionAudience: CommissionAudience | null;
  promoCode: string | null;
  discountAmount: number | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string };
}

/** Everything stored about one booking (admin debugging view). */
export interface AdminOrderDetail {
  service: OrderService;
  statusGroup: OrderStatusGroup;
  /** The booking row (columns) plus the customer. */
  booking: Record<string, unknown> & {
    bookingId: string;
    status: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
    commissionAmount: number | null;
    commissionAudience: CommissionAudience | null;
    promoCode: string | null;
    discountAmount: number | null;
    contactEmail?: string | null;
    contactMobile?: string | null;
    user: { id: string; name: string; email: string; role: string };
  };
  /** The booking record snapshot - shape varies by service and booking age. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Record<string, any> | null;
  payments: Array<{
    merchantTxnNo: string;
    status: string;
    amount: number;
    currency: string;
    paymentMode: string | null;
    txnId: string | null;
    responseCode: string | null;
    respDescription: string | null;
    hmacVerified: boolean;
    statusVerified: boolean;
    createdAt: string;
    paidAt: string | null;
    failedAt: string | null;
    refundAmount: number | null;
  }>;
}

export interface AdminOrdersResponse {
  items: AdminOrder[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  totals: { orders: number; amount: number; commission: number; discount: number };
}

export interface AnalyticsOverview {
  range: { key: string; from: string; to: string };
  users: {
    total: number;
    newInRange: number;
    loggedInInRange: number;
    activeTotal: number;
  };
  bookings: {
    flights: { count: number; revenue: number };
    hotels: { count: number; revenue: number };
    insurance: { count: number; revenue: number };
    totalCount: number;
    totalRevenue: number;
  };
  coupons: {
    bookingsWithCoupon: number;
    totalDiscountGiven: number;
    topCodes: { code: string; uses: number; discount: number }[];
  };
  /** Commission earned on confirmed (paid and issued) bookings in the range. */
  commission: {
    earned: number;
    bookings: number;
    couponDiscount: number;
    netOfCoupons: number;
    byService: { flights: CommissionSlice; hotels: CommissionSlice; insurance: CommissionSlice };
    byAudience: { B2C: CommissionSlice; B2B: CommissionSlice };
    allTimeEarned: number;
    /** Confirmed bookings made before commission was recorded per booking. */
    unrecordedBookings: number;
  };
  offers: { active: number; total: number };
  partners: { total: number; active: number; revoked: number };
  reviews: { pending: number; approved: number; total: number };
  contacts: { pending: number; sent: number; failed: number };
  payments: {
    paid: { count: number; amount: number };
    failed: { count: number };
    refunded: { count: number; amount: number };
  };
  dailyBookings: {
    date: string;
    flights: number;
    hotels: number;
    insurance: number;
  }[];
  /** Caveats the backend wants surfaced, e.g. coupon usage not yet tracked. */
  notes: string[];
}

// ------------------------------------------------------------------ Audit logs

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  page: AdminPage | null;
  method: string;
  path: string;
  statusCode: number;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export type PaymentStatus =
  | 'INITIATED'
  | 'REDIRECTED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'EXPIRED';

/** Dashboard buckets - mirrors STATUS_GROUPS in the backend. */
export type PaymentStatusGroup = 'received' | 'pending' | 'failed';

export interface AdminCustomPayment {
  id: string;
  merchantTxnNo: string;
  /** Bank's transaction id, once the bank has processed it. */
  txnId: string | null;
  /** Decimal as a string, e.g. "5000.00". */
  amount: string;
  status: PaymentStatus;
  customerName: string | null;
  customerEmail: string | null;
  paymentMode: string | null;
  respDescription: string | null;
  createdAt: string;
  paidAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
}

export interface AdminCustomPaymentsResponse {
  items: AdminCustomPayment[];
  summary: Record<PaymentStatusGroup, { count: number; amount: string }> & {
    all: { count: number };
  };
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ---------------------------------------------------------- Customer messages

/** Where the team is with a Contact Us message. */
export type ContactInboxStatus = 'NEW' | 'READ' | 'RESOLVED';
/** Whether the notification email reached the admin inboxes. */
export type ContactEmailStatus = 'PENDING' | 'SENT' | 'FAILED';
export type ContactFilter = ContactInboxStatus | 'EMAIL_FAILED';

export interface ContactMessage {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  subject: string;
  message: string;
  status: ContactEmailStatus;
  sentAt: string | null;
  errorMessage: string | null;
  deliveredTo: string[];
  emailAttempts: number;
  inboxStatus: ContactInboxStatus;
  readAt: string | null;
  resolvedAt: string | null;
  handledByEmail: string | null;
  adminNote: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessagesResponse {
  items: ContactMessage[];
  summary: Record<ContactInboxStatus | 'EMAIL_FAILED' | 'all', number>;
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface ContactSettings {
  /** Inboxes chosen in the admin panel. */
  recipients: string[];
  /** ADMIN_EMAIL from the server config, used while `recipients` is empty. */
  fallback: string[];
  /** Where messages actually go right now. */
  effective: string[];
  updatedByEmail: string | null;
  updatedAt: string | null;
}

// -------------------------------------------------------------------- Policies

/** One numbered section of a legal page. Numbering is positional. */
export interface LegalSection {
  title: string;
  paragraphs: string[];
  /** Highlighted callouts shown under the paragraphs. */
  subsections: { title: string; content: string }[];
}

/** The fields an admin edits (also what a revision snapshot holds). */
export interface LegalDocumentContent {
  title: string;
  description: string;
  metaDescription: string | null;
  sections: LegalSection[];
  helpTitle: string;
  helpText: string;
  isPublished: boolean;
}

export interface LegalDocument extends LegalDocumentContent {
  id: string;
  slug: string;
  /** Built-in page with a fixed public route; can't be deleted. */
  isSystem: boolean;
  sortOrder: number;
  version: number;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  /** Route on the public site, e.g. /terms or /policies/visa-policy. */
  path: string;
}

export interface LegalDocumentSummary extends Omit<LegalDocument, 'sections'> {
  sectionCount: number;
}

export interface LegalRevision {
  version: number;
  editedByEmail: string | null;
  createdAt: string;
  title: string;
  isCurrent: boolean;
}

export interface LegalRevisionDetail {
  version: number;
  snapshot: LegalDocumentContent;
  editedByEmail: string | null;
  createdAt: string;
}

export interface CreateLegalDocumentInput extends Omit<LegalDocumentContent, 'metaDescription'> {
  slug: string;
  metaDescription?: string | null;
}

export interface UpdateLegalDocumentInput extends LegalDocumentContent {
  /** The version the editor loaded. */
  version: number;
}

/**
 * Nest reports validation failures as `message: string[]`. Passing that array
 * straight to Error() stringifies it into one comma-joined wall of text, so the
 * user sees ten copies of the same complaint instead of a readable reason.
 */
function readErrorMessage(data: unknown, status: number): string {
  const message = (data as { message?: unknown } | null)?.message;

  if (Array.isArray(message) && message.length) {
    const [first, ...rest] = message.map(String);
    return rest.length ? `${first} (and ${rest.length} more)` : first;
  }

  if (typeof message === 'string' && message.trim()) return message;

  return `Request failed (${status})`;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    // FormData bodies (uploads) must let the browser set the multipart boundary.
    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const config: RequestInit = {
      ...options,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    // Not every failure carries a JSON body - a gateway 502 or an empty 204
    // would otherwise surface as an unrelated JSON parse error.
    const raw = await response.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new ApiError(readErrorMessage(data, response.status), response.status, data);
    }

    return data as T;
  }

  private async authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new ApiError('Not authenticated', 401);
    }

    return this.request<T>(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  // Token management
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('admin_accessToken', accessToken);
    localStorage.setItem('admin_refreshToken', refreshToken);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('admin_accessToken');
  }

  clearTokens() {
    localStorage.removeItem('admin_accessToken');
    localStorage.removeItem('admin_refreshToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // Auth - reuses same backend endpoints
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.authenticatedRequest('/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    return this.authenticatedRequest<User>('/auth/me');
  }

  // Admin endpoints
  async getUsers(params: { search?: string; role?: string; page?: number; limit?: number }): Promise<PaginatedUsers> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    return this.authenticatedRequest<PaginatedUsers>(`/admin/users?${query.toString()}`);
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    return this.authenticatedRequest<User>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  // Commission endpoints
  async getCommissions(): Promise<ServiceCommission[]> {
    return this.authenticatedRequest<ServiceCommission[]>('/admin/commissions');
  }

  async createCommission(input: CreateCommissionInput): Promise<ServiceCommission> {
    return this.authenticatedRequest<ServiceCommission>('/admin/commissions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateCommission(id: string, input: UpdateCommissionInput): Promise<ServiceCommission> {
    return this.authenticatedRequest<ServiceCommission>(`/admin/commissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deleteCommission(id: string): Promise<{ deleted: boolean }> {
    return this.authenticatedRequest<{ deleted: boolean }>(`/admin/commissions/${id}`, {
      method: 'DELETE',
    });
  }

  // Offer endpoints
  async getOffers(): Promise<Offer[]> {
    return this.authenticatedRequest<Offer[]>('/admin/offers');
  }

  async createOffer(input: CreateOfferInput): Promise<Offer> {
    return this.authenticatedRequest<Offer>('/admin/offers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateOffer(id: string, input: UpdateOfferInput): Promise<Offer> {
    return this.authenticatedRequest<Offer>(`/admin/offers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async deleteOffer(id: string): Promise<{ deleted: boolean }> {
    return this.authenticatedRequest<{ deleted: boolean }>(`/admin/offers/${id}`, {
      method: 'DELETE',
    });
  }

  // Agent (B2B) KYC review endpoints
  async getAgents(params: {
    status?: AgentStatus;
    active?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedAgents> {
    const query = new URLSearchParams();

    if (params.status) query.set('status', params.status);
    if (params.active !== undefined) query.set('active', String(params.active));
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 20));

    return this.authenticatedRequest<PaginatedAgents>(
      `/admin/agents?${query.toString()}`,
    );
  }

  async getAgent(id: string): Promise<AgentApplication> {
    return this.authenticatedRequest<AgentApplication>(`/admin/agents/${id}`);
  }

  /**
   * How to view a document.
   *
   * mode 'signed' (GCS): `url` is a signed URL, good for ~5 minutes. Don't cache it.
   * mode 'proxy'  (local dev): `url` is null - a local file has no browser-reachable
   *   URL, so the bytes must be fetched via getAgentDocumentBlob() instead.
   */
  async getAgentDocumentUrl(
    id: string,
    documentId: string,
  ): Promise<{
    mode: 'signed' | 'proxy';
    url: string | null;
    mimeType: string;
    expiresInSeconds?: number;
  }> {
    return this.authenticatedRequest(
      `/admin/agents/${id}/documents/${documentId}/url`,
    );
  }

  /**
   * Fetches the raw document bytes. Used for 'proxy' mode.
   *
   * Deliberately not authenticatedRequest(): that parses JSON, and this returns
   * an image. The endpoint needs an Authorization header, which is exactly why
   * window.open() cannot be pointed at it directly - the browser would send no
   * token and get a 401.
   */
  async getAgentDocumentBlob(id: string, documentId: string): Promise<Blob> {
    const token = this.getAccessToken();

    if (!token) {
      throw new ApiError('Not authenticated', 401);
    }

    const response = await fetch(
      `${API_BASE_URL}/admin/agents/${id}/documents/${documentId}/raw`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      throw new ApiError('Failed to load document', response.status);
    }

    return response.blob();
  }

  /** Audited on the backend - every reveal is recorded against the admin. */
  async revealAgentNumber(
    id: string,
    field: 'pan' | 'aadhaar',
  ): Promise<{ field: string; value: string }> {
    return this.authenticatedRequest(`/admin/agents/${id}/reveal/${field}`);
  }

  /** Revoke a partner's access. Takes effect on their next request. */
  async revokeAgent(
    id: string,
    reason?: string,
  ): Promise<{ id: string; isActive: boolean }> {
    return this.authenticatedRequest(`/admin/agents/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  }

  /** Restore a previously revoked partner's access. */
  async restoreAgent(id: string): Promise<{ id: string; isActive: boolean }> {
    return this.authenticatedRequest(`/admin/agents/${id}/restore`, {
      method: 'POST',
    });
  }

  // ---------------------------------------------------------------- Page access

  /**
   * The caller's own permissions. Drives which sidebar entries render and which
   * mutating controls are enabled. Every admin can call this, including one with
   * no grant on the User Access page.
   */
  async getMyAccess(): Promise<MyAccess> {
    return this.authenticatedRequest<MyAccess>('/admin/access/me');
  }

  /** Super admin only. */
  async getAdminAccess(): Promise<AdminAccessResponse> {
    return this.authenticatedRequest<AdminAccessResponse>('/admin/access/admins');
  }

  /**
   * Replaces the target's grants wholesale - pages omitted from `access` are
   * revoked. Send the full desired state, not a delta.
   */
  async setAdminAccess(
    userId: string,
    access: PageAccessMap,
  ): Promise<{ userId: string; access: PageAccessMap }> {
    return this.authenticatedRequest(`/admin/access/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ access }),
    });
  }

  // -------------------------------------------------------------- User details

  async getUserDetail(userId: string): Promise<UserDetail> {
    return this.authenticatedRequest<UserDetail>(`/admin/users/${userId}`);
  }

  // ------------------------------------------------------------------- Coupons

  async getPromoCodes(): Promise<PromoCode[]> {
    return this.authenticatedRequest<PromoCode[]>('/admin/promo-codes');
  }

  async createPromoCode(input: CreatePromoCodeInput): Promise<PromoCode> {
    return this.authenticatedRequest<PromoCode>('/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updatePromoCode(
    id: string,
    input: UpdatePromoCodeInput,
  ): Promise<PromoCode> {
    return this.authenticatedRequest<PromoCode>(`/admin/promo-codes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  /** Rejected by the backend if the coupon has ever been redeemed - deactivate instead. */
  async deletePromoCode(id: string): Promise<{ deleted: boolean }> {
    return this.authenticatedRequest(`/admin/promo-codes/${id}`, {
      method: 'DELETE',
    });
  }

  // ------------------------------------------------------------------- Reviews

  async getTestimonials(params: {
    page?: number;
    limit?: number;
    approved?: boolean;
  } = {}): Promise<PaginatedTestimonials> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 20));
    if (params.approved !== undefined) {
      query.set('approved', String(params.approved));
    }

    return this.authenticatedRequest<PaginatedTestimonials>(
      `/testimonials/all?${query.toString()}`,
    );
  }

  async setTestimonialApproval(
    id: string,
    isApproved: boolean,
  ): Promise<{ success: boolean; data: Testimonial }> {
    return this.authenticatedRequest(`/testimonials/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ isApproved }),
    });
  }

  async deleteTestimonial(id: string): Promise<{ success: boolean }> {
    return this.authenticatedRequest(`/testimonials/${id}`, {
      method: 'DELETE',
    });
  }

  async createTestimonial(input: TestimonialInput): Promise<{ success: boolean; data: Testimonial }> {
    return this.authenticatedRequest('/testimonials/admin', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateTestimonial(id: string, input: Partial<TestimonialInput>): Promise<{ success: boolean; data: Testimonial }> {
    return this.authenticatedRequest(`/testimonials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  // -------------------------------------------------------------- Destinations

  async getDestinations(): Promise<DestinationList> {
    return this.authenticatedRequest<DestinationList>('/admin/site-content/destinations');
  }

  async createDestination(input: DestinationInput): Promise<Destination> {
    return this.authenticatedRequest<Destination>('/admin/site-content/destinations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateDestination(id: string, input: Partial<DestinationInput>): Promise<Destination> {
    return this.authenticatedRequest<Destination>(`/admin/site-content/destinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  /** Up to five ids in display order; [] = back to the default (first five by name). */
  async setFeaturedDestinations(ids: string[]): Promise<DestinationList> {
    return this.authenticatedRequest<DestinationList>('/admin/site-content/destinations/featured', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async deleteDestination(id: string): Promise<{ deleted: boolean }> {
    return this.authenticatedRequest(`/admin/site-content/destinations/${id}`, { method: 'DELETE' });
  }

  // ----------------------------------------------------------------- Utilities

  async getAnalyticsOverview(
    range: 'today' | '7d' | '30d' = 'today',
  ): Promise<AnalyticsOverview> {
    return this.authenticatedRequest<AnalyticsOverview>(
      `/admin/analytics/overview?range=${range}`,
    );
  }

  // ------------------------------------------------------------------- Orders

  async getOrders(params: {
    service?: OrderService;
    status?: OrderStatusGroup | 'paid';
    audience?: CommissionAudience;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<AdminOrdersResponse> {
    const query = new URLSearchParams();
    if (params.service) query.set('service', params.service);
    if (params.status) query.set('status', params.status);
    if (params.audience) query.set('audience', params.audience);
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 25));
    return this.authenticatedRequest<AdminOrdersResponse>(`/admin/orders?${query.toString()}`);
  }

  async getOrderDetail(service: OrderService, bookingId: string): Promise<AdminOrderDetail> {
    return this.authenticatedRequest<AdminOrderDetail>(
      `/admin/orders/${service}/${encodeURIComponent(bookingId)}`,
    );
  }

  // ---------------------------------------------------------- Custom payments

  async getCustomPayments(params: {
    status?: PaymentStatusGroup;
    search?: string;
    from?: string;
    to?: string;
    pageNum?: number;
    limit?: number;
  } = {}): Promise<AdminCustomPaymentsResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    query.set('pageNum', String(params.pageNum ?? 1));
    query.set('limit', String(params.limit ?? 25));

    return this.authenticatedRequest<AdminCustomPaymentsResponse>(
      `/admin/custom-payments?${query.toString()}`,
    );
  }

  // --------------------------------------------------------- Customer messages

  async getContactMessages(params: {
    filter?: ContactFilter;
    search?: string;
    from?: string;
    to?: string;
    pageNum?: number;
    limit?: number;
  } = {}): Promise<ContactMessagesResponse> {
    const query = new URLSearchParams();
    if (params.filter) query.set('filter', params.filter);
    if (params.search) query.set('search', params.search);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    query.set('pageNum', String(params.pageNum ?? 1));
    query.set('limit', String(params.limit ?? 25));

    return this.authenticatedRequest<ContactMessagesResponse>(
      `/admin/customer-messages?${query.toString()}`,
    );
  }

  async updateContactMessage(
    id: string,
    input: { inboxStatus?: ContactInboxStatus; adminNote?: string | null },
  ): Promise<ContactMessage> {
    return this.authenticatedRequest(`/admin/customer-messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async resendContactMessage(id: string): Promise<ContactMessage> {
    return this.authenticatedRequest(`/admin/customer-messages/${id}/resend`, {
      method: 'POST',
    });
  }

  async deleteContactMessage(id: string): Promise<{ success: boolean }> {
    return this.authenticatedRequest(`/admin/customer-messages/${id}`, {
      method: 'DELETE',
    });
  }

  async getContactSettings(): Promise<ContactSettings> {
    return this.authenticatedRequest('/admin/customer-messages/settings');
  }

  async updateContactSettings(recipients: string[]): Promise<ContactSettings> {
    return this.authenticatedRequest('/admin/customer-messages/settings', {
      method: 'PUT',
      body: JSON.stringify({ recipients }),
    });
  }

  // ---------------------------------------------------------------- Audit logs

  async getAuditLogs(params: {
    search?: string;
    page?: AdminPage;
    from?: string;
    to?: string;
    pageNum?: number;
    limit?: number;
  } = {}): Promise<PaginatedAuditLogs> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', params.page);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    query.set('pageNum', String(params.pageNum ?? 1));
    query.set('limit', String(params.limit ?? 25));

    return this.authenticatedRequest<PaginatedAuditLogs>(
      `/admin/audit-logs?${query.toString()}`,
    );
  }

  // ---------------------------------------------------------------- Policies

  async getLegalDocuments(): Promise<LegalDocumentSummary[]> {
    return this.authenticatedRequest<LegalDocumentSummary[]>('/admin/legal');
  }

  async getLegalDocument(slug: string): Promise<LegalDocument> {
    return this.authenticatedRequest<LegalDocument>(`/admin/legal/${encodeURIComponent(slug)}`);
  }

  async createLegalDocument(input: CreateLegalDocumentInput): Promise<LegalDocument> {
    return this.authenticatedRequest<LegalDocument>('/admin/legal', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /** 409 (ApiError.statusCode) means someone else saved since `input.version`. */
  async updateLegalDocument(slug: string, input: UpdateLegalDocumentInput): Promise<LegalDocument> {
    return this.authenticatedRequest<LegalDocument>(`/admin/legal/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async getLegalRevisions(slug: string): Promise<LegalRevision[]> {
    return this.authenticatedRequest<LegalRevision[]>(`/admin/legal/${encodeURIComponent(slug)}/revisions`);
  }

  async getLegalRevision(slug: string, revision: number): Promise<LegalRevisionDetail> {
    return this.authenticatedRequest<LegalRevisionDetail>(
      `/admin/legal/${encodeURIComponent(slug)}/revisions/${revision}`,
    );
  }

  async restoreLegalDocument(slug: string, revision: number, version: number): Promise<LegalDocument> {
    return this.authenticatedRequest<LegalDocument>(`/admin/legal/${encodeURIComponent(slug)}/restore`, {
      method: 'POST',
      body: JSON.stringify({ revision, version }),
    });
  }

  async deleteLegalDocument(slug: string): Promise<{ deleted: boolean }> {
    return this.authenticatedRequest<{ deleted: boolean }>(`/admin/legal/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
  }

  // ------------------------------------------------------------ Site content

  async getSiteOverview(): Promise<SitePageOverview[]> {
    return this.authenticatedRequest<SitePageOverview[]>('/admin/site-content');
  }

  async getSitePage(page: SitePage): Promise<SiteSection[]> {
    return this.authenticatedRequest<SiteSection[]>(`/admin/site-content/${page}`);
  }

  async reorderSitePage(page: SitePage, keys: string[]): Promise<SiteSection[]> {
    return this.authenticatedRequest<SiteSection[]>(`/admin/site-content/${page}/order`, {
      method: 'PUT',
      body: JSON.stringify({ keys }),
    });
  }

  async getSiteSection(page: SitePage, key: string): Promise<SiteSection> {
    return this.authenticatedRequest<SiteSection>(`/admin/site-content/${page}/${encodeURIComponent(key)}`);
  }

  /** 409 (ApiError.statusCode) means someone else saved since `input.version`. */
  async updateSiteSection(
    page: SitePage,
    key: string,
    input: { content?: unknown; isVisible?: boolean; version: number },
  ): Promise<SiteSection> {
    return this.authenticatedRequest<SiteSection>(`/admin/site-content/${page}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async getSiteSectionRevisions(page: SitePage, key: string): Promise<SiteSectionRevision[]> {
    return this.authenticatedRequest<SiteSectionRevision[]>(
      `/admin/site-content/${page}/${encodeURIComponent(key)}/revisions`,
    );
  }

  async restoreSiteSection(page: SitePage, key: string, revision: number, version: number): Promise<SiteSection> {
    return this.authenticatedRequest<SiteSection>(`/admin/site-content/${page}/${encodeURIComponent(key)}/restore`, {
      method: 'POST',
      body: JSON.stringify({ revision, version }),
    });
  }

  // ------------------------------------------------------------------- Media

  async getMedia(params: { collection?: MediaCollection; search?: string } = {}): Promise<MediaAsset[]> {
    const query = new URLSearchParams();
    if (params.collection) query.set('collection', params.collection);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    return this.authenticatedRequest<MediaAsset[]>(`/admin/site-content/media${qs ? `?${qs}` : ''}`);
  }

  async uploadMedia(file: Blob, fileName: string, meta: MediaUploadMeta): Promise<MediaAsset> {
    const form = new FormData();
    form.append('file', file, fileName);
    form.append('title', meta.title);
    if (meta.caption) form.append('caption', meta.caption);
    if (meta.category) form.append('category', meta.category);
    form.append('collection', meta.collection);
    form.append('isVisible', meta.isVisible ? 'true' : 'false');
    if (meta.width) form.append('width', String(meta.width));
    if (meta.height) form.append('height', String(meta.height));
    return this.authenticatedRequest<MediaAsset>('/admin/site-content/media', { method: 'POST', body: form });
  }

  async updateMedia(
    id: string,
    patch: Partial<Pick<MediaAsset, 'title' | 'caption' | 'category' | 'collection' | 'isVisible'>>,
  ): Promise<MediaAsset> {
    return this.authenticatedRequest<MediaAsset>(`/admin/site-content/media/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async reorderMedia(ids: string[]): Promise<{ reordered: number }> {
    return this.authenticatedRequest<{ reordered: number }>('/admin/site-content/media/order', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async getMediaUsage(id: string): Promise<{ usedIn: string[] }> {
    return this.authenticatedRequest<{ usedIn: string[] }>(`/admin/site-content/media/${id}/usage`);
  }

  /** Records whose files were deleted from the bucket, and sections still using them. */
  async getMissingMedia(): Promise<MissingMediaReport> {
    return this.authenticatedRequest<MissingMediaReport>('/admin/site-content/media/missing');
  }

  /** Deletes the records of files already gone from the bucket (all when ids is omitted). */
  async removeMissingMedia(ids?: string[]): Promise<{ removed: number; titles: string[] }> {
    return this.authenticatedRequest<{ removed: number; titles: string[] }>('/admin/site-content/media/missing/remove', {
      method: 'POST',
      body: JSON.stringify(ids ? { ids } : {}),
    });
  }

  /** Public site-wide content (no auth); used for the image slots. */
  async getSiteImages(): Promise<SiteImages | null> {
    const res = await this.request<{ global?: { images?: SiteImages } }>('/site-content/global');
    return res?.global?.images ?? null;
  }

  /** 409 carries `usedIn` (see ApiError.data) when a section still shows the image. */
  async deleteMedia(id: string, force = false): Promise<{ deleted: boolean; objectName: string }> {
    return this.authenticatedRequest<{ deleted: boolean; objectName: string }>(
      `/admin/site-content/media/${id}${force ? '?force=true' : ''}`,
      { method: 'DELETE' },
    );
  }
}

// ------------------------------------------------------------- Site content

export type SitePage = 'GLOBAL' | 'HOME' | 'ABOUT' | 'SERVICES' | 'CONTACT' | 'HALL_OF_FAME';

/** Section metadata (no content), as listed on the overview. */
export interface SiteSectionMeta {
  page: SitePage;
  key: string;
  label: string;
  description: string;
  /** False for blocks the site can't work without (e.g. contact details). */
  hideable: boolean;
  isVisible: boolean;
  sortOrder: number;
  version: number;
  updatedAt: string;
  updatedByEmail: string | null;
}

export interface SiteSection extends SiteSectionMeta {
  id: string;
  /** Shape depends on the section; validated server-side (registry.ts). */
  content: unknown;
  createdAt: string;
}

export interface SitePageOverview {
  page: SitePage;
  sections: SiteSectionMeta[];
}

export interface SiteSectionRevision {
  version: number;
  editedByEmail: string | null;
  createdAt: string;
  snapshot: { content: unknown; isVisible: boolean };
  isCurrent: boolean;
}

export type MediaCollection = 'HALL_OF_FAME' | 'LIBRARY';

export interface MediaAsset {
  id: string;
  bucket: string;
  objectName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  title: string;
  caption: string | null;
  category: string | null;
  collection: MediaCollection;
  isVisible: boolean;
  sortOrder: number;
  uploadedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  /** The file is no longer in the bucket (deleted outside the admin panel). */
  missing?: boolean;
}

/** A page section still pointing at a file that was deleted from the bucket. */
export interface BrokenSectionRef {
  section: string;
  page: SitePage;
  key: string;
  url: string;
}

export interface MissingMediaReport {
  records: MediaAsset[];
  brokenSections: BrokenSectionRef[];
}

/** GLOBAL.images: every image slot the site and admin panel use (all nullable). */
export interface SiteImages {
  logo?: string | null;
  pageHeroes?: { policies?: string | null; profile?: string | null; orders?: string | null };
  admin?: Partial<
    Record<
      'login' | 'dashboard' | 'people' | 'partners' | 'pricing' | 'promotions' | 'content' | 'payments' | 'operations' | 'security',
      string | null
    >
  >;
}

export interface MediaUploadMeta {
  title: string;
  caption?: string;
  category?: string;
  collection: MediaCollection;
  isVisible: boolean;
  width?: number;
  height?: number;
}

export const api = new ApiClient();
