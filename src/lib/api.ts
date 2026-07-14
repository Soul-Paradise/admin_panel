const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// 'USER' is what the backend Role enum actually calls a customer. This used to
// say 'CUSTOMER', which matched nothing — the Dashboard's customer count silently
// returned 0 and the Users role filter never matched.
export type UserRole = 'USER' | 'AGENT' | 'ADMIN';

export interface ApiError {
  message: string;
  statusCode: number;
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
  user: { id: string; name: string; email: string; emailVerified: boolean };
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

export interface ServiceCommission {
  id: string;
  serviceType: ServiceType;
  subType: string | null;
  commissionType: CommissionType;
  value: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommissionInput {
  serviceType: ServiceType;
  subType: string | null;
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
      throw { message: data.message || 'An error occurred', statusCode: response.status } as ApiError;
    }

    return data as T;
  }

  private async authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw { message: 'Not authenticated', statusCode: 401 } as ApiError;
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
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedAgents> {
    const query = new URLSearchParams();

    if (params.status) query.set('status', params.status);
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
      throw { message: 'Not authenticated', statusCode: 401 } as ApiError;
    }

    const response = await fetch(
      `${API_BASE_URL}/admin/agents/${id}/documents/${documentId}/raw`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      throw {
        message: 'Failed to load document',
        statusCode: response.status,
      } as ApiError;
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

  async approveAgent(id: string): Promise<{ id: string; status: AgentStatus }> {
    return this.authenticatedRequest(`/admin/agents/${id}/approve`, {
      method: 'POST',
    });
  }

  async rejectAgent(
    id: string,
    reason: string,
  ): Promise<{ id: string; status: AgentStatus }> {
    return this.authenticatedRequest(`/admin/agents/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
}

export const api = new ApiClient();
