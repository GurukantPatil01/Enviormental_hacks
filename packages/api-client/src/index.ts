import type {
  ActivityItem,
  AuthResponse,
  City,
  ClusterDetail,
  ClusterSummary,
  Community,
  CommunityMember,
  CommunityMilestone,
  CommunityState,
  CommunityTimelineEntry,
  Evidence,
  HomeDashboardData,
  HumanReview,
  MapOverview,
  Mission,
  MissionCompleteResponse,
  MissionParticipant,
  OperationsSummary,
  PointBalance,
  PointLedgerEntry,
  Report,
  ResolvedLocation,
  Reward,
  RewardClaim,
  Streak,
  Task,
  User,
  Ward,
} from '@ecopulse/types';
import type {
  AddEvidenceInput,
  AssignTaskInput,
  CompleteMissionInput,
  CreateReportInput,
  CreateTaskInput,
  LoginInput,
  RegisterInput,
} from '@ecopulse/validation';

export class EcoPulseApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'EcoPulseApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
}

export class EcoPulseClient {
  private baseUrl: string;
  private getToken?: () => string | null | Promise<string | null>;
  private onUnauthorized?: () => void;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getToken = config.getToken;
    this.onUnauthorized = config.onUnauthorized;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    if (this.getToken) {
      const token = await this.getToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: unknown) {
      throw new EcoPulseApiError(
        err instanceof Error ? err.message : 'Network connection failed',
        'NETWORK_ERROR',
        0,
        err
      );
    }

    if (response.status === 401 && this.onUnauthorized) {
      this.onUnauthorized();
    }

