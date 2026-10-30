import React from 'react';
import { MapPin, Building2, Users } from 'lucide-react';
import { CONSTITUENCY_TYPES } from '../../utils/constants';

export default function ConstituencyCard({
  constituency,
  stateName,
  districtNames = [],
  parentParliamentaryName,
  candidateCount = 0,
  onSelect,
}) {
  const isParliamentary =
    constituency.type === CONSTITUENCY_TYPES.PARLIAMENTARY;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
          <span className="font-semibold text-[#004d99]">
            {isParliamentary
              ? 'Parliamentary Constituency (Lok Sabha)'
              : 'Assembly Constituency (Vidhan Sabha)'}
          </span>
          <span className="font-mono text-slate-600">{constituency.id}</span>
        </div>

        <h3 className="text-base font-bold text-slate-900">
          {constituency.name}
        </h3>

        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
          <p className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              <strong className="text-slate-800">State / UT:</strong>{' '}
              {stateName || constituency.stateId}
            </span>
          </p>
          {districtNames.length > 0 && (
            <p className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                <strong className="text-slate-800">District(s):</strong>{' '}
                {districtNames.join(', ')}
              </span>
            </p>
          )}
          {!isParliamentary && parentParliamentaryName && (
            <p className="text-slate-600">
              <strong className="text-slate-800">Parent Lok Sabha PC:</strong>{' '}
              {parentParliamentaryName}
            </p>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 text-slate-600 tabular-nums">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          {candidateCount} Registered Candidate(s)
        </span>
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(constituency)}
            className="font-semibold text-[#004d99] hover:underline cursor-pointer"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
