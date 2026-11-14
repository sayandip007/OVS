import {
  escapeHtml,
  htmlToPlainText,
  SIMULATION_EMAIL_DISCLAIMER,
} from './email.provider.js';

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

export class NotificationTemplateService {
  /**
   * Wraps template body with the standard responsive OVS email container and simulation disclaimer.
   */
  private static wrapContainer(title: string, bodyHtml: string): RenderedTemplate {
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #002868; padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.85; text-transform: uppercase; }
    .content { padding: 28px 24px; line-height: 1.6; font-size: 14px; }
    .highlight-box { background: #f1f5f9; border-left: 4px solid #002868; padding: 14px 18px; margin: 18px 0; border-radius: 4px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; font-size: 11px; color: #64748b; line-height: 1.4; text-align: center; }
    .disclaimer { color: #b45309; font-weight: 600; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p>Online Voting System &bull; Election Commission Simulation</p>
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>This message was sent by the Online Voting System (OVS) platform.</p>
      <p class="disclaimer">${escapeHtml(SIMULATION_EMAIL_DISCLAIMER)}</p>
    </div>
  </div>
</body>
</html>`;

    return {
      subject: title,
      html: fullHtml,
      text: htmlToPlainText(fullHtml),
    };
  }

  static renderWelcomeVoter(voterName: string, epicNumber: string): RenderedTemplate {
    const title = 'Welcome to the Online Voting System Demo';
    const body = `
      <p>Namaste <strong>${escapeHtml(voterName)}</strong>,</p>
      <p>Your voter profile has been successfully registered for the Online Voting System educational simulation.</p>
      <div class="highlight-box">
        <strong>Electoral Photo Identity Card (EPIC):</strong> ${escapeHtml(epicNumber)}<br>
        <strong>Status:</strong> Active Simulated Voter
      </div>
      <p>You can now participate in upcoming demo mock polls and track candidate nominations for your constituency.</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderElectionAnnounced(electionTitle: string, stateName: string): RenderedTemplate {
    const title = `Simulated Election Announced: ${electionTitle}`;
    const body = `
      <p>A new simulated general election has been officially gazetted on the demo platform:</p>
      <div class="highlight-box">
        <strong>Election:</strong> ${escapeHtml(electionTitle)}<br>
        <strong>Jurisdiction:</strong> ${escapeHtml(stateName)}
      </div>
      <p>Review the nomination and demo polling schedule in your voter dashboard.</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderNominationDeadlineApproaching(
    electionTitle: string,
    deadlineDate: string
  ): RenderedTemplate {
    const title = `Nomination Filing Deadline Approaching: ${electionTitle}`;
    const body = `
      <p>This is a simulated advisory regarding the approaching candidate nomination cutoff:</p>
      <div class="highlight-box">
        <strong>Election:</strong> ${escapeHtml(electionTitle)}<br>
        <strong>Filing Closes:</strong> ${escapeHtml(deadlineDate)}
      </div>
      <p>Prospective demo candidates and political parties must complete documentation scrutiny prior to this timestamp.</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderPollingScheduleReminder(
    electionTitle: string,
    pollingStart: string,
    pollingEnd: string
  ): RenderedTemplate {
    const title = `Demo Polling Reminder: ${electionTitle}`;
    const body = `
      <p>Simulated polling hours are scheduled for the upcoming demo election:</p>
      <div class="highlight-box">
        <strong>Election:</strong> ${escapeHtml(electionTitle)}<br>
        <strong>Start:</strong> ${escapeHtml(pollingStart)}<br>
        <strong>End:</strong> ${escapeHtml(pollingEnd)}
      </div>
      <p>Demo voters registered in participating constituencies may log in to cast their simulated ballots.</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderPollingOpened(electionTitle: string): RenderedTemplate {
    const title = `Demo Polling is Now Open: ${electionTitle}`;
    const body = `
      <p>Simulated voting is now active for <strong>${escapeHtml(electionTitle)}</strong>.</p>
      <p>Log in to your authenticated voter portal to participate in this educational exercise.</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderPollingClosed(electionTitle: string): RenderedTemplate {
    const title = `Demo Polling Closed: ${electionTitle}`;
    const body = `
      <p>Simulated polling has concluded for <strong>${escapeHtml(electionTitle)}</strong>.</p>
      <p>Independent counting simulations and tally reconciliation will begin shortly.</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderCountingProgress(
    electionTitle: string,
    constituencyName: string,
    roundNumber: number
  ): RenderedTemplate {
    const title = `Counting Milestone: ${constituencyName} (Round ${roundNumber})`;
    const body = `
      <p>Independent synthetic counting round ${roundNumber} has been verified for <strong>${escapeHtml(
      constituencyName
    )}</strong> in ${escapeHtml(electionTitle)}.</p>
      <p>Live demo tallies are updated on the results dashboard.</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderResultsPublished(
    electionTitle: string,
    constituencyName: string
  ): RenderedTemplate {
    const title = `Demo Results Published: ${constituencyName}`;
    const body = `
      <p>Certified synthetic outcomes have been approved and published for <strong>${escapeHtml(
      constituencyName
    )}</strong>.</p>
      <p>You may view the complete party vote share and winner details on the public results portal.</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderGeneralAnnouncement(
    announcementTitle: string,
    summary: string,
    message: string
  ): RenderedTemplate {
    const title = announcementTitle;
    const body = `
      <div class="highlight-box">
        <strong>${escapeHtml(summary)}</strong>
      </div>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    `;
    return this.wrapContainer(title, body);
  }

  static renderAdminSecurityAlert(
    adminUsername: string,
    alertTitle: string,
    details: string
  ): RenderedTemplate {
    const title = `Security Alert: ${alertTitle}`;
    const body = `
      <p>Attention Officer <strong>${escapeHtml(adminUsername)}</strong>,</p>
      <div class="highlight-box">
        <strong>Alert:</strong> ${escapeHtml(alertTitle)}<br>
        <strong>Details:</strong> ${escapeHtml(details)}
      </div>
      <p>Please review the administrative audit trail for full operational telemetry.</p>
    `;
    return this.wrapContainer(title, body);
  }
}
