'use client';
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8081',
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
    `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}${path}`,
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
  async listCurriculumResources(
    tenantId: string = 'atlas-pilot',
  ): Promise<CurriculumResourceItem[]> {
    return request<CurriculumResourceItem[]>('/api/v1/learn/resources', {
      headers: {
        'X-Atlas-Tenant-Id': tenantId,
      },
    });
  },
  async uploadCurriculumResource(
    file: File,
    metadata: CurriculumResourceRequest,
    tenantId: string = 'atlas-pilot',
  ): Promise<CurriculumIngestionResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    );

    const authToken = await token();
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
    const response = await fetch(`${baseUrl}/api/v1/learn/resources`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'X-Atlas-Tenant-Id': tenantId,
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
    tenantId: string = 'atlas-pilot',
  ): Promise<void> {
    const authToken = await token();
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
    const response = await fetch(
      `${baseUrl}/api/v1/learn/resources/${encodeURIComponent(revisionId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Atlas-Tenant-Id': tenantId,
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
