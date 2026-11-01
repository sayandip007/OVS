import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPrismaInventory } from './prismaInventory.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('OVS Phase 8.1.1 — Architecture Consistency & Database Integrity Verification', () => {
  const prismaSchemaPath = path.join(rootDir, 'docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma');
  const databaseDesignPath = path.join(rootDir, 'docs/backend-architecture/DATABASE_DESIGN.md');
  const erDiagramPath = path.join(rootDir, 'docs/backend-architecture/ER_DIAGRAM.md');
  const apiSpecPath = path.join(rootDir, 'docs/backend-architecture/API_SPECIFICATION.md');
  const authDocPath = path.join(rootDir, 'docs/backend-architecture/AUTHENTICATION_AUTHORIZATION.md');
  const securityThreatPath = path.join(rootDir, 'docs/backend-architecture/SECURITY_THREAT_MODEL.md');
  const sysArchPath = path.join(rootDir, 'docs/backend-architecture/SYSTEM_ARCHITECTURE.md');
  const frontMigrationPath = path.join(rootDir, 'docs/backend-architecture/FRONTEND_MIGRATION_PLAN.md');
  const dataMigrationPath = path.join(rootDir, 'docs/backend-architecture/DATA_MIGRATION_PLAN.md');
  const dockerPlanPath = path.join(rootDir, 'docs/backend-architecture/DOCKER_DEVELOPMENT_PLAN.md');
  const testingStrategyPath = path.join(rootDir, 'docs/backend-architecture/TESTING_STRATEGY.md');
  const adrPath = path.join(rootDir, 'docs/backend-architecture/ARCHITECTURE_DECISIONS.md');

  const allDocPaths = [
    prismaSchemaPath,
    databaseDesignPath,
    erDiagramPath,
    apiSpecPath,
    authDocPath,
    securityThreatPath,
    sysArchPath,
    frontMigrationPath,
    dataMigrationPath,
    dockerPlanPath,
    testingStrategyPath,
    adrPath,
  ];

  test('All 12 backend architecture documents exist and are non-empty', () => {
    for (const docPath of allDocPaths) {
      assert.ok(fs.existsSync(docPath), `Missing document: ${docPath}`);
      const stats = fs.statSync(docPath);
      assert.ok(stats.size > 200, `Document too small or empty: ${docPath}`);
    }
  });

  test('Prisma schema draft defines production models (25 models: 24 base + TieResolution) and 17 enums', () => {
    const content = fs.readFileSync(prismaSchemaPath, 'utf8');
    const modelMatches = [...content.matchAll(/^model\s+([A-Za-z0-9_]+)\s+\{/gm)].map(m => m[1]);
    const enumMatches = [...content.matchAll(/^enum\s+([A-Za-z0-9_]+)\s+\{/gm)].map(m => m[1]);

    assert.equal(modelMatches.length, 25, `Expected exactly 25 models, found ${modelMatches.length}: ${modelMatches.join(', ')}`);
    assert.equal(enumMatches.length, 17, `Expected exactly 17 enums, found ${enumMatches.length}: ${enumMatches.join(', ')}`);
  });

  test('AdminUser does not have unstructured assignedElectionIds array; AdminElectionScope exists', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');

    // AdminUser model section
    const adminUserBlockMatch = prismaContent.match(/model AdminUser\s+\{[\s\S]*?\n\}/);
    assert.ok(adminUserBlockMatch, 'AdminUser model block not found');
    const adminUserBlock = adminUserBlockMatch[0];

    assert.ok(!adminUserBlock.includes('assignedElectionIds'), 'AdminUser must NOT contain assignedElectionIds array');
    assert.ok(adminUserBlock.includes('AdminElectionScope[]'), 'AdminUser must relate to AdminElectionScope[]');

    // AdminElectionScope model block
    const scopeBlockMatch = prismaContent.match(/model AdminElectionScope\s+\{[\s\S]*?\n\}/);
    assert.ok(scopeBlockMatch, 'AdminElectionScope model block must exist');
    const scopeBlock = scopeBlockMatch[0];
    assert.ok(/\badminUserId\s+String\b/.test(scopeBlock), 'AdminElectionScope must have adminUserId');
    assert.ok(/\belectionId\s+String\b/.test(scopeBlock), 'AdminElectionScope must have electionId');
    assert.ok(scopeBlock.includes('@@unique([adminUserId, electionId])'), 'AdminElectionScope must enforce @@unique([adminUserId, electionId])');
  });

  test('Strict Ballot Privacy: DemoParticipation contains zero candidate/party choices', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const participationBlockMatch = prismaContent.match(/model DemoParticipation\s+\{[\s\S]*?\n\}/);
    assert.ok(participationBlockMatch, 'DemoParticipation model block not found');
    const participationBlock = participationBlockMatch[0];

    // Filter out comments to check actual fields
    const codeLines = participationBlock.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

    assert.ok(!codeLines.includes('candidateId'), 'DemoParticipation must NOT contain candidateId field');
    assert.ok(!codeLines.includes('partyId'), 'DemoParticipation must NOT contain partyId field');
    assert.ok(!/candidate\s+Candidate/i.test(codeLines), 'DemoParticipation must NOT contain candidate relation');
    assert.ok(!/party\s+PoliticalParty/i.test(codeLines), 'DemoParticipation must NOT contain party relation');
    assert.ok(participationBlock.includes('@@unique([voterId, electionId])'), 'DemoParticipation must enforce unique voter per election');
  });

  test('Geographic Hierarchy Integrity: Composite keys and composite foreign keys', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');

    // District has @@unique([id, stateId])
    assert.ok(prismaContent.includes('@@unique([id, stateId])'), 'District or PC must have @@unique([id, stateId])');

    // AssemblyConstituency has composite FKs
    const acBlockMatch = prismaContent.match(/model AssemblyConstituency\s+\{[\s\S]*?\n\}/);
    assert.ok(acBlockMatch, 'AssemblyConstituency model block not found');
    const acBlock = acBlockMatch[0];
    assert.ok(acBlock.includes('fields: [districtId, stateId], references: [id, stateId]'), 'AC must have composite FK to District (districtId, stateId)');
    assert.ok(acBlock.includes('fields: [parentParliamentaryConstituencyId, stateId], references: [id, stateId]'), 'AC must have composite FK to PC (parentPC, stateId)');
    assert.ok(acBlock.includes('@@unique([id, parentParliamentaryConstituencyId])'), 'AC must have @@unique([id, parentParliamentaryConstituencyId])');

    // VoterProfile has composite FK to AC
    const voterBlockMatch = prismaContent.match(/model VoterProfile\s+\{[\s\S]*?\n\}/);
    assert.ok(voterBlockMatch, 'VoterProfile model block not found');
    const voterBlock = voterBlockMatch[0];
    assert.ok(voterBlock.includes('fields: [assemblyConstituencyId, parliamentaryConstituencyId], references: [id, parentParliamentaryConstituencyId]'), 'VoterProfile must enforce that AC belongs to assigned PC');
  });

  test('Candidate & Tally Integrity: Composite FK (candidateId, partyId) ensures party match', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');

    const candidateBlockMatch = prismaContent.match(/model Candidate\s+\{[\s\S]*?\n\}/);
    assert.ok(candidateBlockMatch, 'Candidate model block not found');
    assert.ok(candidateBlockMatch[0].includes('@@unique([id, partyId])'), 'Candidate must define @@unique([id, partyId])');

    const tallyBlockMatch = prismaContent.match(/model CandidateTally\s+\{[\s\S]*?\n\}/);
    assert.ok(tallyBlockMatch, 'CandidateTally model block not found');
    const tallyBlock = tallyBlockMatch[0];
    assert.ok(tallyBlock.includes('fields: [candidateId, partyId], references: [id, partyId]') || (tallyBlock.includes('candidateId') && tallyBlock.includes('partyId')), 'CandidateTally must bind candidate and party');
  });

  test('Announcement has typed constituency targeting fields and foreign keys', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const announcementBlockMatch = prismaContent.match(/model Announcement\s+\{[\s\S]*?\n\}/);
    assert.ok(announcementBlockMatch, 'Announcement model block not found');
    const announcementBlock = announcementBlockMatch[0];

    assert.ok(announcementBlock.includes('targetConstituencyType'), 'Announcement must declare targetConstituencyType');
    assert.ok(announcementBlock.includes('targetParliamentaryConstituencyId'), 'Announcement must declare targetParliamentaryConstituencyId');
    assert.ok(announcementBlock.includes('targetAssemblyConstituencyId'), 'Announcement must declare targetAssemblyConstituencyId');
    assert.ok(!announcementBlock.includes('targetConstituencyId String?'), 'Untyped targetConstituencyId must be replaced');
  });

  test('ResultStatus enum defines all 10 unified lifecycle statuses', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const enumBlockMatch = prismaContent.match(/enum ResultStatus\s+\{[\s\S]*?\n\}/);
    assert.ok(enumBlockMatch, 'ResultStatus enum block not found');
    const enumBlock = enumBlockMatch[0];

    const expectedStatuses = [
      'DRAFT',
      'COUNTING_IN_PROGRESS',
      'COUNTING_PAUSED',
      'COUNTING_COMPLETED',
      'RESULT_READY_FOR_REVIEW',
      'PUBLISHED',
      'TIED',
      'UNDER_REVIEW',
      'CORRECTED',
      'UNPUBLISHED',
    ];

    for (const status of expectedStatuses) {
      assert.ok(enumBlock.includes(status), `ResultStatus must include ${status}`);
    }
  });

  test('API specification enforces pure HttpOnly cookie sessions and RFC 9457 problem details', () => {
    const apiSpecContent = fs.readFileSync(apiSpecPath, 'utf8');

    assert.ok(!apiSpecContent.includes('Authorization: Bearer <session_token>'), 'API Spec must not promote Bearer tokens for browser sessions');
    assert.ok(apiSpecContent.includes('ovs_session'), 'API Spec must require ovs_session cookie');
    assert.ok(apiSpecContent.includes('RFC 9457'), 'API Spec must standardize on RFC 9457 Problem Details');
    assert.ok(apiSpecContent.includes('X-CSRF-Token'), 'API Spec must enforce X-CSRF-Token header');
  });

  test('Authentication document details CSRF defense-in-depth and normalized officer scoping', () => {
    const authContent = fs.readFileSync(authDocPath, 'utf8');

    assert.ok(authContent.includes('SameSite=Strict'), 'Auth doc must enforce SameSite=Strict');
    assert.ok(authContent.includes('X-CSRF-Token'), 'Auth doc must require X-CSRF-Token');
    assert.ok(authContent.includes('admin_election_scopes'), 'Auth doc must reference admin_election_scopes');
  });

  test('Security threat model includes data classification, field-level encryption and retention', () => {
    const secContent = fs.readFileSync(securityThreatPath, 'utf8');

    assert.ok(secContent.includes('Confidential PII'), 'Security doc must define Confidential PII');
    assert.ok(secContent.includes('AES-256-GCM'), 'Security doc must define field-level encryption');
    assert.ok(secContent.includes('ZERO PERSISTENCE'), 'Security doc must reiterate zero choice persistence');
  });
});

