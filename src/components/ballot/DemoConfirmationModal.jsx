import React from 'react';
import Modal from '../common/Modal';
import { ELECTION_TYPES } from '../../utils/constants';

/**
 * Final Confirmation Dialog before completing demo participation.
 * Clearly labels the action as "Complete demo participation" and explains
 * that no real election vote is being cast.
 */
export default function DemoConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  election,
  constituency,
}) {
  if (!election) return null;

  const isLokSabha =
    (election.type || election.electionType) === ELECTION_TYPES.LOK_SABHA;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Demonstration Participation"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            data-testid="cancel-demo-participation-btn"
            className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="complete-demo-participation-btn"
            className="px-5 py-2 rounded-lg bg-[#138808] hover:bg-emerald-800 text-white text-xs font-extrabold cursor-pointer"
          >
            Complete demo participation
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs" data-testid="demo-confirmation-modal">
        <div className="p-4 rounded-xl bg-slate-900 text-white space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
            {isLokSabha
              ? 'Lok Sabha General Election (PARLIAMENTARY)'
              : 'State Legislative Assembly Election (ASSEMBLY)'}
          </span>
          <h4 className="text-base font-extrabold">
            {election.name || election.title}
          </h4>
          <p className="text-slate-300">
            Constituency: {constituency?.name || 'Mapped Constituency'} (
            {constituency?.code || constituency?.id || 'N/A'})
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
          <strong className="block">Simulation Disclaimer:</strong>
          <p className="leading-relaxed">
            No real election vote is being cast. Confirming this interaction will:
          </p>
          <ul className="list-disc pl-4 space-y-1 pt-1">
            <li>
              Update your demonstration participation status to{' '}
              <code className="font-mono font-bold">VOTED</code> for{' '}
              <strong>{election.id || election.electionId}</strong> only.
            </li>
            <li>
              Generate a non-sensitive demonstration reference (e.g.,{' '}
              <code className="font-mono">
                {isLokSabha ? 'DEMO-LS-000001' : 'DEMO-ASM-000001'}
              </code>
              ).
            </li>
            <li>
              Immediately discard your temporary candidate selection from browser
              memory without storing any candidate or party choice.
            </li>
            <li>
              Leave any other simultaneous election you are eligible for
              completely independent.
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
