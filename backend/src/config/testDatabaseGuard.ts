/**
 * Fail-closed guard for destructive integration test cleanup.
 * Prevents integration suites from ever deleting rows from production or unverified databases.
 */
export function assertSafeTestDatabase(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  allowOverride: string | undefined = process.env.ALLOW_DESTRUCTIVE_TEST_CLEANUP
): void {
  if (nodeEnv === 'production') {
    throw new Error(
      'FAIL-CLOSED TEST GUARD: Refusing destructive test cleanup while NODE_ENV=production.'
    );
  }

  if (!databaseUrl) {
    throw new Error(
      'FAIL-CLOSED TEST GUARD: DATABASE_URL is undefined. Cannot verify safe test database.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      'FAIL-CLOSED TEST GUARD: DATABASE_URL is not a valid URL.'
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();

  const isLocalOrContainerHost = [
    'localhost',
    '127.0.0.1',
    '::1',
    'postgres',
    'postgres-db',
  ].includes(hostname);

  const isSafeDatabaseName =
    dbName.includes('test') ||
    dbName.includes('dev') ||
    dbName === 'ovs_db' ||
    dbName === 'ovs_ci_test' ||
    dbName === 'ovs_validation_db' ||
    allowOverride === 'true';

  if (!isLocalOrContainerHost || !isSafeDatabaseName) {
    throw new Error(
      `FAIL-CLOSED TEST GUARD: Refusing destructive cleanup on target '${hostname}/${dbName}'.`
    );
  }
}
