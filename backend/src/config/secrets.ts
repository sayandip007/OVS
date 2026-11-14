/**
 * OVS Phase 8.13 — Provider-Neutral Secret Management Interface
 *
 * Designed to abstract secret retrieval so the application can resolve
 * secrets from Environment Variables, AWS Secrets Manager, GCP Secret Manager,
 * or HashiCorp Vault without tight vendor coupling.
 */

export interface SecretProvider {
  name?: string;
  /**
   * Retrieves a secret by key name, with optional fallback if not found.
   */
  getSecret(key: string, fallback?: string): Promise<string | undefined>;

  /**
   * Retrieves a required secret by key name, throwing if not found.
   */
  getRequiredSecret(key: string): Promise<string>;

  /**
   * Alias for getRequiredSecret.
   */
  requireSecret?(key: string): Promise<string>;
}

/**
 * Default environment-based secret provider.
 */
export class EnvironmentSecretProvider implements SecretProvider {
  name = 'EnvironmentSecretProvider';

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async getSecret(key: string, fallback?: string): Promise<string | undefined> {
    return this.env[key] ?? fallback;
  }

  async getRequiredSecret(key: string): Promise<string> {
    const val = this.env[key];
    if (!val || val.trim().length === 0) {
      throw new Error(`Required secret '${key}' is missing from environment.`);
    }
    return val;
  }

  async requireSecret(key: string): Promise<string> {
    return this.getRequiredSecret(key);
  }
}

/**
 * Singleton instance of default secret provider.
 */
let activeSecretProvider: SecretProvider = new EnvironmentSecretProvider();

export function getSecretProvider(): SecretProvider {
  return activeSecretProvider;
}

export function setSecretProvider(provider: SecretProvider): void {
  activeSecretProvider = provider;
}
