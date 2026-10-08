'use client';
import Keycloak from 'keycloak-js';

export function resolveKeycloakUrl(): string {
  if (import.meta.env.VITE_KEYCLOAK_URL) {
    return import.meta.env.VITE_KEYCLOAK_URL;
  }
  return import.meta.env.PROD ? 'https://atlas.neuralworks.lk' : 'http://localhost:8081';
}

export function resolveApiBaseUrl(): string {
  if (typeof import.meta.env.VITE_API_BASE_URL === 'string') {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return import.meta.env.PROD ? '' : 'http://localhost:8080';
}

const keycloak = new Keycloak({
  url: resolveKeycloakUrl(),
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'forge-atlas',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'forge-atlas-backoffice',
});
let initialized: Promise<boolean> | undefined;
async function token() {
  initialized ??= keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  });
  if (!(await initialized)) {
    await keycloak.login();
    throw new Error('Redirecting to staff sign in.');
  }
  await keycloak.updateToken(30);
  if (!keycloak.token) throw new Error('No staff access token is available.');
  return keycloak.token;
}

export interface ProfessionalOnboardingRequest {
  email: string;
  displayName: string;
  issuer: string;
}
export interface ProfessionalOnboardingResponse {
  customerId: string;
  subscriptionId: string;
  tenantId: string;
  userId: string;
  provisioningJobId: string;
  customerStatus: string;
  provisioningStatus: string;
  identityStatus: string;
  planCode: string;
  planVersion: number;
  storageQuotaBytes: number;
  maxRegisteredDevices: number;
}
export interface ProfessionalOnboardingSummary {
  customerId: string;
  email: string;
  displayName: string;
  tenantId: string;
  customerStatus: string;
  provisioningStatus: string;
  identityStatus: string;
  planCode: string;
  planVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface ProfessionalOnboardingPage {
  items: ProfessionalOnboardingSummary[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}
export interface CustomerLifecycleRequest {
  status: string;
}

export class AtlasApiError extends Error {
  readonly error: string;
  readonly status: number;
  constructor(status: number, error: string, message: string) {
    super(message);
    this.name = 'AtlasApiError';
    this.error = error;
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await token()}`,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (init?.headers) {
    const h =
      typeof init.headers === 'object' &&
      !Array.isArray(init.headers) &&
      !(init.headers instanceof Headers)
        ? init.headers
        : {};
    Object.assign(headers, h as Record<string, string>);
  }
  const response = await fetch(
    `${resolveApiBaseUrl()}${path}`,
    { ...init, headers },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      string
    >;
    const error = body.error ?? 'UNKNOWN';
    const message = body.message ?? `ATLAS API returned ${response.status}.`;
    throw new AtlasApiError(response.status, error, message);
  }
  return (await response.json()) as Promise<T>;
}

export const backofficeApi = {
  async listCustomers(params?: {
    q?: string;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<ProfessionalOnboardingPage> {
    const q = new URLSearchParams();
    if (params?.q) q.set('q', params.q);
    if (params?.status) q.set('status', params.status);
    if (params?.page !== undefined) q.set('page', String(params.page));
    if (params?.size !== undefined) q.set('size', String(params.size));
    const s = q.toString();
    return request<ProfessionalOnboardingPage>(
      `/api/backoffice/v1/professional-onboardings${s ? `?${s}` : ''}`,
    );
  },
  async createCustomer(
    body: ProfessionalOnboardingRequest,
    idempotencyKey?: string,
  ): Promise<ProfessionalOnboardingResponse> {
    const key = idempotencyKey ?? crypto.randomUUID();
    return request<ProfessionalOnboardingResponse>(
      '/api/backoffice/v1/professional-onboardings',
      { method: 'POST', body: JSON.stringify(body) },
      key,
    );
  },
  async getCustomer(
    customerId: string,
  ): Promise<ProfessionalOnboardingResponse> {
    return request<ProfessionalOnboardingResponse>(
      `/api/backoffice/v1/professional-onboardings/${customerId}`,
    );
  },
  async updateCustomerStatus(
    customerId: string,
    status: string,
  ): Promise<ProfessionalOnboardingResponse> {
    return request<ProfessionalOnboardingResponse>(
      `/api/backoffice/v1/professional-onboardings/${customerId}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    );
  },
  async getCustomerDetail(customerId: string): Promise<CustomerDetailDto> {
    return request<CustomerDetailDto>(`/api/backoffice/v1/customers/${customerId}`);
  },
  async updateCustomer(
    customerId: string,
    body: { status?: string; companyName?: string; contactPhone?: string; billingEmail?: string },
  ): Promise<CustomerDetailDto> {
    return request<CustomerDetailDto>(`/api/backoffice/v1/customers/${customerId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  async listJobs(params?: {
    status?: string;
    page?: number;
    size?: number;
  }): Promise<ProvisioningPageDto> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page !== undefined) q.set('page', String(params.page));
    if (params?.size !== undefined) q.set('size', String(params.size));
    const s = q.toString();
    return request<ProvisioningPageDto>(`/api/backoffice/v1/provisioning/jobs${s ? `?${s}` : ''}`);
  },
  async getJob(jobId: string): Promise<ProvisioningJobDto> {
    return request<ProvisioningJobDto>(`/api/backoffice/v1/provisioning/jobs/${jobId}`);
  },
  async getJobSteps(jobId: string): Promise<ProvisioningStepDto[]> {
    return request<ProvisioningStepDto[]>(`/api/backoffice/v1/provisioning/jobs/${jobId}/steps`);
  },
  async approveJob(jobId: string): Promise<ProvisioningJobDto> {
    return request<ProvisioningJobDto>(`/api/backoffice/v1/provisioning/jobs/${jobId}/approve`, {
      method: 'POST',
    });
  },
  async rejectJob(jobId: string, reason?: string): Promise<ProvisioningJobDto> {
    return request<ProvisioningJobDto>(`/api/backoffice/v1/provisioning/jobs/${jobId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? 'Rejected by staff operator' }),
    });
  },
  async retryJob(jobId: string): Promise<ProvisioningJobDto> {
    return request<ProvisioningJobDto>(`/api/backoffice/v1/provisioning/jobs/${jobId}/retry`, {
      method: 'POST',
    });
  },
  async listUsers(customerId: string): Promise<ProfessionalUserDto[]> {
    return request<ProfessionalUserDto[]>(`/api/backoffice/v1/customers/${customerId}/users`);
  },
  async inviteUser(
    customerId: string,
    body: { email: string; displayName: string; role?: string },
  ): Promise<ProfessionalUserDto> {
    return request<ProfessionalUserDto>(`/api/backoffice/v1/customers/${customerId}/users`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async updateUser(
    customerId: string,
    userId: string,
    body: { status?: string; role?: string },
  ): Promise<ProfessionalUserDto> {
    return request<ProfessionalUserDto>(`/api/backoffice/v1/customers/${customerId}/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  async listDevices(customerId: string): Promise<DeviceDto[]> {
    return request<DeviceDto[]>(`/api/backoffice/v1/customers/${customerId}/devices`);
  },
  async revokeDevice(customerId: string, deviceId: string): Promise<void> {
    return request<void>(`/api/backoffice/v1/customers/${customerId}/devices/${deviceId}`, {
      method: 'DELETE',
    });
  },
  async listAuditEvents(params?: {
    customerId?: string;
    tenantId?: string;
    action?: string;
    page?: number;
    size?: number;
  }): Promise<AuditPageDto> {
    const q = new URLSearchParams();
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.tenantId) q.set('tenantId', params.tenantId);
    if (params?.action) q.set('action', params.action);
    if (params?.page !== undefined) q.set('page', String(params.page));
    if (params?.size !== undefined) q.set('size', String(params.size));
    const s = q.toString();
    return request<AuditPageDto>(`/api/backoffice/v1/audit-events${s ? `?${s}` : ''}`);
  },
  async getCurriculumCatalogue(): Promise<CurriculumCatalogueResponse> {
    return request<CurriculumCatalogueResponse>('/api/backoffice/v1/curriculum/catalogue');
  },
  async listCurriculumResources(): Promise<CurriculumResourceItem[]> {
    return request<CurriculumResourceItem[]>('/api/backoffice/v1/curriculum/resources');
  },
  async uploadCurriculumResource(
    file: File,
    metadata: CurriculumResourceRequest,
  ): Promise<CurriculumIngestionResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    );

    const authToken = await token();
    const baseUrl = resolveApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/backoffice/v1/curriculum/resources`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Record<
        string,
        string
      >;
      const error = body.error ?? 'UPLOAD_FAILED';
      const message =
        body.message ?? `Ingestion failed with status ${response.status}.`;
      throw new AtlasApiError(response.status, error, message);
    }
    return (await response.json()) as CurriculumIngestionResult;
  },
  async deleteCurriculumResource(
    revisionId: string,
  ): Promise<void> {
    const authToken = await token();
    const baseUrl = resolveApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/backoffice/v1/curriculum/resources/${encodeURIComponent(revisionId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Record<
        string,
        string
      >;
      const error = body.error ?? 'DELETE_FAILED';
      const message =
        body.message ?? `Deletion failed with status ${response.status}.`;
      throw new AtlasApiError(response.status, error, message);
    }
  },
};

export interface CurriculumScopeRequest {
  knowledgeSpaceCode: string;
  countryCode: string;
  curriculumCode: string;
  curriculumVersion: string;
  grade: number;
  subjectCode: string;
  language: string;
}

export type CurriculumResourceType =
  | 'TEXTBOOK'
  | 'TEACHER_GUIDE'
  | 'PAST_PAPER'
  | 'MODEL_PAPER'
  | 'MARKING_SCHEME'
  | 'SYLLABUS'
  | 'LESSON_MATERIAL'
  | 'SUPPLEMENTARY_RESOURCE';

export interface CurriculumResourceRequest {
  scope: CurriculumScopeRequest;
  resourceType: CurriculumResourceType;
  originalTitle: string;
  publisherAuthority: string;
  sourceReference: string;
  publicationYear?: number;
  rightsStatus: string;
  versionIdentifier: string;
}

export interface CurriculumIngestionResult {
  resourceId: string;
  revisionId: string;
  indexedChunks: number;
  checksumSha256: string;
}

export interface CurriculumResourceItem {
  resourceId: string;
  revisionId: string;
  originalTitle: string;
  resourceType: string;
  grade: number;
  subjectCode: string;
  subjectName: string;
  languageCode: string;
  publicationYear?: number;
  publisherAuthority: string;
  sourceReference: string;
  versionIdentifier: string;
  ingestionStatus: 'PENDING' | 'INDEXED' | 'FAILED' | 'SUPERSEDED';
  ingestedAt?: string;
  checksumSha256: string;
  indexedChunks: number;
}

export interface CurriculumCatalogueResponse {
  countries: Array<{ id: string; isoCode: string; name: string }>;
  curricula: Array<{ id: string; code: string; name: string; authority: string; countryCode: string }>;
  versions: Array<{ id: string; versionCode: string; status: string; curriculumCode: string }>;
  grades: Array<{ gradeNumber: number; displayName: string }>;
  subjects: Array<{ code: string; name: string; grades: number[]; languages: string[] }>;
  knowledgeSpace?: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    productType: string;
    status: string;
  } | null;
  languages: Array<{ code: string; name: string }>;
  resourceTypes: Array<{ value: CurriculumResourceType; label: string }>;
}

export interface CustomerDetailDto {
  customerId: string;
  email: string;
  displayName: string;
  companyName: string | null;
  contactPhone: string | null;
  billingEmail: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  tenants: CustomerTenantDto[];
  subscription: CustomerSubscriptionDto | null;
  userCount: number;
  deviceCount: number;
}

export interface CustomerTenantDto {
  tenantId: string;
  tenantCode: string;
  name: string;
  status: string;
  region: string;
  createdAt: string;
}

export interface CustomerSubscriptionDto {
  subscriptionId: string;
  planCode: string;
  planVersion: number;
  status: string;
  seatCount: number;
  maxSeats: number;
  startsAt: string;
  expiresAt: string | null;
}

export interface ProvisioningJobDto {
  jobId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  tenantId: string | null;
  planCode: string;
  status: string;
  currentStep: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  eligibleForRetry: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ProvisioningStepDto {
  stepId: string;
  jobId: string;
  stepName: string;
  stepOrder: number;
  status: string;
  attemptCount: number;
  errorMessage: string | null;
  diagnosticsJson: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ProvisioningPageDto {
  items: ProvisioningJobDto[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface ProfessionalUserDto {
  userId: string;
  customerId: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  keycloakUserId: string | null;
  invitedAt: string;
  activatedAt: string | null;
  lastLoginAt: string | null;
}

export interface DeviceDto {
  deviceId: string;
  tenantId: string;
  userId: string;
  userEmail: string | null;
  deviceFingerprint: string;
  platform: string;
  status: string;
  registeredAt: string;
  lastSeenAt: string;
}

export interface AuditEventDto {
  eventId: string;
  customerId: string | null;
  tenantId: string | null;
  operatorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  detailsJson: string | null;
  ipAddress: string | null;
  timestamp: string;
}

export interface AuditPageDto {
  items: AuditEventDto[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