describe('OVS Phase 8.1.2 — Final Database Integrity, Prisma Mapping & Result Publication Hardening', () => {
  const prismaSchemaPath = path.join(rootDir, 'docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma');
  const customSqlPath = path.join(rootDir, 'docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql');
  const dbDesignPath = path.join(rootDir, 'docs/backend-architecture/DATABASE_DESIGN.md');
  const erDiagramPath = path.join(rootDir, 'docs/backend-architecture/ER_DIAGRAM.md');
  const apiSpecPath = path.join(rootDir, 'docs/backend-architecture/API_SPECIFICATION.md');
  const adrDocPath = path.join(rootDir, 'docs/backend-architecture/ARCHITECTURE_DECISIONS.md');
  const testingStrategyPath = path.join(rootDir, 'docs/backend-architecture/TESTING_STRATEGY.md');

  test('Test 1: Column mapping: 100% of camelCase fields in Prisma have explicit @map and match documentation', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const dbDesignContent = fs.readFileSync(dbDesignPath, 'utf8');

    // Extract all models and verify camelCase fields have @map
    const modelBlocks = [...prismaContent.matchAll(/model\s+([A-Za-z0-9_]+)\s+\{([\s\S]*?)\n\}/g)];
    assert.ok(modelBlocks.length === 24 || modelBlocks.length === 25, 'All models must exist in Prisma schema');

    let totalCamelCaseFields = 0;
    let mappedCamelCaseFields = 0;

    for (const [, modelName, body] of modelBlocks) {
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
        const parts = trimmed.split(/\s+/);
        const fieldName = parts[0];
        const fieldType = parts[1];
        if (!fieldName || !fieldType) continue;

        // Skip relation fields (where type is a model or array of models)
        const isRelation = /^[A-Z]/.test(fieldType) && !['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes'].includes(fieldType.replace('[]', '').replace('?', ''));
        // If the type is an enum, it's a scalar column
        const isEnum = /^(ElectionType|ElectionStatus|ConstituencyType|JurisdictionType|PartyType|PartyRecognitionStatus|NominationStatus|VoterStatus|Gender|VoterActionType|AuthChannel|AuditSeverity|CountingStatus|ResultStatus|MetadataSource|DisputeType|AdminRole)(\?|\[\])?$/.test(fieldType);

        if (isRelation && !isEnum) {
          continue; // Relation attribute, not physical column
        }

        // Check if fieldName has uppercase characters (camelCase)
        if (/[A-Z]/.test(fieldName)) {
          totalCamelCaseFields++;
          if (trimmed.includes('@map("')) {
            mappedCamelCaseFields++;
          } else {
            assert.fail(`Model ${modelName} field "${fieldName}" is camelCase but lacks an explicit @map("snake_case") declaration.`);
          }
        }
      }
    }

    assert.ok(totalCamelCaseFields > 50, `Expected over 50 camelCase fields, found ${totalCamelCaseFields}`);
    assert.equal(mappedCamelCaseFields, totalCamelCaseFields, '100% of camelCase scalar fields must have explicit @map declarations');
    assert.ok(dbDesignContent.includes('Prisma-to-PostgreSQL Mapping Verification Table'), 'DATABASE_DESIGN.md must include the mapping verification table');
  });

  test('Test 2: No accidental camelCase column names in CUSTOM_DATABASE_INTEGRITY.sql', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    const forbiddenCamelCaseIdentifiers = [
      'electionId',
      'voterId',
      'candidateId',
      'partyId',
      'countingSessionId',
      'currentRound',
      'totalConfiguredRounds',
      'isPublished',
      'publishedByAdminId',
      'parliamentaryConstituencyId',
      'assemblyConstituencyId',
      'adminUserId',
      'roundNumber',
      'roundVotes',
      'cumulativeVotes',
      'leadMargin',
      'leadCandidateId',
      'totalCountedVotes',
      'notaVotes',
      'rejectedVotes',
      'victoryMargin',
      'winnerCandidateId',
      'runnerUpCandidateId',
    ];

    for (const id of forbiddenCamelCaseIdentifiers) {
      const regex = new RegExp(`\\b${id}\\b`);
      assert.ok(!regex.test(sqlContent), `CUSTOM_DATABASE_INTEGRITY.sql must not contain camelCase identifier "${id}". Must be snake_case.`);
    }
  });

  test('Test 3: Candidate tally is constrained to an approved nomination and NOTA is separated', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    assert.ok(sqlContent.includes('verify_candidate_tally_nomination'), 'verify_candidate_tally_nomination trigger function must exist');
    assert.ok(sqlContent.includes("status = 'APPROVED'"), 'Tally trigger must enforce status = APPROVED on candidate nomination');
    assert.ok(sqlContent.includes('NEW.party_id != v_nom_party_id') && sqlContent.includes('NEW.party_id IS NOT DISTINCT FROM v_nom_party_id'), 'Tally trigger must enforce exact historical nomination party equality');
    assert.ok(sqlContent.includes("UPPER(NEW.candidate_id) = 'NOTA'") || sqlContent.includes("LIKE '%NOTA%'"), 'Tally trigger must explicitly forbid NOTA as candidate tally');
    assert.ok(sqlContent.includes('trg_verify_candidate_tally_nomination'), 'Trigger trg_verify_candidate_tally_nomination must be attached to candidate_tallies');
  });

  test('Test 4: Counting session and nomination constituencies match', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    assert.ok(sqlContent.includes('parliamentary_constituency_id = v_pc_id'), 'Tally must check parliamentary_constituency_id matches session PC');
    assert.ok(sqlContent.includes('assembly_constituency_id = v_ac_id'), 'Tally must check assembly_constituency_id matches session AC');

    // Also check winner and runner-up validation
    assert.ok(sqlContent.includes('verify_counting_session_candidates'), 'verify_counting_session_candidates function must exist');
    assert.ok(sqlContent.includes('Declared winner % lacks an APPROVED nomination'), 'Winner candidate must have APPROVED nomination in exact constituency');
    assert.ok(sqlContent.includes('Winner candidate (%) and runner-up candidate cannot be identical'), 'Winner and runner up cannot be identical');
  });

  test('Test 5: Election type strictly matches constituency type and state scope', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // Election-constituency trigger
    assert.ok(sqlContent.includes('verify_election_constituency_compatibility'), 'verify_election_constituency_compatibility must exist');
    assert.ok(sqlContent.includes("v_election_type = 'LOK_SABHA'"), 'Trigger must inspect LOK_SABHA election type');
    assert.ok(sqlContent.includes("NEW.constituency_type != 'PARLIAMENTARY' OR NEW.parliamentary_constituency_id IS NULL"), 'Lok Sabha must be PARLIAMENTARY');
    assert.ok(sqlContent.includes("v_election_type = 'STATE_ASSEMBLY'"), 'Trigger must inspect STATE_ASSEMBLY election type');
    assert.ok(sqlContent.includes("NEW.constituency_type != 'ASSEMBLY' OR NEW.assembly_constituency_id IS NULL"), 'State Assembly must be ASSEMBLY');
    assert.ok(sqlContent.includes('v_ac_state_id != v_election_state_id'), 'AC state must match election state');

    // Counting session trigger
    assert.ok(sqlContent.includes('verify_counting_session_compatibility'), 'verify_counting_session_compatibility must exist');
  });

  test('Test 6: Result publication cannot bypass review stage (RESULT_READY_FOR_REVIEW required)', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    assert.ok(sqlContent.includes("OLD.status != 'RESULT_READY_FOR_REVIEW'"), 'Trigger must require previous status to be RESULT_READY_FOR_REVIEW for publication');
    assert.ok(sqlContent.includes("Cannot publish result from status %; must be reviewed in RESULT_READY_FOR_REVIEW stage first"), 'Clear error message on unreviewed publication attempt');
    assert.ok(sqlContent.includes("NEW.current_round < NEW.total_configured_rounds"), 'Incomplete counting session publication must be rejected');
    assert.ok(sqlContent.includes("NEW.status = 'TIED' OR OLD.status = 'TIED'"), 'Publication must block while in TIED status');
    assert.ok(sqlContent.includes("NEW.published_by_admin_id IS NULL"), 'Publication requires recording published_by_admin_id');
  });

  test('Test 7: INSERT and UPDATE publication paths are protected against direct unreviewed publication', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // INSERT protection
    assert.ok(sqlContent.includes("IF TG_OP = 'INSERT' THEN"), 'Trigger must explicitly branch on TG_OP = INSERT');
    assert.ok(sqlContent.includes("NEW.is_published = TRUE OR NEW.status = 'PUBLISHED'") || sqlContent.includes("NEW.is_published = TRUE OR NEW.status != 'DRAFT'"), 'Direct insertion as PUBLISHED must be checked');
    assert.ok(sqlContent.includes("New counting sessions cannot be directly inserted as PUBLISHED. Must begin in DRAFT"), 'Clear exception on direct published insertion');

    // UPDATE state machine validation
    assert.ok(sqlContent.includes("IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN"), 'Trigger must inspect state transitions on UPDATE');
    assert.ok(sqlContent.includes("WHEN 'COUNTING_COMPLETED' THEN"), 'State machine must validate transitions from COUNTING_COMPLETED');
    assert.ok(sqlContent.includes("WHEN 'RESULT_READY_FOR_REVIEW' THEN"), 'State machine must validate transitions from RESULT_READY_FOR_REVIEW');
    assert.ok(sqlContent.includes("WHEN 'UNDER_REVIEW' THEN"), 'State machine must validate transitions from UNDER_REVIEW');
  });

  test('Test 8: Counting totals reconcile mathematically with monotonic round progression', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // Vote reconciliation
    assert.ok(sqlContent.includes('reconcile_counting_session_votes'), 'reconcile_counting_session_votes function must exist');
    assert.ok(sqlContent.includes('v_calculated_total := v_candidate_votes_sum + NEW.nota_votes + NEW.rejected_votes'), 'Total calculated formula must equal tallies + NOTA + rejected');
    assert.ok(sqlContent.includes('NEW.total_counted_votes != v_calculated_total'), 'Session total votes must be compared against calculated total');

    // Round progression
    assert.ok(sqlContent.includes('verify_counting_round_progression'), 'verify_counting_round_progression function must exist');
    assert.ok(sqlContent.includes('NEW.cumulative_votes < v_prev_cumulative'), 'Cumulative votes must never decrease between rounds');
    assert.ok(sqlContent.includes('NEW.round_votes != (NEW.cumulative_votes - v_prev_cumulative)'), 'Round votes must equal delta between consecutive cumulative totals');
  });

  test('Test 9: Multiple nominations follow Section 33(7) RPA 1951 rule (max 2 constituencies per candidate)', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // Prisma schema must NOT contain overly restrictive @@unique([candidateId, electionId])
    const nominationBlockMatch = prismaContent.match(/model CandidateNomination\s+\{[\s\S]*?\n\}/);
    assert.ok(nominationBlockMatch, 'CandidateNomination model must exist');
    const nominationBlock = nominationBlockMatch[0];
    assert.ok(!nominationBlock.includes('@@unique([candidateId, electionId])'), 'CandidateNomination must not restrict candidate to 1 constituency via @@unique([candidateId, electionId])');
    assert.ok(nominationBlock.includes('@@index([candidateId, electionId])'), 'CandidateNomination must have index on [candidateId, electionId]');

    // Custom SQL must enforce partial unique indexes per constituency
    assert.ok(sqlContent.includes('uq_nomination_candidate_election_pc'), 'uq_nomination_candidate_election_pc partial unique index must exist');
    assert.ok(sqlContent.includes('uq_nomination_candidate_election_ac'), 'uq_nomination_candidate_election_ac partial unique index must exist');

    // Custom SQL trigger enforces max 2 active nominations
    assert.ok(sqlContent.includes('v_nomination_count >= 2'), 'Trigger must check nomination count >= 2');
    assert.ok(sqlContent.includes('RPA 1951 s.33(7)'), 'Trigger must cite Section 33(7) RPA 1951');
  });

  test('Test 10: Standalone custom SQL draft and Prisma schema remain synchronized', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // Check that custom SQL file is substantial (> 20KB)
    const sqlStats = fs.statSync(customSqlPath);
    assert.ok(sqlStats.size > 20000, `CUSTOM_DATABASE_INTEGRITY.sql should be comprehensive, size is ${sqlStats.size} bytes`);

    // All tables modified in custom SQL must exist in Prisma @@map declarations
    const tableAlterMatches = [...sqlContent.matchAll(/ALTER TABLE\s+([a-z_]+)/g)].map(m => m[1]);
    const uniqueTables = [...new Set(tableAlterMatches)];

    for (const table of uniqueTables) {
      const mapPattern = new RegExp(`@@map\\("${table}"\\)`);
      assert.ok(mapPattern.test(prismaContent), `Table "${table}" altered in custom SQL must have matching @@map("${table}") in PRISMA_SCHEMA_DRAFT.prisma`);
    }

    // Architecture documentation references
    const erDiagram = fs.readFileSync(erDiagramPath, 'utf8');
    const apiSpec = fs.readFileSync(apiSpecPath, 'utf8');
    const adrDoc = fs.readFileSync(adrDocPath, 'utf8');
    const testingDoc = fs.readFileSync(testingStrategyPath, 'utf8');

    assert.ok(erDiagram.includes('snake_case') || erDiagram.includes('counting_sessions'), 'ER diagram must reference physical snake_case schema');
    assert.ok(apiSpec.includes('RESULT_READY_FOR_REVIEW'), 'API spec must reference RESULT_READY_FOR_REVIEW lifecycle state');
    assert.ok(adrDoc.includes('ADR-014'), 'ADR document must contain ADR-014');
    assert.ok(adrDoc.includes('ADR-015'), 'ADR document must contain ADR-015');
    assert.ok(adrDoc.includes('ADR-016'), 'ADR document must contain ADR-016');
    assert.ok(adrDoc.includes('ADR-017'), 'ADR document must contain ADR-017');
    assert.ok(testingDoc.includes('Suite 7') && testingDoc.includes('Suite 8') && testingDoc.includes('Suite 9'), 'Testing strategy must detail Suites 7, 8, and 9');
  });
});

