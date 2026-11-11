/**
 * Frontend Runtime Environment & Data-Source Mode Configuration (Phase 8.2)
 *
 * Preserves 100% backward compatibility with Phases 1–7.7 in `LOCAL_DEMO` mode
 * by default while providing configuration for `BACKEND_API` integration.
 */

export const DATA_SOURCE_MODES = Object.freeze({
  LOCAL_DEMO: 'LOCAL_DEMO',
  BACKEND_API: 'BACKEND_API',
});

const rawViteEnv =
  typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

/**
 * Resolves the active data-source mode.
 * Defaults to `LOCAL_DEMO` so existing local demo providers remain active unless explicitly switched.
 *
 * @param {Record<string, string | undefined>} [envOverride]
 * @returns {'LOCAL_DEMO' | 'BACKEND_API'}
 */
export function resolveDataSourceMode(envOverride = rawViteEnv) {
  const mode = String(envOverride?.VITE_DATA_SOURCE_MODE || 'LOCAL_DEMO')
    .trim()
    .toUpperCase();

  return mode === DATA_SOURCE_MODES.BACKEND_API
    ? DATA_SOURCE_MODES.BACKEND_API
    : DATA_SOURCE_MODES.LOCAL_DEMO;
}

/**
 * Resolves the backend API base URL.
 * Defaults to `http://localhost:5000/api/v1`.
 *
 * @param {Record<string, string | undefined>} [envOverride]
 * @returns {string}
 */
export function resolveApiBaseUrl(envOverride = rawViteEnv) {
  const rawUrl = String(
    envOverride?.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
  ).trim();
  return rawUrl.replace(/\/+$/, '');
}

export const frontendEnv = Object.freeze({
  dataSourceMode: resolveDataSourceMode(),
  apiBaseUrl: resolveApiBaseUrl(),
  isBackendApiMode: resolveDataSourceMode() === DATA_SOURCE_MODES.BACKEND_API,
  isBackendApi: resolveDataSourceMode() === DATA_SOURCE_MODES.BACKEND_API,
  isLocalDemoMode: resolveDataSourceMode() === DATA_SOURCE_MODES.LOCAL_DEMO,
});

export function isBackendModeEnabled() {
  return frontendEnv.isBackendApiMode;
}
