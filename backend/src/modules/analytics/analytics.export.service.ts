import type { ExportFormat, ExportDomain, ExportResult } from './analytics.types.js';

export class AnalyticsExportService {
  /**
   * Sanitizes a cell value to prevent CSV Spreadsheet Formula Injection.
   * If a value begins with '=', '+', '-', '@', '\t', or '\r',
   * prepend a single quote (') and escape quotes according to RFC 4180.
   */
  public sanitizeCsvCell(value: unknown): string {
    if (value === null || value === undefined) {
      return '""';
    }

    const str = String(value);

    // Check for formula injection triggers
    const formulaTriggers = ['=', '+', '-', '@', '\t', '\r'];
    const startsWithTrigger = formulaTriggers.some((trigger) => str.startsWith(trigger));

    const safeStr = startsWithTrigger ? `'${str}` : str;

    // Standard RFC 4180 CSV escaping: wrap in quotes and replace " with ""
    const escaped = safeStr.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Converts a table of headers and rows into RFC 4180 CSV format.
   */
  public buildCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
    const headerRow = headers.map((h) => this.sanitizeCsvCell(h)).join(',');
    const dataRows = rows.map((row) => row.map((cell) => this.sanitizeCsvCell(cell)).join(','));
    return [headerRow, ...dataRows].join('\r\n');
  }

  /**
   * Generates a secure export file based on requested domain and format.
   */
  public exportData(
    domain: ExportDomain,
    format: ExportFormat,
    data: any,
    options?: { electionId?: string; stateId?: string; timestamp?: string }
  ): ExportResult {
    const ts = (options?.timestamp || new Date().toISOString()).replace(/[:.]/g, '-');
    const filenamePrefix = `ovs-demo-${domain}${options?.electionId ? `-${options.electionId}` : ''}${options?.stateId ? `-${options.stateId}` : ''}-${ts}`;

    if (format === 'json') {
      const jsonContent = JSON.stringify(
        {
          meta: {
            title: `OVS Demo Analytics Export - ${domain.toUpperCase()}`,
            isSimulated: true,
            disclaimer: 'SIMULATED DEMO DATA - NOT OFFICIAL ELECTION DATA',
            domain,
            exportedAt: new Date().toISOString(),
            filterOptions: options,
          },
          data,
        },
        null,
        2
      );

      return {
        filename: `${filenamePrefix}.json`,
        mimeType: 'application/json; charset=utf-8',
        content: jsonContent,
      };
    }

    // CSV format conversion by domain
    let csvContent = '';
    switch (domain) {
      case 'national': {
        const headers = ['Metric', 'Category', 'Value'];
        const rows: (string | number)[][] = [
          ['Total Elections', 'Overview', data.totalElections ?? 0],
          ['Lok Sabha Elections', 'Election Types', data.electionsByType?.lokSabha ?? 0],
          ['State Assembly Elections', 'Election Types', data.electionsByType?.stateAssembly ?? 0],
          ['Parliamentary Constituencies Assigned', 'Constituencies', data.totalAssignedConstituencies?.parliamentary ?? 0],
          ['Assembly Constituencies Assigned', 'Constituencies', data.totalAssignedConstituencies?.assembly ?? 0],
          ['States Covered', 'Coverage', data.statesCoveredCount ?? 0],
          ['Polling Active Elections', 'Status', data.milestoneAlerts?.pollingActiveCount ?? 0],
          ['Published Results Count', 'Counting', data.milestoneAlerts?.publishedResultsCount ?? 0],
        ];
        csvContent = this.buildCsv(headers, rows);
        break;
      }

      case 'state': {
        const headers = ['State ID', 'State Name', 'Total Elections', 'Assembly Elections', 'Total ACs', 'Total PCs', 'Participations', 'Published Results'];
        const rows = [
          [
            data.state?.id ?? '',
            data.state?.name ?? '',
            data.totalElections ?? 0,
            data.assemblyElectionsCount ?? 0,
            data.assemblyConstituenciesCount ?? 0,
            data.parliamentaryConstituenciesCount ?? 0,
            data.participationSummary?.totalParticipated ?? 0,
            data.countingSummary?.publishedSessions ?? 0,
          ],
        ];
        csvContent = this.buildCsv(headers, rows);
        break;
      }

      case 'election': {
        const headers = ['Election ID', 'Name', 'Type', 'Year', 'Status', 'Constituencies Assigned', 'Total Candidates', 'Approved Nominations'];
        const rows = [
          [
            data.election?.id ?? '',
            data.election?.name ?? '',
            data.election?.type ?? '',
            data.election?.year ?? '',
            data.election?.status ?? '',
            data.constituenciesSummary?.totalAssigned ?? 0,
            data.candidateAndPartySummary?.totalCandidates ?? 0,
            data.candidateAndPartySummary?.nominationsByStatus?.APPROVED ?? 0,
          ],
        ];
        csvContent = this.buildCsv(headers, rows);
        break;
      }

      case 'participation': {
        const headers = ['Constituency ID', 'Constituency Name', 'Type', 'State', 'Simulated Participation Count'];
        const rows = (data.participationByConstituency ?? []).map((c: any) => [
          c.constituencyId,
          c.constituencyName,
          c.constituencyType,
          c.stateId ?? '',
          c.suppressedDueToPrivacyThreshold ? '< 5' : c.participatedCount,
        ]);
        csvContent = this.buildCsv(headers, rows);
        break;
      }

      case 'counting': {
        const headers = ['Session ID', 'Election ID', 'Constituency Name', 'Winner Candidate', 'Winner Party', 'Total Counted Votes', 'Victory Margin', 'Published At'];
        const rows = (data.publishedWinners ?? []).map((w: any) => [
          w.sessionId,
          w.electionId,
          w.constituencyName,
          w.winnerCandidateName,
          w.winnerPartyName,
          w.totalVotes,
          w.victoryMargin,
          w.publishedAt ?? 'N/A',
        ]);
        csvContent = this.buildCsv(headers, rows);
        break;
      }

      case 'audit': {
        const headers = ['Log ID', 'Timestamp', 'Actor Identifier', 'Actor Role', 'Domain', 'Action Type', 'Outcome'];
        const rows = (data.recentActivity ?? []).map((a: any) => [
          a.id,
          a.timestamp,
          a.actorIdentifier,
          a.actorRole ?? 'N/A',
          a.domain,
          a.actionType,
          a.outcome,
        ]);
        csvContent = this.buildCsv(headers, rows);
        break;
      }

      default: {
        const headers = ['Field', 'Value'];
        const rows = Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
        csvContent = this.buildCsv(headers, rows);
      }
    }

    return {
      filename: `${filenamePrefix}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: csvContent,
    };
  }
}
