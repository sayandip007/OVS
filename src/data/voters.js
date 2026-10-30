import { defaultAvatar } from '../assets';
import { METADATA_SOURCES } from '../utils/constants';

/**
 * Demo Voter Profiles.
 * Each voter has TWO independent constituency associations:
 * 1. parliamentaryConstituencyId (PARLIAMENTARY)
 * 2. assemblyConstituencyId (ASSEMBLY)
 *
 * And an independent `elections` participation dictionary that NEVER stores
 * which candidate was selected (preserving ballot secrecy).
 */
export const INITIAL_VOTERS = [
  {
    id: 'VOTER-001',
    fullName: 'Aarav Sen',
    dob: '1994-05-14',
    epicRef: 'WBX1234567',
    legacyLoginId: '1234', // Preserves backward-compatible 1234 login
    stateId: 'WB',
    districtId: 'NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    email: 'aarav.sen@example.com',
    mobile: '9876543210',
    address: '14 College Street, Ward 8, Krishnanagar, Nadia, West Bengal - 741101',
    avatar: defaultAvatar,
    elections: {
      'LS-2029': { status: 'PENDING' },
      'WB-ASSEMBLY-2029': { status: 'PENDING' },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'VOTER-002',
    fullName: 'Priya Sharma',
    dob: '1991-11-22',
    epicRef: 'DLX7654321',
    legacyLoginId: '5678',
    stateId: 'DL',
    districtId: 'DL-DIST-NEW-DELHI',
    parliamentaryConstituencyId: 'DL-PC-NEW-DELHI',
    assemblyConstituencyId: 'DL-AC-NEW-DELHI',
    email: 'priya.sharma@example.com',
    mobile: '9811122233',
    address: '42 Hanuman Road, Connaught Place, New Delhi - 110001',
    avatar: defaultAvatar,
    elections: {
      'LS-2029': { status: 'PENDING' },
      'DL-ASSEMBLY-2029': { status: 'PENDING' },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
  {
    id: 'VOTER-003',
    fullName: 'Ananya Chatterjee',
    dob: '1988-08-03',
    epicRef: 'WBX9988776',
    legacyLoginId: '9988',
    stateId: 'WB',
    districtId: 'NADIA',
    parliamentaryConstituencyId: 'WB-PC-KRISHNANAGAR',
    assemblyConstituencyId: 'WB-AC-KRISHNANAGAR-UTTAR',
    email: 'ananya.c@example.com',
    mobile: '9830011223',
    address: '78 Ghurni Main Road, Krishnanagar, Nadia, West Bengal - 741103',
    avatar: defaultAvatar,
    elections: {
      'LS-2029': { status: 'VOTED', participatedAt: '2026-10-29T11:20:00.000Z' },
      'WB-ASSEMBLY-2029': { status: 'PENDING' },
    },
    metadataSource: METADATA_SOURCES.DEMO_SAMPLE,
  },
];

export const INITIAL_ADMIN_OFFICERS = [
  {
    id: 'ECI-ADMIN-001',
    name: 'Dr. R. K. Senapati (Chief Returning Officer - Demo)',
    officerId: '1234',
    altOfficerId: 'ECI001',
    mobile: '9876543210',
    designation: 'Election Commission Demonstration Administrator',
    role: 'ADMIN',
  },
];
