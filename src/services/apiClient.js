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
  let unauthorizedHandler =
    typeof options.onUnauthorized === 'function' ? options.onUnauthorized : null;

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
      const errStatus = payload?.status || response.status;
      if (
        errStatus === 401 &&
        unauthorizedHandler &&
        !path.endsWith('/auth/login') &&
        !path.endsWith('/auth/me')
      ) {
        try {
          unauthorizedHandler(path);
        } catch {
          // Ignore callback errors
        }
      }
      throw new ApiProblemError({
        type: payload?.type,
        title: payload?.title || response.statusText || 'Request Failed',
        status: errStatus,
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
    setUnauthorizedHandler: (fn) => {
      unauthorizedHandler = typeof fn === 'function' ? fn : null;
    },
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
      getSchedule: (electionId) =>
        request(`/elections/${encodeURIComponent(electionId)}/schedule`),
    },
    parties: {
      list: (query) => request('/parties', { query }),
      getById: (partyId) => request(`/parties/${encodeURIComponent(partyId)}`),
    },
    candidates: {
      getById: (candidateId) =>
        request(`/candidates/${encodeURIComponent(candidateId)}`),
    },

    // Phase 8.9 Public Results APIs (Published Results Only)
    results: {
      list: (query) => request('/results', { query }),
      getById: (sessionId) =>
        request(`/results/${encodeURIComponent(sessionId)}`),
      getElectionSummary: (electionId) =>
        request(`/results/elections/${encodeURIComponent(electionId)}/summary`),
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

    // Phase 8.4 Administrative Authentication, RBAC, Scoping & Audit APIs
    admin: {
      login: (data) =>
        request('/admin/auth/login', { method: 'POST', body: data }),
      logout: (csrfToken) =>
        request('/admin/auth/logout', { method: 'POST', csrfToken }),
      logoutAll: (csrfToken) =>
        request('/admin/auth/logout-all', { method: 'POST', csrfToken }),
      getMe: () => request('/admin/auth/me'),
      updateMe: (data, csrfToken) =>
        request('/admin/auth/me', { method: 'PATCH', body: data, csrfToken }),
      listSessions: () => request('/admin/auth/sessions'),
      revokeSession: (sessionId, csrfToken) =>
        request(`/admin/auth/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          csrfToken,
        }),
      getPermissions: () => request('/admin/permissions'),
      listUsers: (query) => request('/admin/users', { query }),
      getUser: (id) => request(`/admin/users/${encodeURIComponent(id)}`),
      createUser: (data, csrfToken) =>
        request('/admin/users', { method: 'POST', body: data, csrfToken }),
      updateUser: (id, data, csrfToken) =>
        request(`/admin/users/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: data,
          csrfToken,
        }),
      suspendUser: (id, data, csrfToken) =>
        request(`/admin/users/${encodeURIComponent(id)}/suspend`, {
          method: 'POST',
          body: data,
          csrfToken,
        }),
      activateUser: (id, data, csrfToken) =>
        request(`/admin/users/${encodeURIComponent(id)}/activate`, {
          method: 'POST',
          body: data || {},
          csrfToken,
        }),
      getUserScopes: (id) =>
        request(`/admin/users/${encodeURIComponent(id)}/scopes`),
      updateUserScopes: (id, data, csrfToken) =>
        request(`/admin/users/${encodeURIComponent(id)}/scopes`, {
          method: 'PUT',
          body: data,
          csrfToken,
        }),
      listAuditLogs: (query) => request('/admin/audit-logs', { query }),
      elections: {
        summary: () => request('/admin/elections/summary'),
        list: (query) => request('/admin/elections', { query }),
        getById: (electionId) =>
          request(`/admin/elections/${encodeURIComponent(electionId)}`),
        create: (data, csrfToken) =>
          request('/admin/elections', { method: 'POST', body: data, csrfToken }),
        update: (electionId, data, csrfToken) =>
          request(`/admin/elections/${encodeURIComponent(electionId)}`, {
            method: 'PATCH',
            body: data,
            csrfToken,
          }),
        transition: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/transition`,
            { method: 'POST', body: data, csrfToken }
          ),
        cancel: (electionId, data, csrfToken) =>
          request(`/admin/elections/${encodeURIComponent(electionId)}/cancel`, {
            method: 'POST',
            body: data,
            csrfToken,
          }),
        archive: (electionId, data, csrfToken) =>
          request(`/admin/elections/${encodeURIComponent(electionId)}/archive`, {
            method: 'POST',
            body: data || {},
            csrfToken,
          }),
        history: (electionId, query) =>
          request(`/admin/elections/${encodeURIComponent(electionId)}/history`, {
            query,
          }),
        // Phase 8.7 Constituency Assignment, Schedule & Configuration Review
        listConstituencies: (electionId, query) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/constituencies`,
            { query }
          ),
        listAvailableConstituencies: (electionId, query) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/available-constituencies`,
            { query }
          ),
        assignConstituency: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/constituencies`,
            { method: 'POST', body: data, csrfToken }
          ),
        previewBulkConstituencies: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/constituencies/preview`,
            { method: 'POST', body: data, csrfToken }
          ),
        bulkAssignConstituencies: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/constituencies/bulk`,
            { method: 'POST', body: data, csrfToken }
          ),
        removeConstituency: (electionId, constituencyId, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/constituencies/${encodeURIComponent(constituencyId)}`,
            { method: 'DELETE', csrfToken }
          ),
        constituencyHistory: (electionId, query) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/constituencies/history`,
            { query }
          ),
        getSchedule: (electionId) =>
          request(`/admin/elections/${encodeURIComponent(electionId)}/schedule`),
        putSchedule: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/schedule`,
            { method: 'PUT', body: data, csrfToken }
          ),
        patchMilestone: (electionId, milestoneId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/schedule/${encodeURIComponent(milestoneId)}`,
            { method: 'PATCH', body: data, csrfToken }
          ),
        validateSchedule: (electionId, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/schedule/validate`,
            { method: 'POST', body: {}, csrfToken }
          ),
        scheduleHistory: (electionId, query) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/schedule/history`,
            { query }
          ),
        validateConfig: (electionId) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/configuration/validation`
          ),
        submitConfig: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/configuration/submit`,
            { method: 'POST', body: data || {}, csrfToken }
          ),
        reviewConfig: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/configuration/review`,
            { method: 'POST', body: data || {}, csrfToken }
          ),
        approveConfig: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/configuration/approve`,
            { method: 'POST', body: data || {}, csrfToken }
          ),
        returnConfig: (electionId, data, csrfToken) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/configuration/return`,
            { method: 'POST', body: data, csrfToken }
          ),
        participationSummary: (electionId) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/participation/summary`
          ),
        participationConstituencies: (electionId) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/participation/constituencies`
          ),
        participationTimeline: (electionId) =>
          request(
            `/admin/elections/${encodeURIComponent(electionId)}/participation/timeline`
          ),
      },
      candidates: {
        list: (query) => request('/admin/candidates', { query }),
        getById: (candidateId) =>
          request(`/admin/candidates/${encodeURIComponent(candidateId)}`),
        create: (data, csrfToken) =>
          request('/admin/candidates', { method: 'POST', body: data, csrfToken }),
        update: (candidateId, data, csrfToken) =>
          request(`/admin/candidates/${encodeURIComponent(candidateId)}`, {
            method: 'PATCH',
            body: data,
            csrfToken,
          }),
        deactivate: (candidateId, data, csrfToken) =>
          request(
            `/admin/candidates/${encodeURIComponent(candidateId)}/deactivate`,
            { method: 'POST', body: data || {}, csrfToken }
          ),
      },
      parties: {
        list: (query) => request('/admin/parties', { query }),
        getById: (partyId) =>
          request(`/admin/parties/${encodeURIComponent(partyId)}`),
        create: (data, csrfToken) =>
          request('/admin/parties', { method: 'POST', body: data, csrfToken }),
        update: (partyId, data, csrfToken) =>
          request(`/admin/parties/${encodeURIComponent(partyId)}`, {
            method: 'PATCH',
            body: data,
            csrfToken,
          }),
      },
      nominations: {
        list: (query) => request('/admin/nominations', { query }),
        getById: (nominationId) =>
          request(`/admin/nominations/${encodeURIComponent(nominationId)}`),
        create: (data, csrfToken) =>
          request('/admin/nominations', { method: 'POST', body: data, csrfToken }),
        updateDraft: (nominationId, data, csrfToken) =>
          request(`/admin/nominations/${encodeURIComponent(nominationId)}`, {
            method: 'PATCH',
            body: data,
            csrfToken,
          }),
        submit: (nominationId, data, csrfToken) =>
          request(
            `/admin/nominations/${encodeURIComponent(nominationId)}/submit`,
            { method: 'POST', body: data || {}, csrfToken }
          ),
        review: (nominationId, data, csrfToken) =>
          request(
            `/admin/nominations/${encodeURIComponent(nominationId)}/review`,
            { method: 'POST', body: data || {}, csrfToken }
          ),
        approve: (nominationId, data, csrfToken) =>
          request(
            `/admin/nominations/${encodeURIComponent(nominationId)}/approve`,
            { method: 'POST', body: data || {}, csrfToken }
          ),
        reject: (nominationId, data, csrfToken) =>
          request(
            `/admin/nominations/${encodeURIComponent(nominationId)}/reject`,
            { method: 'POST', body: data, csrfToken }
          ),
        withdraw: (nominationId, data, csrfToken) =>
          request(
            `/admin/nominations/${encodeURIComponent(nominationId)}/withdraw`,
            { method: 'POST', body: data, csrfToken }
          ),
        history: (nominationId, query) =>
          request(
            `/admin/nominations/${encodeURIComponent(nominationId)}/history`,
            { query }
          ),
      },
      // Phase 8.9 Admin Counting & Results Management
      counting: {
        listSessions: (query) => request('/admin/counting/sessions', { query }),
        getSession: (sessionId) =>
          request(`/admin/counting/sessions/${encodeURIComponent(sessionId)}`),
        createSession: (data, csrfToken) =>
          request('/admin/counting/sessions', {
            method: 'POST',
            body: data,
            csrfToken,
          }),
        recordRound: (sessionId, data, csrfToken) =>
          request(
            `/admin/counting/sessions/${encodeURIComponent(sessionId)}/rounds`,
            { method: 'POST', body: data, csrfToken }
          ),
        recordTallies: (sessionId, data, csrfToken) =>
          request(
            `/admin/counting/sessions/${encodeURIComponent(sessionId)}/tallies`,
            { method: 'POST', body: data, csrfToken }
          ),
        resolveTie: (sessionId, data, csrfToken) =>
          request(
            `/admin/counting/sessions/${encodeURIComponent(sessionId)}/tie-break`,
            { method: 'POST', body: data, csrfToken }
          ),
        submitForReview: (sessionId, csrfToken) =>
          request(
            `/admin/counting/sessions/${encodeURIComponent(sessionId)}/review`,
            { method: 'POST', body: {}, csrfToken }
          ),
        publish: (sessionId, csrfToken) =>
          request(
            `/admin/counting/sessions/${encodeURIComponent(sessionId)}/publish`,
            { method: 'POST', body: {}, csrfToken }
          ),
        correct: (sessionId, data, csrfToken) =>
          request(
            `/admin/counting/sessions/${encodeURIComponent(sessionId)}/correct`,
            { method: 'POST', body: data, csrfToken }
          ),
        reset: (sessionId, csrfToken) =>
          request(
            `/admin/counting/sessions/${encodeURIComponent(sessionId)}/reset`,
            { method: 'POST', body: {}, csrfToken }
          ),
      },

      // Phase 8.10 Analytics & Dashboards
      analytics: {
        national: (query) => request('/admin/analytics/national', { query }),
        overview: (query) => request('/admin/analytics/overview', { query }),
        state: (stateId, query) =>
          request(`/admin/analytics/states/${encodeURIComponent(stateId)}`, { query }),
        election: (electionId) =>
          request(`/admin/analytics/elections/${encodeURIComponent(electionId)}`),
        electionOverview: (electionId) =>
          request(`/admin/analytics/elections/${encodeURIComponent(electionId)}/overview`),
        electionCandidates: (electionId) =>
          request(`/admin/analytics/elections/${encodeURIComponent(electionId)}/candidates`),
        electionParties: (electionId) =>
          request(`/admin/analytics/elections/${encodeURIComponent(electionId)}/parties`),
        participation: (query) => request('/admin/analytics/participation', { query }),
        participationTrends: (query) => request('/admin/analytics/participation/trends', { query }),
        counting: (query) => request('/admin/analytics/counting', { query }),
        audit: (query) => request('/admin/analytics/activity', { query }),
        exportUrl: (query) => {
          const params = new URLSearchParams(query || {}).toString();
          return `/api/v1/admin/analytics/export${params ? `?${params}` : ''}`;
        },
      },
    },

    publicAnalytics: {
      elections: (query) => request('/public/analytics/elections', { query }),
      results: (query) => request('/public/analytics/results', { query }),
    },

    // Phase 8.8 Voter Demo Voting & Participation (Zero Candidate-Choice Transmission)
    voter: {
      listElections: () => request('/voter/elections'),
      getElection: (electionId) =>
        request(`/voter/elections/${encodeURIComponent(electionId)}`),
      getEligibility: (electionId) =>
        request(
          `/voter/elections/${encodeURIComponent(electionId)}/eligibility`
        ),
      getBallot: (electionId) =>
        request(`/voter/elections/${encodeURIComponent(electionId)}/ballot`),
      confirmParticipation: (electionId, csrfToken) =>
        request(
          `/voter/elections/${encodeURIComponent(electionId)}/participation`,
          { method: 'POST', body: {}, csrfToken }
        ),
      listParticipation: () => request('/voter/participation'),
      getElectionParticipation: (electionId) =>
        request(
          `/voter/elections/${encodeURIComponent(electionId)}/participation`
        ),
    },
  };
}

export const apiClient = createOvsApiClient();