describe('OVS Phase 8.1.3 — Final PostgreSQL Integrity & Transaction-Safety Verification', () => {
  const prismaSchemaPath = path.join(rootDir, 'docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma');
  const customSqlPath = path.join(rootDir, 'docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql');
  const dbDesignPath = path.join(rootDir, 'docs/backend-architecture/DATABASE_DESIGN.md');
  const phaseReportPath = path.join(rootDir, 'PHASE_8_1_2_CORRECTION_REPORT.md');
  const validationSqlPath = path.join(rootDir, 'tests/postgresql-validation.sql');

  test('Test 8.1.3.1: ElectionConstituency membership validation for CandidateNomination and CountingSession', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // CandidateNomination checks election_constituencies mapping
    assert.ok(sqlContent.includes('SELECT 1 FROM election_constituencies'), 'Nomination trigger must check membership in election_constituencies');
    assert.ok(sqlContent.includes('is not mapped to election % in election_constituencies'), 'Nomination trigger must reject unmapped constituencies');

    // CountingSession checks election_constituencies mapping
    assert.ok(sqlContent.includes('references PC % which is not mapped to election %') || sqlContent.includes('not mapped to election % in election_constituencies'), 'Counting session trigger must reject unmapped constituencies');

    // ElectionConstituency mutation protection trigger
    assert.ok(sqlContent.includes('prevent_election_constituency_mutation_with_dependents'), 'Trigger function to prevent election constituency mutation with dependents must exist');
    assert.ok(sqlContent.includes('trg_prevent_election_constituency_mutation'), 'Trigger trg_prevent_election_constituency_mutation must be attached to election_constituencies');
  });

  test('Test 8.1.3.2: Candidate nomination lifecycle integrity and tally binding', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // Prisma schema has nominationId in CandidateTally
    assert.ok(prismaContent.includes('nominationId') && prismaContent.includes('@map("nomination_id")'), 'CandidateTally must declare nominationId @map("nomination_id")');
    assert.ok(prismaContent.includes('nomination          CandidateNomination? @relation(fields: [nominationId], references: [id], onDelete: Restrict)'), 'CandidateTally must define Restrict FK to CandidateNomination');

    // SQL foreign key
    assert.ok(sqlContent.includes('fk_tally_nomination'), 'fk_tally_nomination constraint must exist in SQL');
    assert.ok(sqlContent.includes('REFERENCES candidate_nominations(id)'), 'Tally must reference candidate_nominations(id)');
    assert.ok(sqlContent.includes('ON DELETE RESTRICT'), 'fk_tally_nomination must specify ON DELETE RESTRICT');

    // Nomination protection trigger
    assert.ok(sqlContent.includes('protect_nomination_lifecycle'), 'protect_nomination_lifecycle trigger function must exist');
    assert.ok(sqlContent.includes('trg_protect_nomination_lifecycle'), 'Trigger trg_protect_nomination_lifecycle must be attached to candidate_nominations');
    assert.ok(sqlContent.includes('Cannot delete candidate nomination %: % dependent counting tallies exist'), 'Deletion of nomination with tallies must be blocked');
    assert.ok(sqlContent.includes('Cannot change nomination % status from APPROVED to %'), 'Invalidating nomination status with active tallies must be blocked');
  });

  test('Test 8.1.3.3: CountingSession mapping integrity and state scope', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    assert.ok(sqlContent.includes('verify_counting_session_compatibility'), 'verify_counting_session_compatibility function must exist');
    assert.ok(sqlContent.includes('Counting session % for Lok Sabha must reference a Parliamentary Constituency'), 'Lok Sabha session must be PC');
    assert.ok(sqlContent.includes('Counting session % for State Assembly must reference an Assembly Constituency'), 'State Assembly session must be AC');
    assert.ok(sqlContent.includes('Counting session constituency state (%) does not match election state (%)'), 'AC state must match election state');
  });

  test('Test 8.1.3.4: Bidirectional tally INSERT, UPDATE and DELETE reconciliation', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // Tally mutation protection and session lock
    assert.ok(sqlContent.includes('protect_and_reconcile_candidate_tallies'), 'protect_and_reconcile_candidate_tallies trigger function must exist');
    assert.ok(sqlContent.includes('trg_protect_and_reconcile_candidate_tallies'), 'Trigger must be attached to candidate_tallies');
    assert.ok(sqlContent.includes('FOR UPDATE'), 'Trigger must acquire FOR UPDATE lock on counting session');
    assert.ok(sqlContent.includes('BEFORE INSERT OR UPDATE OR DELETE ON candidate_tallies'), 'Tally protection trigger must run on INSERT, UPDATE and DELETE');
    assert.ok(sqlContent.includes('Cannot % candidate tallies: session % is in % status'), 'Tally mutations on completed sessions must be blocked');
  });

  test('Test 8.1.3.5: Zero-vote reconciliation without bypass conditions', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    assert.ok(sqlContent.includes('reconcile_counting_session_votes'), 'reconcile_counting_session_votes trigger must exist');
    // Ensure no "v_candidate_votes_sum > 0" bypass exists
    assert.ok(!sqlContent.includes('v_candidate_votes_sum > 0'), 'Reconciliation must not bypass when candidate votes sum is zero');
    assert.ok(sqlContent.includes('COALESCE(SUM(votes), 0)'), 'Reconciliation must handle empty tallies using COALESCE(SUM(votes), 0)');
    assert.ok(sqlContent.includes('v_calculated_total := v_candidate_votes_sum + NEW.nota_votes + NEW.rejected_votes'), 'Formula must be candidate votes + NOTA + rejected');
  });

  test('Test 8.1.3.6: Publication status and flag equivalence & DRAFT-only initial state', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // CHECK constraints
    assert.ok(sqlContent.includes('chk_counting_session_publication_equivalence'), 'chk_counting_session_publication_equivalence constraint must exist');
    assert.ok(sqlContent.includes("(status = 'PUBLISHED' AND is_published = TRUE)"), 'Equivalence CHECK constraint must require PUBLISHED <=> is_published = TRUE');
    assert.ok(sqlContent.includes('chk_counting_session_initial_draft'), 'chk_counting_session_initial_draft constraint must exist');

    // Trigger enforcement on INSERT
    assert.ok(sqlContent.includes("TG_OP = 'INSERT'"), 'Publication trigger must inspect TG_OP = INSERT');
    assert.ok(sqlContent.includes("NEW.status != 'DRAFT'"), 'New counting session must be in DRAFT status');
  });

  test('Test 8.1.3.7: Counting round progression, earlier-round immutability & deletion protection', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    // Progression trigger
    assert.ok(sqlContent.includes('verify_counting_round_progression'), 'verify_counting_round_progression function must exist');
    assert.ok(sqlContent.includes('FOR UPDATE'), 'Counting round trigger must lock counting session FOR UPDATE');
    assert.ok(sqlContent.includes('Round number % is not sequential'), 'Round sequentiality must be enforced on INSERT');
    assert.ok(sqlContent.includes('Cannot modify vote totals for earlier round % when subsequent rounds exist'), 'Earlier rounds must be immutable when later rounds exist');

    // Deletion protection trigger
    assert.ok(sqlContent.includes('protect_counting_round_deletion'), 'protect_counting_round_deletion trigger must exist');
    assert.ok(sqlContent.includes('trg_protect_counting_round_deletion'), 'Trigger trg_protect_counting_round_deletion must be attached to counting_rounds');
    assert.ok(sqlContent.includes('Rounds must be deleted in strict reverse order'), 'Strict reverse-order round rollback must be enforced');

    // Current round synchronization
    assert.ok(sqlContent.includes('synchronize_session_current_round'), 'synchronize_session_current_round trigger function must exist');
  });

  test('Test 8.1.3.8: Actual round completeness required for publication', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    assert.ok(sqlContent.includes('SELECT COUNT(*) INTO v_actual_rounds \n    FROM counting_rounds') || sqlContent.includes('SELECT COUNT(*) INTO v_actual_rounds FROM counting_rounds'), 'Publication trigger must count actual round records');
    assert.ok(sqlContent.includes('v_actual_rounds < NEW.total_configured_rounds'), 'Publication trigger must verify all configured rounds exist');
    assert.ok(sqlContent.includes('only % of % configured counting round records exist'), 'Clear exception message when round records are missing');
  });

  test('Test 8.1.3.9: Transaction-safe nomination limit via advisory locking', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    assert.ok(sqlContent.includes('pg_advisory_xact_lock'), 'Nomination trigger must employ pg_advisory_xact_lock for concurrency protection');
    assert.ok(sqlContent.includes('candidate_nomination_limit:'), 'Advisory lock must use deterministic candidate-election key namespace');
  });

  test('Test 8.1.3.10: Round leader nomination validation in counting rounds', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');

    assert.ok(sqlContent.includes('NEW.leading_candidate_id IS NOT NULL'), 'Trigger must inspect leading_candidate_id');
    assert.ok(sqlContent.includes('Round % leader % lacks an APPROVED nomination in session constituency'), 'Round leader must be validated for approved nomination');
  });

  test('Test 8.1.3.11: Accurate model inventory and documentation consistency', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const dbDesignContent = fs.readFileSync(dbDesignPath, 'utf8');
    const reportContent = fs.readFileSync(phaseReportPath, 'utf8');

    const expectedModels = [
      'State',
      'District',
      'ParliamentaryConstituency',
      'AssemblyConstituency',
      'User',
      'VoterProfile',
      'UserSession',
      'AuthChallenge',
      'Election',
      'ElectionConstituency',
      'ElectionLifecycleHistory',
      'PoliticalParty',
      'Candidate',
      'CandidateNomination',
      'AdminUser',
      'AdminElectionScope',
      'AdminActionLog',
      'DemoParticipation',
      'CountingSession',
      'CountingRound',
      'CandidateTally',
      'ResultCorrectionHistory',
      'Announcement',
      'VoterNotification',
    ];

    const actualModels = [...prismaContent.matchAll(/^model\s+([A-Za-z0-9_]+)\s+\{/gm)].map(m => m[1]);
    assert.ok(actualModels.length === 24 || actualModels.length === 25, 'Actual Prisma schema must define 24 base models (+ TieResolution)');
    for (const m of expectedModels) {
      assert.ok(actualModels.includes(m), `Actual Prisma schema must include model ${m}`);
    }

    // Ensure phantom models do NOT exist in the actual schema or documentation tables
    assert.ok(!actualModels.includes('RoundTally'), 'Schema must not define phantom model RoundTally');
    assert.ok(!actualModels.includes('ElectionResult'), 'Schema must not define phantom model ElectionResult');
    assert.ok(!actualModels.includes('ResultAuditHistory'), 'Schema must not define phantom model ResultAuditHistory');
    assert.ok(!actualModels.includes('AppSession'), 'Schema must not define phantom model AppSession (it is UserSession)');

    // Ensure DATABASE_DESIGN.md and PHASE_8_1_2_CORRECTION_REPORT.md tables contain the true base models
    for (const m of expectedModels) {
      assert.ok(dbDesignContent.includes(`\`${m}\``), `DATABASE_DESIGN.md must document model ${m}`);
      assert.ok(reportContent.includes(`\`${m}\``), `PHASE_8_1_2_CORRECTION_REPORT.md must document model ${m}`);
    }
  });

  test('Test 8.1.3.12: Standalone PostgreSQL integration test suite file exists and is comprehensive', () => {
    assert.ok(fs.existsSync(validationSqlPath), 'tests/postgresql-validation.sql must exist');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');
    assert.ok(valContent.length > 5000, 'tests/postgresql-validation.sql must be a comprehensive test script');
    assert.ok(valContent.includes('SCENARIO 1: Valid Geographic Hierarchy Insertion'), 'Must test scenario 1');
    assert.ok(valContent.includes('SCENARIO 2: Invalid Geographic Hierarchy Rejection'), 'Must test scenario 2');
    assert.ok(valContent.includes('SCENARIO 5: Candidate Nomination Integrity'), 'Must test scenario 5');
    assert.ok(valContent.includes('SCENARIO 11: Active Counting Automatic Tally Reconciliation'), 'Must test scenario 11');
    assert.ok(valContent.includes('SCENARIO 14: Publication Review Gate Enforcement'), 'Must test scenario 14');
  });
});

