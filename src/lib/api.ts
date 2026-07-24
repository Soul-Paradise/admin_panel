const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// 'USER' is what the backend Role enum actually calls a customer. This used to
// say 'CUSTOMER', which matched nothing — the Dashboard's customer count silently
// returned 0 and the Users role filter never matched.
export type UserRole = 'USER' | 'AGENT' | 'ADMIN' | 'SUPER_ADMIN';

/** Sidebar sections. Mirrors the backend AdminPage enum — keep in sync. */
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
  | 'AUDIT_LOGS';

export type AccessLevel = 'READ' | 'WRITE';

/** A page missing from the map means no access at all — absence is denial. */
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

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
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
 * call to revealAgentNumber() — the backend never sends it with the application.
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

/** `code` is intentionally not updatable — see the backend DTO for why. */
export type UpdatePromoCodeInput = Partial<Omit<CreatePromoCodeInput, 'code'>>;

// --------------------------------------------------------------------- Reviews

export interface Testimonial {
  id: string;
  name: string;
  review: string;
  rating: number;
  service: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTestimonials {
  success: boolean;
  data: Testimonial[];
  pagination: { total: number; page: number; totalPages: number; limit: number };
}

// ------------------------------------------------------------------- Utilities

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

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.message || 'An error occurred', response.status);
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
   * mode 'proxy'  (local dev): `url` is null — a local file has no browser-reachable
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
   * window.open() cannot be pointed at it directly — the browser would send no
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

  /** Audited on the backend — every reveal is recorded against the admin. */
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
   * Replaces the target's grants wholesale — pages omitted from `access` are
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

  /** Rejected by the backend if the coupon has ever been redeemed — deactivate instead. */
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

  // ----------------------------------------------------------------- Utilities

  async getAnalyticsOverview(
    range: 'today' | '7d' | '30d' = 'today',
  ): Promise<AnalyticsOverview> {
    return this.authenticatedRequest<AnalyticsOverview>(
      `/admin/analytics/overview?range=${range}`,
    );
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
}

export const api = new ApiClient();
