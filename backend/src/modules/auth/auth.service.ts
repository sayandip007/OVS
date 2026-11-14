import crypto from 'node:crypto';
import {
  ConflictProblemError,
  NotFoundProblemError,
  UnauthorizedProblemError,
  ForbiddenProblemError,
  ValidationProblemError,
  ServiceUnavailableProblemError,
} from '../../common/errors/problemDetails.js';
import { AUTH_CONSTANTS } from './auth.constants.js';
import type {
  AuthUserPayload,
  RegisterVoterInput,
  OtpChallengeResult,
  OtpVerifyResult,
  SafeSessionItem,
} from './auth.types.js';
import { AuthRepository, type UserWithRelations } from './auth.repository.js';
import { OtpService } from './otp.service.js';
import { SessionService } from './session.service.js';

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly otpService: OtpService,
    private readonly sessionService: SessionService,
    private readonly sessionSecret: string
  ) {}

  /**
   * Transforms a UserWithRelations entity into a safe client payload.
   */
  toSafeUserPayload(user: UserWithRelations): AuthUserPayload {
    const adminUser = user.adminUser
      ? (() => {
          const stateIdSet = new Set<string>();
          if (user.adminUser.assignedStateId) {
            stateIdSet.add(user.adminUser.assignedStateId);
          }
          for (const s of user.adminUser.assignedStateScopes ?? []) {
            stateIdSet.add(s.stateId);
          }
          return {
            id: user.adminUser.id,
            userId: user.adminUser.userId,
            officerCode: user.adminUser.officerCode,
            email: user.adminUser.email,
            fullName: user.adminUser.fullName,
            designation: user.adminUser.designation,
            role: user.adminUser.role,
            status: user.adminUser.status,
            isActive: user.adminUser.isActive,
            assignedStateId: user.adminUser.assignedStateId,
            assignedStateIds: Array.from(stateIdSet),
            assignedElectionIds: (user.adminUser.assignedElectionScopes ?? []).map(
              (e) => e.electionId
            ),
            assignedConstituencyScopes: (
              user.adminUser.assignedConstituencyScopes ?? []
            ).map((c) => ({
              id: c.id,
              electionId: c.electionId,
              constituencyType: c.constituencyType,
              parliamentaryConstituencyId: c.parliamentaryConstituencyId,
              assemblyConstituencyId: c.assemblyConstituencyId,
            })),
          };
        })()
      : null;

    return {
      id: user.id,
      identifier: user.identifier,
      userType: user.userType,
      role: user.userType === 'ADMIN' && adminUser ? adminUser.role : 'VOTER',
      isActive: user.isActive,
      voterProfile: user.voterProfile
        ? {
            id: user.voterProfile.id,
            epicNumber: user.voterProfile.epicNumber,
            fullName: user.voterProfile.fullName,
            dateOfBirth: user.voterProfile.dateOfBirth.toISOString().split('T')[0]!,
            gender: user.voterProfile.gender,
            mobile: user.voterProfile.mobile,
            email: user.voterProfile.email,
            address: user.voterProfile.address,
            pinCode: user.voterProfile.pinCode,
            stateId: user.voterProfile.stateId,
            districtId: user.voterProfile.districtId,
            parliamentaryConstituencyId: user.voterProfile.parliamentaryConstituencyId,
            assemblyConstituencyId: user.voterProfile.assemblyConstituencyId,
            registrationDate: user.voterProfile.registrationDate.toISOString(),
            isVerified: user.voterProfile.isVerified,
            metadataSource: user.voterProfile.metadataSource,
          }
        : null,
      adminUser,
    };
  }

  /**
   * Registers a new demo voter atomically.
   */
  async registerVoter(input: RegisterVoterInput): Promise<AuthUserPayload> {
    // 1. Check uniqueness of EPIC identifier in users table
    const existingUser = await this.repository.findUserByIdentifier(input.epicNumber);
    if (existingUser) {
      throw new ConflictProblemError(
        `A user account with EPIC '${input.epicNumber}' already exists.`
      );
    }

    // 2. Check uniqueness of EPIC number in voter profiles
    const existingEpic = await this.repository.findVoterProfileByEpic(input.epicNumber);
    if (existingEpic) {
      throw new ConflictProblemError(
        `A voter profile with EPIC '${input.epicNumber}' already exists.`
      );
    }

    // 3. Check uniqueness of mobile number in voter profiles
    const existingMobile = await this.repository.findUserByMobile(input.mobile);
    if (existingMobile) {
      throw new ConflictProblemError(
        `The mobile number '${input.mobile}' is already registered with an existing voter.`
      );
    }

    // 4. Check uniqueness of email address
    const existingEmail = await this.repository.findVoterProfileByEmail(input.email);
    if (existingEmail) {
      throw new ConflictProblemError(
        `The email address '${input.email}' is already registered with an existing voter.`
      );
    }

    // 5. Verify geographic hierarchy consistency
    const geoCheck = await this.repository.verifyGeographicHierarchy(
      input.stateId,
      input.districtId,
      input.parliamentaryConstituencyId,
      input.assemblyConstituencyId
    );

    if (!geoCheck.valid) {
      throw new ValidationProblemError(
        geoCheck.reason || 'Geographic constituency mapping is invalid or inconsistent.',
        [
          {
            name: 'assemblyConstituencyId',
            reason: geoCheck.reason || 'Geographic hierarchy check failed.',
          },
        ]
      );
    }

    // 6. Generate high-entropy password placeholder (voters authenticate via OTP)
    const placeholderHash = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(`placeholder_pwd_${input.epicNumber}_${Date.now()}`)
      .digest('hex');

    // 7. Atomic transaction to create User and VoterProfile
    const createdUser = await this.repository.createVoterUser(input, placeholderHash);
    return this.toSafeUserPayload(createdUser);
  }

  /**
   * Initiates an OTP authentication challenge.
   * Defends against account enumeration by returning a generic format.
   */
  async requestOtp(
    identifier: string,
    phoneNumber?: string,
    _ipAddress?: string,
    _userAgent?: string
  ): Promise<OtpChallengeResult> {
    const cleanId = identifier.trim().toUpperCase();
    const cleanMobile = phoneNumber ? phoneNumber.trim() : '';

    // Look up user by identifier or mobile
    let user = await this.repository.findUserByIdentifier(cleanId);
    if (!user && (cleanMobile || /^\d{10}$/.test(cleanId))) {
      user = await this.repository.findUserByMobile(cleanMobile || cleanId);
    }

    const expiresInSeconds = Math.floor(AUTH_CONSTANTS.OTP_EXPIRY_MS / 1000);

    // If user not found, perform dummy hash to equalize timing, and return safe generic message
    if (!user) {
      this.otpService.hashOtp('123456', this.sessionSecret);
      // Return synthetic challenge ID to avoid leaking non-existence
      return {
        challengeId: crypto.randomUUID(),
        expiresInSeconds,
        message: 'If the account is registered, a demonstration OTP challenge has been initiated.',
      };
    }

    // Check if account is active
    if (!user.isActive) {
      throw new ForbiddenProblemError('Account is deactivated. Please contact election administrators.');
    }

    // Invalidate existing active challenges for this identifier
    await this.repository.invalidateActiveChallenges(user.identifier);

    // Generate secure 6-digit OTP
    const rawOtp = this.otpService.generateSecureOtp();
    const otpHash = this.otpService.hashOtp(rawOtp, this.sessionSecret);
    const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.OTP_EXPIRY_MS);

    // Persist challenge in database
    const challenge = await this.repository.createAuthChallenge({
      identifier: user.identifier,
      otpHash,
      expiresAt,
      maxAttempts: AUTH_CONSTANTS.OTP_MAX_ATTEMPTS,
    });

    // Deliver OTP via configured provider (never exposed in normal auth responses)
    const targetMobile = user.voterProfile?.mobile || cleanMobile || user.identifier;
    try {
      const delivered = await this.otpService.deliverOtp(user.identifier, targetMobile, rawOtp);
      if (!delivered) {
        throw new ServiceUnavailableProblemError(
          'OTP delivery failed. SMS delivery provider returned failure.'
        );
      }
    } catch (err: any) {
      if (err instanceof ServiceUnavailableProblemError) {
        throw err;
      }
      throw new ServiceUnavailableProblemError(
        err?.message || 'OTP delivery is currently unavailable in this environment.'
      );
    }

    return {
      challengeId: challenge.id,
      expiresInSeconds,
      message: 'Demonstration OTP challenge initiated. Please verify with the 6-digit code.',
    };
  }

  /**
   * Verifies an OTP code and establishes an authenticated session.
   */
  async verifyOtp(
    challengeId: string,
    otpCode: string,
    userAgent?: string,
    ipAddress?: string,
    existingSessionToken?: string | null
  ): Promise<OtpVerifyResult> {
    const challenge = await this.repository.findChallengeById(challengeId);

    if (!challenge) {
      throw new UnauthorizedProblemError('Authentication challenge was not found or has expired.');
    }

    if (challenge.consumedAt !== null) {
      throw new UnauthorizedProblemError('This authentication challenge has already been used.');
    }

    if (new Date() > challenge.expiresAt) {
      throw new UnauthorizedProblemError('The authentication challenge has expired. Please request a new OTP.');
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new UnauthorizedProblemError('Maximum verification attempts exceeded. Challenge is locked.');
    }

    // Verify OTP digest in constant time
    const isMatch = this.otpService.verifyOtpHash(otpCode, challenge.otpHash, this.sessionSecret);

    if (!isMatch) {
      const updated = await this.repository.incrementChallengeAttempts(challengeId);
      const remaining = Math.max(0, updated.maxAttempts - updated.attempts);
      if (remaining === 0) {
        throw new UnauthorizedProblemError(
          `Invalid OTP code. Maximum attempts (${updated.maxAttempts}) reached. Please request a new OTP.`
        );
      }
      throw new UnauthorizedProblemError(
        `Invalid OTP code entered. ${remaining} attempt(s) remaining.`
      );
    }

    // Atomically mark challenge consumed (prevents concurrent replay)
    const consumed = await this.repository.markChallengeConsumed(challengeId);
    if (!consumed) {
      throw new UnauthorizedProblemError('This authentication challenge has already been consumed.');
    }

    // Find user record
    const user = await this.repository.findUserByIdentifier(challenge.identifier);
    if (!user) {
      throw new UnauthorizedProblemError('Account associated with this challenge could not be found.');
    }

    if (!user.isActive) {
      throw new ForbiddenProblemError('Account is deactivated.');
    }

    // Invalidate any other challenges for this identifier
    await this.repository.invalidateActiveChallenges(user.identifier);

    // Prevent session fixation by revoking any existing session held by client
    if (existingSessionToken) {
      const oldHash = this.sessionService.hashSessionToken(existingSessionToken);
      await this.repository.deleteSessionByHash(oldHash);
    }

    // Establish secure session
    const rawSessionToken = this.sessionService.generateSessionToken();
    const sessionHash = this.sessionService.hashSessionToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.SESSION_DURATION_MS);

    await this.repository.createSession({
      sessionHash,
      userId: user.id,
      expiresAt,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    });

    const csrfToken = this.sessionService.generateCsrfToken(rawSessionToken);

    return {
      user: this.toSafeUserPayload(user),
      sessionToken: rawSessionToken,
      csrfToken,
    };
  }

  /**
   * Retrieves current authenticated user profile by session token.
   */
  async authenticateSession(rawSessionToken: string): Promise<{
    user: AuthUserPayload;
    sessionHash: string;
    expiresAt: Date;
  } | null> {
    if (!rawSessionToken) return null;
    const sessionHash = this.sessionService.hashSessionToken(rawSessionToken);
    const session = await this.repository.findSessionByHash(sessionHash);

    if (!session) return null;

    const now = Date.now();
    if (now > session.expiresAt.getTime()) {
      await this.repository.deleteSessionByHash(sessionHash);
      return null;
    }

    const lastActivity = session.lastActivityAt?.getTime() ?? session.createdAt.getTime();
    if (now - lastActivity > AUTH_CONSTANTS.SESSION_INACTIVITY_TIMEOUT_MS) {
      await this.repository.deleteSessionByHash(sessionHash);
      return null;
    }

    if (!session.user.isActive) {
      return null;
    }

    if (
      session.user.userType === 'ADMIN' &&
      (!session.user.adminUser ||
        !session.user.adminUser.isActive ||
        session.user.adminUser.status !== 'ACTIVE')
    ) {
      await this.repository.deleteSessionByHash(sessionHash);
      return null;
    }

    if (now - lastActivity > AUTH_CONSTANTS.SESSION_ACTIVITY_REFRESH_INTERVAL_MS) {
      await this.repository.touchSessionActivity(sessionHash);
    }

    return {
      user: this.toSafeUserPayload(session.user),
      sessionHash,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Retrieves user profile by ID.
   */
  async getMe(userId: string): Promise<AuthUserPayload> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new NotFoundProblemError('User', userId);
    }
    return this.toSafeUserPayload(user);
  }

  /**
   * Lists active sessions for a user without exposing raw tokens.
   */
  async listUserSessions(
    userId: string,
    currentSessionHash?: string
  ): Promise<SafeSessionItem[]> {
    const sessions = await this.repository.listActiveSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      lastActivityAt: s.lastActivityAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: s.id === currentSessionHash,
    }));
  }

  /**
   * Revokes a specific session belonging to the user.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const deleted = await this.repository.deleteUserSession(userId, sessionId);
    if (!deleted) {
      throw new NotFoundProblemError('Session', sessionId);
    }
  }

  /**
   * Terminates current session (logout).
   */
  async logout(rawSessionToken: string): Promise<void> {
    if (!rawSessionToken) return;
    const sessionHash = this.sessionService.hashSessionToken(rawSessionToken);
    await this.repository.deleteSessionByHash(sessionHash);
  }

  /**
   * Revokes all active sessions for a user (logout all devices).
   */
  async logoutAll(userId: string): Promise<number> {
    return this.repository.deleteAllUserSessions(userId);
  }

  /**
   * Generates a CSRF token for the session.
   */
  getCsrfToken(rawSessionToken?: string): string {
    if (!rawSessionToken) {
      return crypto
        .createHmac('sha256', this.sessionSecret)
        .update(`anonymous_csrf_${Date.now()}`)
        .digest('hex');
    }
    return this.sessionService.generateCsrfToken(rawSessionToken);
  }
}
