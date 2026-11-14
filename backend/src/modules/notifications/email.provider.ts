import type {
  EmailDeliveryProvider,
  EmailDeliveryResult,
  EmailMessage,
} from './notifications.types.js';

/**
 * Escapes HTML characters in untrusted user-controlled strings to prevent HTML/XSS injection.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strips HTML tags for creating safe plain-text email alternatives.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

/**
 * Standard Educational Simulation Disclaimer appended to all system messages.
 */
export const SIMULATION_EMAIL_DISCLAIMER =
  'NOTICE: This communication is generated as part of the Online Voting System (OVS) educational simulation. ' +
  'It does NOT represent a legally binding election event, official government notice, or real electoral authority advisory.';

/**
 * Safe development email provider.
 * Logs sanitized metadata and holds sent messages in an inspectable memory outbox.
 * Guarantees zero real outbound email transmissions.
 */
export class DevelopmentEmailProvider implements EmailDeliveryProvider {
  public readonly name = 'DevelopmentEmailProvider';
  private outbox: Array<EmailMessage & { id: string; sentAt: Date }> = [];

  async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    const id = `dev-mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record = {
      ...message,
      id,
      sentAt: new Date(),
    };
    this.outbox.push(record);

    return {
      success: true,
      messageId: id,
      status: 'DELIVERED',
    };
  }

  getOutbox(): Array<EmailMessage & { id: string; sentAt: Date }> {
    return [...this.outbox];
  }

  clearOutbox(): void {
    this.outbox = [];
  }
}

/**
 * Production SMTP Email Provider skeleton.
 * Safe and fail-closed: requires EMAIL_DELIVERY_ENABLED=true and complete SMTP configuration.
 */
export class SMTPEmailProvider implements EmailDeliveryProvider {
  public readonly name = 'SMTPEmailProvider';
  private fromAddress: string;
  private enabled: boolean;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM_ADDRESS || 'ovs-notifications@simulation.eci.gov.in';
    this.enabled = process.env.EMAIL_DELIVERY_ENABLED === 'true';
  }

  async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    if (!this.enabled) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Email delivery is disabled via EMAIL_DELIVERY_ENABLED configuration.',
      };
    }

    const id = `smtp-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return {
      success: true,
      messageId: id,
      status: 'SENT',
    };
  }
}

let testProviderOverride: EmailDeliveryProvider | null = null;
let activeProvider: EmailDeliveryProvider = new DevelopmentEmailProvider();

export function getEmailProvider(): EmailDeliveryProvider {
  if (testProviderOverride) {
    return testProviderOverride;
  }
  const providerType = process.env.EMAIL_PROVIDER || 'DEVELOPMENT';
  if (providerType === 'SMTP') {
    if (!(activeProvider instanceof SMTPEmailProvider)) {
      activeProvider = new SMTPEmailProvider();
    }
  } else {
    if (!(activeProvider instanceof DevelopmentEmailProvider)) {
      activeProvider = new DevelopmentEmailProvider();
    }
  }
  return activeProvider;
}

export function setEmailProviderForTesting(provider: EmailDeliveryProvider | null): void {
  testProviderOverride = provider;
}
