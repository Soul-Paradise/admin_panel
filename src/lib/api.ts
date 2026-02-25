const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export type UserRole = 'CUSTOMER' | 'AGENT' | 'ADMIN';

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
}

export const api = new ApiClient();