describe('OVS Phase 8.1.4 — PostgreSQL Integration Test Repair & Final Database Integrity Verification', () => {
  const prismaSchemaPath = path.join(rootDir, 'docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma');
  const customSqlPath = path.join(rootDir, 'docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql');
  const validationSqlPath = path.join(rootDir, 'tests/postgresql-validation.sql');

  test('Test 8.1.4.1: PostgreSQL validation SQL uses 100% genuine physical column names matching Prisma', () => {
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    // Verify nonexistent columns are completely eliminated
    assert.ok(!valContent.includes('states (id, code,'), 'states table must NOT use nonexistent code column');
    assert.ok(!valContent.includes('jurisdiction_type'), 'states table must NOT use jurisdiction_type (it is type)');
    assert.ok(!valContent.includes('districts (id, state_id, district_code,'), 'districts table must NOT use nonexistent district_code column');
    assert.ok(!valContent.includes('headquarters_city'), 'districts table must NOT use headquarters_city (it is headquarters)');
    assert.ok(!valContent.includes('total_electors'), 'Constituencies must NOT use total_electors (it is total_voters)');
    assert.ok(!valContent.includes('elections (id, title,'), 'elections table must NOT use title (it is name)');
    assert.ok(!valContent.includes('election_type'), 'elections table must NOT use election_type column name (it is type)');
    assert.ok(!valContent.includes('party_code'), 'political_parties table must NOT use party_code (it is abbreviation)');

    // Verify correct physical column names are used
    assert.ok(valContent.includes('states (id, name, type, capital,'), 'states fixture must use (id, name, type, capital)');
    assert.ok(valContent.includes('districts (id, state_id, name, headquarters,'), 'districts fixture must use (id, state_id, name, headquarters)');
    assert.ok(valContent.includes('parliamentary_constituencies (id, state_id, constituency_number, name, reservation_type, total_voters,'), 'PC fixture must use total_voters');
    assert.ok(valContent.includes('assembly_constituencies (id, state_id, district_id, parent_parliamentary_constituency_id, constituency_number, name, reservation_type, total_voters,'), 'AC fixture must use total_voters');
    assert.ok(valContent.includes('elections (id, name, type, year,'), 'elections fixture must use (id, name, type, year)');
    assert.ok(valContent.includes('political_parties (id, name, abbreviation, party_type,'), 'political_parties fixture must use abbreviation');

    // AdminUser insertion must reference an existing User row
    assert.ok(valContent.includes('INSERT INTO users'), 'users fixture must precede admin_users insertion');
    assert.ok(valContent.includes('admin_users (id, user_id, officer_code,'), 'admin_users fixture must reference user_id');
  });

  test('Test 8.1.4.2: Negative tests eliminate false-positive catch-own-exception pattern and assert specific SQLSTATEs', () => {
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    // Ensure unsafe pattern is absent
    const unsafeCatchPattern = /RAISE\s+EXCEPTION[^\n;]+;[\s\n]*EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+RAISE\s+NOTICE\s+'SUCCESS/gi;
    assert.ok(!unsafeCatchPattern.test(valContent), 'Negative tests must not use unsafe pattern that catches its own exception');

    // Verify robust subtransaction pattern is used
    assert.ok(valContent.includes('v_caught_expected_error BOOLEAN := FALSE;'), 'Subtransaction assertion must declare boolean error flag');
    assert.ok(valContent.includes('IF NOT v_caught_expected_error THEN'), 'Assertion block must verify error flag was set');
    assert.ok(valContent.includes('ASSERTION FAILED'), 'Assertion block must raise explicit failure if invalid operation succeeds');
    assert.ok(valContent.includes('foreign_key_violation'), 'Assertions must catch foreign_key_violation specifically');
    assert.ok(valContent.includes('check_violation'), 'Assertions must catch check_violation specifically');
    assert.ok(valContent.includes("SQLSTATE 'P0001'"), "Assertions must catch custom trigger exceptions via SQLSTATE 'P0001'");
  });

  test('Test 8.1.4.3: Bidirectional tally reconciliation enforces candidate tallies as granular source of truth during active counting', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    // SQL trigger on candidate_tallies
    assert.ok(sqlContent.includes('auto_reconcile_session_votes_on_tally_change'), 'Trigger function auto_reconcile_session_votes_on_tally_change must exist');
    assert.ok(sqlContent.includes('trg_auto_reconcile_session_votes_on_tally_change'), 'Trigger trg_auto_reconcile_session_votes_on_tally_change must exist on candidate_tallies');
    assert.ok(sqlContent.includes('AFTER INSERT OR UPDATE OR DELETE ON candidate_tallies'), 'Auto-reconciliation must trigger on INSERT, UPDATE, or DELETE on candidate_tallies');
    assert.ok(sqlContent.includes('SET total_counted_votes = v_candidate_sum + nota_votes + rejected_votes'), 'Auto-reconciliation must update total_counted_votes with tally sum + nota + rejected');

    // Validated in integration script Scenario 11
    assert.ok(valContent.includes('SCENARIO 11: Active Counting Automatic Tally Reconciliation'), 'Scenario 11 must test auto-reconciliation');
    assert.ok(valContent.includes('SCENARIO 12: Session Completion Strict Reconciliation'), 'Scenario 12 must test strict completion check');
    assert.ok(valContent.includes('SCENARIO 13: Completed Session Tally Mutation Protection'), 'Scenario 13 must test tally mutation protection');
  });

  test('Test 8.1.4.4: Tie resolution evidence model TieResolution and state machine gate (TIED -> RESULT_READY_FOR_REVIEW)', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    // Prisma Model
    assert.ok(prismaContent.includes('model TieResolution'), 'TieResolution model must exist in Prisma schema');
    assert.ok(prismaContent.includes('@@map("tie_resolutions")'), 'TieResolution must map to tie_resolutions table');
    assert.ok(prismaContent.includes('resolutionMethod'), 'TieResolution must declare resolutionMethod');
    assert.ok(prismaContent.includes('justificationNote'), 'TieResolution must declare justificationNote');
    assert.ok(prismaContent.includes('approvedByAdminId'), 'TieResolution must declare approvedByAdminId');

    // SQL DDL and Immutability
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS tie_resolutions'), 'tie_resolutions table DDL must exist in custom SQL');
    assert.ok(sqlContent.includes('protect_tie_resolution_immutability'), 'protect_tie_resolution_immutability function must exist');
    assert.ok(sqlContent.includes('trg_protect_tie_resolution_immutability'), 'trg_protect_tie_resolution_immutability trigger must exist');

    // State machine gate
    assert.ok(sqlContent.includes("WHEN 'TIED' THEN"), 'State transition trigger must evaluate TIED status');
    assert.ok(sqlContent.includes('Transition from TIED to RESULT_READY_FOR_REVIEW requires verified database evidence in tie_resolutions'), 'Gate must require tie_resolutions evidence matching winner');

    // Validated in integration script Scenario 22
    assert.ok(valContent.includes('SCENARIO 22: Tie State Transition & Mandatory TieResolution Evidence Gate'), 'Scenario 22 must test tie resolution evidence');
  });

  test('Test 8.1.4.5: Historical nomination-bound party modeling and independent candidate support', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    // Prisma schema nomination party
    const nomMatch = prismaContent.match(/model CandidateNomination\s+\{[\s\S]*?\n\}/);
    assert.ok(nomMatch, 'CandidateNomination model block must exist');
    assert.ok(nomMatch[0].includes('partyId'), 'CandidateNomination must have partyId field');
    assert.ok(nomMatch[0].includes('@map("party_id")'), 'partyId must map to party_id');
    assert.ok(nomMatch[0].includes('party                       PoliticalParty?'), 'CandidateNomination must relate to PoliticalParty');

    // CandidateTally party is nullable for independent candidates
    const tallyMatch = prismaContent.match(/model CandidateTally\s+\{[\s\S]*?\n\}/);
    assert.ok(tallyMatch, 'CandidateTally model block must exist');
    assert.ok(tallyMatch[0].includes('partyId             String?'), 'CandidateTally partyId must be nullable for independent candidates');

    // SQL Trigger verifies nomination-bound party
    assert.ok(sqlContent.includes('Candidate % holds an INDEPENDENT nomination; tally party_id must be NULL'), 'Trigger must support independent candidates');
    assert.ok(sqlContent.includes('Tally party (%) does not match nomination party (%) for candidate %'), 'Trigger must verify tally party matches nomination party');

    // Integration test Scenario 6
    assert.ok(valContent.includes('SCENARIO 6: Historical Party Modeling & Independent Candidate Support'), 'Scenario 6 must test historical independent candidate modeling');
  });

  test('Test 8.1.4.6: CountingRound UPDATE integrity protects session immutability, round number immutability, and earlier-round immutability', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    // Custom SQL triggers
    assert.ok(sqlContent.includes('Cannot transfer counting round % to different session'), 'UPDATE trigger must forbid altering session_id');
    assert.ok(sqlContent.includes('Cannot modify round_number (% to %) on existing round record'), 'UPDATE trigger must forbid altering round_number on existing round');
    assert.ok(sqlContent.includes('Cannot modify vote totals for earlier round % when subsequent rounds exist'), 'Earlier rounds must be immutable when later rounds exist');
    assert.ok(sqlContent.includes('AFTER INSERT OR UPDATE OR DELETE ON counting_rounds'), 'synchronize_session_current_round must fire on INSERT, UPDATE, or DELETE');

    // Integration test Scenarios 18-21
    assert.ok(valContent.includes('SCENARIO 18: CountingRound UPDATE Integrity'), 'Scenario 18 must test round update immutability');
    assert.ok(valContent.includes('SCENARIO 19: Earlier Round Vote Mutation Rejection'), 'Scenario 19 must test earlier round immutability');
    assert.ok(valContent.includes('SCENARIO 20: Strict Reverse-Order Round Rollback'), 'Scenario 20 must test reverse rollback');
    assert.ok(valContent.includes('SCENARIO 21: Automatic Synchronization of current_round Counter'), 'Scenario 21 must test current_round sync');
  });

  test('Test 8.1.4.7: Comprehensive 23-scenario coverage in tests/postgresql-validation.sql', () => {
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    for (let i = 1; i <= 23; i++) {
      assert.ok(valContent.includes(`SCENARIO ${i}:`), `tests/postgresql-validation.sql must contain SCENARIO ${i}:`);
    }

    assert.ok(valContent.includes('ALL 23 BASE SCENARIOS') || valContent.includes('ALL 23 SCENARIOS PASSED'), 'Integration test suite verdict must confirm base 23 scenarios passed');
  });
});

