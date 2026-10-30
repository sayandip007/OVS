import React, { useState } from 'react';
import { useElection } from '../../context/ElectionContext';
import { useNotification } from '../../context/NotificationContext';
import { PARTY_SYMBOL_OPTIONS } from '../../assets';

export default function PartyManagement() {
  const { parties, upsertParty } = useElection();
  const { notifySuccess, notifyError } = useNotification();

  const [form, setForm] = useState({
    partyId: '',
    partyName: '',
    abbreviation: '',
    partyType: 'STATE',
    symbolName: PARTY_SYMBOL_OPTIONS[0].name,
    symbolUrl: PARTY_SYMBOL_OPTIONS[0].src,
    status: 'ACTIVE',
  });

  const handleSymbolChange = (symbolLabel) => {
    const found =
      PARTY_SYMBOL_OPTIONS.find((s) => s.label === symbolLabel) ||
      PARTY_SYMBOL_OPTIONS[0];
    setForm((prev) => ({
      ...prev,
      symbolName: found.name,
      symbolUrl: found.src,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.partyName.trim() || !form.abbreviation.trim()) {
      notifyError('Party Name and Abbreviation are required.');
      return;
    }

    const saved = upsertParty({
      ...form,
      partyId:
        form.partyId ||
        `PARTY-${form.abbreviation.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
    });

    notifySuccess(`Saved political party: ${saved.partyName} (${saved.abbreviation})`);
    setForm({
      partyId: '',
      partyName: '',
      abbreviation: '',
      partyType: 'STATE',
      symbolName: PARTY_SYMBOL_OPTIONS[0].name,
      symbolUrl: PARTY_SYMBOL_OPTIONS[0].src,
      status: 'ACTIVE',
    });
  };

  const toggleStatus = (party) => {
    const nextStatus = party.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    upsertParty({ ...party, status: nextStatus });
    notifySuccess(`${party.partyName} status changed to ${nextStatus}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#002868]">
            Election Symbols &amp; Party Registry
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Political Parties Management ({parties.length})
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-200 items-end"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Party Name *
            </label>
            <input
              type="text"
              required
              value={form.partyName}
              onChange={(e) => setForm({ ...form, partyName: e.target.value })}
              placeholder="e.g. Bharatiya Pragati Dal"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Abbreviation *
            </label>
            <input
              type="text"
              required
              value={form.abbreviation}
              onChange={(e) =>
                setForm({ ...form, abbreviation: e.target.value.toUpperCase() })
              }
              placeholder="e.g. BPD"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Recognition Type
            </label>
            <select
              value={form.partyType}
              onChange={(e) => setForm({ ...form, partyType: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="NATIONAL">NATIONAL</option>
              <option value="STATE">STATE</option>
              <option value="UNRECOGNISED">UNRECOGNISED</option>
              <option value="INDEPENDENT">INDEPENDENT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Allocated Symbol Asset
            </label>
            <select
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {PARTY_SYMBOL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label} — {opt.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            {form.partyId ? 'Update Party' : '+ Register Party'}
          </button>
        </form>
      </div>

      {/* Parties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {parties.map((party) => (
          <div
            key={party.partyId}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <img
                src={party.symbolUrl}
                alt={party.abbreviation}
                className="w-14 h-14 rounded-xl object-contain border border-slate-200 p-1.5 bg-slate-50"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-[#002868] text-[10px] font-bold">
                    {party.partyType}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      party.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {party.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  {party.partyName} ({party.abbreviation})
                </h3>
                <p className="text-xs text-slate-500">Symbol: {party.symbolName}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setForm(party)}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => toggleStatus(party)}
                className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 cursor-pointer"
              >
                {party.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
