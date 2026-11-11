import type { Request } from 'express';
import type {
  UserType,
  MetadataSource,
  AdminRole,
  AdminStatus,
  ConstituencyType,
} from '@prisma/client';

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
  state?: { id: string; code: string; name: string; type: string };
  district?: { id: string; stateId: string; name: string };
  parliamentaryConstituency?: { id: string; stateId: string; name: string };
  assemblyConstituency?: { id: string; stateId: string; districtId: string; name: string };
}

export interface SafeAdminConstituencyScope {
  id: string;
  electionId: string | null;
  constituencyType: ConstituencyType;
  parliamentaryConstituencyId: string | null;
  assemblyConstituencyId: string | null;
}

export interface SafeAdminUser {
  id: string;
  userId: string;
  officerCode: string;
  email: string;
  fullName: string;
  designation: string;
  role: AdminRole;
  status: AdminStatus;
  isActive: boolean;
  assignedStateId: string | null;
  assignedStateIds: string[];
  assignedElectionIds: string[];
  assignedConstituencyScopes: SafeAdminConstituencyScope[];
}

export interface AuthUserPayload {
  id: string;
  identifier: string;
  userType: UserType;
  role: 'VOTER' | AdminRole;
  isActive: boolean;
  voterProfile: SafeVoterProfile | null;
  adminUser: SafeAdminUser | null;
}

export interface SessionData {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface SafeSessionItem {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActivityAt: string;
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
}

export interface OtpVerifyResult {
  user: AuthUserPayload;
  sessionToken: string;
  csrfToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
  adminUser?: SafeAdminUser;
  adminPermissions?: string[];
  sessionId?: string;
  sessionToken?: string;
  csrfToken?: string;
}