describe('OVS Phase 8.1.5 — Final SQL Trigger Corrections & Database Runtime Readiness (Static Architecture Suite)', () => {
  const prismaSchemaPath = path.join(rootDir, 'docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma');
  const customSqlPath = path.join(rootDir, 'docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql');
  const validationSqlPath = path.join(rootDir, 'tests/postgresql-validation.sql');
  const dbDesignPath = path.join(rootDir, 'docs/backend-architecture/DATABASE_DESIGN.md');
  const adrPath = path.join(rootDir, 'docs/backend-architecture/ARCHITECTURE_DECISIONS.md');

  test('Test 8.1.5.1: Every trigger NEW.<field> and OLD.<field> reference in CUSTOM_DATABASE_INTEGRITY.sql maps to a real column in PRISMA_SCHEMA_DRAFT.prisma (and obsolete lead_candidate_id is eliminated)', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');
    const dbDesignContent = fs.readFileSync(dbDesignPath, 'utf8');
    const adrContent = fs.readFileSync(adrPath, 'utf8');

    const obsoleteField = 'lead' + '_candidate_id';
    assert.ok(!sqlContent.includes(obsoleteField), `CUSTOM_DATABASE_INTEGRITY.sql must not contain obsolete field "${obsoleteField}"`);
    assert.ok(!valContent.includes(obsoleteField), `tests/postgresql-validation.sql must not contain literal obsolete field "${obsoleteField}"`);
    assert.ok(!dbDesignContent.includes(obsoleteField), `DATABASE_DESIGN.md must not reference obsolete field "${obsoleteField}"`);
    assert.ok(!adrContent.includes(obsoleteField), `ARCHITECTURE_DECISIONS.md must not reference obsolete field "${obsoleteField}"`);

    // Build physical table -> Set<column_name> map from PRISMA_SCHEMA_DRAFT.prisma
    const enumNames = new Set([...prismaContent.matchAll(/^enum\s+([A-Za-z0-9_]+)\s+\{/gm)].map(m => m[1]));
    const scalarTypes = new Set(['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes']);
    const tableColumns = new Map();

    const modelBlocks = [...prismaContent.matchAll(/model\s+([A-Za-z0-9_]+)\s+\{([\s\S]*?)\n\}/g)];
    for (const [, modelName, body] of modelBlocks) {
      const tableMapMatch = body.match(/@@map\("([a-z0-9_]+)"\)/);
      assert.ok(tableMapMatch, `Model ${modelName} must declare @@map`);
      const tableName = tableMapMatch[1];
      const cols = new Set();

      for (const line of body.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
        const parts = trimmed.split(/\s+/);
        const fieldName = parts[0];
        const rawType = (parts[1] || '').replace('[]', '').replace('?', '');
        if (!fieldName || !rawType) continue;

        if (!scalarTypes.has(rawType) && !enumNames.has(rawType)) {
          continue; // Relation field
        }

        const colMapMatch = trimmed.match(/@map\("([a-z0-9_]+)"\)/);
        const physicalCol = colMapMatch ? colMapMatch[1] : fieldName;
        cols.add(physicalCol);
      }
      tableColumns.set(tableName, cols);
    }

    // Parse all trigger functions and their bound tables from CUSTOM_DATABASE_INTEGRITY.sql
    const functionBodies = new Map();
    const funcRegex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-z0-9_]+)\(\)\s+RETURNS\s+TRIGGER\s+AS\s+\$\$([\s\S]*?)\$\$\s+LANGUAGE\s+plpgsql;/gi;
    for (const match of sqlContent.matchAll(funcRegex)) {
      functionBodies.set(match[1], match[2]);
    }
    assert.ok(functionBodies.size >= 12, `Expected at least 12 trigger functions, found ${functionBodies.size}`);

    const triggerRegex = /CREATE\s+TRIGGER\s+([a-z0-9_]+)[\s\S]*?\bON\s+([a-z0-9_]+)[\s\S]*?EXECUTE\s+FUNCTION\s+([a-z0-9_]+)\(\);/gi;
    let verifiedReferences = 0;

    for (const match of sqlContent.matchAll(triggerRegex)) {
      const [, triggerName, tableName, funcName] = match;
      const validCols = tableColumns.get(tableName);
      assert.ok(validCols, `Trigger ${triggerName} references unknown table ${tableName}`);
      const funcBody = functionBodies.get(funcName);
      assert.ok(funcBody, `Trigger ${triggerName} references unknown function ${funcName}`);

      // Strip SQL comments before scanning NEW.<col> / OLD.<col>
      const uncommentedBody = funcBody.replace(/--.*$/gm, '');
      const recordRefs = [...uncommentedBody.matchAll(/\b(?:NEW|OLD)\.([a-z0-9_]+)\b/gi)];
      for (const ref of recordRefs) {
        const colName = ref[1].toLowerCase();
        assert.ok(
          validCols.has(colName),
          `Trigger ${triggerName} (function ${funcName} on table ${tableName}) references nonexistent record field "${ref[0]}". Valid columns: ${[...validCols].join(', ')}`
        );
        verifiedReferences++;
      }
    }

    assert.ok(verifiedReferences > 80, `Expected over 80 verified NEW/OLD field references across triggers, verified ${verifiedReferences}`);
  });

  test('Test 8.1.5.2: Exact historical nomination-party equality (IS NOT DISTINCT FROM) and independent candidate support without global party override', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    // Extract verify_candidate_tally_nomination body
    const funcMatch = sqlContent.match(/CREATE OR REPLACE FUNCTION verify_candidate_tally_nomination\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/);
    assert.ok(funcMatch, 'verify_candidate_tally_nomination must exist');
    const funcBody = funcMatch[0];

    // Must NOT query candidates.party_id or allow global party fallback
    assert.ok(!funcBody.includes('FROM candidates'), 'verify_candidate_tally_nomination must NOT query mutable candidates.party_id');
    assert.ok(!funcBody.includes('v_candidate_party_id'), 'verify_candidate_tally_nomination must NOT use v_candidate_party_id fallback');
    assert.ok(!funcBody.includes('NEW.party_id := v_nom_party_id'), 'verify_candidate_tally_nomination must NOT silently rewrite NULL tally party when nomination has a party');

    // Must enforce exact IS NOT DISTINCT FROM invariant
    assert.ok(funcBody.includes('NEW.party_id IS NOT DISTINCT FROM v_nom_party_id'), 'Trigger must enforce NEW.party_id IS NOT DISTINCT FROM v_nom_party_id');

    // Composite unique key and FK
    assert.ok(prismaContent.includes('@@unique([id, candidateId, partyId])'), 'CandidateNomination must declare @@unique([id, candidateId, partyId])');
    assert.ok(sqlContent.includes('fk_tally_nomination_candidate_party'), 'SQL must define composite FK fk_tally_nomination_candidate_party');
    assert.ok(sqlContent.includes('OLD.party_id IS DISTINCT FROM NEW.party_id'), 'protect_nomination_lifecycle must block changing historical party_id when tallies exist');

    // Verified in integration scenarios 25 and 26
    assert.ok(valContent.includes('SCENARIO 25: Exact Historical Nomination-Party Consistency'), 'Scenario 25 must test exact nomination-party consistency');
    assert.ok(valContent.includes('SCENARIO 26: Global Candidate Party Switch Without Historical Tally Corruption'), 'Scenario 26 must test global party change isolation');
  });

  test('Test 8.1.5.3: CandidateTally session ownership immutability prevents silent transfers between sessions', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    assert.ok(
      sqlContent.includes("CandidateTally session_id is immutable after INSERT (attempted transfer of tally % from session % to %)"),
      'Trigger must explicitly reject UPDATE operations that change CandidateTally.session_id'
    );
    assert.ok(
      sqlContent.includes("CandidateTally candidate_id is immutable after INSERT"),
      'Trigger must explicitly reject UPDATE operations that change CandidateTally.candidate_id'
    );
    assert.ok(valContent.includes('SCENARIO 27: CandidateTally Session Ownership Immutability & Old Session Total Preservation'), 'Scenario 27 must test session transfer rejection and old session total preservation');
  });

  test('Test 8.1.5.4: Dedicated TieResolution INSERT validation trigger enforces session TIED status, approved nomination, and active scoped admin', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    assert.ok(sqlContent.includes('CREATE OR REPLACE FUNCTION verify_tie_resolution_insert()'), 'verify_tie_resolution_insert function must exist');
    assert.ok(sqlContent.includes('CREATE TRIGGER trg_verify_tie_resolution_insert'), 'trg_verify_tie_resolution_insert trigger must exist');
    assert.ok(sqlContent.includes("v_session_status != 'TIED'"), 'Trigger must require session status to be TIED');
    assert.ok(sqlContent.includes('IF NOT v_admin_active OR NOT v_user_active THEN'), 'Trigger must verify approving admin and user are active');
    assert.ok(sqlContent.includes("v_admin_role = 'READ_ONLY_AUDITOR'"), 'Trigger must reject READ_ONLY_AUDITOR');
    assert.ok(sqlContent.includes('SELECT 1 FROM admin_election_scopes'), 'Trigger must verify ELECTION_OFFICER scope in admin_election_scopes');
    assert.ok(sqlContent.includes('chk_tie_resolution_valid_fields'), 'Declarative CHECK constraint chk_tie_resolution_valid_fields must exist');

    assert.ok(valContent.includes('SCENARIO 28:'), 'Scenario 28 must test non-TIED and unnominated winner rejection');
    assert.ok(valContent.includes('SCENARIO 29: TieResolution Administrator Active Status & RBAC Scope Validation'), 'Scenario 29 must test inactive and out-of-scope admin rejection');
  });

  test('Test 8.1.5.5: TieResolution immutability and consistent onDelete: Restrict referential policy across Prisma and SQL', () => {
    const prismaContent = fs.readFileSync(prismaSchemaPath, 'utf8');
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    const tieBlockMatch = prismaContent.match(/model TieResolution\s+\{[\s\S]*?\n\}/);
    assert.ok(tieBlockMatch, 'TieResolution model block must exist');
    const tieBlock = tieBlockMatch[0];

    // Prisma must use onDelete: Restrict (NOT Cascade) on session relation
    assert.ok(
      tieBlock.includes('session           CountingSession @relation(fields: [sessionId], references: [id], onDelete: Restrict)'),
      'Prisma TieResolution.session must use onDelete: Restrict'
    );
    assert.ok(!tieBlock.includes('onDelete: Cascade'), 'TieResolution must not contain any onDelete: Cascade relation');

    // SQL must use ON DELETE RESTRICT on tie_resolutions.session_id and protect_counting_session_deletion trigger
    const tieSqlSection = sqlContent.slice(sqlContent.indexOf('-- 1.5 Tie Resolution'), sqlContent.indexOf('-- SECTION 2:'));
    assert.ok(!tieSqlSection.includes('ON DELETE CASCADE'), 'tie_resolutions DDL in SQL must NOT use ON DELETE CASCADE');
    assert.ok(tieSqlSection.includes('ON DELETE RESTRICT'), 'tie_resolutions DDL in SQL must use ON DELETE RESTRICT');
    assert.ok(sqlContent.includes('protect_counting_session_deletion'), 'protect_counting_session_deletion trigger function must exist');

    assert.ok(valContent.includes('SCENARIO 30: TieResolution DELETE Rejection & CountingSession Deletion Restriction'), 'Scenario 30 must test TieResolution and CountingSession deletion rejection');
  });

  test('Test 8.1.5.6: Publication enforces resolved winner consistency and deterministic parent-first lock order', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    assert.ok(sqlContent.includes('DETERMINISTIC TRANSACTION LOCK ORDERING HIERARCHY'), 'SQL must document deterministic transaction lock ordering hierarchy');
    assert.ok(sqlContent.includes('Declared session winner (%) does not match resolved winner (%) in tie_resolutions'), 'Session review/publication must enforce winner matches TieResolution');
    assert.ok(valContent.includes('SCENARIO 31: Complete Tied Session Review & Publication Workflow'), 'Scenario 31 must test publication with resolved winner only');
  });
});

