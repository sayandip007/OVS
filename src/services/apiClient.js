import { frontendEnv } from '../config/env.js';

/**
 * Structured error representing an RFC 9457 Problem Details response (`application/problem+json`)
 * or network transport failure from the OVS Backend API.
 */
export class ApiProblemError extends Error {
  /**
   * @param {object} details
   * @param {string} [details.type]
   * @param {string} [details.title]
   * @param {number} [details.status]
   * @param {string} [details.detail]
   * @param {string} [details.instance]
   * @param {string} [details.code]
   * @param {string} [details.requestId]
   * @param {Array<{ name: string, reason: string }>} [details.invalidParams]
   */
  constructor(details = {}) {
    const message =
      details.detail ||
      details.title ||
      'An unexpected error occurred while communicating with the OVS API.';
    super(message);
    this.name = 'ApiProblemError';
    this.type = details.type || 'https://ovs.eci.gov.in/errors/unexpected-error';
    this.title = details.title || 'API Error';
    this.status = typeof details.status === 'number' ? details.status : 500;
    this.detail = message;
    this.instance = details.instance || '';
    this.code = details.code || 'API_ERROR';
    this.requestId = details.requestId || null;
    this.invalidParams = Array.isArray(details.invalidParams)
      ? details.invalidParams
      : [];
  }
}

/**
 * Builds a URL with serialized query parameters, omitting null/undefined/empty values.
 *
 * @param {string} baseUrl
 * @param {string} path
 * @param {Record<string, string | number | boolean | undefined | null>} [query]
 * @returns {string}
 */
export function buildApiUrl(baseUrl, path, query = {}) {
  const normalizedBase = String(baseUrl || frontendEnv.apiBaseUrl).replace(/\/+$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  const fullUrl = `${normalizedBase}${normalizedPath}`;

  const searchParams = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${fullUrl}?${queryString}` : fullUrl;
}

/**
 * Creates a reusable OVS API client with credentials support and RFC 9457 Problem Details error mapping.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createOvsApiClient(options = {}) {
  const baseUrl = options.baseUrl || frontendEnv.apiBaseUrl;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  async function request(path, config = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new ApiProblemError({
        title: 'Fetch Unavailable',
        status: 500,
        detail: 'Global fetch implementation is not available in this runtime.',
        code: 'FETCH_UNAVAILABLE',
      });
    }

    const url = buildApiUrl(baseUrl, path, config.query);
    const headers = {
      Accept: 'application/json, application/problem+json',
      ...(config.body ? { 'Content-Type': 'application/json' } : {}),
      ...(config.csrfToken ? { 'X-CSRF-Token': config.csrfToken } : {}),
      ...(config.requestId ? { 'X-Request-Id': config.requestId } : {}),
      ...(config.headers || {}),
    };

    let response;
    try {
      response = await fetchImpl(url, {
        method: config.method || 'GET',
        headers,
        credentials: 'include',
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: config.signal,
      });
    } catch (networkError) {
      throw new ApiProblemError({
        type: 'https://ovs.eci.gov.in/errors/network-error',
        title: 'Network Error',
        status: 0,
        detail:
          networkError instanceof Error
            ? networkError.message
            : 'Unable to reach OVS Backend API server.',
        instance: path,
        code: 'NETWORK_ERROR',
      });
    }

    const contentType = response.headers?.get?.('content-type') || '';
    const isJson =
      contentType.includes('application/json') ||
      contentType.includes('application/problem+json');

    const payload = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      throw new ApiProblemError({
        type: payload?.type,
        title: payload?.title || response.statusText || 'Request Failed',
        status: payload?.status || response.status,
        detail:
          payload?.detail ||
          `HTTP ${response.status} error returned from ${path}`,
        instance: payload?.instance || path,
        code: payload?.code || `HTTP_${response.status}`,
        requestId:
          payload?.requestId || response.headers?.get?.('x-request-id') || null,
        invalidParams: payload?.invalidParams || [],
      });
    }

    return payload;
  }

  return {
    request,
    get: (path, query, config = {}) =>
      request(path, { ...config, method: 'GET', query }),

    // Read-only Phase 8.2 Domain Endpoints
    health: {
      live: () => request('/health/live'),
      ready: () => request('/health/ready'),
    },
    geography: {
      listStates: (query) => request('/geography/states', { query }),
      getState: (stateId) =>
        request(`/geography/states/${encodeURIComponent(stateId)}`),
      listDistricts: (stateId, query) =>
        request(`/geography/states/${encodeURIComponent(stateId)}/districts`, {
          query,
        }),
      listParliamentaryConstituencies: (stateId, query) =>
        request(
          `/geography/states/${encodeURIComponent(stateId)}/parliamentary-constituencies`,
          { query }
        ),
      listAssemblyConstituencies: (stateId, query) =>
        request(
          `/geography/states/${encodeURIComponent(stateId)}/assembly-constituencies`,
          { query }
        ),
      getConstituency: (constituencyId, query) =>
        request(
          `/geography/constituencies/${encodeURIComponent(constituencyId)}`,
          { query }
        ),
    },
    elections: {
      list: (query) => request('/elections', { query }),
      getById: (electionId) =>
        request(`/elections/${encodeURIComponent(electionId)}`),
      listConstituencies: (electionId, query) =>
        request(
          `/elections/${encodeURIComponent(electionId)}/constituencies`,
          { query }
        ),
      listCandidates: (electionId, query) =>
        request(`/elections/${encodeURIComponent(electionId)}/candidates`, {
          query,
        }),
    },
    parties: {
      list: (query) => request('/parties', { query }),
      getById: (partyId) => request(`/parties/${encodeURIComponent(partyId)}`),
    },
    candidates: {
      getById: (candidateId) =>
        request(`/candidates/${encodeURIComponent(candidateId)}`),
    },

    // Phase 8.3 Authentication & Session Management
    auth: {
      register: (data) =>
        request('/auth/register', { method: 'POST', body: data }),
      requestOtp: (data) =>
        request('/auth/otp/request', { method: 'POST', body: data }),
      verifyOtp: (data) =>
        request('/auth/otp/verify', { method: 'POST', body: data }),
      getMe: () => request('/auth/me'),
      getCsrf: () => request('/auth/csrf'),
      listSessions: () => request('/auth/sessions'),
      revokeSession: (sessionId, csrfToken) =>
        request(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          csrfToken,
        }),
      logout: (csrfToken) =>
        request('/auth/logout', { method: 'POST', csrfToken }),
      logoutAll: (csrfToken) =>
        request('/auth/logout-all', { method: 'POST', csrfToken }),
      getDevOtp: (identifier) =>
        request('/auth/dev/latest-otp', { query: { identifier } }),
    },

    // Phase 8.3 Voter Profile APIs
    voters: {
      getMe: () => request('/voters/me'),
      updateMe: (data, csrfToken) =>
        request('/voters/me', { method: 'PATCH', body: data, csrfToken }),
      getConstituencies: () => request('/voters/me/constituencies'),
    },
  };
}

export const apiClient = createOvsApiClient();
