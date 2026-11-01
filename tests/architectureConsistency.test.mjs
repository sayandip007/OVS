import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  test('Prisma schema draft defines exactly 24 models and 17 enums', () => {
    const content = fs.readFileSync(prismaSchemaPath, 'utf8');
    const modelMatches = [...content.matchAll(/^model\s+([A-Za-z0-9_]+)\s+\{/gm)].map(m => m[1]);
    const enumMatches = [...content.matchAll(/^enum\s+([A-Za-z0-9_]+)\s+\{/gm)].map(m => m[1]);

    assert.equal(modelMatches.length, 24, `Expected exactly 24 models, found ${modelMatches.length}: ${modelMatches.join(', ')}`);
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
    assert.ok(tallyBlock.includes('fields: [candidateId, partyId], references: [id, partyId]'), 'CandidateTally must enforce composite FK (candidateId, partyId)');
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
    assert.equal(modelBlocks.length, 24, 'All 24 models must exist in Prisma schema');

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
    assert.ok(sqlContent.includes("v_candidate_party_id != NEW.party_id"), 'Tally trigger must enforce candidate party matches registered party');
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
    assert.ok(sqlContent.includes("NEW.is_published = TRUE OR NEW.status = 'PUBLISHED'"), 'Direct insertion as PUBLISHED must be checked');
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