    const contentType = response.headers.get('content-type');
    let data: any = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorCode = data?.error?.code || 'UNKNOWN_ERROR';
      const errorMessage = data?.error?.message || response.statusText || 'An error occurred';
      const errorDetails = data?.error?.details;
      throw new EcoPulseApiError(errorMessage, errorCode, response.status, errorDetails);
    }

    // Unwrap if wrapped in { data: ... }
    if (data && typeof data === 'object' && 'data' in data && !Array.isArray(data)) {
      return data.data as T;
    }

    return data as T;
  }

  // Auth Endpoints
  public readonly auth = {
    register: (input: RegisterInput): Promise<AuthResponse> => {
      return this.request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    login: (input: LoginInput): Promise<AuthResponse> => {
      return this.request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    me: (): Promise<{ user: User }> => {
      return this.request<{ user: User }>('/auth/me');
    },
  };

  // Community Endpoints
  public readonly communities = {
    list: (): Promise<Community[]> => {
      return this.request<Community[]>('/communities');
    },
    get: (id: string): Promise<Community> => {
      return this.request<Community>(`/communities/${id}`);
    },
    join: (id: string): Promise<{ success: boolean; community: Community }> => {
      return this.request<{ success: boolean; community: Community }>(`/communities/${id}/join`, {
        method: 'POST',
      });
    },
    getMembers: (id: string): Promise<CommunityMember[]> => {
      return this.request<CommunityMember[]>(`/communities/${id}/members`);
    },
    getState: (id: string): Promise<CommunityState> => {
      return this.request<CommunityState>(`/communities/${id}/state`);
    },
    getTimeline: (id: string, limit?: number): Promise<CommunityTimelineEntry[]> => {
      const q = limit ? `?limit=${limit}` : '';
      return this.request<CommunityTimelineEntry[]>(`/communities/${id}/timeline${q}`);
    },
    getMilestones: (id: string): Promise<CommunityMilestone[]> => {
      return this.request<CommunityMilestone[]>(`/communities/${id}/milestones`);
    },
  };

  // Missions Endpoints
  public readonly missions = {
    list: (communityId?: string): Promise<Mission[]> => {
      const query = communityId ? `?communityId=${encodeURIComponent(communityId)}` : '';
      return this.request<Mission[]>(`/missions${query}`);
    },
    get: (id: string): Promise<Mission> => {
      return this.request<Mission>(`/missions/${id}`);
    },
    start: (id: string): Promise<MissionParticipant> => {
      return this.request<MissionParticipant>(`/missions/${id}/start`, {
        method: 'POST',
      });
    },
    complete: (id: string, payload: Omit<CompleteMissionInput, 'missionId'>): Promise<MissionCompleteResponse> => {
      return this.request<MissionCompleteResponse>(`/missions/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  };

  // Reports Endpoints
  public readonly reports = {
    list: (filters?: { communityId?: string; userId?: string; status?: string; category?: string }): Promise<Report[]> => {
      const params = new URLSearchParams();
      if (filters?.communityId) params.append('communityId', filters.communityId);
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.category) params.append('category', filters.category);
      const q = params.toString() ? `?${params.toString()}` : '';
      return this.request<Report[]>(`/reports${q}`);
    },
    get: (id: string): Promise<Report> => {
      return this.request<Report>(`/reports/${id}`);
    },
    create: (input: CreateReportInput): Promise<Report> => {
      return this.request<Report>('/reports', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    submit: (id: string): Promise<Report> => {
      return this.request<Report>(`/reports/${id}/submit`, {
        method: 'POST',
      });
    },
    attachEvidence: (reportId: string, input: AddEvidenceInput): Promise<Evidence> => {
      return this.request<Evidence>(`/reports/${reportId}/evidence`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    listEvidence: (reportId: string): Promise<Evidence[]> => {
      return this.request<Evidence[]>(`/reports/${reportId}/evidence`);
    },
    uploadImage: (data: string, filename?: string, mimeType?: string): Promise<{ storageKey: string; publicUrl: string; sizeBytes: number }> => {
      return this.request<{ storageKey: string; publicUrl: string; sizeBytes: number }>('/reports/upload', {
        method: 'POST',
        body: JSON.stringify({ data, filename, mimeType }),
      });
    },
  };

  // Verification & Human Review Endpoints
  public readonly reviews = {
    list: (filters?: { entityType?: string; entityId?: string }): Promise<HumanReview[]> => {
      const params = new URLSearchParams();
      if (filters?.entityType) params.append('entityType', filters.entityType);
      if (filters?.entityId) params.append('entityId', filters.entityId);
      const q = params.toString() ? `?${params.toString()}` : '';
      return this.request<HumanReview[]>(`/reviews${q}`);
    },
    approve: (id: string, body?: { entityType?: string; reason?: string; recommendation?: string }): Promise<HumanReview> => {
      return this.request<HumanReview>(`/reviews/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      });
    },
    reject: (id: string, body?: { entityType?: string; reason?: string; recommendation?: string }): Promise<HumanReview> => {
      return this.request<HumanReview>(`/reviews/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      });
    },
    requestEvidence: (id: string, body?: { entityType?: string; reason?: string; recommendation?: string }): Promise<HumanReview> => {
      return this.request<HumanReview>(`/reviews/${id}/request-evidence`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      });
    },
  };


  // Field Operations Tasks Endpoints
  public readonly tasks = {
    list: (filters?: { communityId?: string; assignedTo?: string; status?: string; reportId?: string }): Promise<Task[]> => {
      const params = new URLSearchParams();
      if (filters?.communityId) params.append('communityId', filters.communityId);
      if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.reportId) params.append('reportId', filters.reportId);
      const q = params.toString() ? `?${params.toString()}` : '';
      return this.request<Task[]>(`/tasks${q}`);
    },
    get: (id: string): Promise<Task> => {
      return this.request<Task>(`/tasks/${id}`);
    },
    create: (input: CreateTaskInput): Promise<Task> => {
      return this.request<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    assign: (id: string, input: AssignTaskInput): Promise<Task> => {
      return this.request<Task>(`/tasks/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    complete: (id: string): Promise<Task> => {
      return this.request<Task>(`/tasks/${id}/complete`, {
        method: 'POST',
      });
    },
    verify: (id: string): Promise<Task> => {
      return this.request<Task>(`/tasks/${id}/verify`, {
        method: 'POST',
      });
    },
  };

  // Maintainer Operations
  public readonly maintainer = {
    getOperations: (communityId?: string): Promise<OperationsSummary> => {
      const q = communityId ? `?communityId=${encodeURIComponent(communityId)}` : '';
      return this.request<OperationsSummary>(`/maintainer/operations${q}`);
    },
    getIncidents: (communityId?: string): Promise<Report[]> => {
      const q = communityId ? `?communityId=${encodeURIComponent(communityId)}` : '';
      return this.request<Report[]>(`/maintainer/incidents${q}`);
    },
    getReviews: (): Promise<HumanReview[]> => {
      return this.request<HumanReview[]>('/maintainer/reviews');
    },
    getTasks: (communityId?: string): Promise<Task[]> => {
      const q = communityId ? `?communityId=${encodeURIComponent(communityId)}` : '';
      return this.request<Task[]>(`/maintainer/tasks${q}`);
    },
  };

  // Geographic Foundation (City > Ward > Cluster) + Map
  public readonly geo = {
    listCities: (): Promise<City[]> => {
      return this.request<City[]>('/geo/cities');
    },
    listWards: (cityId: string): Promise<Ward[]> => {
      return this.request<Ward[]>(`/geo/cities/${cityId}/wards`);
    },
    listClusters: (communityId?: string): Promise<ClusterSummary[]> => {
      const q = communityId ? `?communityId=${encodeURIComponent(communityId)}` : '';
      return this.request<ClusterSummary[]>(`/geo/clusters${q}`);
    },
    resolveLocation: (lat: number, lng: number): Promise<ResolvedLocation> => {
      return this.request<ResolvedLocation>('/geo/resolve-location', {
        method: 'POST',
        body: JSON.stringify({ lat, lng }),
      });
    },
    mapOverview: (viewport?: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    }): Promise<MapOverview> => {
      const q = viewport
        ? `?minLat=${viewport.minLat}&maxLat=${viewport.maxLat}&minLng=${viewport.minLng}&maxLng=${viewport.maxLng}`
        : '';
      return this.request<MapOverview>(`/map/overview${q}`);
    },
    getCluster: (id: string, includeHistory = false): Promise<ClusterDetail> => {
      return this.request<ClusterDetail>(`/clusters/${id}${includeHistory ? '?history=true' : ''}`);
    },
    joinCluster: (id: string): Promise<{ success: boolean; cluster: ClusterSummary }> => {
      return this.request<{ success: boolean; cluster: ClusterSummary }>(
        `/clusters/${id}/join`,
        { method: 'POST' }
      );
    },
  };

  // User / Me Endpoints
  public readonly me = {
    get: (): Promise<HomeDashboardData> => {
      return this.request<HomeDashboardData>('/me');
    },
    getActivity: (): Promise<ActivityItem[]> => {
      return this.request<ActivityItem[]>('/me/activity');
    },
    getPoints: (): Promise<{ balance: PointBalance; ledger: PointLedgerEntry[] }> => {
      return this.request<{ balance: PointBalance; ledger: PointLedgerEntry[] }>('/me/points');
    },
    getStreak: (): Promise<Streak> => {
      return this.request<Streak>('/me/streak');
    },
    getCluster: (): Promise<ClusterSummary | null> => {
      return this.request<ClusterSummary | null>('/me/cluster');
    },
  };

  // Rewards & Government Ticket Discount Coupons
  public readonly rewards = {
    getAll: (category?: string): Promise<Reward[]> => {
      const query = category ? `?category=${encodeURIComponent(category)}` : '';
      return this.request<Reward[]>(`/rewards${query}`);
    },
    getById: (id: string): Promise<Reward> => {
      return this.request<Reward>(`/rewards/${id}`);
    },
    claim: (id: string, clientEventId: string): Promise<{ claim: RewardClaim; newBalance: number }> => {
      return this.request<{ claim: RewardClaim; newBalance: number }>(`/rewards/${id}/claim`, {
        method: 'POST',
        body: JSON.stringify({ clientEventId }),
      });
    },
    getMyClaims: (): Promise<RewardClaim[]> => {
      return this.request<RewardClaim[]>('/rewards/my-claims');
    },
  };
}