describe('OVS Phase 8.1.6 — Final Tie Integrity, Publication Workflow & PostgreSQL CI Verification (Static Architecture Suite)', () => {
  const prismaSchemaPath = path.join(rootDir, 'docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma');
  const customSqlPath = path.join(rootDir, 'docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql');
  const validationSqlPath = path.join(rootDir, 'tests/postgresql-validation.sql');
  const dbDesignPath = path.join(rootDir, 'docs/backend-architecture/DATABASE_DESIGN.md');
  const dockerPlanPath = path.join(rootDir, 'docs/backend-architecture/DOCKER_DEVELOPMENT_PLAN.md');
  const testingStrategyPath = path.join(rootDir, 'docs/backend-architecture/TESTING_STRATEGY.md');
  const ciWorkflowPath = path.join(rootDir, '.github/workflows/ci.yml');
  const phase815ReportPath = path.join(rootDir, 'PHASE_8_1_5_FINAL_AUDIT_REPORT.md');
  const phase816ReportPath = path.join(rootDir, 'PHASE_8_1_6_FINAL_AUDIT_REPORT.md');

  test('Test 8.1.6.1: Genuine tie check in verify_tie_resolution_insert() enforces v_top_tied_count >= 2', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    const funcMatch = sqlContent.match(/CREATE OR REPLACE FUNCTION verify_tie_resolution_insert\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/);
    assert.ok(funcMatch, 'verify_tie_resolution_insert() must exist in CUSTOM_DATABASE_INTEGRITY.sql');
    const funcBody = funcMatch[0];

    assert.ok(
      funcBody.includes('IF v_top_tied_count < 2 THEN'),
      'verify_tie_resolution_insert() must explicitly reject when v_top_tied_count < 2'
    );
    assert.ok(
      funcBody.includes('genuine tie requires at least 2 eligible APPROVED candidates tied at highest votes'),
      'verify_tie_resolution_insert() must raise specific error when fewer than 2 eligible APPROVED candidates are tied'
    );

    // Verify all required tie scenarios are covered in tests/postgresql-validation.sql
    assert.ok(valContent.includes('28d: Single candidate with highest votes (only 1 candidate tally in session)'), 'Scenario 28d must test single candidate rejection');
    assert.ok(valContent.includes('28e: Unique highest candidate among multiple candidates (600 vs 400 vs 400)'), 'Scenario 28e must test unique highest candidate rejection');
    assert.ok(valContent.includes('28f: Selected winner not among tied candidates'), 'Scenario 28f must test winner not among tied candidates rejection');
    assert.ok(valContent.includes('28h: Three-way tie — accepted'), 'Scenario 28h must test three-way tie acceptance');
    assert.ok(valContent.includes('Step 2: Insert valid tie-resolution evidence for SESS_PC3_ACTIVE (Genuine two-candidate tie accepted'), 'Scenario 31 Step 2 must test two-candidate tie acceptance');
  });

  test('Test 8.1.6.2: Missing candidate tallies are explicitly rejected in verify_tie_resolution_insert()', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    const funcMatch = sqlContent.match(/CREATE OR REPLACE FUNCTION verify_tie_resolution_insert\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/);
    assert.ok(funcMatch, 'verify_tie_resolution_insert() must exist');
    const funcBody = funcMatch[0];

    assert.ok(funcBody.includes('v_total_tally_count'), 'verify_tie_resolution_insert() must count candidate tallies in session');
    assert.ok(funcBody.includes('IF v_total_tally_count = 0 THEN'), 'verify_tie_resolution_insert() must reject when v_total_tally_count = 0');
    assert.ok(funcBody.includes('no candidate tallies exist for session'), 'verify_tie_resolution_insert() must raise clear error for missing candidate tallies');
    assert.ok(valContent.includes('28b: No candidate tallies — rejected'), 'Scenario 28b must test missing candidate tallies rejection');
  });

  test('Test 8.1.6.3: Zero-vote ties are explicitly rejected in verify_tie_resolution_insert()', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    const funcMatch = sqlContent.match(/CREATE OR REPLACE FUNCTION verify_tie_resolution_insert\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/);
    assert.ok(funcMatch, 'verify_tie_resolution_insert() must exist');
    const funcBody = funcMatch[0];

    assert.ok(
      funcBody.includes('IF v_max_votes IS NULL OR v_max_votes <= 0 THEN'),
      'verify_tie_resolution_insert() must reject when v_max_votes <= 0'
    );
    assert.ok(
      funcBody.includes('maximum vote count among eligible APPROVED candidates in session % must be greater than zero'),
      'verify_tie_resolution_insert() must raise specific error for zero-vote ties'
    );
    assert.ok(valContent.includes('28c: Zero votes for all candidates — rejected'), 'Scenario 28c must test zero-vote tie rejection');
  });

  test('Test 8.1.6.4: Eligible candidate filtering in tie comparison joins candidate_nominations with status = APPROVED', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    const funcMatch = sqlContent.match(/CREATE OR REPLACE FUNCTION verify_tie_resolution_insert\(\)[\s\S]*?\$\$ LANGUAGE plpgsql;/);
    assert.ok(funcMatch, 'verify_tie_resolution_insert() must exist');
    const funcBody = funcMatch[0];

    // Verify v_max_votes, v_top_tied_count, and v_winner_votes join candidate_nominations with cn.status = 'APPROVED'
    const joinMatches = [...funcBody.matchAll(/JOIN\s+candidate_nominations\s+cn[\s\S]*?AND\s+cn\.status\s*=\s*'APPROVED'/g)];
    assert.equal(
      joinMatches.length,
      6,
      `Expected 6 APPROVED candidate_nominations joins (3 for PARLIAMENTARY + 3 for ASSEMBLY across v_max_votes, v_top_tied_count, and v_winner_votes), found ${joinMatches.length}`
    );
    assert.ok(
      valContent.includes('28g: Unapproved candidate included in highest-vote comparison'),
      'Scenario 28g must test exclusion of unapproved candidate from highest-vote tie comparison'
    );
  });

  test('Test 8.1.6.5: Scenario 31 uses the valid TIED -> RESULT_READY_FOR_REVIEW -> PUBLISHED workflow', () => {
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    const s31Index = valContent.indexOf('-- SCENARIO 31:');
    assert.ok(s31Index !== -1, 'Scenario 31 must exist in tests/postgresql-validation.sql');
    const s31Block = valContent.slice(s31Index);

    const reviewTransitionIdx = s31Block.indexOf("SET status = 'RESULT_READY_FOR_REVIEW',\n    winner_candidate_id = 'TEST_CAND_2'");
    const wrongWinnerPublishIdx = s31Block.indexOf("SET status = 'PUBLISHED',\n        is_published = TRUE,\n        winner_candidate_id = 'TEST_CAND_IND'");
    const validPublishIdx = s31Block.indexOf("SET status = 'PUBLISHED',\n    is_published = TRUE,\n    winner_candidate_id = 'TEST_CAND_2'");

    assert.ok(reviewTransitionIdx !== -1, 'Scenario 31 must first transition TIED session to RESULT_READY_FOR_REVIEW with resolved winner');
    assert.ok(wrongWinnerPublishIdx > reviewTransitionIdx, 'Scenario 31 must attempt publication with wrong winner AFTER transitioning to RESULT_READY_FOR_REVIEW');
    assert.ok(validPublishIdx > wrongWinnerPublishIdx, 'Scenario 31 must publish with resolved winner AFTER verifying wrong-winner rejection');
  });

  test('Test 8.1.6.6: Scenario 31 verifies the specific wrong-winner rejection message and post-failure state', () => {
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');

    const s31Index = valContent.indexOf('-- SCENARIO 31:');
    const s31Block = valContent.slice(s31Index);

    assert.ok(
      s31Block.includes("IF v_err_msg NOT LIKE '%does not match resolved winner (TEST_CAND_2) in tie_resolutions%'"),
      'Scenario 31 must assert the specific winner mismatch trigger message'
    );
    assert.ok(
      s31Block.includes("IF v_stat != 'RESULT_READY_FOR_REVIEW' OR v_pub != FALSE OR v_win != 'TEST_CAND_2' OR v_pub_admin IS NOT NULL OR v_pub_at IS NOT NULL"),
      'Scenario 31 must verify session remains in RESULT_READY_FOR_REVIEW with is_published = FALSE after failed attempt'
    );
    assert.ok(
      s31Block.includes("IF v_stat != 'PUBLISHED'") && s31Block.includes("IF v_pub != TRUE") && s31Block.includes("IF v_win != 'TEST_CAND_2'") && s31Block.includes("v_pub_admin IS DISTINCT FROM 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid OR v_pub_at IS NULL"),
      'Scenario 31 must verify final PUBLISHED status, is_published = TRUE, winner, publisher ID, and publication timestamp'
    );
  });

  test('Test 8.1.6.7: Programmatic model and enum inventory matches PRISMA_SCHEMA_DRAFT.prisma across documentation and reports', () => {
    const inventory = extractPrismaInventory(prismaSchemaPath);

    assert.equal(inventory.modelCount, 25, `Prisma schema must contain exactly 25 models, found ${inventory.modelCount}`);
    assert.equal(inventory.enumCount, 17, `Prisma schema must contain exactly 17 enums, found ${inventory.enumCount}`);

    const dbDesignContent = fs.readFileSync(dbDesignPath, 'utf8');
    const report815Content = fs.readFileSync(phase815ReportPath, 'utf8');
    const report816Content = fs.readFileSync(phase816ReportPath, 'utf8');

    // Every actual model and enum must appear in DATABASE_DESIGN.md, PHASE_8_1_5_FINAL_AUDIT_REPORT.md, and PHASE_8_1_6_FINAL_AUDIT_REPORT.md
    for (const model of inventory.models) {
      assert.ok(dbDesignContent.includes(`\`${model.name}\``), `DATABASE_DESIGN.md must document model ${model.name}`);
      assert.ok(report815Content.includes(`\`${model.name}\``), `PHASE_8_1_5_FINAL_AUDIT_REPORT.md must document model ${model.name}`);
      assert.ok(report816Content.includes(`\`${model.name}\``), `PHASE_8_1_6_FINAL_AUDIT_REPORT.md must document model ${model.name}`);
    }

    for (const enumItem of inventory.enums) {
      assert.ok(dbDesignContent.includes(`\`${enumItem.name}\``), `DATABASE_DESIGN.md must document enum ${enumItem.name}`);
      assert.ok(report815Content.includes(`\`${enumItem.name}\``), `PHASE_8_1_5_FINAL_AUDIT_REPORT.md must document enum ${enumItem.name}`);
      assert.ok(report816Content.includes(`\`${enumItem.name}\``), `PHASE_8_1_6_FINAL_AUDIT_REPORT.md must document enum ${enumItem.name}`);
    }

    // Ensure non-existent enum names are absent from Section 9.2 of PHASE_8_1_5_FINAL_AUDIT_REPORT.md and PHASE_8_1_6_FINAL_AUDIT_REPORT.md
    const bogusEnums = [
      'AccountStatus',
      'VerificationStatus',
      'PartyCategory',
      'NominationStatus',
      'DemoParticipationStatus',
      'CountingSessionStatus',
      'NotificationPriority',
    ];
    for (const bogus of bogusEnums) {
      assert.ok(!report815Content.includes(`\`${bogus}\``), `PHASE_8_1_5_FINAL_AUDIT_REPORT.md must not list nonexistent enum ${bogus}`);
    }
  });

  test('Test 8.1.6.8: PostgreSQL setup instructions include Prisma schema bootstrap before CUSTOM_DATABASE_INTEGRITY.sql', () => {
    const sqlContent = fs.readFileSync(customSqlPath, 'utf8');
    const valContent = fs.readFileSync(validationSqlPath, 'utf8');
    const dbDesignContent = fs.readFileSync(dbDesignPath, 'utf8');
    const dockerPlanContent = fs.readFileSync(dockerPlanPath, 'utf8');
    const testingStrategyContent = fs.readFileSync(testingStrategyPath, 'utf8');

    for (const [docName, content] of [
      ['CUSTOM_DATABASE_INTEGRITY.sql', sqlContent],
      ['tests/postgresql-validation.sql', valContent],
      ['DATABASE_DESIGN.md', dbDesignContent],
      ['DOCKER_DEVELOPMENT_PLAN.md', dockerPlanContent],
      ['TESTING_STRATEGY.md', testingStrategyContent],
    ]) {
      const prismaPushIdx = content.indexOf('prisma');
      const customSqlIdx = content.indexOf('psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql');
      const validationSqlIdx = content.indexOf('psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql');

      assert.ok(prismaPushIdx !== -1 && content.includes('db push --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma'), `${docName} must document prisma db push schema bootstrap`);
      assert.ok(customSqlIdx > prismaPushIdx, `${docName} must apply CUSTOM_DATABASE_INTEGRITY.sql AFTER Prisma schema bootstrap`);
      assert.ok(validationSqlIdx > customSqlIdx, `${docName} must execute tests/postgresql-validation.sql AFTER CUSTOM_DATABASE_INTEGRITY.sql`);
    }
  });

  test('Test 8.1.6.9: GitHub Actions workflow includes the PostgreSQL 16 integration validation job while keeping frontend CI intact', () => {
    const ciContent = fs.readFileSync(ciWorkflowPath, 'utf8');

    // Frontend verify job intact
    assert.ok(ciContent.includes('verify:'), 'CI workflow must preserve verify job');
    assert.ok(ciContent.includes('npm run lint'), 'CI workflow must run lint');
    assert.ok(ciContent.includes('npm run typecheck'), 'CI workflow must run typecheck');
    assert.ok(ciContent.includes('npm test'), 'CI workflow must run npm test');
    assert.ok(ciContent.includes('npm run build'), 'CI workflow must run npm run build');
    assert.ok(ciContent.includes('npm run test:e2e'), 'CI workflow must run Playwright E2E tests');

    // PostgreSQL 16 validation job
    assert.ok(ciContent.includes('postgres-validation:'), 'CI workflow must define postgres-validation job');
    assert.ok(ciContent.includes('image: postgres:16-alpine'), 'CI workflow must use postgres:16-alpine service container');
    assert.ok(ciContent.includes('npx prisma validate --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma'), 'CI workflow must validate Prisma schema');
    assert.ok(ciContent.includes('npx prisma db push --schema=docs/backend-architecture/PRISMA_SCHEMA_DRAFT.prisma --skip-generate'), 'CI workflow must push Prisma schema to disposable database');
    assert.ok(ciContent.includes('psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/backend-architecture/CUSTOM_DATABASE_INTEGRITY.sql'), 'CI workflow must apply CUSTOM_DATABASE_INTEGRITY.sql');
    assert.ok(ciContent.includes('psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/postgresql-validation.sql'), 'CI workflow must run tests/postgresql-validation.sql');
  });
});




