import React, { useState, useMemo, useEffect } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import SearchBar from '../../components/common/SearchBar';
import { ADMIN_ROLE_LABELS } from '../../utils/constants';
import { escapeCsvCell, triggerCsvDownload } from '../../services/countingService';
import { FileText, ShieldCheck, Download } from 'lucide-react';

export default function AuditLogs() {
  const { auditLogs: localAuditLogs } = useElection();
  const { isBackendApiMode } = useAuth();
  const [backendLogs, setBackendLogs] = useState([]);

  useEffect(() => {
    if (!isBackendApiMode) return undefined;
    let cancelled = false;
    apiClient.admin
      .listAuditLogs({ limit: 100 })
      .then((res) => {
        if (!cancelled && Array.isArray(res?.data)) {
          setBackendLogs(
            res.data.map((item) => ({
              id: item.id,
              timestamp: item.timestamp,
              adminName: item.adminUser?.fullName || item.actorIdentifier || 'System',
              adminRole: item.actorRole || item.adminUser?.role || 'SYSTEM',
              actionType: item.actionType,
              targetEntity: item.domain,
              targetId: item.targetEntityId,
              summary: `${item.outcome}: ${JSON.stringify(item.details || {})}`,
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isBackendApiMode]);

  const auditLogs = isBackendApiMode ? backendLogs : localAuditLogs;

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  const uniqueEntities = useMemo(() => {
    const set = new Set(auditLogs.map((l) => l.targetEntity).filter(Boolean));
    return Array.from(set);
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (roleFilter !== 'ALL' && log.adminRole !== roleFilter) return false;
      if (entityFilter !== 'ALL' && log.targetEntity !== entityFilter)
        return false;
      if (dateFilter && !(log.timestamp || '').startsWith(dateFilter)) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          (log.actionType || '').toLowerCase().includes(q) ||
          (log.summary || '').toLowerCase().includes(q) ||
          (log.targetId || '').toLowerCase().includes(q) ||
          (log.adminName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, roleFilter, entityFilter, dateFilter, search]);

  const handleExportAuditCsv = () => {
    const headers = [
      'DataClassification',
      'LogId',
      'Timestamp',
      'AdminName',
      'AdminRole',
      'ActionType',
      'TargetEntity',
      'TargetId',
      'Summary',
    ];
    const rows = filteredLogs.map((l) => [
      'DEMONSTRATION_AUDIT_LOG',
      l.id,
      l.timestamp,
      l.adminName,
      l.adminRole,
      l.actionType,
      l.targetEntity,
      l.targetId,
      l.summary,
    ]);
    const csv = [
      '# DEMONSTRATION AUDIT LOGS — SANITIZED ADMINISTRATIVE EVENTS ONLY',
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) => r.map(escapeCsvCell).join(',')),
    ].join('\n');
    triggerCsvDownload(
      `ovs-demo-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      csv
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-[#002868]" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
                Append-Only Administrative Ledger
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                Administrative Audit Logs ({auditLogs.length})
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Chronological trail of all administrative actions across elections, constituencies, candidates, schedules, announcements, and results.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                <strong>Sanitized &amp; Append-Only:</strong> Never stores ballot selections, OTPs, or secrets.
              </span>
            </div>
            <button
              type="button"
              onClick={handleExportAuditCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Audit CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search action, summary, target ID..."
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Admin Roles</option>
            {Object.entries(ADMIN_ROLE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label} ({k})
              </option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="ALL">All Target Entities</option>
            {uniqueEntities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                <th className="py-3 px-4">Log ID &amp; Timestamp</th>
                <th className="py-3 px-4">Admin Officer &amp; Role</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Target Entity / ID</th>
                <th className="py-3 px-4">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-900">
                      {log.id}
                    </span>
                    <span className="block text-[11px] font-mono text-slate-500">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{log.adminName}</p>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#002868] font-mono text-[10px] font-bold">
                      {log.adminRole}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[11px]">
                      {log.actionType}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <span className="font-bold text-slate-700">
                      {log.targetEntity}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {log.targetId}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
