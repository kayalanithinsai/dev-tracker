import React from 'react';
import { Problem } from '../types';

interface ProblemGridProps {
  problems: Problem[];
  onToggle: (id: string) => void;
}

const ProblemGrid: React.FC<ProblemGridProps> = ({ problems, onToggle }) => {
  const getStatus = (problem: Problem) => {
    if (problem.revisionCompleted) return 'completed';
    if (problem.isForRevision) return 'revision';
    if (problem.isSolved) return 'solved';
    return 'unsolved';
  };

  const statusStyles = {
    unsolved: 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700',
    solved: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.25)]',
    revision: 'bg-amber-500 hover:bg-amber-400 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
    completed: 'bg-sky-500 hover:bg-sky-400 border-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.25)]'
  };

  return (
    <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 gap-1.5 p-4 bg-zinc-900 rounded-xl border border-zinc-800 overflow-y-auto max-h-[300px]">
      {problems.map((problem, index) => {
        const status = getStatus(problem);
        return (
          <button
            key={problem.id}
            type="button"
            onClick={() => onToggle(problem.id)}
            title={`${index + 1}. ${problem.title} — ${
              status === 'completed' ? 'Revision completed' :
              status === 'revision' ? `In revision (${problem.revisionInterval || 1} day cycle)` :
              status === 'solved' ? 'Solved' : 'Unsolved'
            }`}
            aria-label={`${problem.title}: ${status}`}
            className={`aspect-square rounded-sm border cursor-pointer transition-all duration-200 ease-in-out hover:scale-125 hover:z-10 relative group flex items-center justify-center ${statusStyles[status]}`}
          >
            <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] z-50 pointer-events-none">
              <span className="block bg-black text-white text-xs px-2 py-1 rounded border border-zinc-700 shadow-xl truncate">
                #{index + 1}: {problem.title}
              </span>
              <span className="block w-2 h-2 bg-black border-r border-b border-zinc-700 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ProblemGrid;
