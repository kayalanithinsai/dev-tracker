import React from 'react';
import { Problem } from '../types';

interface ProblemGridProps {
  problems: Problem[];
  onToggle: (id: string) => void;
}

const ProblemGrid: React.FC<ProblemGridProps> = ({ problems, onToggle }) => {
  return (
    <div className="grid grid-cols-10 sm:grid-cols-12 md:grid-cols-15 lg:grid-cols-20 gap-1.5 p-4 bg-zinc-900 rounded-xl border border-zinc-800 overflow-y-auto max-h-[300px]">
      {problems.map((problem, index) => (
        <div
          key={problem.id}
          onClick={() => onToggle(problem.id)}
          title={`${index + 1}. ${problem.title} (${problem.isSolved ? 'Solved' : 'Unsolved'})`}
          className={`
            aspect-square rounded-sm cursor-pointer transition-all duration-200 ease-in-out
            hover:scale-125 hover:z-10 relative group
            ${problem.isSolved 
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
              : 'bg-zinc-800 hover:bg-zinc-700'}
          `}
        >
          {/* Tooltip for better UX on hover */}
          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] z-50">
            <div className="bg-black text-white text-xs px-2 py-1 rounded border border-zinc-700 shadow-xl truncate">
              #{index + 1}: {problem.title}
            </div>
            <div className="w-2 h-2 bg-black border-r border-b border-zinc-700 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProblemGrid;
