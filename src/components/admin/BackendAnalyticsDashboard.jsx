import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  BarChart3,
  TrendingUp,
  Download,
  ShieldAlert,
  Building2,
  Calendar,
  Users,
  Vote,
  Award,
  RefreshCw,
  FileSpreadsheet,
  FileCode,
  AlertTriangle,
} from 'lucide-react';

export default function BackendAnalyticsDashboard() {
  const { currentAdmin } = useAuth();
  const { notifyError, notifySuccess } = useNotification();

  const [activeTab, setActiveTab] = useState('national'); // national | state | election | participation | counting | audit
  const [loading, setLoading] = useState(false);

  // Data states
  const [nationalData, setNationalData] = useState(null);
  const [stateData, setStateData] = useState(null);
  const [electionData, setElectionData] = useState(null);
  const [participationData, setParticipationData] = useState(null);
  const [countingData, setCountingData] = useState(null);
  const [auditData, setAuditData] = useState(null);

  // Filters & selections
  const [selectedStateId, setSelectedStateId] = useState(currentAdmin?.assignedStateId || 'WB');
  const [selectedElectionId, setSelectedElectionId] = useState('LS-2029');
  const [exportDomain, setExportDomain] = useState('national');
  const [exportFormat, setExportFormat] = useState('csv');

  const fetchNationalOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.analytics.national();
      if (res.success && res.data) {
        setNationalData(res.data.data);
      }
    } catch (err) {
      notifyError(err.message || 'Failed to load national analytics');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  const fetchStateOverview = useCallback(async (stateId) => {
    try {
      setLoading(true);
      const res = await apiClient.admin.analytics.state(stateId);
      if (res.success && res.data) {
        setStateData(res.data.data);
      }
    } catch (err) {
      notifyError(err.message || `Failed to load analytics for state ${stateId}`);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  const fetchElectionOverview = useCallback(async (electionId) => {
    try {
      setLoading(true);
      const res = await apiClient.admin.analytics.election(electionId);
      if (res.success && res.data) {
        setElectionData(res.data.data);
      }
    } catch (err) {
      notifyError(err.message || `Failed to load analytics for election ${electionId}`);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  const fetchParticipationAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.analytics.participation();
      if (res.success && res.data) {
        setParticipationData(res.data.data);
      }
    } catch (err) {
      notifyError(err.message || 'Failed to load participation analytics');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  const fetchCountingAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.analytics.counting();
      if (res.success && res.data) {
        setCountingData(res.data.data);
      }
    } catch (err) {
      notifyError(err.message || 'Failed to load counting analytics');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  const fetchAuditAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.admin.analytics.audit();
      if (res.success && res.data) {
        setAuditData(res.data.data);
      }
    } catch (err) {
      notifyError(err.message || 'Failed to load audit activity');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    if (activeTab === 'national') fetchNationalOverview();
    else if (activeTab === 'state') fetchStateOverview(selectedStateId);
    else if (activeTab === 'election') fetchElectionOverview(selectedElectionId);
    else if (activeTab === 'participation') fetchParticipationAnalytics();
    else if (activeTab === 'counting') fetchCountingAnalytics();
    else if (activeTab === 'audit') fetchAuditAnalytics();
  }, [activeTab, selectedStateId, selectedElectionId, fetchNationalOverview, fetchStateOverview, fetchElectionOverview, fetchParticipationAnalytics, fetchCountingAnalytics, fetchAuditAnalytics]);

  const handleExport = () => {
    const query = {
      domain: exportDomain,
      format: exportFormat,
      ...(exportDomain === 'state' ? { stateId: selectedStateId } : {}),
      ...(exportDomain === 'election' ? { electionId: selectedElectionId } : {}),
    };

    const downloadUrl = apiClient.admin.analytics.exportUrl(query);
    window.open(downloadUrl, '_blank');
    notifySuccess(`Downloading ${exportDomain.toUpperCase()} ${exportFormat.toUpperCase()} report...`);
  };

  return (
    <div className="space-y-6">
      {/* Simulation Banner */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r shadow-xs">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              SIMULATED DEMO ANALYTICS & MONITORING SYSTEM
            </p>
            <p className="text-xs text-amber-700">
              All figures represent educational election simulation data. Participation metrics and synthetic counting results are logically and technically independent datasets.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'national', label: 'National Overview', icon: Building2 },
            { id: 'state', label: 'State Dashboard', icon: BarChart3 },
            { id: 'election', label: 'Election Specific', icon: Calendar },
            { id: 'participation', label: 'Voter Participation', icon: Users },
            { id: 'counting', label: 'Counting Results', icon: Award },
            { id: 'audit', label: 'Administrative Activity', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#002868] text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            if (activeTab === 'national') fetchNationalOverview();
            else if (activeTab === 'state') fetchStateOverview(selectedStateId);
            else if (activeTab === 'election') fetchElectionOverview(selectedElectionId);
            else if (activeTab === 'participation') fetchParticipationAnalytics();
            else if (activeTab === 'counting') fetchCountingAnalytics();
            else if (activeTab === 'audit') fetchAuditAnalytics();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Export Toolbar Card */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Download className="w-5 h-5 text-gray-500" />
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Secure Report & Data Export</h4>
            <p className="text-xs text-gray-500">CSV (Formula-Sanitized) & Structured JSON with Audit Trails</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={exportDomain}
            onChange={(e) => setExportDomain(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-700 focus:ring-1 focus:ring-blue-500"
          >
            <option value="national">National Overview</option>
            <option value="state">State Summary</option>
            <option value="election">Election Configuration</option>
            <option value="participation">Participation Aggregates</option>
            <option value="counting">Counting Results</option>
            <option value="audit">Audit Activity</option>
          </select>

          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-700 focus:ring-1 focus:ring-blue-500"
          >
            <option value="csv">CSV (Spreadsheet Safe)</option>
            <option value="json">JSON Document</option>
          </select>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-medium px-3.5 py-1.5 rounded-md shadow-xs transition-colors"
          >
            {exportFormat === 'csv' ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileCode className="w-3.5 h-3.5" />}
            Export Report
          </button>
        </div>
      </div>

      {/* Tab 1: National Overview */}
      {activeTab === 'national' && nationalData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Elections</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-gray-900">{nationalData.totalElections}</span>
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                  LS: {nationalData.electionsByType.lokSabha} | SA: {nationalData.electionsByType.stateAssembly}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Constituencies</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-gray-900">{nationalData.totalAssignedConstituencies.total}</span>
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                  PC: {nationalData.totalAssignedConstituencies.parliamentary} | AC: {nationalData.totalAssignedConstituencies.assembly}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Polling Window</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-green-700">{nationalData.milestoneAlerts.pollingActiveCount}</span>
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                  Live Demo Polls
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Published Results</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-purple-700">{nationalData.milestoneAlerts.publishedResultsCount}</span>
                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-medium">
                  Awaiting Review: {nationalData.milestoneAlerts.awaitingResultReviewCount}
                </span>
              </div>
            </div>
          </div>

          {/* Configuration Review Status */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Election Configuration Readiness</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <p className="text-xs text-gray-500">Draft</p>
                <p className="text-lg font-bold text-gray-800">{nationalData.configurationStatusCounts.draft}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                <p className="text-xs text-blue-600">Submitted</p>
                <p className="text-lg font-bold text-blue-800">{nationalData.configurationStatusCounts.submittedForReview}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <p className="text-xs text-amber-600">Under Review</p>
                <p className="text-lg font-bold text-amber-800">{nationalData.configurationStatusCounts.underReview}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                <p className="text-xs text-green-600">Approved</p>
                <p className="text-lg font-bold text-green-800">{nationalData.configurationStatusCounts.approved}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                <p className="text-xs text-red-600">Changes Req.</p>
                <p className="text-lg font-bold text-red-800">{nationalData.configurationStatusCounts.changesRequested}</p>
              </div>
            </div>
          </div>

          {/* State Coverage Table */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <h3 className="text-sm font-bold text-gray-800 mb-3">States Covered by Active Configurations</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">State Code</th>
                    <th className="py-2.5 px-3">State Name</th>
                    <th className="py-2.5 px-3">Configured Elections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nationalData.statesCovered.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{s.id}</td>
                      <td className="py-2.5 px-3 text-gray-700">{s.name}</td>
                      <td className="py-2.5 px-3 text-gray-700">{s.electionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: State Dashboard */}
      {activeTab === 'state' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-700">Select State Jurisdiction:</label>
            <select
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-800"
            >
              <option value="WB">West Bengal (WB)</option>
              <option value="MH">Maharashtra (MH)</option>
              <option value="DL">NCT of Delhi (DL)</option>
            </select>
          </div>

          {stateData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase">State Assembly Seats</span>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{stateData.assemblyConstituenciesCount}</p>
                  <span className="text-xs text-gray-500">Parliamentary: {stateData.parliamentaryConstituenciesCount}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Approved Nominations</span>
                  <p className="mt-2 text-2xl font-bold text-blue-700">{stateData.approvedNominationsCount}</p>
                  <span className="text-xs text-gray-500">Active Parties: {stateData.activePartiesCount}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Demo Participations</span>
                  <p className="mt-2 text-2xl font-bold text-green-700">{stateData.participationSummary.totalParticipated}</p>
                  <span className="text-xs text-gray-500">
                    Simulated Rate: {stateData.participationSummary.simulatedRatePercentage !== null ? `${stateData.participationSummary.simulatedRatePercentage}%` : 'N/A'}
                  </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Published Results</span>
                  <p className="mt-2 text-2xl font-bold text-purple-700">{stateData.countingSummary.publishedSessions}</p>
                  <span className="text-xs text-gray-500">Total Sessions: {stateData.countingSummary.totalSessions}</span>
                </div>
              </div>

              {/* Elections in state */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Elections in State Jurisdiction</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3">Election ID</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Constituencies</th>
                        <th className="py-2 px-3">Review Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stateData.elections.map((e) => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{e.id}</td>
                          <td className="py-2.5 px-3 text-gray-700">{e.name}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${e.type === 'LOK_SABHA' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {e.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-600">{e.status}</td>
                          <td className="py-2.5 px-3 text-gray-600">{e.constituenciesCount}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                              {e.configReviewStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Election-Specific */}
      {activeTab === 'election' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-700">Select Election Target:</label>
            <select
              value={selectedElectionId}
              onChange={(e) => setSelectedElectionId(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-800"
            >
              <option value="LS-2029">General Parliamentary Elections 2029 (LS-2029)</option>
              <option value="WB-ASSEMBLY-2029">West Bengal Legislative Assembly 2029</option>
              <option value="MH-ASSEMBLY-2029">Maharashtra Legislative Assembly 2029</option>
              <option value="DL-ASSEMBLY-2029">Delhi Legislative Assembly 2029</option>
            </select>
          </div>

          {electionData && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{electionData.election.name}</h3>
                    <p className="text-xs text-gray-500">ID: {electionData.election.id} | Year: {electionData.election.year}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md font-semibold">
                      {electionData.election.status}
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md font-semibold">
                      Config: {electionData.election.configReviewStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                  <div>
                    <span className="text-gray-500">Polling Dates:</span>
                    <p className="font-semibold text-gray-800">{electionData.election.pollingStartDate.slice(0, 10)} to {electionData.election.pollingEndDate.slice(0, 10)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Counting Date:</span>
                    <p className="font-semibold text-gray-800">{electionData.election.countingDate.slice(0, 10)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Constituencies:</span>
                    <p className="font-semibold text-gray-800">{electionData.constituenciesSummary.totalAssigned} ({electionData.constituenciesSummary.type})</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Candidates:</span>
                    <p className="font-semibold text-gray-800">{electionData.candidateAndPartySummary.totalCandidates} ({electionData.candidateAndPartySummary.participatingPartiesCount} Parties)</p>
                  </div>
                </div>
              </div>

              {/* Constituency Breakdown Table */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <h4 className="text-sm font-bold text-gray-800 mb-3">Assigned Constituencies Status</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                      <tr>
                        <th className="py-2 px-3">Constituency</th>
                        <th className="py-2 px-3">State</th>
                        <th className="py-2 px-3">Candidates</th>
                        <th className="py-2 px-3">Simulated Turnout</th>
                        <th className="py-2 px-3">Counting Status</th>
                        <th className="py-2 px-3">Published</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {electionData.constituenciesSummary.constituencies.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{c.name} ({c.id})</td>
                          <td className="py-2.5 px-3 text-gray-600">{c.stateName || 'N/A'}</td>
                          <td className="py-2.5 px-3 text-gray-800">{c.candidatesCount}</td>
                          <td className="py-2.5 px-3 text-gray-800">{c.participationCount}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {c.countingStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {c.isPublished ? 'YES' : 'NO'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Voter Participation (Strict Privacy) */}
      {activeTab === 'participation' && participationData && (
        <div className="space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r shadow-xs">
            <h4 className="text-sm font-bold text-blue-900">ZERO CANDIDATE-CHOICE PRIVACY INVARIANT</h4>
            <p className="text-xs text-blue-800 mt-1">
              Participation analytics are strictly aggregate voter turnout counts. Candidate choices are never recorded or stored on the server and cannot be derived from these records.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Total Participating Accounts</span>
              <p className="mt-2 text-2xl font-bold text-gray-900">{participationData.totalParticipatingDemoAccounts}</p>
              <span className="text-xs text-gray-500">Eligible Registered Accounts: {participationData.totalEligibleDemoAccounts}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Demo Account Participation Rate</span>
              <p className="mt-2 text-2xl font-bold text-indigo-700">
                {participationData.demoParticipationRatePercentage !== null ? `${participationData.demoParticipationRatePercentage}%` : 'N/A'}
              </p>
              <span className="text-xs text-gray-500">Educational demo accounts only</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Participation by Election Type</span>
              <p className="mt-2 text-sm font-semibold text-gray-800">
                Lok Sabha: {participationData.participationByType.lokSabha} | Assembly: {participationData.participationByType.stateAssembly}
              </p>
            </div>
          </div>

          {/* Constituency Level Aggregates with Minimum Group Suppression */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <h4 className="text-sm font-bold text-gray-800 mb-3">Constituency-Level Participation Aggregates</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Constituency</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">State</th>
                    <th className="py-2 px-3">Simulated Participation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {participationData.participationByConstituency.map((c) => (
                    <tr key={c.constituencyId} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{c.constituencyName}</td>
                      <td className="py-2.5 px-3 text-gray-600">{c.constituencyType}</td>
                      <td className="py-2.5 px-3 text-gray-600">{c.stateId || 'N/A'}</td>
                      <td className="py-2.5 px-3">
                        {c.suppressedDueToPrivacyThreshold ? (
                          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono">
                            &lt; 5 (Privacy Masked)
                          </span>
                        ) : (
                          <span className="font-semibold text-gray-900">{c.participatedCount}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Independent Synthetic Counting Results */}
      {activeTab === 'counting' && countingData && (
        <div className="space-y-6">
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r shadow-xs">
            <h4 className="text-sm font-bold text-purple-900">INDEPENDENT SYNTHETIC COUNTING DATASET</h4>
            <p className="text-xs text-purple-800 mt-1">
              Synthetic tallies are generated and reconciled independently of voter participation. Candidate choices are never tallied from voter participation records.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Published Results</span>
              <p className="mt-2 text-2xl font-bold text-green-700">{countingData.publishedSessionsCount}</p>
              <span className="text-xs text-gray-500">Total Sessions: {countingData.totalCountingSessions}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Review Pending</span>
              <p className="mt-2 text-2xl font-bold text-amber-700">{countingData.sessionsReadyForReviewCount}</p>
              <span className="text-xs text-gray-500">Under Review: {countingData.sessionsUnderReviewCount}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Tied Sessions</span>
              <p className="mt-2 text-2xl font-bold text-red-700">{countingData.tiedSessionsCount}</p>
              <span className="text-xs text-gray-500">Resolved Ties: {countingData.resolvedTiesCount}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Total Simulated Votes</span>
              <p className="mt-2 text-2xl font-bold text-gray-900">{(countingData.totalSimulatedVotesCounted).toLocaleString()}</p>
              <span className="text-xs text-gray-500">NOTA: {countingData.totalSimulatedNotaVotes.toLocaleString()}</span>
            </div>
          </div>

          {/* Certified Published Winners Table */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <h4 className="text-sm font-bold text-gray-800 mb-3">Certified Published Results</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Constituency</th>
                    <th className="py-2 px-3">Declared Winner</th>
                    <th className="py-2 px-3">Party</th>
                    <th className="py-2 px-3">Simulated Votes</th>
                    <th className="py-2 px-3">Victory Margin</th>
                    <th className="py-2 px-3">Published At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {countingData.publishedWinners.map((w) => (
                    <tr key={w.sessionId} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{w.constituencyName}</td>
                      <td className="py-2.5 px-3 font-medium text-emerald-800">{w.winnerCandidateName}</td>
                      <td className="py-2.5 px-3 text-gray-700">{w.winnerPartyName}</td>
                      <td className="py-2.5 px-3 text-gray-900 font-mono">{w.totalVotes.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-gray-900 font-mono">+{w.victoryMargin.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-gray-500">{w.publishedAt ? w.publishedAt.slice(0, 16) : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Administrative Activity */}
      {activeTab === 'audit' && auditData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Total Operations Logged</span>
              <p className="mt-2 text-2xl font-bold text-gray-900">{auditData.totalActionsLogged}</p>
              <span className="text-xs text-green-700 font-medium">Successful: {auditData.actionsByOutcome.success}</span>
              <span className="text-xs text-red-600 ml-3 font-medium">Failed: {auditData.actionsByOutcome.failure}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-xs font-semibold text-gray-500 uppercase">Activity by Admin Role</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(auditData.actionsByRole).map(([role, count]) => (
                  <span key={role} className="text-xs bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md font-medium">
                    {role}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <h4 className="text-sm font-bold text-gray-800 mb-3">Recent Administrative Activity Log</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Officer Code / User</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3">Domain</th>
                    <th className="py-2 px-3">Action Type</th>
                    <th className="py-2 px-3">Target</th>
                    <th className="py-2 px-3">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditData.recentActivity.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 font-mono text-[11px]">
                      <td className="py-2 px-3 text-gray-500">{log.timestamp.slice(0, 19)}</td>
                      <td className="py-2 px-3 font-semibold text-gray-900">{log.actorIdentifier}</td>
                      <td className="py-2 px-3 text-gray-600">{log.actorRole || 'N/A'}</td>
                      <td className="py-2 px-3 text-gray-800">{log.domain}</td>
                      <td className="py-2 px-3 text-indigo-700 font-medium">{log.actionType}</td>
                      <td className="py-2 px-3 text-gray-600">{log.targetEntityId}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded font-bold ${log.outcome === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {log.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
