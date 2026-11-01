-- CreateEnum
CREATE TYPE "JurisdictionType" AS ENUM ('STATE', 'UNION_TERRITORY');

-- CreateEnum
CREATE TYPE "MetadataSource" AS ENUM ('VERIFIED_OFFICIAL', 'DEMO_SAMPLE');

-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('GENERAL', 'SC', 'ST');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('VOTER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ElectionType" AS ENUM ('LOK_SABHA', 'STATE_ASSEMBLY');

-- CreateEnum
CREATE TYPE "ConstituencyType" AS ENUM ('PARLIAMENTARY', 'ASSEMBLY');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'UPCOMING', 'NOMINATION_OPEN', 'NOMINATION_CLOSED', 'READY', 'POLLING_ACTIVE', 'POLLING_COMPLETED', 'COUNTING', 'RESULTS_DECLARED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('PENDING', 'VOTED', 'UPCOMING', 'CLOSED', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "CandidateNominationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('NATIONAL', 'STATE', 'INDEPENDENT');

-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'NATIONAL_ADMIN', 'STATE_ADMIN', 'ELECTION_OFFICER', 'READ_ONLY_AUDITOR');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('DRAFT', 'COUNTING_IN_PROGRESS', 'COUNTING_PAUSED', 'COUNTING_COMPLETED', 'RESULT_READY_FOR_REVIEW', 'PUBLISHED', 'TIED', 'UNDER_REVIEW', 'CORRECTED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('GENERAL_INFO', 'ELECTION_SCHEDULE', 'CANDIDATE_INFO', 'POLLING_INSTRUCTIONS', 'RESULTS', 'IMPORTANT_NOTICE');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL_VOTERS', 'SPECIFIC_STATE', 'SPECIFIC_ELECTION', 'SPECIFIC_CONSTITUENCY');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ELECTION_ANNOUNCEMENT', 'NOMINATION_SCHEDULE', 'POLLING_SCHEDULE', 'ELECTION_REMINDER', 'CANDIDATE_LIST', 'RESULT_PUBLISHED', 'PROFILE_UPDATE', 'GENERAL_ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "states" (
    "id" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "JurisdictionType" NOT NULL DEFAULT 'STATE',
    "capital" VARCHAR(100) NOT NULL,
    "official_languages" TEXT[],
    "total_lok_sabha_seats" INTEGER NOT NULL,
    "total_assembly_seats" INTEGER NOT NULL,
    "metadata_source" "MetadataSource" NOT NULL DEFAULT 'VERIFIED_OFFICIAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" VARCHAR(50) NOT NULL,
    "state_id" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "headquarters" VARCHAR(100) NOT NULL,
    "metadata_source" "MetadataSource" NOT NULL DEFAULT 'VERIFIED_OFFICIAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parliamentary_constituencies" (
    "id" VARCHAR(50) NOT NULL,
    "state_id" VARCHAR(10) NOT NULL,
    "constituency_number" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "reservation_type" "ReservationType" NOT NULL DEFAULT 'GENERAL',
    "total_voters" INTEGER NOT NULL DEFAULT 0,
    "metadata_source" "MetadataSource" NOT NULL DEFAULT 'VERIFIED_OFFICIAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parliamentary_constituencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assembly_constituencies" (
    "id" VARCHAR(50) NOT NULL,
    "state_id" VARCHAR(10) NOT NULL,
    "district_id" VARCHAR(50) NOT NULL,
    "parent_parliamentary_constituency_id" VARCHAR(50) NOT NULL,
    "constituency_number" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "reservation_type" "ReservationType" NOT NULL DEFAULT 'GENERAL',
    "total_voters" INTEGER NOT NULL DEFAULT 0,
    "metadata_source" "MetadataSource" NOT NULL DEFAULT 'VERIFIED_OFFICIAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assembly_constituencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "user_type" "UserType" NOT NULL DEFAULT 'VOTER',
    "identifier" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "lockout_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voter_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "epic_number" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" VARCHAR(20) NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "address" TEXT NOT NULL,
    "pin_code" VARCHAR(10) NOT NULL,
    "state_id" VARCHAR(10) NOT NULL,
    "district_id" VARCHAR(50) NOT NULL,
    "parliamentary_constituency_id" VARCHAR(50) NOT NULL,
    "assembly_constituency_id" VARCHAR(50) NOT NULL,
    "registration_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_verified" BOOLEAN NOT NULL DEFAULT true,
    "metadata_source" "MetadataSource" NOT NULL DEFAULT 'DEMO_SAMPLE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "voter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "user_agent" TEXT,
    "ip_address" VARCHAR(45),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" UUID NOT NULL,
    "identifier" VARCHAR(100) NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elections" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "ElectionType" NOT NULL,
    "year" INTEGER NOT NULL,
    "state_id" VARCHAR(10),
    "status" "ElectionStatus" NOT NULL DEFAULT 'UPCOMING',
    "registration_deadline" DATE,
    "nomination_start_date" DATE,
    "nomination_end_date" DATE,
    "scrutiny_date" DATE,
    "withdrawal_deadline" DATE,
    "campaign_start_date" DATE,
    "campaign_end_date" DATE,
    "polling_start_date" DATE NOT NULL,
    "polling_end_date" DATE NOT NULL,
    "counting_date" DATE NOT NULL,
    "result_date" DATE NOT NULL,
    "simulation_clock_date" DATE,
    "demo_sandbox_mode" VARCHAR(50) NOT NULL DEFAULT 'CONCURRENT_SIMULATION_SANDBOX',
    "description" TEXT NOT NULL DEFAULT '',
    "metadata_source" "MetadataSource" NOT NULL DEFAULT 'DEMO_SAMPLE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_constituencies" (
    "id" UUID NOT NULL,
    "election_id" VARCHAR(50) NOT NULL,
    "constituency_type" "ConstituencyType" NOT NULL,
    "parliamentary_constituency_id" VARCHAR(50),
    "assembly_constituency_id" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_constituencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_lifecycle_history" (
    "id" UUID NOT NULL,
    "election_id" VARCHAR(50) NOT NULL,
    "from_status" "ElectionStatus" NOT NULL,
    "to_status" "ElectionStatus" NOT NULL,
    "changed_by_admin_id" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "election_lifecycle_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "political_parties" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "abbreviation" VARCHAR(20) NOT NULL,
    "party_type" "PartyType" NOT NULL DEFAULT 'NATIONAL',
    "symbol_name" VARCHAR(100) NOT NULL,
    "symbol_url" VARCHAR(500) NOT NULL,
    "established_year" INTEGER,
    "headquarters" VARCHAR(150),
    "status" "PartyStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata_source" "MetadataSource" NOT NULL DEFAULT 'DEMO_SAMPLE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "political_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" VARCHAR(50) NOT NULL,
    "party_id" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" VARCHAR(20) NOT NULL,
    "education" VARCHAR(150) NOT NULL,
    "profession" VARCHAR(150) NOT NULL,
    "criminal_cases" INTEGER NOT NULL DEFAULT 0,
    "assets_declared" BIGINT NOT NULL DEFAULT 0,
    "liabilities_declared" BIGINT NOT NULL DEFAULT 0,
    "photo_url" VARCHAR(500),
    "bio" TEXT NOT NULL DEFAULT '',
    "metadata_source" "MetadataSource" NOT NULL DEFAULT 'DEMO_SAMPLE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_nominations" (
    "id" UUID NOT NULL,
    "candidate_id" VARCHAR(50) NOT NULL,
    "party_id" VARCHAR(50),
    "election_id" VARCHAR(50) NOT NULL,
    "constituency_type" "ConstituencyType" NOT NULL,
    "parliamentary_constituency_id" VARCHAR(50),
    "assembly_constituency_id" VARCHAR(50),
    "nomination_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CandidateNominationStatus" NOT NULL DEFAULT 'APPROVED',
    "scrutiny_note" TEXT NOT NULL DEFAULT '',
    "scrutiny_date" TIMESTAMPTZ(6),
    "scrutinized_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidate_nominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "officer_code" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "designation" VARCHAR(150) NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'READ_ONLY_AUDITOR',
    "assigned_state_id" VARCHAR(10),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_election_scopes" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "election_id" VARCHAR(50) NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_admin_id" UUID,

    CONSTRAINT "admin_election_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_action_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "action_type" VARCHAR(50) NOT NULL,
    "domain" VARCHAR(50) NOT NULL,
    "target_entity_id" VARCHAR(100) NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_participations" (
    "id" UUID NOT NULL,
    "voter_id" UUID NOT NULL,
    "election_id" VARCHAR(50) NOT NULL,
    "status" "ParticipationStatus" NOT NULL DEFAULT 'VOTED',
    "demo_reference" VARCHAR(30) NOT NULL,
    "reference_id" VARCHAR(60) NOT NULL,
    "participated_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "demo_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counting_sessions" (
    "id" VARCHAR(100) NOT NULL,
    "election_id" VARCHAR(50) NOT NULL,
    "constituency_type" "ConstituencyType" NOT NULL,
    "parliamentary_constituency_id" VARCHAR(50),
    "assembly_constituency_id" VARCHAR(50),
    "total_configured_rounds" INTEGER NOT NULL DEFAULT 5,
    "current_round" INTEGER NOT NULL DEFAULT 0,
    "status" "ResultStatus" NOT NULL DEFAULT 'DRAFT',
    "total_voters" INTEGER NOT NULL,
    "total_counted_votes" INTEGER NOT NULL DEFAULT 0,
    "nota_votes" INTEGER NOT NULL DEFAULT 0,
    "rejected_votes" INTEGER NOT NULL DEFAULT 0,
    "winner_candidate_id" VARCHAR(50),
    "runner_up_candidate_id" VARCHAR(50),
    "victory_margin" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "published_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "counting_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counting_rounds" (
    "id" UUID NOT NULL,
    "session_id" VARCHAR(100) NOT NULL,
    "round_number" INTEGER NOT NULL,
    "round_votes" INTEGER NOT NULL DEFAULT 0,
    "cumulative_votes" INTEGER NOT NULL DEFAULT 0,
    "leading_candidate_id" VARCHAR(50),
    "lead_margin" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_by_admin_id" UUID,

    CONSTRAINT "counting_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_tallies" (
    "id" UUID NOT NULL,
    "session_id" VARCHAR(100) NOT NULL,
    "candidate_id" VARCHAR(50) NOT NULL,
    "nomination_id" UUID,
    "party_id" VARCHAR(50),
    "votes" INTEGER NOT NULL DEFAULT 0,
    "vote_share_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidate_tallies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_correction_history" (
    "id" UUID NOT NULL,
    "session_id" VARCHAR(100) NOT NULL,
    "previous_state" JSONB NOT NULL,
    "corrected_state" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "corrected_by_admin_id" UUID NOT NULL,
    "corrected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_correction_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tie_resolutions" (
    "id" UUID NOT NULL,
    "session_id" VARCHAR(100) NOT NULL,
    "decision" VARCHAR(100) NOT NULL,
    "selected_winner_id" VARCHAR(50) NOT NULL,
    "resolution_method" VARCHAR(100) NOT NULL,
    "justification_note" TEXT NOT NULL,
    "approved_by_admin_id" UUID NOT NULL,
    "resolved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tie_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL DEFAULT 'GENERAL_INFO',
    "target_audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL_VOTERS',
    "target_state_id" VARCHAR(10),
    "target_election_id" VARCHAR(50),
    "target_constituency_type" "ConstituencyType",
    "target_parliamentary_constituency_id" VARCHAR(50),
    "target_assembly_constituency_id" VARCHAR(50),
    "publication_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_by_admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voter_notifications" (
    "id" VARCHAR(50) NOT NULL,
    "voter_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERAL_ANNOUNCEMENT',
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "voter_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "districts_state_id_idx" ON "districts"("state_id");

-- CreateIndex
CREATE UNIQUE INDEX "districts_id_state_id_key" ON "districts"("id", "state_id");

-- CreateIndex
CREATE INDEX "parliamentary_constituencies_state_id_idx" ON "parliamentary_constituencies"("state_id");

-- CreateIndex
CREATE UNIQUE INDEX "parliamentary_constituencies_id_state_id_key" ON "parliamentary_constituencies"("id", "state_id");

-- CreateIndex
CREATE UNIQUE INDEX "parliamentary_constituencies_state_id_constituency_number_key" ON "parliamentary_constituencies"("state_id", "constituency_number");

-- CreateIndex
CREATE INDEX "assembly_constituencies_state_id_idx" ON "assembly_constituencies"("state_id");

-- CreateIndex
CREATE INDEX "assembly_constituencies_district_id_idx" ON "assembly_constituencies"("district_id");

-- CreateIndex
CREATE INDEX "assembly_constituencies_parent_parliamentary_constituency_i_idx" ON "assembly_constituencies"("parent_parliamentary_constituency_id");

-- CreateIndex
CREATE UNIQUE INDEX "assembly_constituencies_id_state_id_key" ON "assembly_constituencies"("id", "state_id");

-- CreateIndex
CREATE UNIQUE INDEX "assembly_constituencies_id_parent_parliamentary_constituenc_key" ON "assembly_constituencies"("id", "parent_parliamentary_constituency_id");

-- CreateIndex
CREATE UNIQUE INDEX "assembly_constituencies_state_id_constituency_number_key" ON "assembly_constituencies"("state_id", "constituency_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_identifier_key" ON "users"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "voter_profiles_user_id_key" ON "voter_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "voter_profiles_epic_number_key" ON "voter_profiles"("epic_number");

-- CreateIndex
CREATE INDEX "voter_profiles_state_id_parliamentary_constituency_id_assem_idx" ON "voter_profiles"("state_id", "parliamentary_constituency_id", "assembly_constituency_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "auth_challenges_identifier_consumed_at_expires_at_idx" ON "auth_challenges"("identifier", "consumed_at", "expires_at");

-- CreateIndex
CREATE INDEX "elections_status_type_idx" ON "elections"("status", "type");

-- CreateIndex
CREATE INDEX "election_constituencies_election_id_constituency_type_idx" ON "election_constituencies"("election_id", "constituency_type");

-- CreateIndex
CREATE INDEX "election_constituencies_parliamentary_constituency_id_idx" ON "election_constituencies"("parliamentary_constituency_id");

-- CreateIndex
CREATE INDEX "election_constituencies_assembly_constituency_id_idx" ON "election_constituencies"("assembly_constituency_id");

-- CreateIndex
CREATE INDEX "election_lifecycle_history_election_id_changed_at_idx" ON "election_lifecycle_history"("election_id", "changed_at");

-- CreateIndex
CREATE INDEX "candidates_party_id_idx" ON "candidates"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_id_party_id_key" ON "candidates"("id", "party_id");

-- CreateIndex
CREATE INDEX "candidate_nominations_candidate_id_election_id_idx" ON "candidate_nominations"("candidate_id", "election_id");

-- CreateIndex
CREATE INDEX "candidate_nominations_party_id_idx" ON "candidate_nominations"("party_id");

-- CreateIndex
CREATE INDEX "candidate_nominations_election_id_status_idx" ON "candidate_nominations"("election_id", "status");

-- CreateIndex
CREATE INDEX "candidate_nominations_parliamentary_constituency_id_idx" ON "candidate_nominations"("parliamentary_constituency_id");

-- CreateIndex
CREATE INDEX "candidate_nominations_assembly_constituency_id_idx" ON "candidate_nominations"("assembly_constituency_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_nominations_id_candidate_id_party_id_key" ON "candidate_nominations"("id", "candidate_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_user_id_key" ON "admin_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_officer_code_key" ON "admin_users"("officer_code");

-- CreateIndex
CREATE INDEX "admin_election_scopes_admin_user_id_idx" ON "admin_election_scopes"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_election_scopes_election_id_idx" ON "admin_election_scopes"("election_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_election_scopes_admin_user_id_election_id_key" ON "admin_election_scopes"("admin_user_id", "election_id");

-- CreateIndex
CREATE INDEX "admin_action_logs_domain_target_entity_id_timestamp_idx" ON "admin_action_logs"("domain", "target_entity_id", "timestamp");

-- CreateIndex
CREATE INDEX "demo_participations_voter_id_election_id_idx" ON "demo_participations"("voter_id", "election_id");

-- CreateIndex
CREATE UNIQUE INDEX "demo_participations_voter_id_election_id_key" ON "demo_participations"("voter_id", "election_id");

-- CreateIndex
CREATE INDEX "counting_sessions_is_published_election_id_idx" ON "counting_sessions"("is_published", "election_id");

-- CreateIndex
CREATE INDEX "counting_sessions_election_id_constituency_type_idx" ON "counting_sessions"("election_id", "constituency_type");

-- CreateIndex
CREATE INDEX "counting_rounds_session_id_round_number_idx" ON "counting_rounds"("session_id", "round_number");

-- CreateIndex
CREATE UNIQUE INDEX "counting_rounds_session_id_round_number_key" ON "counting_rounds"("session_id", "round_number");

-- CreateIndex
CREATE INDEX "candidate_tallies_session_id_idx" ON "candidate_tallies"("session_id");

-- CreateIndex
CREATE INDEX "candidate_tallies_nomination_id_idx" ON "candidate_tallies"("nomination_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_tallies_session_id_candidate_id_key" ON "candidate_tallies"("session_id", "candidate_id");

-- CreateIndex
CREATE INDEX "result_correction_history_session_id_corrected_at_idx" ON "result_correction_history"("session_id", "corrected_at");

-- CreateIndex
CREATE UNIQUE INDEX "tie_resolutions_session_id_key" ON "tie_resolutions"("session_id");

-- CreateIndex
CREATE INDEX "tie_resolutions_selected_winner_id_idx" ON "tie_resolutions"("selected_winner_id");

-- CreateIndex
CREATE INDEX "tie_resolutions_approved_by_admin_id_idx" ON "tie_resolutions"("approved_by_admin_id");

-- CreateIndex
CREATE INDEX "announcements_status_target_audience_publication_date_idx" ON "announcements"("status", "target_audience", "publication_date");

-- CreateIndex
CREATE INDEX "voter_notifications_voter_id_is_read_idx" ON "voter_notifications"("voter_id", "is_read");

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parliamentary_constituencies" ADD CONSTRAINT "parliamentary_constituencies_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_constituencies" ADD CONSTRAINT "assembly_constituencies_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_constituencies" ADD CONSTRAINT "assembly_constituencies_district_id_state_id_fkey" FOREIGN KEY ("district_id", "state_id") REFERENCES "districts"("id", "state_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_constituencies" ADD CONSTRAINT "assembly_constituencies_parent_parliamentary_constituency__fkey" FOREIGN KEY ("parent_parliamentary_constituency_id", "state_id") REFERENCES "parliamentary_constituencies"("id", "state_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_profiles" ADD CONSTRAINT "voter_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_profiles" ADD CONSTRAINT "voter_profiles_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_profiles" ADD CONSTRAINT "voter_profiles_district_id_state_id_fkey" FOREIGN KEY ("district_id", "state_id") REFERENCES "districts"("id", "state_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_profiles" ADD CONSTRAINT "voter_profiles_parliamentary_constituency_id_state_id_fkey" FOREIGN KEY ("parliamentary_constituency_id", "state_id") REFERENCES "parliamentary_constituencies"("id", "state_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_profiles" ADD CONSTRAINT "voter_profiles_assembly_constituency_id_parliamentary_cons_fkey" FOREIGN KEY ("assembly_constituency_id", "parliamentary_constituency_id") REFERENCES "assembly_constituencies"("id", "parent_parliamentary_constituency_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_constituencies" ADD CONSTRAINT "election_constituencies_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_constituencies" ADD CONSTRAINT "election_constituencies_parliamentary_constituency_id_fkey" FOREIGN KEY ("parliamentary_constituency_id") REFERENCES "parliamentary_constituencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_constituencies" ADD CONSTRAINT "election_constituencies_assembly_constituency_id_fkey" FOREIGN KEY ("assembly_constituency_id") REFERENCES "assembly_constituencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_lifecycle_history" ADD CONSTRAINT "election_lifecycle_history_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_lifecycle_history" ADD CONSTRAINT "election_lifecycle_history_changed_by_admin_id_fkey" FOREIGN KEY ("changed_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "political_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_nominations" ADD CONSTRAINT "candidate_nominations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_nominations" ADD CONSTRAINT "candidate_nominations_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "political_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_nominations" ADD CONSTRAINT "candidate_nominations_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_nominations" ADD CONSTRAINT "candidate_nominations_parliamentary_constituency_id_fkey" FOREIGN KEY ("parliamentary_constituency_id") REFERENCES "parliamentary_constituencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_nominations" ADD CONSTRAINT "candidate_nominations_assembly_constituency_id_fkey" FOREIGN KEY ("assembly_constituency_id") REFERENCES "assembly_constituencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_nominations" ADD CONSTRAINT "candidate_nominations_scrutinized_by_admin_id_fkey" FOREIGN KEY ("scrutinized_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_assigned_state_id_fkey" FOREIGN KEY ("assigned_state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_election_scopes" ADD CONSTRAINT "admin_election_scopes_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_election_scopes" ADD CONSTRAINT "admin_election_scopes_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_election_scopes" ADD CONSTRAINT "admin_election_scopes_assigned_by_admin_id_fkey" FOREIGN KEY ("assigned_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_participations" ADD CONSTRAINT "demo_participations_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "voter_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_participations" ADD CONSTRAINT "demo_participations_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_sessions" ADD CONSTRAINT "counting_sessions_election_id_fkey" FOREIGN KEY ("election_id") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_sessions" ADD CONSTRAINT "counting_sessions_parliamentary_constituency_id_fkey" FOREIGN KEY ("parliamentary_constituency_id") REFERENCES "parliamentary_constituencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_sessions" ADD CONSTRAINT "counting_sessions_assembly_constituency_id_fkey" FOREIGN KEY ("assembly_constituency_id") REFERENCES "assembly_constituencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_sessions" ADD CONSTRAINT "counting_sessions_winner_candidate_id_fkey" FOREIGN KEY ("winner_candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_sessions" ADD CONSTRAINT "counting_sessions_runner_up_candidate_id_fkey" FOREIGN KEY ("runner_up_candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_sessions" ADD CONSTRAINT "counting_sessions_published_by_admin_id_fkey" FOREIGN KEY ("published_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_rounds" ADD CONSTRAINT "counting_rounds_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "counting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_rounds" ADD CONSTRAINT "counting_rounds_leading_candidate_id_fkey" FOREIGN KEY ("leading_candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counting_rounds" ADD CONSTRAINT "counting_rounds_processed_by_admin_id_fkey" FOREIGN KEY ("processed_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tallies" ADD CONSTRAINT "candidate_tallies_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "counting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tallies" ADD CONSTRAINT "candidate_tallies_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tallies" ADD CONSTRAINT "candidate_tallies_nomination_id_fkey" FOREIGN KEY ("nomination_id") REFERENCES "candidate_nominations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tallies" ADD CONSTRAINT "candidate_tallies_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "political_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_correction_history" ADD CONSTRAINT "result_correction_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "counting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_correction_history" ADD CONSTRAINT "result_correction_history_corrected_by_admin_id_fkey" FOREIGN KEY ("corrected_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tie_resolutions" ADD CONSTRAINT "tie_resolutions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "counting_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tie_resolutions" ADD CONSTRAINT "tie_resolutions_selected_winner_id_fkey" FOREIGN KEY ("selected_winner_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tie_resolutions" ADD CONSTRAINT "tie_resolutions_approved_by_admin_id_fkey" FOREIGN KEY ("approved_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_state_id_fkey" FOREIGN KEY ("target_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_election_id_fkey" FOREIGN KEY ("target_election_id") REFERENCES "elections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_parliamentary_constituency_id_fkey" FOREIGN KEY ("target_parliamentary_constituency_id") REFERENCES "parliamentary_constituencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_assembly_constituency_id_fkey" FOREIGN KEY ("target_assembly_constituency_id") REFERENCES "assembly_constituencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_notifications" ADD CONSTRAINT "voter_notifications_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "voter_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
