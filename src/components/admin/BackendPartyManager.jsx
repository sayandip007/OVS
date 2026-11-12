import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { apiClient } from '../../services/apiClient';
import {
  ADMIN_PERMISSION_KEYS,
  hasAdminPermission,
} from '../../services/adminPermissionService';
import { Flag, Search, PlusCircle, Edit3, Eye } from 'lucide-react';

export default function BackendPartyManager() {
  const { currentAdmin, csrfToken } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const canCreate = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.PARTIES_CREATE
  );
  const canUpdate = hasAdminPermission(
    currentAdmin,
    ADMIN_PERMISSION_KEYS.PARTIES_UPDATE
  );
  const isStateAdmin = currentAdmin?.role === 'STATE_ADMIN';

  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    id: '',
    name: '',
    abbreviation: '',
    partyType: isStateAdmin ? 'STATE' : 'NATIONAL',
    symbolName: 'Demo Emblem',
    description: '',
    status: 'ACTIVE',
  });

  const loadParties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.admin.parties.list({
        page: 1,
        limit: 50,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setParties(res?.data || []);
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to load parties.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, notifyError]);

  useEffect(() => {
    loadParties();
  }, [loadParties]);

  const handleInspect = async (partyId) => {
    try {
      const res = await apiClient.admin.parties.getById(partyId);
      setSelectedParty(res?.data || null);
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Failed to load party details.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.admin.parties.update(
          editingId,
          {
            name: form.name.trim(),
            abbreviation: form.abbreviation.trim().toUpperCase(),
            partyType: form.partyType,
            symbolName: form.symbolName.trim(),
            description: form.description.trim(),
            status: form.status,
          },
          csrfToken
        );
        notifySuccess(`Updated party '${editingId}'.`);
      } else {
        await apiClient.admin.parties.create(
          {
            id: form.id.trim().toUpperCase(),
            name: form.name.trim(),
            abbreviation: form.abbreviation.trim().toUpperCase(),
            partyType: form.partyType,
            symbolName: form.symbolName.trim(),
            description: form.description.trim(),
            status: form.status,
          },
          csrfToken
        );
        notifySuccess(`Created demo party '${form.abbreviation.toUpperCase()}'.`);
      }
      setShowForm(false);
      setEditingId(null);
      await loadParties();
    } catch (err) {
      notifyError(err?.detail || err?.message || 'Party operation failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Phase 8.6 • Political Party Registry (DEMO_SAMPLE)
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5 flex items-center gap-2">
            <Flag className="w-6 h-6 text-[#002868]" />
            Political Party Management
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Synthetic demo political parties. Historical nominations preserve party
            snapshots even when party status or candidate affiliation changes.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({
                id: '',
                name: '',
                abbreviation: '',
                partyType: isStateAdmin ? 'STATE' : 'NATIONAL',
                symbolName: 'Demo Emblem',
                description: '',
                status: 'ACTIVE',
              });
              setShowForm((p) => !p);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#002868] text-white text-xs font-bold"
          >
            <PlusCircle className="w-4 h-4" />
            {showForm ? 'Close Form' : 'Register Demo Party'}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
        >
          {!editingId && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Party ID *
              </label>
              <input
                required
                placeholder="PARTY-DEMO-01"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono uppercase"
              />
            </div>
          )}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Party Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Abbreviation *
            </label>
            <input
              required
              value={form.abbreviation}
              onChange={(e) =>
                setForm({ ...form, abbreviation: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 uppercase"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Party Type
            </label>
            <select
              value={form.partyType}
              onChange={(e) => setForm({ ...form, partyType: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            >
              {!isStateAdmin && <option value="NATIONAL">NATIONAL</option>}
              <option value="STATE">STATE</option>
              <option value="INDEPENDENT">INDEPENDENT</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>
          <div className="md:col-span-3 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#002868] text-white font-bold"
            >
              {editingId ? 'Save Party Changes' : 'Create Party'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party name, code, ID..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-300"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px]">
            <tr>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Candidates / Nominations</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Loading parties...
                </td>
              </tr>
            ) : (
              parties.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">
                      {p.name} ({p.abbreviation})
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">{p.id}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{p.partyType}</td>
                  <td className="px-4 py-3 font-bold">{p.status}</td>
                  <td className="px-4 py-3">
                    {p.counts.candidates} candidates • {p.counts.nominations}{' '}
                    nominations
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleInspect(p.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 font-bold"
                    >
                      <Eye className="w-3.5 h-3.5" /> Details
                    </button>
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(p.id);
                          setForm({
                            id: p.id,
                            name: p.name,
                            abbreviation: p.abbreviation,
                            partyType: p.partyType,
                            symbolName: p.symbolName,
                            description: p.description || '',
                            status: p.status,
                          });
                          setShowForm(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 font-bold"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedParty && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-extrabold text-slate-900">
              {selectedParty.name} ({selectedParty.abbreviation})
            </h2>
            <button
              type="button"
              onClick={() => setSelectedParty(null)}
              className="text-slate-500 font-bold"
            >
              Close
            </button>
          </div>
          <p className="text-slate-600">{selectedParty.description || 'Demo party record.'}</p>
          <p className="font-bold text-slate-800">
            Associated Candidates ({selectedParty.candidates?.length || 0}):
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {(selectedParty.candidates || []).map((c) => (
              <li key={c.id}>
                {c.fullName} ({c.id}) — {c.isActive ? 'Active' : 'Inactive'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
