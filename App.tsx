import React, { useState, useEffect, useMemo } from 'react';
import type { Subject, Problem } from './types';
import { v4 as uuidv4 } from 'uuid';
import ProblemGrid from './components/ProblemGrid';
import AIAssistant from './components/AIAssistant';
import { db } from './services/database';
// Use react-markdown only in AIAssistant to keep App clean, import icons
import { Trash2, Plus, ArrowLeft, BrainCircuit, CheckCircle2, Circle, Calendar, Repeat, BookOpen, Edit2, FileText, StickyNote, X } from 'lucide-react';

const DEFAULT_DSA_PROBLEMS = 250;

const App: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [notesModalProblem, setNotesModalProblem] = useState<{ subjectId: string; problem: Problem } | null>(null);
  const [notesContent, setNotesContent] = useState('');

  // Initialize Database and Load Data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await db.initialize();
        const loadedSubjects = await db.getAllSubjects();

        if (loadedSubjects.length === 0) {
          const defaultSubjects: Subject[] = [
            {
              id: uuidv4(),
              title: 'DSA',
              description: 'Data Structures and Algorithms Interview Prep',
              problems: [],
              createdAt: Date.now()
            },
            {
              id: uuidv4(),
              title: 'System Design (HLD)',
              description: 'High Level Design Concepts',
              problems: [],
              createdAt: Date.now()
            },
            {
              id: uuidv4(),
              title: 'LLD',
              description: 'Low Level Design & OOP',
              problems: [],
              createdAt: Date.now()
            }
          ];

          for (const subject of defaultSubjects) {
            await db.createSubject(subject);
          }

          setSubjects(defaultSubjects);
        } else {
          setSubjects(loadedSubjects);
        }

        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoaded(true);
      }
    };

    initializeApp();
  }, []);

  const activeSubject = useMemo(() =>
    subjects.find(s => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  const toggleProblem = async (subjectId: string, problemId: string) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id === problemId) {
            const updated = { ...p, isSolved: !p.isSolved };
            db.updateProblem(updated); // Persist to database
            return updated;
          }
          return p;
        })
      };
    }));
  };


  const markForRevision = async (subjectId: string, problemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id !== problemId) return p;

          let updated: Problem;
          // Toggle revision
          if (p.isForRevision) {
            const { isForRevision, revisionInterval, nextRevisionDate, ...rest } = p;
            updated = rest as Problem;
          } else {
            // Start revision schedule (1 day)
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + 1);
            nextDate.setHours(0, 0, 0, 0);

            updated = {
              ...p,
              isForRevision: true,
              revisionInterval: 1,
              nextRevisionDate: nextDate.getTime()
            };
          }

          db.updateProblem(updated); // Persist to database
          return updated;
        })
      };
    }));
  };

  const completeRevision = async (subjectId: string, problemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id !== problemId) return p;

          if (!p.revisionInterval) return p;

          let updated: Problem;
          let newInterval: number | undefined;

          if (p.revisionInterval === 1) newInterval = 4;
          else if (p.revisionInterval === 4) newInterval = 7;
          else {
            // Finished cycle
            const { isForRevision, revisionInterval, nextRevisionDate, ...rest } = p;
            updated = rest as Problem;
            db.updateProblem(updated); // Persist to database
            return updated;
          }

          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + newInterval);
          nextDate.setHours(0, 0, 0, 0);

          updated = {
            ...p,
            revisionInterval: newInterval,
            nextRevisionDate: nextDate.getTime()
          };

          db.updateProblem(updated); // Persist to database
          return updated;
        })
      };
    }));
  };

  const dueRevisions = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const due: { subject: Subject; problem: Problem }[] = [];

    subjects.forEach(subject => {
      subject.problems.forEach(problem => {
        if (problem.isForRevision) {
          console.log('dbg:', today, problem.nextRevisionDate, problem.nextRevisionDate <= today);
        }
        if (problem.isForRevision && problem.nextRevisionDate && problem.nextRevisionDate <= today) {
          console.log('inside');
          due.push({ subject, problem });
        }
      });
    });
    return due;
  }, [subjects]);

  const deleteSubject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this subject?')) {
      await db.deleteSubject(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
      if (selectedSubjectId === id) setSelectedSubjectId(null);
    }
  };

  const createSubject = async () => {
    const title = prompt("Enter Subject Name (e.g., 'React Internals'):");
    if (!title) return;

    const newSubject: Subject = {
      id: uuidv4(),
      title,
      description: 'New subject tracker',
      problems: [],
      createdAt: Date.now()
    };

    await db.createSubject(newSubject);
    setSubjects(prev => [...prev, newSubject]);
  };

  const addNewProblem = async (subjectId: string) => {
    const title = prompt("Enter task name:");
    if (!title || !title.trim()) return;

    const newProblem: Problem = {
      id: uuidv4(),
      title: title.trim(),
      isSolved: false
    };

    await db.createProblem(subjectId, newProblem);

    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: [...sub.problems, newProblem]
      };
    }));
  };

  const deleteProblem = async (subjectId: string, problemId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this task?')) return;

    await db.deleteProblem(problemId);

    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.filter(p => p.id !== problemId)
      };
    }));
  };

  const updateProblemTitle = async (subjectId: string, problemId: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id === problemId) {
            const updated = { ...p, title: newTitle };
            db.updateProblem(updated);
            return updated;
          }
          return p;
        })
      };
    }));
  };

  const updateProblemNotes = async (subjectId: string, problemId: string, notes: string) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id === problemId) {
            const updated = { ...p, notes };
            db.updateProblem(updated);
            return updated;
          }
          return p;
        })
      };
    }));
  };

  const handleStartEdit = (problem: Problem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProblemId(problem.id);
    setEditingTitle(problem.title);
  };

  const handleSaveEdit = async (subjectId: string, problemId: string) => {
    if (editingTitle.trim()) {
      await updateProblemTitle(subjectId, problemId, editingTitle);
    }
    setEditingProblemId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingProblemId(null);
    setEditingTitle('');
  };

  const openNotesModal = (subjectId: string, problem: Problem, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotesModalProblem({ subjectId, problem });
    setNotesContent(problem.notes || '');
  };

  const saveNotes = async () => {
    if (notesModalProblem) {
      await updateProblemNotes(notesModalProblem.subjectId, notesModalProblem.problem.id, notesContent);
      setNotesModalProblem(null);
      setNotesContent('');
    }
  };

  const closeNotesModal = () => {
    setNotesModalProblem(null);
    setNotesContent('');
  };

  const getProgressStats = (problems: Problem[]) => {
    const solved = problems.filter(p => p.isSolved).length;
    const total = problems.length;
    const percentage = total === 0 ? 0 : Math.round((solved / total) * 100);
    return { solved, total, percentage };
  };

  if (!isLoaded) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-emerald-500">Loading Tracker...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedSubjectId(null)}>
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              DevTracker
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>Prepare. Track. Succeed.</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Dashboard View */}
        {!activeSubject && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">Your Subjects</h2>
              <button
                onClick={createSubject}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>New Subject</span>
              </button>
            </div>

            {/* <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">Your Subjects</h2>
              <button
                onClick={createSubject}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>New Subject</span>
              </button>
            </div> */}

            {/* Today's Revisions Section */}
            {dueRevisions.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Revision Required</h3>
                    <p className="text-sm text-zinc-500">Spaced repetition for long-term memory</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {dueRevisions.map(({ subject, problem }) => (
                    <div key={problem.id} className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 hover:border-amber-500/30 transition-colors">
                      <div>
                        <p className="font-medium text-zinc-200">{problem.title}</p>
                        <p className="text-xs text-zinc-500">{subject.title} • {problem.revisionInterval} day interval</p>
                      </div>
                      <button
                        onClick={(e) => completeRevision(subject.id, problem.id, e)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white rounded-lg text-sm font-medium transition-all"
                      >
                        <BookOpen className="w-4 h-4" />
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map(subject => {
                const { solved, total, percentage } = getProgressStats(subject.problems);
                return (
                  <div
                    key={subject.id}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{subject.title}</h3>
                        <p className="text-sm text-zinc-500 mt-1">{subject.description}</p>
                      </div>
                      <button
                        onClick={(e) => deleteSubject(subject.id, e)}
                        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between mt-8">
                      <div>
                        <span className="text-3xl font-bold text-white">{percentage}%</span>
                        <span className="text-zinc-500 text-sm ml-2">Complete</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-zinc-300">{solved} / {total}</div>
                        <div className="text-xs text-zinc-600 uppercase tracking-wider mt-1">Problems</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Card Placeholder */}
              <button
                onClick={createSubject}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300 h-full min-h-[200px]"
              >
                <Plus className="w-10 h-10 mb-2" />
                <span className="font-medium">Add Subject</span>
              </button>
            </div>
          </div>
        )}

        {/* Detail View */}
        {activeSubject && (
          <div className="animate-fade-in-up">
            {/* Nav & Header */}
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setSelectedSubjectId(null)}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white">{activeSubject.title}</h2>
                <div className="flex items-center gap-4 mt-2">
                  <div className="h-2 w-48 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${getProgressStats(activeSubject.problems).percentage}%` }}
                    />
                  </div>
                  <span className="text-emerald-400 font-mono text-sm">
                    {getProgressStats(activeSubject.problems).percentage}% Done
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => addNewProblem(activeSubject.id)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-semibold">Add Task</span>
                </button>

                <button
                  onClick={() => setIsAiOpen(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105"
                >
                  <BrainCircuit className="w-5 h-5" />
                  <span className="font-semibold">Ask AI Tutor</span>
                </button>
              </div>
            </div>

            {/* Grid Visualization */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-zinc-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Progress Grid
                </h3>
                <span className="text-xs text-zinc-500">Click a box to toggle status</span>
              </div>
              <ProblemGrid
                problems={activeSubject.problems}
                onToggle={(pid) => toggleProblem(activeSubject.id, pid)}
              />
              <div className="flex gap-4 mt-3 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-zinc-800 rounded-sm"></div>
                  <span>Unsolved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                  <span>Solved</span>
                </div>
              </div>
            </div>

            {/* Problem List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                <h3 className="font-semibold text-white">Problem List</h3>
                <span className="text-xs text-zinc-500 font-mono">{activeSubject.problems.length} Items</span>
              </div>
              <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
                {activeSubject.problems.map((problem, index) => (
                  <div
                    key={problem.id}
                    onClick={() => editingProblemId !== problem.id && toggleProblem(activeSubject.id, problem.id)}
                    className={`
                      group flex items-center gap-4 p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors
                      ${problem.isSolved ? 'bg-emerald-900/10' : ''}
                    `}
                  >
                    <div className="flex-shrink-0 w-8 text-center text-sm font-mono text-zinc-600 group-hover:text-zinc-400">
                      {index + 1}
                    </div>
                    <div className="flex-shrink-0">
                      {problem.isSolved ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      {editingProblemId === problem.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleSaveEdit(activeSubject.id, problem.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(activeSubject.id, problem.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="flex-1 bg-zinc-800 text-zinc-200 px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <div className={`text-sm font-medium transition-colors flex-1 ${problem.isSolved ? 'text-zinc-400 line-through' : 'text-zinc-200'}`}>
                            {problem.title}
                          </div>
                          {problem.notes && (
                            <span title="Has notes">
                              <StickyNote className="w-4 h-4 text-amber-500/70" />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                      <button
                        onClick={(e) => handleStartEdit(problem, e)}
                        className="p-1.5 text-zinc-600 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                        title="Edit title (Double-click)"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => openNotesModal(activeSubject.id, problem, e)}
                        className="p-1.5 text-zinc-600 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                        title="Add/edit notes"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => deleteProblem(activeSubject.id, problem.id, e)}
                        className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => markForRevision(activeSubject.id, problem.id, e)}
                        className={`p-1.5 rounded-lg transition-colors ${problem.isForRevision
                          ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'text-zinc-600 hover:text-amber-500 hover:bg-zinc-800'
                          }`}
                        title={problem.isForRevision ? `Next review: ${new Date(problem.nextRevisionDate!).toLocaleDateString()}` : "Mark for spaced repetition"}
                      >
                        <Repeat className="w-4 h-4" />
                      </button>

                      <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                        {problem.isSolved ? 'Mark Unsolved' : 'Mark Solved'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Notes Modal */}
      {notesModalProblem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Notes
                </h3>
                <p className="text-sm text-zinc-500 mt-1">{notesModalProblem.problem.title}</p>
              </div>
              <button
                onClick={closeNotesModal}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={notesContent}
                onChange={(e) => setNotesContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeNotesModal();
                  if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    saveNotes();
                  }
                }}
                placeholder="Add notes, links, or study references here..."
                className="w-full h-64 bg-zinc-800/50 text-zinc-200 border border-zinc-700 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-zinc-600"
                autoFocus
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-zinc-600">
                  <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">Ctrl+S</kbd> to save • <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">Esc</kbd> to close
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={closeNotesModal}
                    className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNotes}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Sidebar */}
      <AIAssistant
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        subjectTitle={activeSubject?.title || 'General'}
      />

    </div>
  );
};

export default App;
