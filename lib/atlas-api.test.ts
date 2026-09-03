import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('keycloak-js', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      init: vi.fn().mockResolvedValue(true),
      login: vi.fn(),
      updateToken: vi.fn().mockResolvedValue(undefined),
      token: 'test-token',
    })),
  };
});

import { backofficeApi, AtlasApiError } from './atlas-api';

const originalFetch = global.fetch;
const originalCrypto = global.crypto;

function mockFetchOnce(status: number, body: unknown) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
  global.fetch = vi.fn().mockResolvedValue(response);
  return global.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe('backofficeApi', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-123' } as unknown as Crypto);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalCrypto) global.crypto = originalCrypto;
  });

  it('listCustomers builds query params correctly', async () => {
    const fetchMock = mockFetchOnce(200, { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 });
    await backofficeApi.listCustomers({ q: 'acme', status: 'ACTIVE', page: 1, size: 10 });
    const url = (fetchMock.mock.calls[0][0] as string);
    expect(url).toContain('/api/backoffice/v1/professional-onboardings');
    expect(url).toContain('q=acme');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('page=1');
    expect(url).toContain('size=10');
  });

  it('listCustomers without params calls base endpoint', async () => {
    const fetchMock = mockFetchOnce(200, { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 });
    await backofficeApi.listCustomers();
    const url = (fetchMock.mock.calls[0][0] as string);
    expect(url).toBe('http://localhost:8080/api/backoffice/v1/professional-onboardings');
  });

  it('createCustomer sends Idempotency-Key header with generated UUID', async () => {
    const fetchMock = mockFetchOnce(202, { customerId: 'c1', subscriptionId: 's1', tenantId: 't1', userId: 'u1', provisioningJobId: 'j1', customerStatus: 'ACTIVE', provisioningStatus: 'PENDING', identityStatus: 'BOUND', planCode: 'PROFESSIONAL', planVersion: 1, storageQuotaBytes: 1000, maxRegisteredDevices: 2 });
    await backofficeApi.createCustomer({ email: 'a@b.com', displayName: 'Test', issuer: 'https://issuer' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('test-uuid-123');
    expect(init.method).toBe('POST');
  });

  it('createCustomer reuses provided idempotency key', async () => {
    const fetchMock = mockFetchOnce(202, { customerId: 'c1', subscriptionId: 's1', tenantId: 't1', userId: 'u1', provisioningJobId: 'j1', customerStatus: 'ACTIVE', provisioningStatus: 'PENDING', identityStatus: 'BOUND', planCode: 'PROFESSIONAL', planVersion: 1, storageQuotaBytes: 1000, maxRegisteredDevices: 2 });
    await backofficeApi.createCustomer({ email: 'a@b.com', displayName: 'Test', issuer: 'https://issuer' }, 'my-key-123');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('my-key-123');
  });

  it('getCustomer calls correct endpoint', async () => {
    const fetchMock = mockFetchOnce(200, { customerId: 'c1', subscriptionId: 's1', tenantId: 't1', userId: 'u1', provisioningJobId: 'j1', customerStatus: 'ACTIVE', provisioningStatus: 'PENDING', identityStatus: 'BOUND', planCode: 'PROFESSIONAL', planVersion: 1, storageQuotaBytes: 1000, maxRegisteredDevices: 2 });
    await backofficeApi.getCustomer('my-id');
    const url = (fetchMock.mock.calls[0][0] as string);
    expect(url).toContain('/api/backoffice/v1/professional-onboardings/my-id');
  });

  it('updateCustomerStatus sends PATCH with status', async () => {
    const fetchMock = mockFetchOnce(200, { customerId: 'c1', subscriptionId: 's1', tenantId: 't1', userId: 'u1', provisioningJobId: 'j1', customerStatus: 'SUSPENDED', provisioningStatus: 'PENDING', identityStatus: 'BOUND', planCode: 'PROFESSIONAL', planVersion: 1, storageQuotaBytes: 1000, maxRegisteredDevices: 2 });
    await backofficeApi.updateCustomerStatus('my-id', 'SUSPENDED');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ status: 'SUSPENDED' }));
  });

  it('throws AtlasApiError with structured error fields on failure', async () => {
    mockFetchOnce(409, { error: 'CONFLICT', message: 'Already exists' });
    try {
      await backofficeApi.createCustomer({ email: 'a@b.com', displayName: 'Test', issuer: 'https://issuer' });
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AtlasApiError);
      expect((e as AtlasApiError).status).toBe(409);
      expect((e as AtlasApiError).error).toBe('CONFLICT');
      expect((e as AtlasApiError).message).toBe('Already exists');
    }
  });

  it('throws AtlasApiError for 401 with correct status', async () => {
    mockFetchOnce(401, { error: 'UNAUTHORIZED', message: 'Not authorized' });
    try {
      await backofficeApi.listCustomers();
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AtlasApiError);
      expect((e as AtlasApiError).status).toBe(401);
      expect((e as AtlasApiError).error).toBe('UNAUTHORIZED');
    }
  });

  it('handles 404 without swallowing error', async () => {
    mockFetchOnce(404, { error: 'NOT_FOUND', message: 'Customer not found' });
    await expect(backofficeApi.getCustomer('missing')).rejects.toBeInstanceOf(AtlasApiError);
    try {
      await backofficeApi.getCustomer('missing');
    } catch (e) {
      expect((e as AtlasApiError).status).toBe(404);
    }
  });

  it('includes Authorization header', async () => {
    const fetchMock = mockFetchOnce(200, { items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 });
    await backofficeApi.listCustomers();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
  });
});