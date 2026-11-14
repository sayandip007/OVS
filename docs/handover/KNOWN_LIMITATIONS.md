# OVS Known Limitations & Non-Production Simplifications

**System:** Online Voting System (OVS)  
**Version:** Release Candidate (Phase 8.15)  

---

## 1. Intentional Non-Production Simplifications

### 1. Simulated Identity Verification
- **Current Architecture:** Generates synthetic 6-digit numeric OTPs stored in memory / local database (`DevelopmentOtpProvider`).
- **Limitation:** Does not integrate with government SMS gateways (e.g., NIC/CDAC SMS API) or official identity registries (such as Aadhaar e-KYC or NVSP APIs).
- **Justification:** OVS is strictly an educational election-system prototype. Real voter PII and biometric identity integrations are intentionally excluded.

### 2. Volatile Client Ballot & Independent Counting
- **Current Architecture:** To guarantee secret ballot preservation, the backend never receives or stores candidate choices. Counting sessions use independently generated synthetic tallies.
- **Limitation:** In a real-world electronic voting system, cryptographic end-to-end verifiability (E2E-V) using homomorphic encryption (e.g., Paillier or ElGamal) and zero-knowledge proofs (ZKP) would allow mathematically tallying encrypted ballots without exposing individual choices.
- **Justification:** Implementing full homomorphic mix-nets and multi-party computation was out of scope for the current RESTful prototype.

### 3. Local In-Memory Locks in Testing
- **Current Architecture:** Test suites run using Node.js mock clocks and in-memory rate limiting when Redis is unavailable.
- **Limitation:** Multi-node cluster deployments require dedicated Redis instances for distributed rate limiting and advisory session locks.

---

## 2. Recommended Future Enhancements (Post-Handover)

1. **Cryptographic End-to-End Verifiability (E2E-V):** Integrate verifiable mix-nets or homomorphic vote encryption to demonstrate mathematically verifiable tallying.
2. **Hardware Security Module (HSM) Integration:** Support PKCS#11 or cloud KMS for signing election result certificates.
3. **Multi-Language Content Dynamic Translation:** Extend feature flags to support full UI localization across all 22 Eighth Schedule Indian languages.
4. **Voter Verifiable Paper Audit Trail (VVPAT) Visualizer:** Add an interactive animated slip printer simulation on the voter confirmation screen.
