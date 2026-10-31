import React, { useState, useMemo } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import SearchBar from '../../components/common/SearchBar';
import Modal from '../../components/common/Modal';
import { Eye, ShieldCheck, Lock } from 'lucide-react';

function maskPhoneNumber(mobile) {
  if (!mobile || mobile.length < 4) return '**********';
  return `${mobile.slice(0, 2)}******${mobile.slice(-2)}`;
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '****@demo.in';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}****@${domain}`;
}

export default function VoterManagement() {
  const {
    voters = [],
    states = [],
    districts = [],
    constituencies = [],
    elections = [],
    participationRecords = [],
    updateVoterProfile,
    appendAuditLog,
  } = useElection();
  const { currentAdmin, canPerformAdminAction } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState(
    currentAdmin?.assignedStateId || 'ALL'
  );
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [inspectedVoter, setInspectedVoter] = useState(null);

  const availableDistricts = useMemo(() => {
    if (stateFilter === 'ALL') return districts;
    return districts.filter((d) => d.stateId === stateFilter);
  }, [districts, stateFilter]);

  const filteredVoters = useMemo(() => {
    return voters.filter((v) => {
      if (stateFilter !== 'ALL' && v.stateId !== stateFilter) return false;
      if (districtFilter !== 'ALL' && v.districtId !== districtFilter)
        return false;
      const acctStatus = v.accountStatus || 'VERIFIED_DEMO';
      if (statusFilter !== 'ALL' && acctStatus !== statusFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const pc = constituencies.find(
          (c) => c.constituencyId === v.parliamentaryConstituencyId
        );
        const ac = constituencies.find(
          (c) => c.constituencyId === v.assemblyConstituencyId
        );
        return (
          v.fullName.toLowerCase().includes(q) ||
          (v.voterRef || '').toLowerCase().includes(q) ||
          (pc?.name || '').toLowerCase().includes(q) ||
          (ac?.name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [voters, stateFilter, districtFilter, statusFilter, search, constituencies]);

  const handleToggleAccountStatus = (voter) => {
    const perm = canPerformAdminAction('MANAGE_VOTER', {
      stateId: voter.stateId,
    });
    if (!perm.allowed) {
      notifyError(perm.reason);
      return;
    }

    const currentStatus = voter.accountStatus || 'VERIFIED_DEMO';
    const nextStatus =
      currentStatus === 'INACTIVE' ? 'VERIFIED_DEMO' : 'INACTIVE';

    const res = updateVoterProfile(voter.id || voter.voterId, {
      accountStatus: nextStatus,
      isActive: nextStatus !== 'INACTIVE',
    });

    if (res.ok) {
      appendAuditLog({
        adminUser: currentAdmin,
        actionType: 'UPDATE_VOTER_ACCOUNT_STATUS',
        targetEntity: 'VOTER',
        targetId: voter.voterRef,
        summary: `Changed demo voter ${voter.voterRef} account status to ${nextStatus}.`,
      });
      notifySuccess(
        `Voter ${voter.fullName} (${voter.voterRef}) marked as ${nextStatus}.`
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
              Electoral Roll &amp; Ballot Secrecy Protection
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              Demo Voter Registry &amp; Constituency Mapping ({voters.length})
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Inspect voter electoral roll mappings and independent participation status. Ballot choices, candidate/party selections, and OTPs are cryptographically separated and never visible to administrators.
            </p>
          </div>
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Ballot Secrecy Active:</strong> Only participation status (VOTED / NOT_VOTED) is stored.
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search name, EPIC ref, or constituency..."
          />
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value);
              setDistrictFilter('ALL');
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All States &amp; UTs</option>
            {states.map((st) => (
              <option key={st.stateId} value={st.stateId}>
                {st.stateName} ({st.stateId})
              </option>
            ))}
          </select>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Districts</option>
            {availableDistricts.map((d) => (
              <option key={d.districtId} value={d.districtId}>
                {d.districtName} ({d.stateId})
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Account Statuses</option>
            <option value="VERIFIED_DEMO">VERIFIED_DEMO</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Voters Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4">EPIC / Ref</th>
                <th className="py-3 px-4">Voter Name &amp; Contact (Masked)</th>
                <th className="py-3 px-4">State &amp; District</th>
                <th className="py-3 px-4">Parliamentary (PC)</th>
                <th className="py-3 px-4">Assembly (AC)</th>
                <th className="py-3 px-4">Participation Status</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVoters.map((voter) => {
                const voterId = voter.id || voter.voterId;
                const pc = constituencies.find(
                  (c) => c.constituencyId === voter.parliamentaryConstituencyId
                );
                const ac = constituencies.find(
                  (c) => c.constituencyId === voter.assemblyConstituencyId
                );
                const voterRecs = participationRecords.filter(
                  (r) =>
                    (r.voterId === voterId || r.voterRef === voter.voterRef) &&
                    r.status === 'VOTED'
                );
                const acctStatus = voter.accountStatus || 'VERIFIED_DEMO';

                return (
                  <tr key={voterId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-[#002868]">
                      {voter.voterRef}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{voter.fullName}</p>
                      <span className="text-[11px] font-mono text-slate-500">
                        +91-{maskPhoneNumber(voter.mobile)} • {maskEmail(voter.email)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800">{voter.stateId}</span>
                      <span className="block text-[10px] text-slate-500">
                        {voter.districtId}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-indigo-950">
                        {pc?.name || voter.parliamentaryConstituencyId}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-teal-950">
                        {ac?.name || voter.assemblyConstituencyId}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {voterRecs.length === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                          0 Votes Cast
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {voterRecs.map((r) => (
                            <span
                              key={r.electionId}
                              className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono"
                            >
                              {r.electionId}: VOTED
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          acctStatus === 'INACTIVE'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {acctStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectedVoter(voter)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAccountStatus(voter)}
                          className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                        >
                          {acctStatus === 'INACTIVE' ? 'Activate' : 'Deactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voter Detail & Participation Status Modal */}
      <Modal
        isOpen={Boolean(inspectedVoter)}
        onClose={() => setInspectedVoter(null)}
        title={
          inspectedVoter
            ? `Voter Roll Inspection: ${inspectedVoter.fullName}`
            : ''
        }
        subtitle={
          inspectedVoter ? `EPIC Reference: ${inspectedVoter.voterRef}` : ''
        }
      >
        {inspectedVoter && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  State / District
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {inspectedVoter.stateId} • {inspectedVoter.districtId}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Masked Contact
                </p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">
                  +91-{maskPhoneNumber(inspectedVoter.mobile)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-indigo-700">
                  Parliamentary Constituency (PC)
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {inspectedVoter.parliamentaryConstituencyId}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-teal-700">
                  Assembly Constituency (AC)
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {inspectedVoter.assemblyConstituencyId}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                Eligible Elections &amp; Participation Status Only
              </p>
              {elections
                .filter(
                  (el) =>
                    el.electionType === 'LOK_SABHA' ||
                    (el.electionType === 'STATE_ASSEMBLY' &&
                      el.stateId === inspectedVoter.stateId)
                )
                .map((el) => {
                  const rec = participationRecords.find(
                    (r) =>
                      (r.voterId === (inspectedVoter.id || inspectedVoter.voterId) ||
                        r.voterRef === inspectedVoter.voterRef) &&
                      r.electionId === el.electionId &&
                      r.status === 'VOTED'
                  );

                  return (
                    <div
                      key={el.electionId}
                      className="p-3 rounded-xl border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{el.title}</p>
                        <span className="text-[11px] font-mono text-slate-500">
                          {el.electionId} ({el.electionType})
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            rec
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rec ? 'VOTED' : 'NOT_VOTED'}
                        </span>
                        {rec && (
                          <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                            Ref: {rec.referenceId}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-[#002868] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                Zero Ballot Linkage: Candidate or NOTA selections are never stored in voter participation records.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
