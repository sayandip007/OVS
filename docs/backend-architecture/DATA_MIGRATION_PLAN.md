# OVS Data Migration & Seed Architecture

## 1. Migration Overview & Seed Strategy

The frontend application currently relies on a structured, normalized set of JavaScript seed data files located under `src/data/`:
- `states.js`: 28 States and 8 Union Territories (36 jurisdictions).
- `districts.js`: 72 representative administrative districts.
- `constituencies.js`: 72 Parliamentary Constituencies (PCs) and 144 Assembly Constituencies (ACs).
- `parties.js`: Registered National, State, and Independent political parties.
- `elections.js`: 5 seeded elections (`LS-2029`, `WB-ASSEMBLY-2029`, `DL-ASSEMBLY-2029`, `MH-ASSEMBLY-2029`, `LS-2024`) and portal announcements.
- `candidates.js`: Contesting candidate profiles and baseline tallies.
- `voters.js`: 6 multi-state demo voters, 5 ECI administrative officers, voter notifications, and audit logs.
- `results.js`: Seeded constituency counting sessions and published result records.

The migration strategy translates these static definitions into an **idempotent, relational PostgreSQL seed script** (`prisma/seed.ts`) using Prisma `upsert` queries.

---

## 2. Stable Identifiers & Provenance Tagging

To ensure deterministic testing, reproducible E2E tests, and zero data drift:
1. **Canonical Primary Keys**: Existing string slugs (e.g. `WB`, `PC-WB-KOLKATA-SOUTH`, `AC-WB-BHABANIPUR`, `LS-2029`, `PARTY-BJP`, `CAND-LS29-KRN-1`, `ECI-SUPER-001`) are preserved directly as primary keys in geography, election, party, candidate, and counting session tables.
2. **Provenance Separation**:
   - `MetadataSource.VERIFIED_OFFICIAL`: Assigned to official constitutional boundaries (36 States/UTs, seat allocations 543 / 4,123, official constituency names).
   - `MetadataSource.DEMO_SAMPLE`: Assigned to simulated candidates, demo voters, fictitious audit logs, and simulated counting totals.

---

## 3. Ordered Idempotent Migration Sequence

The seed pipeline must execute in strict dependency order to satisfy relational foreign key constraints:

```text
Step 1: States & Union Territories (states.js)
  └── Step 2: Districts (districts.js)
        └── Step 3: Parliamentary Constituencies (constituencies.js)
              └── Step 4: Assembly Constituencies with parent PC links (constituencies.js)
                    └── Step 5: Political Parties (parties.js)
                          └── Step 6: Elections (elections.js)
                                ├── Step 7: Election Constituencies junction
                                ├── Step 8: Candidates & Nominations (candidates.js)
                                ├── Step 9: Users, Admin Officers & Demo Voters (voters.js)
                                ├── Step 10: Announcements (elections.js)
                                └── Step 11: Counting Sessions, Rounds & Tallies (results.js)
```

### 3.1 Idempotent Seed Pattern (`prisma/seed.ts`)

```typescript
// prisma/seed.ts snippet
import { PrismaClient, MetadataSource, JurisdictionType } from '@prisma/client';
import { INITIAL_STATES } from '../src/data/states.js';
import { INITIAL_DISTRICTS } from '../src/data/districts.js';
import { INITIAL_CONSTITUENCIES } from '../src/data/constituencies.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Electoral Geography...');

  // 1. States
  for (const state of INITIAL_STATES) {
    await prisma.state.upsert({
      where: { id: state.id },
      update: {
        name: state.name,
        totalLokSabhaSeats: state.totalLokSabhaSeats,
        totalAssemblySeats: state.totalAssemblySeats,
      },
      create: {
        id: state.id,
        name: state.name,
        type: state.type === 'UNION_TERRITORY' ? JurisdictionType.UNION_TERRITORY : JurisdictionType.STATE,
        capital: state.capital,
        officialLanguages: state.officialLanguages,
        totalLokSabhaSeats: state.totalLokSabhaSeats,
        totalAssemblySeats: state.totalAssemblySeats,
        metadataSource: MetadataSource.VERIFIED_OFFICIAL,
      },
    });
  }

  // 2. Districts
  for (const dist of INITIAL_DISTRICTS) {
    await prisma.district.upsert({
      where: { id: dist.id },
      update: { name: dist.name },
      create: {
        id: dist.id,
        stateId: dist.stateId,
        name: dist.name,
        headquarters: dist.headquarters,
        metadataSource: MetadataSource.VERIFIED_OFFICIAL,
      },
    });
  }

  // 3. Parliamentary Constituencies
  const pcs = INITIAL_CONSTITUENCIES.filter(c => c.type === 'PARLIAMENTARY');
  for (const pc of pcs) {
    await prisma.parliamentaryConstituency.upsert({
      where: { id: pc.id },
      update: { name: pc.name, totalVoters: pc.totalVoters },
      create: {
        id: pc.id,
        stateId: pc.stateId,
        constituencyNumber: pc.constituencyNumber,
        name: pc.name,
        reservationType: pc.reservationType || 'GENERAL',
        totalVoters: pc.totalVoters,
        metadataSource: MetadataSource.VERIFIED_OFFICIAL,
      },
    });
  }

  // 4. Assembly Constituencies (with parent PC link)
  const acs = INITIAL_CONSTITUENCIES.filter(c => c.type === 'ASSEMBLY');
  for (const ac of acs) {
    await prisma.assemblyConstituency.upsert({
      where: { id: ac.id },
      update: { name: ac.name, totalVoters: ac.totalVoters },
      create: {
        id: ac.id,
        stateId: ac.stateId,
        districtId: ac.districtId,
        parentParliamentaryConstituencyId: ac.parentParliamentaryConstituencyId,
        constituencyNumber: ac.constituencyNumber,
        name: ac.name,
        reservationType: ac.reservationType || 'GENERAL',
        totalVoters: ac.totalVoters,
        metadataSource: MetadataSource.VERIFIED_OFFICIAL,
      },
    });
  }

  console.log('Seed completed successfully.');
}

main().catch(e => { console.error(e); process.exit(1); });
```

---

## 4. Reset & Data Isolation Strategy

1. **Transactional Demo Reset (`POST /api/v1/admin/system/reset-demo`)**:
   - Authorized exclusively for `SUPER_ADMIN`.
   - Executes inside a PostgreSQL transaction (`prisma.$transaction`).
   - Clears dynamic demonstration tables: `demo_participations`, `user_sessions`, `auth_challenges`, `voter_notifications`, and resets `counting_sessions` back to initial round counts.
   - Preserves verified geography, registered parties, and core election schedules without requiring a full database rebuild.
2. **Zero Real Personal Data**:
   - All voter names, emails, phone numbers, and addresses in `voters.js` are fictitious demonstration personas.
   - The seed script enforces sanitization flags to prevent ingestion of production PII into development instances.
