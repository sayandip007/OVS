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
