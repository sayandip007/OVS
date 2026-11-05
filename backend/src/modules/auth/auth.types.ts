import type { Request } from 'express';
import type { UserType, MetadataSource, AdminRole } from '@prisma/client';

export interface SafeVoterProfile {
  id: string;
  epicNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  email: string;
  address: string;
  pinCode: string;
  stateId: string;
  districtId: string;
  parliamentaryConstituencyId: string;
  assemblyConstituencyId: string;
  registrationDate: string;
  isVerified: boolean;
  metadataSource: MetadataSource;
}

export interface SafeAdminUser {
  id: string;
  officerCode: string;
  fullName: string;
  role: AdminRole;
  assignedStateId: string | null;
}

export interface AuthUserPayload {
  id: string;
  identifier: string;
  userType: UserType;
  isActive: boolean;
  voterProfile: SafeVoterProfile | null;
  adminUser: SafeAdminUser | null;
}

export interface SessionData {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface SafeSessionItem {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface RegisterVoterInput {
  epicNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  email: string;
  address: string;
  pinCode: string;
  stateId: string;
  districtId: string;
  parliamentaryConstituencyId: string;
  assemblyConstituencyId: string;
}

export interface OtpChallengeResult {
  challengeId: string;
  expiresInSeconds: number;
  message: string;
  // Dev-only field, strictly omitted in production
  devCode?: string;
}

export interface OtpVerifyResult {
  user: AuthUserPayload;
  sessionToken: string;
  csrfToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
  sessionId?: string;
  sessionToken?: string;
  csrfToken?: string;
}

